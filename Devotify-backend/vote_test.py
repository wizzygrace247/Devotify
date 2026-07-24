from web3 import Web3
from relayer import vote_by_id

event_id = 1
voter_id = Web3.keccak(text="student-12345")

print("Voting...")
result = vote_by_id(event_id, 0, voter_id)
print("Result:", result)