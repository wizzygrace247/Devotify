import os
import json
import requests
import time 
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

rpc_url = os.getenv("SEPOLIA_RPC_URL")
contract_address = os.getenv("DEVOTIFY_VOTING_ADDRESS")

w3 = Web3(Web3.HTTPProvider(rpc_url))

with open("devotify_voting_abi.json") as f:
    abi_data = json.load(f)

abi = abi_data["abi"] if isinstance(abi_data, dict) else abi_data

contract = w3.eth.contract(
    address=Web3.to_checksum_address(contract_address),
    abi=abi,
)

# --- Basic reads ---

event_count = contract.functions.eventCount().call()
print("Total voting events on-chain:", event_count)

event_data = contract.functions.events(0).call()
print("Event 0 details:", event_data)

# --- Event log queries ---

from_block = w3.eth.block_number - 9

try:
    registered_logs = contract.events.VoterRegistered().get_logs(from_block=from_block, to_block="latest")
    print(f"\nVoterRegistered events found: {len(registered_logs)}")
    for log in registered_logs:
        print(" ", log.args)
except requests.exceptions.HTTPError as e:
    print("\nVoterRegistered query failed. Alchemy error response:", e.response.text)

try:
    vote_logs = contract.events.VoteCast().get_logs(from_block=from_block, to_block="latest")
    print(f"\nVoteCast events found: {len(vote_logs)}")
    for log in vote_logs:
        print(" ", log.args)
except requests.exceptions.HTTPError as e:
    print("\nVoteCast query failed. Alchemy error response:", e.response.text)

try:
    reveal_logs = contract.events.ResultsRevealed().get_logs(from_block=from_block, to_block="latest")
    print(f"\nResultsRevealed events found: {len(reveal_logs)}")
    for log in reveal_logs:
        print(" ", log.args)
except requests.exceptions.HTTPError as e:
    print("\nResultsRevealed query failed. Alchemy error response:", e.response.text)
    

    event_id = 2 
    event_data = contract.functions.events(event_id).call() 
    registration_deadline = event_data[1] 
    voting_deadline = event_data[3] 
    now = int(time.time()) 
    print("\nNow:", now) 
    print("Registration deadline:", registration_deadline, "- passed:", now > registration_deadline) 
    print("Voting deadline:", voting_deadline, "- passed:", now > voting_deadline)