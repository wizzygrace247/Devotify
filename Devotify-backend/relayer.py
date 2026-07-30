import os
import json
import time
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

contract = w3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=abi,
)

relayer_account = w3.eth.account.from_key(RELAYER_PRIVATE_KEY)


def send_relayer_transaction(function_call, max_retries: int = 3):
    """Build, sign, send, and wait for a relayer transaction."""
    last_error = None

    for attempt in range(max_retries):
        try:
            nonce = w3.eth.get_transaction_count(relayer_account.address, "pending")
            gas_estimate = function_call.estimate_gas({"from": relayer_account.address})

            tx = function_call.build_transaction(
                {
                    "from": relayer_account.address,
                    "nonce": nonce,
                    "gas": int(gas_estimate * 1.2),
                    "maxFeePerGas": w3.eth.gas_price * 2,
                    "maxPriorityFeePerGas": w3.to_wei(1, "gwei"),
                }
            )

            signed_tx = w3.eth.account.sign_transaction(tx, RELAYER_PRIVATE_KEY)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

            if receipt.status != 1:
                raise Exception(
                    f"Transaction reverted on-chain. tx_hash={tx_hash.hex()}"
                )

            return receipt

        except Exception as e:
            last_error = e
            # brief pause, then retry (helps with nonce / RPC flakiness)
            time.sleep(1.5 * (attempt + 1))

    raise Exception(f"Relayer transaction failed after {max_retries} attempts: {last_error}")


def register_voter_by_id(event_id: int, voter_id: bytes) -> dict:
    function_call = contract.functions.registerForEventById(event_id, voter_id)
    receipt = send_relayer_transaction(function_call)
    return {
        "tx_hash": receipt.transactionHash.hex(),
        "status": receipt.status,
    }


def vote_by_id(event_id: int, option_index: int, voter_id: bytes) -> dict:
    function_call = contract.functions.castVoteById(event_id, option_index, voter_id)
    receipt = send_relayer_transaction(function_call)
    return {
        "tx_hash": receipt.transactionHash.hex(),
        "status": receipt.status,
    }