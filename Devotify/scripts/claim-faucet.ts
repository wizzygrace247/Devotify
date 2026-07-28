import { network } from "hardhat"; 
 
const FAUCET_ADDRESS = "0x520359047a53f5f1b2d61feb4b9c528a7cbbef40"; 
async function main() { 
    const { viem } = await network.connect("sepolia"); 
    const publicClient = await viem.getPublicClient(); 
    const faucet = await viem.getContractAt("Faucet", FAUCET_ADDRESS); 
    
    console.log("Claiming from faucet..."); 
    const hash = await faucet.write.claim(); 
    await publicClient.waitForTransactionReceipt({ hash }); 
    console.log("Claim successful!"); 
} 
main().catch((error) => { 
    console.error(error); 
    process.exitCode = 1; 
});