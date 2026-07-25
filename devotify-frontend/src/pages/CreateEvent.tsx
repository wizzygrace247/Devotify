import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import dvyAbi from "../abis/DVY.json";
import devotifyVotingAbi from "../abis/DevotifyVoting.json";
import { DVY_ADDRESS, DEVOTIFY_VOTING_ADDRESS } from "../contracts";

type RegistrationMode = "open" | "id" | "credential";

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
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("open");
  const [eligibleVotersText, setEligibleVotersText] = useState("");
  const [credentialPairsText, setCredentialPairsText] = useState("");

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const addOption = () => setOptions([...options, ""]);

  const handleSubmit = async () => {
    if (!isConnected) {
      setStatus("Connect your wallet first.");
      return;
    }

    const filledOptions = options.filter((o) => o.trim() !== "");
    if (!topic.trim() || filledOptions.length < 2) {
      setStatus("Enter a topic and at least 2 options.");
      return;
    }

    try {
      const depositAmountWei = parseUnits(depositAmount.toString(), 18);
      const now = Math.floor(Date.now() / 1000);
      const registrationDeadline = BigInt(now + registrationMinutes * 60);
      const votingDeadline = BigInt(now + (registrationMinutes + votingMinutes) * 60);

      setStatus("Approving deposit...");
      const approveHash = await writeContractAsync({
        address: DVY_ADDRESS as `0x${string}`,
        abi: dvyAbi,
        functionName: "approve",
        args: [DEVOTIFY_VOTING_ADDRESS, depositAmountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveHash });

      setStatus("Creating event...");
      const createHash = await writeContractAsync({
        address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`,
        abi: devotifyVotingAbi,
        functionName: "createEvent",
        args: [topic, filledOptions, registrationDeadline, votingDeadline, depositAmountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: createHash });

      const eventCount = (await publicClient!.readContract({
        address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`,
        abi: devotifyVotingAbi,
        functionName: "eventCount",
      })) as bigint;

      const newEventId = eventCount - 1n;

      if (registrationMode === "id") {
        const identityKeys = eligibleVotersText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (identityKeys.length > 0) {
          setStatus("Adding eligible voters...");
          const res = await fetch(`http://127.0.0.1:8000/events/${newEventId}/eligible-voters`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identity_keys: identityKeys }),
          });

          if (!res.ok) {
            setStatus("Election created, but adding eligible voters failed. You can add them later.");
            navigate(`/events/${newEventId}`);
            return;
          }
        }
      } else if (registrationMode === "credential") {
        const credentials = credentialPairsText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => {
            const [identity_key, password] = line.split(",").map((s) => s.trim());
            return { identity_key, password };
          });

        if (credentials.length > 0) {
          setStatus("Adding voter credentials...");
          const res = await fetch(`http://127.0.0.1:8000/events/${newEventId}/credential-voters`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credentials }),
          });

          if (!res.ok) {
            setStatus("Election created, but adding credentials failed. You can add them later.");
            navigate(`/events/${newEventId}`);
            return;
          }
        }
      }

      setStatus("Election created!");
      navigate(`/events/${newEventId}`);
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong — check the browser console for details.");
    }
  };

  return (
    <div>
      <h1>Create Election</h1>

      <label>
        Topic
        <input value={topic} onChange={(e) => setTopic(e.target.value)} />
      </label>

      <h3>Options</h3>
      {options.map((option, index) => (
        <input
          key={index}
          value={option}
          onChange={(e) => updateOption(index, e.target.value)}
          placeholder={`Option ${index + 1}`}
        />
      ))}
      <button type="button" onClick={addOption}>
        + Add option
      </button>

      <label>
        Registration window (minutes from now)
        <input
          type="number"
          value={registrationMinutes}
          onChange={(e) => setRegistrationMinutes(Number(e.target.value))}
        />
      </label>

      <label>
        Voting window (minutes after registration closes)
        <input
          type="number"
          value={votingMinutes}
          onChange={(e) => setVotingMinutes(Number(e.target.value))}
        />
      </label>

      <label>
        Deposit amount (DVY)
        <input
          type="number"
          value={depositAmount}
          onChange={(e) => setDepositAmount(Number(e.target.value))}
        />
      </label>

      <h3>How will people participate?</h3>

      <label style={{ display: "block" }}>
        <input
          type="radio"
          checked={registrationMode === "open"}
          onChange={() => setRegistrationMode("open")}
        />
        Open — anyone with a wallet can register
      </label>

      <label style={{ display: "block" }}>
        <input
          type="radio"
          checked={registrationMode === "id"}
          onChange={() => setRegistrationMode("id")}
        />
        ID-based — voters self-register with an identity key you provide, no wallet needed
      </label>

      <label style={{ display: "block" }}>
        <input
          type="radio"
          checked={registrationMode === "credential"}
          onChange={() => setRegistrationMode("credential")}
        />
        Credential-based — voters skip registration; they log in with an ID + password you set and vote in one step
      </label>

      {registrationMode === "id" && (
        <label>
          Eligible voter identity keys (one per line)
          <textarea
            value={eligibleVotersText}
            onChange={(e) => setEligibleVotersText(e.target.value)}
            rows={5}
            placeholder={"student-12345\nstudent-67890"}
          />
        </label>
      )}

      {registrationMode === "credential" && (
        <label>
          Voter credentials — one per line, as identity_key,password
          <textarea
            value={credentialPairsText}
            onChange={(e) => setCredentialPairsText(e.target.value)}
            rows={5}
            placeholder={"student-12345,correcthorse1\nstudent-67890,correcthorse2"}
          />
        </label>
      )}

      <button type="button" onClick={handleSubmit}>
        Create Election
      </button>

      {status && <p>{status}</p>}
    </div>
  );
}

export default CreateEvent;