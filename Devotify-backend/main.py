import os
import json
import sqlite3
import secrets
from pathlib import Path
from indexer_task import start_indexer_thread
import bcrypt
from dotenv import load_dotenv
from web3 import Web3
from eth_abi import encode
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from relayer import register_voter_by_id, vote_by_id

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR))
DB_PATH = DATA_DIR / "devotify.db"
ABI_PATH = BASE_DIR / "devotify_voting_abi.json"

# --- Set up the chain connection and contract ONCE, at startup ---
RPC_URL = os.getenv("SEPOLIA_RPC_URL")
CONTRACT_ADDRESS = os.getenv("DEVOTIFY_VOTING_ADDRESS")

w3 = Web3(Web3.HTTPProvider(RPC_URL))

with open(ABI_PATH) as f:
    abi_data = json.load(f)
abi = abi_data["abi"] if isinstance(abi_data, dict) else abi_data

contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)


app = FastAPI(title="Devotify Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Shared helpers ---

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def normalize_hash(h) -> str:
    if h is None:
        return ""
    h = h[2:] if isinstance(h, str) and (h.startswith("0x") or h.startswith("0X")) else h
    return str(h).lower()


def get_event_options(event_id: int) -> list:
    options = []
    i = 0
    while True:
        try:
            option = contract.functions.eventOptions(event_id, i).call()
            options.append(option)
            i += 1
        except Exception:
            break
    return options


def get_or_create_event_salt(event_id: int) -> str:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT salt FROM event_salts WHERE event_id = ?", (event_id,))
        row = cursor.fetchone()
        if row:
            return row["salt"]
        salt = secrets.token_hex(16)
        cursor.execute("INSERT INTO event_salts (event_id, salt) VALUES (?, ?)", (event_id, salt))
        conn.commit()
        return salt
    finally:
        conn.close()


# --- Table setup ---

def init_eligibility_tables():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS event_salts (
                event_id INTEGER PRIMARY KEY,
                salt TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eligible_voters (
                event_id INTEGER,
                identity_key TEXT,
                voter_id TEXT,
                used INTEGER DEFAULT 0,
                PRIMARY KEY (event_id, identity_key)
            )
        """)
        conn.commit()
    finally:
        conn.close()     
        
def init_credential_table():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS credential_voters (
                event_id INTEGER,
                identity_key TEXT,
                password_hash TEXT,
                voter_id TEXT,
                used INTEGER DEFAULT 0,
                PRIMARY KEY (event_id, identity_key)
            )
        """)
        conn.commit()
    finally:
        conn.close()


init_eligibility_tables()
init_credential_table()
start_indexer_thread(w3, contract, get_db_connection)

# --- Basic read endpoints ---

@app.get("/")
def read_root() -> dict:
    return {"status": "ok", "service": "devotify-backend"}


@app.get("/events")
def list_events() -> dict:
    event_count = contract.functions.eventCount().call()

    events = []
    for event_id in range(event_count):
        creator, topic, registration_deadline, voting_deadline, deposit_amount, results_revealed = (
            contract.functions.events(event_id).call()
        )
        events.append({
            "event_id": event_id,
            "topic": topic,
            "creator": creator,
            "registration_deadline": registration_deadline,
            "voting_deadline": voting_deadline,
            "results_revealed": results_revealed,
        })

    return {"count": event_count, "events": events}


@app.get("/events/{event_id}")
def get_event_details(event_id: int) -> dict:
    event_count = contract.functions.eventCount().call()
    if event_id >= event_count or event_id < 0:
        raise HTTPException(status_code=404, detail="Event not found")

    creator, topic, registration_deadline, voting_deadline, deposit_amount, results_revealed = (
        contract.functions.events(event_id).call()
    )
    options = get_event_options(event_id)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM voter_registrations WHERE event_id = ?", (event_id,))
        registration_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM votes WHERE event_id = ?", (event_id,))
        vote_count = cursor.fetchone()["count"]
    finally:
        conn.close()

    return {
        "event_id": event_id,
        "topic": topic,
        "options": options,
        "creator": creator,
        "registration_deadline": registration_deadline,
        "voting_deadline": voting_deadline,
        "deposit_amount": str(deposit_amount),
        "results_revealed": results_revealed,
        "registration_count": registration_count,
        "vote_count": vote_count,
    }


@app.get("/events/{event_id}/results")
def get_event_results(event_id: int) -> dict:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT option_index, COUNT(*) as vote_count FROM votes WHERE event_id = ? GROUP BY option_index",
            (event_id,),
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    results = {row["option_index"]: row["vote_count"] for row in rows}
    return {"event_id": event_id, "results": results}


@app.get("/events/{event_id}/verify")
def verify_event_results(event_id: int) -> dict:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT results_hash FROM results_revealed WHERE event_id = ?", (event_id,))
        row = cursor.fetchone()
        if row is None:
            return {"event_id": event_id, "verified": False, "reason": "Results not revealed yet"}
        onchain_hash = row["results_hash"]

        cursor.execute(
            "SELECT option_index, COUNT(*) as vote_count FROM votes WHERE event_id = ? GROUP BY option_index",
            (event_id,),
        )
        vote_rows = cursor.fetchall()
    finally:
        conn.close()

    options = get_event_options(event_id)
    tally = [0] * len(options)
    for r in vote_rows:
        tally[r["option_index"]] = r["vote_count"]

    encoded = encode(["uint256[]"], [tally])
    computed_hash = Web3.keccak(encoded).hex()
    verified = normalize_hash(computed_hash) == normalize_hash(onchain_hash)

    return {
        "event_id": event_id,
        "tally_from_our_database": tally,
        "computed_hash": computed_hash,
        "onchain_hash": onchain_hash,
        "verified": verified,
    }


# --- Eligibility system (identity key only, self-service registration) ---

class EligibleVotersRequest(BaseModel):
    identity_keys: list[str]


@app.post("/events/{event_id}/eligible-voters")
def add_eligible_voters(event_id: int, body: EligibleVotersRequest) -> dict:
    salt = get_or_create_event_salt(event_id)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        added = 0
        for identity_key in body.identity_keys:
            voter_id_hex = Web3.keccak(text=f"{identity_key}:{salt}").hex()
            cursor.execute(
                "INSERT OR IGNORE INTO eligible_voters (event_id, identity_key, voter_id, used) VALUES (?, ?, ?, 0)",
                (event_id, identity_key, voter_id_hex),
            )
            added += cursor.rowcount
        conn.commit()
    finally:
        conn.close()
    return {"event_id": event_id, "added": added, "total_submitted": len(body.identity_keys)}


class RegisterByIdRequest(BaseModel):
    identity_key: str


@app.post("/events/{event_id}/register-by-id")
def register_by_id(event_id: int, body: RegisterByIdRequest) -> dict:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT voter_id, used FROM eligible_voters WHERE event_id = ? AND identity_key = ?",
            (event_id, body.identity_key),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Not eligible for this event")
        if row["used"]:
            raise HTTPException(status_code=409, detail="This identity has already registered")
        voter_id_hex = row["voter_id"]
    finally:
        conn.close()

    voter_id_bytes = bytes.fromhex(voter_id_hex[2:] if voter_id_hex.startswith("0x") else voter_id_hex)
    try:
        result = register_voter_by_id(event_id, voter_id_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"On-chain registration failed: {str(e)}")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE eligible_voters SET used = 1 WHERE event_id = ? AND identity_key = ?",
            (event_id, body.identity_key),
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "registered", "event_id": event_id, "tx_hash": result["tx_hash"]}


