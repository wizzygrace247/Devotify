import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import dvyAbi from "../abis/DVY.json";
import devotifyVotingAbi from "../abis/DevotifyVoting.json";
import { DVY_ADDRESS, DEVOTIFY_VOTING_ADDRESS } from "../contracts";

type RegistrationMode = "open" | "id" | "credential";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelClass = "mb-1 block text-sm font-semibold text-ink";

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

  const isError = /error|failed|enter|connect/i.test(status);

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
          .map((l) => l.trim())
          .filter(Boolean);

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
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line) => {
            const [identity_key, password] = line.split(",").map((s) => s.trim());
            return { identity_key, password };
          });

        if (credentials.length > 0) {
          setStatus("Adding voter credentials...");
          const res = await fetch(
            `http://127.0.0.1:8000/events/${newEventId}/credential-voters`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credentials }),
            }
          );

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

  const modeOptions: { value: RegistrationMode; title: string; description: string }[] = [
    {
      value: "open",
      title: "Open",
      description: "Anyone with a wallet can register",
    },
    {
      value: "id",
      title: "ID-based",
      description: "Voters self-register with an identity key you provide, no wallet needed",
    },
    {
      value: "credential",
      title: "Credential-based",
      description:
        "Voters skip registration; they log in with an ID + password you set and vote in one step",
    },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Create Election</h1>

      <div className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <label className={labelClass}>Topic</label>
          <input
            className={inputClass}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Best programming language"
          />
        </div>

        <div>
          <label className={labelClass}>Options</label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <input
                key={index}
                className={inputClass}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="mt-2 text-sm font-semibold text-primary hover:text-primary-bright"
          >
            + Add option
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Registration window (minutes)</label>
            <input
              type="number"
              className={inputClass}
              value={registrationMinutes}
              onChange={(e) => setRegistrationMinutes(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Voting window (minutes after)</label>
            <input
              type="number"
              className={inputClass}
              value={votingMinutes}
              onChange={(e) => setVotingMinutes(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Deposit amount (DVY)</label>
          <input
            type="number"
            className={inputClass}
            value={depositAmount}
            onChange={(e) => setDepositAmount(Number(e.target.value))}
          />
        </div>

        <div>
          <label className={labelClass}>How will people participate?</label>
          <div className="space-y-2">
            {modeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`block cursor-pointer rounded-lg border p-3 transition ${
                  registrationMode === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={registrationMode === opt.value}
                    onChange={() => setRegistrationMode(opt.value)}
                  />
                  <div>
                    <p className="font-semibold text-ink">{opt.title}</p>
                    <p className="text-sm text-ink/60">{opt.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {registrationMode === "id" && (
          <div>
            <label className={labelClass}>Eligible voter identity keys (one per line)</label>
            <textarea
              className={inputClass}
              value={eligibleVotersText}
              onChange={(e) => setEligibleVotersText(e.target.value)}
              rows={4}
              placeholder={"student-12345\nstudent-67890"}
            />
          </div>
        )}

        {registrationMode === "credential" && (
          <div>
            <label className={labelClass}>
              Voter credentials — one per line, as identity_key,password
            </label>
            <textarea
              className={inputClass}
              value={credentialPairsText}
              onChange={(e) => setCredentialPairsText(e.target.value)}
              rows={4}
              placeholder={"student-12345,correcthorse1\nstudent-67890,correcthorse2"}
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-bright"
        >
          Create Election
        </button>

        {status && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              isError ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
            }`}
          >
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

export default CreateEvent;