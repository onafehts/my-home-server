import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  apiFetch,
  type GameDetail as GameDetailData,
  type LeaderboardEntry,
  type RoundSummary,
} from "../lib/api";
import { useSession } from "../lib/auth-client";

type Scope = "alltime" | "season";

export function GameDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [scope, setScope] = useState<Scope>("alltime");

  const detail = useQuery({
    queryKey: ["game", slug],
    queryFn: () => apiFetch<GameDetailData>(`/games/${slug}`),
  });

  const gameId = detail.data?.game.id;

  const leaderboard = useQuery({
    queryKey: ["leaderboard", gameId, scope],
    enabled: Boolean(gameId),
    queryFn: () =>
      apiFetch<{ entries: LeaderboardEntry[] }>(
        `/games/${gameId}/leaderboard?scope=${scope}`,
      ),
  });

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ["game", slug] });
    queryClient.invalidateQueries({ queryKey: ["leaderboard", gameId] });
    queryClient.invalidateQueries({ queryKey: ["rounds", gameId] });
  }

  const enter = useMutation({
    mutationFn: () =>
      apiFetch(`/games/${gameId}/enter`, {
        method: "POST",
        body: JSON.stringify({ source: "site" }),
      }),
  });

  // MOCK: trigger the round engine so the loop is observable without the video job.
  const simulate = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/simulate-round`, {
        method: "POST",
        body: JSON.stringify({ gameId }),
      }),
    onSuccess: refetchAll,
  });

  const rounds = useQuery({
    queryKey: ["rounds", gameId],
    enabled: Boolean(gameId),
    queryFn: () =>
      apiFetch<{ rounds: RoundSummary[] }>(`/games/${gameId}/rounds`),
  });

  const toggleJoin = useMutation({
    mutationFn: async (joined: boolean) => {
      if (!gameId) return;
      await apiFetch(`/games/${gameId}/${joined ? "leave" : "join"}`, {
        method: joined ? "DELETE" : "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game", slug] });
    },
  });

  if (detail.isPending) return <p className="text-slate-400">Loading…</p>;
  if (detail.error)
    return <p className="text-rose-400">{String(detail.error)}</p>;

  const { game, participantCount, joined } = detail.data;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/games" className="text-sm text-slate-400 hover:text-white">
          ← All games
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{game.name}</h1>
        <p className="mt-2 text-slate-400">{game.description}</p>
        <p className="mt-1 text-sm text-slate-500">{participantCount} players</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {session ? (
            <>
              <button
                onClick={() => toggleJoin.mutate(joined)}
                disabled={toggleJoin.isPending}
                className={`rounded-lg px-5 py-2 font-medium disabled:opacity-50 ${
                  joined
                    ? "border border-slate-700 hover:bg-slate-800"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                {toggleJoin.isPending ? "…" : joined ? "Leave game" : "Join game"}
              </button>
              <button
                onClick={() => enter.mutate()}
                disabled={enter.isPending}
                className="rounded-lg border border-emerald-600/60 px-5 py-2 font-medium text-emerald-300 hover:bg-emerald-600/10 disabled:opacity-50"
              >
                {enter.isPending
                  ? "…"
                  : enter.isSuccess
                    ? "✓ Entered next round"
                    : "Enter next round"}
              </button>
              <button
                onClick={() => simulate.mutate()}
                disabled={simulate.isPending}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                title="Mock: runs the round engine now (stands in for the video job)"
              >
                {simulate.isPending ? "Running…" : "⚙️ Simulate round (demo)"}
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="rounded-lg bg-indigo-600 px-5 py-2 font-medium hover:bg-indigo-500"
            >
              Sign in to join
            </button>
          )}
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <div className="flex rounded-lg border border-slate-800 p-0.5 text-xs">
            {(["alltime", "season"] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-md px-2 py-1 ${
                  scope === s ? "bg-indigo-600 text-white" : "text-slate-400"
                }`}
              >
                {s === "alltime" ? "All-time" : "Season"}
              </button>
            ))}
          </div>
        </div>
        {leaderboard.data && leaderboard.data.entries.length > 0 ? (
          <ol className="space-y-1">
            {leaderboard.data.entries.map((e) => (
              <li
                key={e.userId}
                className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2"
              >
                <span>
                  <span className="mr-2 text-slate-500">#{e.rankPosition}</span>
                  {e.name || "Anonymous"}
                </span>
                <span className="font-mono text-slate-300">
                  {e.currentPoints} pts
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">
            No ranking yet — play a round to seed the leaderboard.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Rounds</h2>
        {rounds.data && rounds.data.rounds.length > 0 ? (
          <ul className="space-y-1">
            {rounds.data.rounds.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/rounds/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 hover:border-indigo-500"
                >
                  <span>
                    Round {r.roundNumber}
                    {r.name ? ` — ${r.name}` : ""}
                  </span>
                  <span className="text-xs text-slate-500">{r.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No rounds have been played.</p>
        )}
      </section>
    </div>
  );
}
