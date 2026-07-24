from web3 import Web3 
from relayer import register_voter_by_id 


event_id = 1
# the fresh event just created on the new contract 
 
voter_id = Web3.keccak(text="student-12345") 
print("Voter ID:", voter_id.hex()) 
print("Registering...") 

result = register_voter_by_id(event_id, voter_id) 
print("Result:", result)