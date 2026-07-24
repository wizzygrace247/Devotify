import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import devotifyVotingAbi from "../abis/DevotifyVoting.json";
import { DEVOTIFY_VOTING_ADDRESS } from "../contracts";

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

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        setEvent(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch event:", err);
        setLoading(false);
      });
  }, [eventId]);

  const handleWalletRegister = async () => {
    if (!isConnected) {
      setRegisterStatus("Connect your wallet first.");
      return;
    }
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
    if (!identityKey.trim()) {
      setRegisterStatus("Enter your identity key.");
      return;
    }
    try {
      setRegisterStatus("Registering...");
      const res = await fetch(`http://127.0.0.1:8000/events/${eventId}/register-by-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity_key: identityKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegisterStatus(`Error: ${data.detail}`);
        return;
      }
      setRegisterStatus("Registered successfully!");
    } catch (err) {
      console.error(err);
      setRegisterStatus("Registration failed — see browser console for details.");
    }
  };

  const handleWalletVote = async () => {
    if (!isConnected) {
      setVoteStatus("Connect your wallet first.");
      return;
    }
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
    if (!voteIdentityKey.trim()) {
      setVoteStatus("Enter your identity key.");
      return;
    }
    try {
      setVoteStatus("Voting...");
      const res = await fetch(`http://127.0.0.1:8000/events/${eventId}/vote-by-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity_key: voteIdentityKey, option_index: selectedOption }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoteStatus(`Error: ${data.detail}`);
        return;
      }
      setVoteStatus("Vote cast successfully!");
    } catch (err) {
      console.error(err);
      setVoteStatus("Vote failed — see browser console for details.");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!event) return <p>Event not found.</p>;

  const now = Math.floor(Date.now() / 1000);
  const registrationOpen = now <= event.registration_deadline;
  const votingOpen = now > event.registration_deadline && now <= event.voting_deadline;

  return (
    <div>
      <h1>{event.topic}</h1>
      <p>Created by: {event.creator}</p>
      <p>Options: {event.options.join(", ")}</p>
      <p>Registration deadline: {new Date(event.registration_deadline * 1000).toLocaleString()}</p>
      <p>Voting deadline: {new Date(event.voting_deadline * 1000).toLocaleString()}</p>
      <p>Registered voters: {event.registration_count}</p>
      <p>Votes cast: {event.vote_count}</p>
      <p>Results revealed: {event.results_revealed ? "Yes" : "No"}</p>

      {registrationOpen && (
        <div>
          <h3>Register</h3>
          <div>
            <button type="button" onClick={handleWalletRegister}>
              Register with wallet
            </button>
          </div>
          <div>
            <p>Or register without a wallet:</p>
            <input
              value={identityKey}
              onChange={(e) => setIdentityKey(e.target.value)}
              placeholder="Your matric number / identity key"
            />
            <button type="button" onClick={handleIdRegister}>
              Register
            </button>
          </div>
          {registerStatus && <p>{registerStatus}</p>}
        </div>
      )}

      {votingOpen && (
        <div>
          <h3>Vote</h3>
          <div>
            {event.options.map((option, index) => (
              <label key={index} style={{ display: "block" }}>
                <input
                  type="radio"
                  name="voteOption"
                  checked={selectedOption === index}
                  onChange={() => setSelectedOption(index)}
                />
                {option}
              </label>
            ))}
          </div>
          <div>
            <button type="button" onClick={handleWalletVote}>
              Vote with wallet
            </button>
          </div>
          <div>
            <p>Or vote without a wallet:</p>
            <input
              value={voteIdentityKey}
              onChange={(e) => setVoteIdentityKey(e.target.value)}
              placeholder="Your matric number / identity key"
            />
            <button type="button" onClick={handleIdVote}>
              Vote
            </button>
          </div>
          {voteStatus && <p>{voteStatus}</p>}
        </div>
      )}
    </div>
  );
}

export default EventDetail;