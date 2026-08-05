import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config";

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

function EventCard({ event }: { event: VotingEvent }) {
  const status = getStatus(event);

  return (
    <Link
      to={`/events/${event.event_id}`}
      className="mx-auto max-w-md rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
      >
        {status.label}
      </span>
      <h2 className="mt-3 text-lg font-bold text-ink">{event.topic}</h2>
      <p className="mt-1 truncate font-mono text-xs text-ink/50">{event.creator}</p>
    </Link>
  );
}

function Dashboard() {
  const [events, setEvents] = useState<VotingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const res = await fetch(`${API_BASE_URL}/events`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.detail || data?.message || `Failed to load events (${res.status})`,
          );
        }

        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setEvents([]);
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) return <p className="text-ink/60">Loading elections...</p>;

  const now = Math.floor(Date.now() / 1000);
  const activeEvents = events
    .filter((e) => now <= e.voting_deadline)
    .sort((a, b) => b.event_id - a.event_id);
  const pastEvents = events
    .filter((e) => now > e.voting_deadline)
    .sort((a, b) => b.event_id - a.event_id);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">Elections</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/create"
            className="rounded-lg bg-primary px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-primary-bright"
          >
            + Create Election
          </Link>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {events.length === 0 && !error ? (
        <p className="text-ink/60">No elections yet. Be the first to create one.</p>
      ) : events.length === 0 && error ? (
        <p className="text-ink/60">Could not load elections. Check the error above.</p>
      ) : (
        <>
          {activeEvents.length > 0 ? (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              {activeEvents.map((event) => (
                <EventCard key={event.event_id} event={event} />
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-ink/60">No active elections right now.</p>
          )}

          {pastEvents.length > 0 && (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setShowPast(!showPast)}
                className="flex items-center gap-2 text-sm font-semibold text-ink/70 hover:text-ink"
              >
                <span
                  className={`inline-block transition-transform ${showPast ? "rotate-90" : ""}`}
                >
                  ▸
                </span>
                Past elections ({pastEvents.length})
              </button>

              {showPast && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {pastEvents.map((event) => (
                    <EventCard key={event.event_id} event={event} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;