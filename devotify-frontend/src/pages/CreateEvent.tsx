import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import dvyAbi from "../abis/DVY.json";
import devotifyVotingAbi from "../abis/DevotifyVoting.json";
import { DVY_ADDRESS, DEVOTIFY_VOTING_ADDRESS } from "../contracts";

function CreateEvent() {
    const navigate = useNavigate();
    const { isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [topic, setTopic] = useState("");
    const [options, setOptions] = useState(["", ""]);
    const [registrationMinutes, setRegistrationMinutes] = useState(30);
    const [votingMinutes, setVotingMinutes] = useState(60);
    const [depositAmount, setDepositAmount] = useState(1000);
    const [status, setStatus] = useState("");
    const updateOption = (index: number, value: string) => {
        const next = [...options]; next[index] = value;
        setOptions(next);
    }; const addOption = () =>
        setOptions([...options, ""]);
    const handleSubmit = async () => {
        if (!isConnected) {
            setStatus("Connect your wallet first.");
            return;
        }
        const filledOptions = options.filter((o) => o.trim() !== "");
        if (!topic.trim() || filledOptions.length < 2) {
            setStatus("Enter a topic and at least 2 options.");
            return;
        } try {
            const depositAmountWei = parseUnits(depositAmount.toString(), 18);
            const now = Math.floor(Date.now() / 1000);
            const registrationDeadline = BigInt(now + registrationMinutes * 60);
            const votingDeadline = BigInt(now + (registrationMinutes + votingMinutes) * 60);
            setStatus("Approving deposit...");
            const approveHash = await writeContractAsync
                ({ address: DVY_ADDRESS as `0x${string}`, abi: dvyAbi, functionName: "approve", args: [DEVOTIFY_VOTING_ADDRESS, depositAmountWei], }
                ); await publicClient!.waitForTransactionReceipt({ hash: approveHash }); setStatus("Creating event..."); const createHash = await writeContractAsync({ address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`, abi: devotifyVotingAbi, functionName: "createEvent", args: [topic, filledOptions, registrationDeadline, votingDeadline, depositAmountWei], }); await publicClient!.waitForTransactionReceipt({ hash: createHash }); setStatus("Election created!"); navigate("/");
        } catch (err) { console.error(err); setStatus("Something went wrong — check the browser console for details."); }
    };
    return (<div> <h1>Create Election</h1> <label> Topic <input value={topic} onChange={(e) =>
        setTopic(e.target.value)} />
    </label> <h3>Options</h3> {options.map((option, index) => (<input key={index} value={option} onChange={(e) =>
        updateOption(index, e.target.value)} placeholder={`Option ${index + 1}`} />
    ))}
        <button type="button" onClick={addOption}>+ Add option</button>
        <label> Registration window (minutes from now) <input type="number" value={registrationMinutes} onChange={(e) =>
            setRegistrationMinutes(Number(e.target.value))} /> </label> <label> Voting window (minutes after registration closes)
            <input type="number" value={votingMinutes} onChange={(e) =>
                setVotingMinutes(Number(e.target.value))} /> </label> 
                <label> Deposit amount (DVY) 
                    <input type="number" value={depositAmount} onChange={(e) => 
                    setDepositAmount(Number(e.target.value))} /> </label> <button type="button" onClick={handleSubmit}>Create Election</button> {status && <p>{status}</p>} </div>
                );
} 
export default CreateEvent