import os
import time
import threading

CHUNK_SIZE = 9  # Alchemy free tier max range for eth_getLogs
POLL_INTERVAL_SECONDS = 20

# If the indexer ever starts with an empty `indexer_state` table (fresh DB,
# first deploy, or a manual reset), it replays from this block instead of
# `latest - CHUNK_SIZE`. Set this to the block your DevotifyVoting contract
# was deployed at (check the deploy tx on Sepolia Etherscan) so a cold start
# rebuilds the *full* history instead of silently only counting new votes.
DEPLOY_BLOCK_ENV = "DEVOTIFY_DEPLOY_BLOCK"


def load_last_synced_block(w3, get_db_connection):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT last_synced_block FROM indexer_state WHERE id = 1")
        row = cursor.fetchone()
        if row:
            return row["last_synced_block"]
    finally:
        conn.close()

    deploy_block = os.getenv(DEPLOY_BLOCK_ENV)
    if deploy_block:
        return int(deploy_block)
    return w3.eth.block_number - CHUNK_SIZE


def save_last_synced_block(get_db_connection, block_number):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO indexer_state (id, last_synced_block) VALUES (1, %s)
            ON CONFLICT (id) DO UPDATE SET last_synced_block = EXCLUDED.last_synced_block
            """,
            (block_number,),
        )
        conn.commit()
    finally:
        conn.close()


def init_indexer_tables(get_db_connection):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS voter_registrations (
                event_id INTEGER,
                voter_id TEXT,
                block_number INTEGER
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                event_id INTEGER,
                voter_id TEXT,
                option_index INTEGER,
                block_number INTEGER
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS results_revealed (
                event_id INTEGER,
                results_hash TEXT,
                block_number INTEGER
            )
        """)
        # Replaces indexer_state.json. Single row (id=1) holding the cursor.
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS indexer_state (
                id INTEGER PRIMARY KEY,
                last_synced_block BIGINT NOT NULL
            )
        """)

        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_voter_registrations_unique ON voter_registrations(event_id, voter_id)"
        )
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique ON votes(event_id, voter_id)"
        )
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_results_revealed_unique ON results_revealed(event_id)"
        )

        conn.commit()
    finally:
        conn.close()


def process_chunk(conn, contract, from_block, to_block):
    cursor = conn.cursor()
    for event_name in ["VoterRegistered", "VoteCast", "ResultsRevealed"]:
        event = getattr(contract.events, event_name)
        logs = event().get_logs(from_block=from_block, to_block=to_block)
        for log in logs:
            print(f"[indexer] [{event_name}] block {log.blockNumber}: {dict(log.args)}")
            if event_name == "VoterRegistered":
                cursor.execute(
                    """
                    INSERT INTO voter_registrations (event_id, voter_id, block_number)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (event_id, voter_id) DO NOTHING
                    """,
                    (log.args.eventId, log.args.voterId.hex(), log.blockNumber),
                )
            elif event_name == "VoteCast":
                cursor.execute(
                    """
                    INSERT INTO votes (event_id, voter_id, option_index, block_number)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (event_id, voter_id) DO NOTHING
                    """,
                    (
                        log.args.eventId,
                        log.args.voterId.hex(),
                        log.args.optionIndex,
                        log.blockNumber,
                    ),
                )
            elif event_name == "ResultsRevealed":
                cursor.execute(
                    """
                    INSERT INTO results_revealed (event_id, results_hash, block_number)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (event_id) DO NOTHING
                    """,
                    (log.args.eventId, log.args.resultsHash.hex(), log.blockNumber),
                )
    conn.commit()


def run_indexer_loop(w3, contract, get_db_connection):
    init_indexer_tables(get_db_connection)
    print("[indexer] Background indexer thread started.")
    while True:
        try:
            last_synced = load_last_synced_block(w3, get_db_connection)
            latest = w3.eth.block_number
            while last_synced < latest:
                chunk_end = min(last_synced + CHUNK_SIZE, latest)
                conn = get_db_connection()
                try:
                    process_chunk(conn, contract, last_synced + 1, chunk_end)
                finally:
                    conn.close()
                last_synced = chunk_end
                save_last_synced_block(get_db_connection, last_synced)
        except Exception as e:
            print(f"[indexer] Error during scan: {e}")
        time.sleep(POLL_INTERVAL_SECONDS)


def start_indexer_thread(w3, contract, get_db_connection):
    thread = threading.Thread(
        target=run_indexer_loop,
        args=(w3, contract, get_db_connection),
        daemon=True,
    )
    thread.start()