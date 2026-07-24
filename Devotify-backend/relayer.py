import os
import json
from pathlib import Path
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
ABI_PATH = BASE_DIR / "devotify_voting_abi.json"

RPC_URL = os.getenv("SEPOLIA_RPC_URL")
CONTRACT_ADDRESS = os.getenv("DEVOTIFY_VOTING_ADDRESS")
RELAYER_PRIVATE_KEY = os.getenv("RELAYER_PRIVATE_KEY")

w3 = Web3(Web3.HTTPProvider(RPC_URL))

with open(ABI_PATH) as f:
    abi_data = json.load(f)
abi = abi_data["abi"] if isinstance(abi_data, dict) else abi_data

contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)

relayer_account = w3.eth.account.from_key(RELAYER_PRIVATE_KEY)


def send_relayer_transaction(function_call):
    """Build, sign, and send a transaction from the relayer account."""
    tx = function_call.build_transaction({
        "from": relayer_account.address,
        "nonce": w3.eth.get_transaction_count(relayer_account.address),
    })

    signed_tx = w3.eth.account.sign_transaction(tx, RELAYER_PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return receipt


def register_voter_by_id(event_id: int, voter_id: bytes) -> dict:
    function_call = contract.functions.registerForEventById(event_id, voter_id)
    receipt = send_relayer_transaction(function_call)
    return {"tx_hash": receipt.transactionHash.hex(), "status": receipt.status}


def vote_by_id(event_id: int, option_index: int, voter_id: bytes) -> dict:
    function_call = contract.functions.castVoteById(event_id, option_index, voter_id)
    receipt = send_relayer_transaction(function_call)
    return {"tx_hash": receipt.transactionHash.hex(), "status": receipt.status}