import { network } from "hardhat";
const DVY_ADDRESS = "0xdB6ebCdf768Fa5627Fa171DbE5F4e131e4689241";

async function main() {
    const { viem } = await network.connect("sepolia");
    const [deployer] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    console.log(`Deploying DevotifyVoting from ${deployer.account.address}...`);

    const devotifyVoting = await viem.deployContract("DevotifyVoting", [DVY_ADDRESS, deployer.account.address]);
    const chainId = await publicClient.getChainId();

    console.log("DevotifyVoting deployed successfully!");
    console.log("Contract address:", devotifyVoting.address);
    console.log("Linked DVY token:", DVY_ADDRESS);
    console.log("Chain ID:", chainId);

    if (chainId === 11155111) {
        console.log("View on Sepolia Etherscan:", `https://sepolia.etherscan.io/address/${devotifyVoting.address}`);
    }
}
main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});