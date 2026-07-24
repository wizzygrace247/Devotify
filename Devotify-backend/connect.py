import os
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

rpc_url = os.getenv("SEPOLIA_RPC_URL")
w3 = Web3(Web3.HTTPProvider(rpc_url))
print("Connected:", w3.is_connected())
print("Chain ID:", w3.eth.chain_id)
print("Latest block:", w3.eth.block_number)