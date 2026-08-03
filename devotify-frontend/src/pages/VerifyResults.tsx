import { useState } from "react";
import { API_BASE_URL } from "../config";

interface VerificationResponse {
    event_id: number;
    topic: string;
    options: string[];
    results: Record<string, number>;
    verified: boolean;
    computed_hash?: string;
    onchain_hash?: string;
    reason?: string;
}

const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

function VerifyResultsPage() {
    const [hashInput, setHashInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [verification, setVerification] = useState<VerificationResponse | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedHash = hashInput.trim();

        if (!trimmedHash) {
            setError("Paste a results hash from a concluded election.");
            setVerification(null);
            return;
        }

        try {
            setLoading(true);
            setError("");
            const res = await fetch(`${API_BASE_URL}/verify-results`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ results_hash: trimmedHash }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.detail || data?.message || "Could not verify that election hash");
            }

            setVerification(data);
        } catch (err) {
            console.error("Verification failed:", err);
            setVerification(null);
            setError(err instanceof Error ? err.message : "Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const totalVotes = verification
        ? Object.values(verification.results).reduce((total, value) => total + value, 0)
        : 0;

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-extrabold text-ink">Verify an election result</h1>
            <p className="mt-2 text-sm text-ink/60">
                Paste the revealed results hash from a concluded election to recompute the tally and see
                whether it matches the on-chain record.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-ink">Results hash</label>
                <input
                    className={inputClass}
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value)}
                    placeholder="0x..."
                />
                <button
                    type="submit"
                    className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-bright"
                >
                    {loading ? "Verifying..." : "Verify results"}
                </button>
            </form>

            {error && (
                <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            )}

            {verification && (
                <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
                    <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${verification.verified ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
                        {verification.verified ? "✓ Verified" : "✗ Not verified"}
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-ink">{verification.topic}</h2>
                    <p className="mt-1 text-sm text-ink/60">Election #{verification.event_id}</p>

                    {verification.reason && (
                        <p className="mt-3 text-sm text-ink/70">{verification.reason}</p>
                    )}

                    <div className="mt-5 space-y-3">
                        {verification.options.map((option, index) => {
                            const votes = verification.results[index] ?? verification.results[String(index)] ?? 0;
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
                                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <details className="mt-5">
                        <summary className="cursor-pointer text-sm font-semibold text-primary">
                            Verification details
                        </summary>
                        <div className="mt-2 space-y-1 rounded-lg bg-surface-muted p-3 font-mono text-xs text-ink/70">
                            <p>Computed: {verification.computed_hash || "—"}</p>
                            <p>On-chain: {verification.onchain_hash || "—"}</p>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}

export default VerifyResultsPage;
