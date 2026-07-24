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

w3 = Web3(Web3.HTTPProvider(RPC_URL))

with open(ABI_PATH) as f:
    abi_data = json.load(f)
abi = abi_data["abi"] if isinstance(abi_data, dict) else abi_data

contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)

event_id = 1
event_data = contract.functions.events(event_id).call()
registration_deadline = event_data[2]
voting_deadline = event_data[3]
now = int(time.time())

print("Now:", now)
print("Registration deadline:", registration_deadline, "- passed:", now > registration_deadline)
print("Voting deadline:", voting_deadline, "- passed:", now > voting_deadline)