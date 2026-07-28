import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import devotifyVotingAbi from "../abis/DevotifyVoting.json";
import { DEVOTIFY_VOTING_ADDRESS } from "../contracts";
import { API_BASE_URL } from "../config";

interface EventDetails {
  event_id: number;
  topic: string;
  options: string[];
  creator: string;
  registration_deadline: number;
  voting_deadline: number;
  deposit_amount: string;
  results_revealed: boolean;
  registration_count: number;
  vote_count: number;
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelClass = "mb-1 block text-sm font-semibold text-ink";
const cardClass = "mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm";
const primaryBtn =
  "w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-bright";

function statusBanner(message: string) {
  const isError = /error|failed|enter|connect/i.test(message);
  return (
    <p
      className={`mt-3 rounded-lg px-4 py-3 text-sm ${isError ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
        }`}
    >
      {message}
    </p>
  );
}

function EventDetail() {
  const { eventId } = useParams();
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [registerStatus, setRegisterStatus] = useState("");
  const [identityKey, setIdentityKey] = useState("");
  const [selectedOption, setSelectedOption] = useState(0);
  const [voteStatus, setVoteStatus] = useState("");
  const [voteIdentityKey, setVoteIdentityKey] = useState("");
  const [registrationMode, setRegistrationMode] = useState<"open" | "id" | "credential">("open");
  const [loginIdentityKey, setLoginIdentityKey] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [revealStatus, setRevealStatus] = useState("");
  const [results, setResults] = useState<Record<string, number> | null>(null);
  const [verifyData, setVerifyData] = useState<{
    verified: boolean;
    computed_hash: string;
    onchain_hash: string;
  } | null>(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/events/${eventId}`);
        setEvent(await res.json());
      } catch (err) {
        console.error("Failed to fetch event:", err);
      } finally {
        setLoading(false);
      }
    };

    const loadRegistrationMode = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/events/${eventId}/registration-mode`);
        const data = await res.json();
        setRegistrationMode(data.mode);
      } catch (err) {
        console.error("Failed to fetch registration mode:", err);
      }
    };

    void loadEvent();
    void loadRegistrationMode();
  }, [eventId]);

  useEffect(() => {
    if (event?.results_revealed) {
      fetch(`${API_BASE_URL}/events/${eventId}/results`)
        .then((res) => res.json())
        .then((data) => setResults(data.results))
        .catch((err) => console.error("Failed to fetch results:", err));

      fetch(`${API_BASE_URL}/events/${eventId}/verify`)
        .then((res) => res.json())
        .then((data) => setVerifyData(data))
        .catch((err) => console.error("Failed to fetch verification:", err));
    }
  }, [event?.results_revealed, eventId]);

  const handleWalletRegister = async () => {
    if (!isConnected) return setRegisterStatus("Connect your wallet first.");
    try {
      setRegisterStatus("Registering...");
      const hash = await writeContractAsync({
        address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`,
        abi: devotifyVotingAbi,
        functionName: "registerForEvent",
        args: [BigInt(eventId!)],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setRegisterStatus("Registered successfully!");
    } catch (err) {
      console.error(err);
      setRegisterStatus("Registration failed — see browser console for details.");
    }
  };

  const handleIdRegister = async () => {
    if (!identityKey.trim()) return setRegisterStatus("Enter your identity key.");
    try {
      setRegisterStatus("Registering...");
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/register-by-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity_key: identityKey }),
      });
      const data = await res.json();
      if (!res.ok) return setRegisterStatus(`Error: ${data.detail}`);
      setRegisterStatus("Registered successfully!");
    } catch (err) {
      console.error(err);
      setRegisterStatus("Registration failed — see browser console for details.");
    }
  };

  const handleWalletVote = async () => {
    if (!isConnected) return setVoteStatus("Connect your wallet first.");
    try {
      setVoteStatus("Voting...");
      const hash = await writeContractAsync({
        address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`,
        abi: devotifyVotingAbi,
        functionName: "castVote",
        args: [BigInt(eventId!), BigInt(selectedOption)],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setVoteStatus("Vote cast successfully!");
    } catch (err) {
      console.error(err);
      setVoteStatus("Vote failed — see browser console for details.");
    }
  };

  const handleIdVote = async () => {
    if (!voteIdentityKey.trim()) return setVoteStatus("Enter your identity key.");
    try {
      setVoteStatus("Voting...");
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/vote-by-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_key: voteIdentityKey,
          option_index: selectedOption,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setVoteStatus(`Error: ${data.detail}`);
      setVoteStatus("Vote cast successfully!");
    } catch (err) {
      console.error(err);
      setVoteStatus("Vote failed — see browser console for details.");
    }
  };

  const handleLoginAndVote = async () => {
    if (!loginIdentityKey.trim() || !loginPassword) {
      return setVoteStatus("Enter both your identity key and password.");
    }
    try {
      setVoteStatus("Logging in and voting...");
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/authenticate-and-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_key: loginIdentityKey,
          password: loginPassword,
          option_index: selectedOption,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setVoteStatus(`Error: ${data.detail}`);
      setVoteStatus("Vote cast successfully!");
    } catch (err) {
      console.error(err);
      setVoteStatus("Vote failed — see browser console for details.");
    }
  };

  const handleRevealResults = async () => {
    if (!isConnected) {
      return setRevealStatus("Connect your wallet first (must be the event creator).");
    }
    try {
      setRevealStatus("Revealing results...");
      const hash = await writeContractAsync({
        address: DEVOTIFY_VOTING_ADDRESS as `0x${string}`,
        abi: devotifyVotingAbi,
        functionName: "revealResults",
        args: [BigInt(eventId!)],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setRevealStatus("Results revealed!");
      const res = await fetch(`${API_BASE_URL}/events/${eventId}`);
      setEvent(await res.json());
    } catch (err) {
      console.error(err);
      setRevealStatus(
        "Reveal failed — only the event creator can do this, and only after voting closes."
      );
    }
  };

  if (loading) return <p className="text-ink/60">Loading...</p>;
  if (!event) return <p className="text-ink/60">Event not found.</p>;

  const now = Math.floor(Date.now() / 1000);
  const registrationOpen = now <= event.registration_deadline;
  const votingOpen = now > event.registration_deadline && now <= event.voting_deadline;
  const votingClosed = now > event.voting_deadline;

  const statusInfo = event.results_revealed
    ? { label: "Results revealed", className: "bg-primary/10 text-primary" }
    : registrationOpen
      ? { label: "Registration open", className: "bg-primary-bright/10 text-primary-bright" }
      : votingOpen
        ? { label: "Voting open", className: "bg-amber-100 text-amber-700" }
        : { label: "Voting closed", className: "bg-border text-ink/60" };

  const totalVotes = results ? Object.values(results).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="max-w-2xl">
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}
      >
        {statusInfo.label}
      </span>

      <h1 className="mt-2 text-2xl font-extrabold text-ink">{event.topic}</h1>
      <p className="mt-1 font-mono text-xs text-ink/50">{event.creator}</p>

      <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Registered</p>
          <p className="mt-1 text-xl font-bold text-ink">{event.registration_count}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Votes cast</p>
          <p className="mt-1 text-xl font-bold text-ink">{event.vote_count}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
            Registration closes
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {new Date(event.registration_deadline * 1000).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Voting closes</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {new Date(event.voting_deadline * 1000).toLocaleString()}
          </p>
        </div>
      </div>

      {registrationOpen && registrationMode !== "credential" && (
        <div className={cardClass}>
          <h2 className="mb-4 text-lg font-bold text-ink">Register</h2>
          <button type="button" onClick={handleWalletRegister} className={primaryBtn}>
            Register with wallet
          </button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase text-ink/40">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              className={inputClass}
              value={identityKey}
              onChange={(e) => setIdentityKey(e.target.value)}
              placeholder="Your matric number / identity key"
            />
            <button
              type="button"
              onClick={handleIdRegister}
              className="whitespace-nowrap rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Register
            </button>
          </div>
          {registerStatus && statusBanner(registerStatus)}
        </div>
      )}

      {votingOpen && registrationMode === "credential" && (
        <div className={cardClass}>
          <h2 className="mb-4 text-lg font-bold text-ink">Log in and vote</h2>
          <div className="mb-4 space-y-2">
            {event.options.map((option, index) => (
              <label
                key={index}
                className={`block cursor-pointer rounded-lg border p-3 transition ${selectedOption === index
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="voteOption"
                    className="h-4 w-4 accent-primary"
                    checked={selectedOption === index}
                    onChange={() => setSelectedOption(index)}
                  />
                  <span className="font-medium text-ink">{option}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Identity key</label>
              <input
                className={inputClass}
                value={loginIdentityKey}
                onChange={(e) => setLoginIdentityKey(e.target.value)}
                placeholder="e.g. your matric number"
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                className={inputClass}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="the password your election organizer gave you"
              />
            </div>
          </div>
          <button type="button" onClick={handleLoginAndVote} className={`mt-4 ${primaryBtn}`}>
            Log in and vote
          </button>
          {voteStatus && statusBanner(voteStatus)}
        </div>
      )}

      {votingOpen && registrationMode !== "credential" && (
        <div className={cardClass}>
          <h2 className="mb-4 text-lg font-bold text-ink">Vote</h2>
          <div className="mb-4 space-y-2">
            {event.options.map((option, index) => (
              <label
                key={index}
                className={`block cursor-pointer rounded-lg border p-3 transition ${selectedOption === index
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="voteOption"
                    className="h-4 w-4 accent-primary"
                    checked={selectedOption === index}
                    onChange={() => setSelectedOption(index)}
                  />
                  <span className="font-medium text-ink">{option}</span>
                </div>
              </label>
            ))}
          </div>
          <button type="button" onClick={handleWalletVote} className={primaryBtn}>
            Vote with wallet
          </button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase text-ink/40">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              className={inputClass}
              value={voteIdentityKey}
              onChange={(e) => setVoteIdentityKey(e.target.value)}
              placeholder="Your matric number / identity key"
            />
            <button
              type="button"
              onClick={handleIdVote}
              className="whitespace-nowrap rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Vote
            </button>
          </div>
          {voteStatus && statusBanner(voteStatus)}
        </div>
      )}

      {votingClosed && !event.results_revealed && (
        <div className={cardClass}>
          <h2 className="mb-2 text-lg font-bold text-ink">Results</h2>
          <p className="mb-4 text-sm text-ink/60">
            Voting has closed. Results haven't been revealed yet.
          </p>
          <button type="button" onClick={handleRevealResults} className={primaryBtn}>
            Reveal Results (creator only)
          </button>
          {revealStatus && statusBanner(revealStatus)}
        </div>
      )}

      {event.results_revealed && (
        <div className={cardClass}>
          <h2 className="mb-4 text-lg font-bold text-ink">Results</h2>

          {verifyData && (
            <div
              className={`mb-5 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${verifyData.verified
                  ? "bg-primary/10 text-primary"
                  : "bg-danger/10 text-danger"
                }`}
            >
              <span>{verifyData.verified ? "✓" : "✗"}</span>
              {verifyData.verified
                ? "Verified — independently recomputed and matches on-chain"
                : "Not verified — recomputed result does not match on-chain"}
            </div>
          )}

          {results && (
            <div className="space-y-3">
              {event.options.map((option, index) => {
                const votes = results[index] ?? 0;
                const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                return (
                  <div key={index}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-ink">{option}</span>
                      <span className="text-ink/60">
                        {votes} vote{votes === 1 ? "" : "s"} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {verifyData && (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-semibold text-primary">
                Verification details
              </summary>
              <div className="mt-2 space-y-1 rounded-lg bg-surface-muted p-3 font-mono text-xs text-ink/70">
                <p>Computed: {verifyData.computed_hash}</p>
                <p>On-chain: {verifyData.onchain_hash}</p>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default EventDetail;