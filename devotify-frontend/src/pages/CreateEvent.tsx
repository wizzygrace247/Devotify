import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import dvyAbi from "../abis/DVY.json";
import devotifyVotingAbi from "../abis/DevotifyVoting.json";
import faucetAbi from "../abis/Faucet.json";
import { DVY_ADDRESS, DEVOTIFY_VOTING_ADDRESS, FAUCET_ADDRESS } from "../contracts";
import { API_BASE_URL } from "../config";

type RegistrationMode = "open" | "id" | "credential";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelClass = "mb-1 block text-sm font-semibold text-ink";

const parsePositiveInteger = (value: string | number, fallback = 0) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return fallback;
  }

  const parsed = Number(trimmed);
  return parsed > 0 ? Math.floor(parsed) : fallback;
};

function CreateEvent() {
  const navigate = useNavigate();
  const { isConnected, address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [registrationMinutes, setRegistrationMinutes] = useState("30");
  const [votingMinutes, setVotingMinutes] = useState("60");
  const [depositAmount, setDepositAmount] = useState("1000");
  const [status, setStatus] = useState("");
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("open");
  const [eligibleVotersText, setEligibleVotersText] = useState("");
  const [credentialPairs, setCredentialPairs] = useState([{ identityKey: "", password: "" }]);
  const [faucetStatus, setFaucetStatus] = useState("");

  const { data: dvyBalance, refetch: refetchBalance } = useReadContract({
    address: DVY_ADDRESS as `0x${string}`,
    abi: dvyAbi as any,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isError = /error|failed|enter|connect/i.test(status);

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const addOption = () => setOptions([...options, ""]);

  const updateCredentialPair = (
    index: number,
    field: "identityKey" | "password",
    value: string,
  ) => {
    const next = [...credentialPairs];
    next[index] = { ...next[index], [field]: value };
    setCredentialPairs(next);
  };

  const addCredentialPair = () =>
    setCredentialPairs([...credentialPairs, { identityKey: "", password: "" }]);

  const removeCredentialPair = (index: number) => {
    setCredentialPairs(credentialPairs.filter((_, i) => i !== index));
  };

  const handleClaimFaucet = async () => {
    if (!isConnected) {
      setFaucetStatus("Connect your wallet first.");
      return;
    }
    try {
      setFaucetStatus("Claiming...");
      const hash = await writeContractAsync({
        address: FAUCET_ADDRESS as `0x${string}`,
        abi: faucetAbi as any,
        functionName: "claim",
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setFaucetStatus("Claimed 100 DVY!");
      refetchBalance();
    } catch (err) {
      console.error(err);
      setFaucetStatus("Claim failed — you may need to wait for the 24-hour cooldown.");
    }
  };

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

    const parsedRegistrationMinutes = parsePositiveInteger(registrationMinutes);
    const parsedVotingMinutes = parsePositiveInteger(votingMinutes);
    const parsedDepositAmount = parsePositiveInteger(depositAmount);

    if (parsedRegistrationMinutes < 1) {
      setStatus("Registration window must be at least 1 minute.");
      return;
    }

    if (parsedVotingMinutes < 1) {
      setStatus("Voting window must be at least 1 minute.");
      return;
    }

    if (parsedDepositAmount < 1) {
      setStatus("Deposit amount must be at least 1000 DVY.");
      return;
    }

    if (registrationMode === "credential" && parsedRegistrationMinutes < 5) {
      setStatus(
        "Credential mode needs at least 5 minutes — the system has to register every voter on-chain automatically before the window closes.",
      );
      return;
    }

    try {
      const depositAmountWei = parseUnits(parsedDepositAmount.toString(), 18);
      const now = Math.floor(Date.now() / 1000);
      const registrationDeadline = BigInt(now + parsedRegistrationMinutes * 60);
      const votingDeadline = BigInt(now + (parsedRegistrationMinutes + parsedVotingMinutes) * 60);

      setStatus("Approving deposit...");
      const approveHash = await writeContractAsync({
        address: DVY_ADDRESS as `0x${string}`,
        abi: dvyAbi as any,
        functionName: "approve",
        args: [DEVOTIFY_VOTING_ADDRESS, depositAmountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveHash });

      setStatus("Creating event...");
      const createHash = await writeContractAsync({
        address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`,
        abi: devotifyVotingAbi as any,
        functionName: "createEvent",
        args: [topic, filledOptions, registrationDeadline, votingDeadline, depositAmountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash: createHash });

      const eventCount = (await publicClient!.readContract({
        address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`,
        abi: devotifyVotingAbi as any,
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
          const res = await fetch(`${API_BASE_URL}/events/${newEventId}/eligible-voters`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": import.meta.env.VITE_API_KEY,
            },
            body: JSON.stringify({ identity_keys: identityKeys }),
          });

          if (!res.ok) {
            setStatus(
              "Election created, but adding eligible voters failed. You can add them later.",
            );
            navigate(`/events/${newEventId}`);
            return;
          }
        }
      } else if (registrationMode === "credential") {
        const credentials = credentialPairs
          .filter((p) => p.identityKey.trim() && p.password)
          .map((p) => ({
            identity_key: p.identityKey.trim(),
            password: p.password,
          }));

        if (credentials.length > 0) {
          setStatus("Adding voter credentials...");
          const res = await fetch(`${API_BASE_URL}/events/${newEventId}/credential-voters`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": import.meta.env.VITE_API_KEY,
            },
            body: JSON.stringify({ credentials }),
          });

          if (!res.ok) {
            setStatus(
              "Election created, but adding credentials failed. You can add them later.",
            );
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

      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-ink">Need DVY to create an election?</p>
          <p className="text-xs text-ink/60">
            {dvyBalance !== undefined
              ? `Your balance: ${formatUnits(dvyBalance as bigint, 18)} DVY`
              : "Connect your wallet to check your balance"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClaimFaucet}
          className="whitespace-nowrap rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          Get test tokens
        </button>
      </div>
      {faucetStatus && <p className="mb-4 text-sm text-ink/60">{faucetStatus}</p>}

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
              min="1"
              className={inputClass}
              value={registrationMinutes}
              onChange={(e) => setRegistrationMinutes(e.target.value)}
            />
            {registrationMode === "credential" && (
              <p className="mt-1 text-xs text-ink/50">
                Needs enough time for every voter&apos;s credential to be registered on-chain
                automatically — 5+ minutes recommended.
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Voting window (minutes after)</label>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={votingMinutes}
              onChange={(e) => setVotingMinutes(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Deposit amount (DVY)</label>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>How will people participate?</label>
          <div className="space-y-2">
            {modeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`block cursor-pointer rounded-lg border p-3 transition ${registrationMode === opt.value
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
            <label className={labelClass}>Voter credentials</label>
            <div className="mb-1 flex gap-2 px-1 text-xs font-semibold text-ink/50">
              <span className="flex-1">Identity key</span>
              <span className="flex-1">Password</span>
            </div>
            <div className="space-y-2">
              {credentialPairs.map((pair, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={pair.identityKey}
                    onChange={(e) => updateCredentialPair(index, "identityKey", e.target.value)}
                    placeholder="e.g. student-12345"
                  />
                  <input
                    className={inputClass}
                    value={pair.password}
                    onChange={(e) => updateCredentialPair(index, "password", e.target.value)}
                    placeholder="e.g. correcthorse1"
                  />
                  {credentialPairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCredentialPair(index)}
                      className="px-2 text-lg text-ink/40 transition-colors hover:text-danger"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCredentialPair}
              className="mt-2 text-sm font-semibold text-primary hover:text-primary-bright"
            >
              + Add voter
            </button>
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
            className={`rounded-lg px-4 py-3 text-sm ${isError ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
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