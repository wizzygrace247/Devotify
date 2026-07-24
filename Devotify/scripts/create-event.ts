import { network } from "hardhat";
const DVY_ADDRESS = "0xdB6ebCdf768Fa5627Fa171DbE5F4e131e4689241";
const DEVOTIFY_VOTING_ADDRESS = "0xb27ed315958c19c980e2255a942044c39c42ab66";


async function main() {
    const { viem } = await network.connect("sepolia");
    const [creator] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const dvy = await viem.getContractAt("DVY", DVY_ADDRESS);
    const devotifyVoting = await viem.getContractAt("DevotifyVoting", DEVOTIFY_VOTING_ADDRESS);

    const depositAmount = 1000n * 10n ** 18n;
    const now = Math.floor(Date.now() / 1000);
    const registrationDeadline = BigInt(now + 7200);
    const votingDeadline = BigInt(now + 14400);

    console.log("Approving deposit...");
    const approveHash = await dvy.write.approve([DEVOTIFY_VOTING_ADDRESS, depositAmount]);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("Approval confirmed.");

    console.log("Creating event...");
    const createHash = await devotifyVoting.write.createEvent([
        "Best programming language",
        ["Rust", "TypeScript", "Python"],
        registrationDeadline,
        votingDeadline,
        depositAmount,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: createHash });
    console.log("Event creation confirmed.");
}

main().catch(console.error);