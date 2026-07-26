import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface VotingEvent {
  event_id: number;
  topic: string;
  creator: string;
  registration_deadline: number;
  voting_deadline: number;
  results_revealed: boolean;
}

function getStatus(event: VotingEvent): { label: string; className: string } {
  const now = Math.floor(Date.now() / 1000);

  if (event.results_revealed) {
    return { label: "Results revealed", className: "bg-primary/10 text-primary" };
  }

  if (now <= event.registration_deadline) {
    return {
      label: "Registration open",
      className: "bg-primary-bright/10 text-primary-bright",
    };
  }

  if (now <= event.voting_deadline) {
    return { label: "Voting open", className: "bg-amber-100 text-amber-700" };
  }

  return { label: "Voting closed", className: "bg-border text-ink/60" };
}

function Dashboard() {
  const [events, setEvents] = useState<VotingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/events")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch events:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-ink/60">Loading elections...</p>;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">Elections</h1>
        <Link
          to="/create"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-bright"
        >
          + Create Election
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-ink/60">No elections yet. Be the first to create one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => {
            const status = getStatus(event);
            return (
              <Link
                key={event.event_id}
                to={`/events/${event.event_id}`}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
                <h2 className="mt-3 text-lg font-bold text-ink">{event.topic}</h2>
                <p className="mt-1 truncate font-mono text-xs text-ink/50">
                  {event.creator}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dashboard;