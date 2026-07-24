import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { keccak256, encodeAbiParameters, encodePacked } from "viem";

const { viem, networkHelpers } = await hre.network.create();

describe("DevotifyVoting", function () {
    async function deployFixture() {
        const [deployer, creator, voter1, relayer] = await viem.getWalletClients();
        const dvy = await viem.deployContract("DVY");
        const devotifyVoting = await viem.deployContract("DevotifyVoting", [dvy.address, relayer.account.address]);
        return { dvy, devotifyVoting, deployer, creator, voter1, relayer };
    }

    async function deployWithEventFixture() {
        const { dvy, devotifyVoting, deployer, creator, voter1, relayer } = await deployFixture();
        const depositAmount = 1000n * 10n ** 18n;
        await dvy.write.transfer([creator.account.address, depositAmount], { account: deployer.account });
        await dvy.write.approve([devotifyVoting.address, depositAmount], { account: creator.account });

        const now = await networkHelpers.time.latest(); const registrationDeadline = BigInt(now + 3600);
        const votingDeadline = BigInt(now + 7200); await devotifyVoting.write.createEvent(["Best programming language", ["Rust", "TypeScript", "Python"],
            registrationDeadline, votingDeadline, depositAmount], { account: creator.account },);
        return {
            dvy, devotifyVoting, deployer, creator, voter1, relayer,
            eventId: 0n, registrationDeadline, votingDeadline
        };
    }

    it("lets a creator make an event after approving the deposit", async function () {
        const { dvy, devotifyVoting, deployer, creator } = await networkHelpers.loadFixture(deployFixture);

        const depositAmount = 1000n * 10n ** 18n;

        // deployer holds all the initial DVY (minted to whoever deploys DVY) — send some to creator
        await dvy.write.transfer([creator.account.address, depositAmount], { account: deployer.account });

        // creator must approve DevotifyVoting to pull the deposit before createEvent's transferFrom will work
        await dvy.write.approve([devotifyVoting.address, depositAmount], { account: creator.account });

        const now = await networkHelpers.time.latest();

        await devotifyVoting.write.createEvent(
            ["Best programming language", ["Rust", "TypeScript", "Python"], BigInt(now + 3600), BigInt(now + 7200), depositAmount],
            { account: creator.account },
        );

        const eventCount = await devotifyVoting.read.eventCount();
        assert.equal(eventCount, 1n);
    });

    it("lets a voter register before the deadline", async function () {
        const { devotifyVoting, voter1, eventId } = await networkHelpers.loadFixture(deployWithEventFixture);

        await devotifyVoting.write.registerForEvent([eventId], { account: voter1.account });
        const voterId = keccak256(encodePacked(["address"], [voter1.account.address]));

        const registered = await devotifyVoting.read.isRegistered([eventId, voterId]);
        assert.equal(registered, true);
    });

    it("blocks a second registration attempt from the same voter",
        async function () {
            const { devotifyVoting, voter1, eventId } = await networkHelpers.loadFixture(deployWithEventFixture);
            await devotifyVoting.write.registerForEvent([eventId], { account: voter1.account });
            await viem.assertions.revertWith(devotifyVoting.write.registerForEvent([eventId],
                { account: voter1.account }), "Already registered",);
        });

    it("lets a registered voter cast a vote for a valid option",
        async function () {
            const { devotifyVoting, voter1, eventId, registrationDeadline } = await networkHelpers.loadFixture(deployWithEventFixture);
            await devotifyVoting.write.registerForEvent([eventId], { account: voter1.account });

            // jump time forward past the registration deadline, since voting can't start until then 
            await networkHelpers.time.increaseTo(registrationDeadline + 1n);
            await devotifyVoting.write.castVote([eventId, 0n], { account: voter1.account });

            const voteCount = await devotifyVoting.read.voteCounts([eventId, 0n]); assert.equal(voteCount, 1n);
            const voterId = keccak256(encodePacked(["address"], [voter1.account.address]));
            const voted = await devotifyVoting.read.hasVoted([eventId, voterId]);
            assert.equal(voted, true);
        });

    it("blocks a second vote from the same voter",
        async function () {
            const { devotifyVoting, voter1, eventId, registrationDeadline } = await networkHelpers.loadFixture(deployWithEventFixture);
            await devotifyVoting.write.registerForEvent([eventId], { account: voter1.account });
            await networkHelpers.time.increaseTo(registrationDeadline + 1n);
            await devotifyVoting.write.castVote([eventId, 0n], { account: voter1.account });
            await viem.assertions.revertWith(devotifyVoting.write.castVote([eventId, 1n],
                { account: voter1.account }), "Already voted",);
        });

    it("blocks voting from an address that never registered",
        async function () {
            const { devotifyVoting, voter1, eventId } = await networkHelpers.loadFixture(deployWithEventFixture);
            await viem.assertions.revertWith(devotifyVoting.write.castVote([eventId, 0n],
                { account: voter1.account }), "Not registered",);
        });

    it("lets the creator reveal results, with a hash anyone can independently verify", async function () {
        const { devotifyVoting, creator, voter1, eventId, registrationDeadline, votingDeadline } = await networkHelpers.loadFixture(deployWithEventFixture);
        await devotifyVoting.write.registerForEvent([eventId], { account: voter1.account });
        await networkHelpers.time.increaseTo(registrationDeadline + 1n);
        await devotifyVoting.write.castVote([eventId, 0n], { account: voter1.account });
        await networkHelpers.time.increaseTo(votingDeadline + 1n);
        await devotifyVoting.write.revealResults([eventId], { account: creator.account });

        const results = await devotifyVoting.read.getResults([eventId]); assert.deepEqual(results, [1n, 0n, 0n]); // 1 vote for option 0 ("Rust"), 0 for the others 

        // recompute the hash exactly the way a public verifier would, independent of the contract 
        const expectedHash = keccak256(encodeAbiParameters([{ type: "uint256[]" }], [results]));
        const onChainHash = await devotifyVoting.read.getResultsHash([eventId]); assert.equal(onChainHash, expectedHash);
    });

    it("blocks anyone other than the creator from revealing",
        async function () {
            const { devotifyVoting, voter1, eventId, votingDeadline } =
                await networkHelpers.loadFixture(deployWithEventFixture);
            await networkHelpers.time.increaseTo(votingDeadline + 1n);
            await viem.assertions.revertWith(devotifyVoting.write.revealResults([eventId], { account: voter1.account }), "Only creator can reveal",);
        });

    it("blocks revealing before voting closes",
        async function () {
            const { devotifyVoting, creator, eventId } =
                await networkHelpers.loadFixture(deployWithEventFixture);
            await viem.assertions.revertWith(devotifyVoting.write.revealResults([eventId], { account: creator.account }), "Voting still open",);
        });

    it("lets the relayer register a voter by ID",
        async function () {
            const { devotifyVoting, relayer, eventId } =
                await networkHelpers.loadFixture(deployWithEventFixture);
            const voterId = keccak256(encodePacked(["string"], ["student-12345"]));
            await devotifyVoting.write.registerForEventById([eventId, voterId], { account: relayer.account });
            const registered = await devotifyVoting.read.isRegistered([eventId, voterId]); assert.equal(registered, true);
        });

    it("blocks a non-relayer from calling registerForEventById",
        async function () {
            const { devotifyVoting, voter1, eventId } =
                await networkHelpers.loadFixture(deployWithEventFixture);
            const voterId = keccak256(encodePacked(["string"], ["student-12345"]));
            await viem.assertions.revertWith(devotifyVoting.write.registerForEventById([eventId, voterId], { account: voter1.account }), "Only relayer can call this",);
        });

    it("lets the relayer register and vote on behalf of a walletless voter",
        async function () {
            const { devotifyVoting, relayer, eventId, registrationDeadline } =
                await networkHelpers.loadFixture(deployWithEventFixture);
            const voterId = keccak256(encodePacked(["string"], ["student-12345"]));
            await devotifyVoting.write.registerForEventById([eventId, voterId], { account: relayer.account });
            await networkHelpers.time.increaseTo(registrationDeadline + 1n);
            await devotifyVoting.write.castVoteById([eventId, 1n, voterId], { account: relayer.account });

            const voteCount = await devotifyVoting.read.voteCounts([eventId, 1n]); assert.equal(voteCount, 1n);
            const voted = await devotifyVoting.read.hasVoted([eventId, voterId]); assert.equal(voted, true);
        });

     it("blocks a non-relayer from calling castVoteById", 
        async function () { 
            const { devotifyVoting, relayer, voter1, eventId, registrationDeadline } = 
            await networkHelpers.loadFixture(deployWithEventFixture); 
            const voterId = keccak256(encodePacked(["string"], ["student-12345"])); 
            await devotifyVoting.write.registerForEventById([eventId, voterId], { account: relayer.account }); 
            await networkHelpers.time.increaseTo(registrationDeadline + 1n); await viem.assertions.revertWith( devotifyVoting.write.castVoteById([eventId, 0n, voterId], { account: voter1.account }), "Only relayer can call this", );
         }); 
});