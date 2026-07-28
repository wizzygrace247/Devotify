import { network } from "hardhat";

const DVY_ADDRESS = "0xdB6ebCdf768Fa5627Fa171DbE5F4e131e4689241";

async function main() {
  const { viem } = await network.connect("sepolia");
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log(`Deploying Faucet from ${deployer.account.address}...`);

  const faucet = await viem.deployContract("Faucet", [DVY_ADDRESS]);

  console.log("Faucet deployed successfully!");
  console.log("Contract address:", faucet.address);
  console.log(
    "View on Sepolia Etherscan:",
    `https://sepolia.etherscan.io/address/${faucet.address}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});