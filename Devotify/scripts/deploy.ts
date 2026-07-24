import { network } from "hardhat";

async function main() {
    const { viem } = await network.connect("sepolia");
    const [deployer] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    console.log(`Deploying DVY token from ${deployer.account.address}...`);

    const dvy = await viem.deployContract("DVY");
    const chainId = await publicClient.getChainId();

    console.log("DVY token deployed successfully!");
    console.log("Contract address:", dvy.address);
    console.log("Chain ID:", chainId);

    if (chainId === 11155111) {
        console.log("View on Sepolia Etherscan:", `https://sepolia.etherscan.io/address/${dvy.address}`);
    }
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});