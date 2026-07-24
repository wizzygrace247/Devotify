import os
import json
import sqlite3
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

STATE_FILE = "indexer_state.json"
CHUNK_SIZE = 9  # Alchemy free tier max range for eth_getLogs

rpc_url = os.getenv("SEPOLIA_RPC_URL")
contract_address = os.getenv("DEVOTIFY_VOTING_ADDRESS")

w3 = Web3(Web3.HTTPProvider(rpc_url))

with open("devotify_voting_abi.json") as f:
    abi_data = json.load(f)
abi = abi_data["abi"] if isinstance(abi_data, dict) else abi_data

contract = w3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=abi)


def init_db():
    conn = sqlite3.connect("devotify.db")
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
    return conn


def load_last_synced_block():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)["last_synced_block"]
    return w3.eth.block_number - CHUNK_SIZE


def save_last_synced_block(block_number):
    with open(STATE_FILE, "w") as f:
        json.dump({"last_synced_block": block_number}, f)


def process_chunk(conn, from_block, to_block):
    """Process events for a block range."""
    cursor = conn.cursor()

    for event_name in ["VoterRegistered", "VoteCast", "ResultsRevealed"]:
        event = getattr(contract.events, event_name)
        logs = event().get_logs(from_block=from_block, to_block=to_block)

        for log in logs:
            print(f"[{event_name}] block {log.blockNumber}: {dict(log.args)}")

            if event_name == "VoterRegistered":
                cursor.execute(
                    "INSERT INTO voter_registrations (event_id, voter_id, block_number) VALUES (?, ?, ?)",
                    (log.args.eventId, log.args.voterId.hex(), log.blockNumber),
                )
            elif event_name == "VoteCast":
                cursor.execute(
                    "INSERT INTO votes (event_id, voter_id, option_index, block_number) VALUES (?, ?, ?, ?)",
                    (log.args.eventId, log.args.voterId.hex(), log.args.optionIndex, log.blockNumber),
                )
            elif event_name == "ResultsRevealed":
                cursor.execute(
                    "INSERT INTO results_revealed (event_id, results_hash, block_number) VALUES (?, ?, ?)",
                    (log.args.eventId, log.args.resultsHash.hex(), log.blockNumber),
                )

    conn.commit()


def run_indexer():
    conn = init_db()
    last_synced = load_last_synced_block()
    latest = w3.eth.block_number

    while last_synced < latest:
        chunk_end = min(last_synced + CHUNK_SIZE, latest)
        print(f"Scanning blocks {last_synced + 1} to {chunk_end}...")
        process_chunk(conn, last_synced + 1, chunk_end)
        last_synced = chunk_end
        save_last_synced_block(last_synced)

    conn.close()
    print("Caught up. Last synced block:", last_synced)


if __name__ == "__main__":
    run_indexer()