class VoteByIdRequest(BaseModel):
    identity_key: str
    option_index: int


@app.post("/events/{event_id}/vote-by-id")
def submit_vote_by_id(event_id: int, body: VoteByIdRequest) -> dict:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT voter_id FROM eligible_voters WHERE event_id = ? AND identity_key = ?",
            (event_id, body.identity_key),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Not eligible for this event")
        voter_id_hex = row["voter_id"]
    finally:
        conn.close()

    voter_id_bytes = bytes.fromhex(voter_id_hex[2:] if voter_id_hex.startswith("0x") else voter_id_hex)

    try:
        result = vote_by_id(event_id, body.option_index, voter_id_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"On-chain vote failed: {str(e)}")

    return {"status": "voted", "event_id": event_id, "option_index": body.option_index, "tx_hash": result["tx_hash"]}


# --- Credential system (identity key + password, combined authenticate-and-vote) ---

class VoterCredential(BaseModel):
    identity_key: str
    password: str


class CredentialVotersRequest(BaseModel):
    credentials: list[VoterCredential]


@app.post("/events/{event_id}/credential-voters")
def add_credential_voters(event_id: int, body: CredentialVotersRequest) -> dict:
    salt = get_or_create_event_salt(event_id)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        added = 0
        newly_added_voter_ids = []

        for cred in body.credentials:
            voter_id_hex = Web3.keccak(text=f"{cred.identity_key}:{salt}").hex()
            password_hash = bcrypt.hashpw(cred.password.encode(), bcrypt.gensalt()).decode()

            cursor.execute(
                "INSERT OR IGNORE INTO credential_voters (event_id, identity_key, password_hash, voter_id, used) VALUES (?, ?, ?, ?, 0)",
                (event_id, cred.identity_key, password_hash, voter_id_hex),
            )

            if cursor.rowcount > 0:
                added += 1
                newly_added_voter_ids.append(voter_id_hex)

        conn.commit()
    finally:
        conn.close()

    # Register each newly added voter on-chain immediately, right now, while
    # the registration window is guaranteed to still be open (we're inside
    # event creation/setup). Voters never have to register themselves later.
    registration_errors = []
    for voter_id_hex in newly_added_voter_ids:
        voter_id_bytes = bytes.fromhex(
            voter_id_hex[2:] if voter_id_hex.startswith("0x") else voter_id_hex
        )
        try:
            register_voter_by_id(event_id, voter_id_bytes)
        except Exception as e:
            registration_errors.append(str(e))

    return {
        "event_id": event_id,
        "added": added,
        "total_submitted": len(body.credentials),
        "registration_errors": registration_errors,
    }


class AuthenticateAndVoteRequest(BaseModel):
    identity_key: str
    password: str
    option_index: int


@app.post("/events/{event_id}/authenticate-and-vote")
def authenticate_and_vote(event_id: int, body: AuthenticateAndVoteRequest) -> dict:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT password_hash, voter_id FROM credential_voters WHERE event_id = ? AND identity_key = ?",
            (event_id, body.identity_key),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="No such voter for this event")
        if not bcrypt.checkpw(body.password.encode(), row["password_hash"].encode()):
            raise HTTPException(status_code=401, detail="Incorrect password")
        voter_id_hex = row["voter_id"]
    finally:
        conn.close()
    voter_id_bytes = bytes.fromhex(voter_id_hex[2:] if voter_id_hex.startswith("0x") else voter_id_hex)
    try:
        result = vote_by_id(event_id, body.option_index, voter_id_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"On-chain vote failed: {str(e)}")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE credential_voters SET used = 1 WHERE event_id = ? AND identity_key = ?",
            (event_id, body.identity_key),
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "voted", "event_id": event_id, "option_index": body.option_index, "tx_hash": result["tx_hash"]}