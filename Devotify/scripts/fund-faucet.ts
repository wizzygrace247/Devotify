import { network } from "hardhat";

const DVY_ADDRESS = "0xdB6ebCdf768Fa5627Fa171DbE5F4e131e4689241";
const FAUCET_ADDRESS = "0x520359047a53f5f1b2d61feb4b9c528a7cbbef40";

async function main() {
  const { viem } = await network.connect("sepolia");
  const publicClient = await viem.getPublicClient();

  const dvy = await viem.getContractAt("DVY", DVY_ADDRESS);

  const fundAmount = 50000n * 10n ** 18n; // 50,000 DVY — 500 claims worth

  console.log("Funding faucet...");

  const hash = await dvy.write.transfer([FAUCET_ADDRESS, fundAmount]);
  await publicClient.waitForTransactionReceipt({ hash });

  console.log("Faucet funded with 50,000 DVY.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});