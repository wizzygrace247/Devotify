import time
import threading
from pathlib import Path
import json
BASE_DIR = Path(__file__).resolve().parent
import os 

DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR)) 
STATE_FILE = DATA_DIR / "indexer_state.json"
CHUNK_SIZE = 9
POLL_INTERVAL_SECONDS = 20


def load_last_synced_block(w3):
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)["last_synced_block"]
    return w3.eth.block_number - CHUNK_SIZE


def save_last_synced_block(block_number):
    with open(STATE_FILE, "w") as f:
        json.dump({"last_synced_block": block_number}, f)


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
                    "INSERT INTO voter_registrations (event_id, voter_id, block_number) VALUES (?, ?, ?)",
                    (log.args.eventId, log.args.voterId.hex(), log.blockNumber),
                )
            elif event_name == "VoteCast":
                cursor.execute(
                    "INSERT INTO votes (event_id, voter_id, option_index, block_number) VALUES (?, ?, ?, ?)",
                    (
                        log.args.eventId,
                        log.args.voterId.hex(),
                        log.args.optionIndex,
                        log.blockNumber,
                    ),
                )
            elif event_name == "ResultsRevealed":
                cursor.execute(
                    "INSERT INTO results_revealed (event_id, results_hash, block_number) VALUES (?, ?, ?)",
                    (log.args.eventId, log.args.resultsHash.hex(), log.blockNumber),
                )
    conn.commit()


def run_indexer_loop(w3, contract, get_db_connection):
    init_indexer_tables(get_db_connection)
    print("[indexer] Background indexer thread started.")
    while True:
        try:
            last_synced = load_last_synced_block(w3)
            latest = w3.eth.block_number
            if last_synced < latest:
                conn = get_db_connection()
                try:
                    while last_synced < latest:
                        chunk_end = min(last_synced + CHUNK_SIZE, latest)
                        process_chunk(conn, contract, last_synced + 1, chunk_end)
                        last_synced = chunk_end
                        save_last_synced_block(last_synced)
                finally:
                    conn.close()
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