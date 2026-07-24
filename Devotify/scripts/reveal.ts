 import { network } from "hardhat"; 
 const DEVOTIFY_VOTING_ADDRESS = "0x8460b57d763dea51a308979845bb10e951450703"; 
 async function main() { 
    const { viem } = await network.connect("sepolia"); 
    const publicClient = await viem.getPublicClient(); 
    const devotifyVoting = await viem.getContractAt("DevotifyVoting", DEVOTIFY_VOTING_ADDRESS); 
    const eventId = (await devotifyVoting.read.eventCount()) - 1n; 
    
    console.log("Revealing results for event ID:", eventId); 
    
    const hash = await devotifyVoting.write.revealResults([eventId]); 
    await publicClient.waitForTransactionReceipt({ hash }); 
    console.log("Results revealed."); 
    
    const results = await devotifyVoting.read.getResults([eventId]); 
    const resultsHash = await devotifyVoting.read.getResultsHash([eventId]); 

    console.log("Tally:", results); 
    console.log("Results hash:", resultsHash); } 
    
    main().catch((error) => { console.error(error); 
        process.exitCode = 1; }
    );