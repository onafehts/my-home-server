import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE, apiFetch, type MyResult } from "../lib/api";
import { useSession } from "../lib/auth-client";

function medal(placement: number | null): string {
  if (placement === 1) return "🥇";
  if (placement === 2) return "🥈";
  if (placement === 3) return "🥉";
  return "🎯";
}

export function MyResults() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["my-results"],
    queryFn: () => apiFetch<{ results: MyResult[] }>("/me/results"),
  });

  if (results.isPending) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Find your result</h1>
        <p className="text-sm text-slate-400">
          Every round you were in — where you placed, how long you survived, and
          your highlight.
        </p>
      </div>

      {results.data?.results.length === 0 && (
        <p className="text-slate-500">
          You haven't been in a round yet.{" "}
          <Link to="/games" className="text-indigo-400">
            Join a game
          </Link>
          .
        </p>
      )}

      <div className="space-y-2">
        {results.data?.results.map((r) => {
          const open = openId === r.roundId;
          return (
            <div
              key={r.roundId}
              className="rounded-xl border border-slate-800 bg-slate-900/40"
            >
              <button
                onClick={() => setOpenId(open ? null : r.roundId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-2xl">{medal(r.placement)}</span>
                <span className="flex-1">
                  <span className="font-semibold">{r.gameName}</span> · Round{" "}
                  {r.roundNumber}
                  <span className="block text-xs text-slate-500">
                    Finished #{r.placement} of {r.totalParticipants} · +
                    {r.pointsEarned} pts
                  </span>
                </span>
                <span className="text-slate-500">{open ? "▲" : "▼"}</span>
              </button>

              {open && (
                <div className="space-y-3 border-t border-slate-800 px-4 py-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <Stat label="Placement" value={`#${r.placement}`} />
                    <Stat label="Survived" value={`${r.survivedSeconds}s`} />
                    <Stat label="Points" value={`+${r.pointsEarned}`} />
                  </div>

                  {/* MOCK highlight clip — real per-player clips come from the video job. */}
                  <div className="relative flex aspect-video items-center justify-center rounded-lg bg-slate-800 text-slate-500">
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">
                      mock highlight
                    </span>
                    ▶ Your run{" "}
                    {r.eliminatedAtSeconds
                      ? `(eliminated at ${r.eliminatedAtSeconds}s)`
                      : "(survived to the end)"}
                  </div>

                  {userId && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500">
                        Shareable card:
                      </div>
                      <img
                        src={`${API_BASE}/cards/round/${r.roundId}/user/${userId}`}
                        alt="Result card"
                        className="w-full max-w-md rounded-lg border border-slate-800"
                      />
                    </div>
                  )}

                  <Link
                    to={`/rounds/${r.roundId}`}
                    className="inline-block text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    View full round →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 py-2">
      <div className="font-mono text-lg">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
