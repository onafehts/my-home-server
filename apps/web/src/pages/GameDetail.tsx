import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  apiFetch,
  type GameDetail as GameDetailData,
  type LeaderboardEntry,
  type RoundSummary,
} from "../lib/api";
import { useSession } from "../lib/auth-client";

export function GameDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const detail = useQuery({
    queryKey: ["game", slug],
    queryFn: () => apiFetch<GameDetailData>(`/games/${slug}`),
  });

  const gameId = detail.data?.game.id;

  const leaderboard = useQuery({
    queryKey: ["leaderboard", gameId],
    enabled: Boolean(gameId),
    queryFn: () =>
      apiFetch<{ entries: LeaderboardEntry[] }>(
        `/games/${gameId}/leaderboard`,
      ),
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

        <div className="mt-4">
          {session ? (
            <button
              onClick={() => toggleJoin.mutate(joined)}
              disabled={toggleJoin.isPending}
              className={`rounded-lg px-5 py-2 font-medium disabled:opacity-50 ${
                joined
                  ? "border border-slate-700 hover:bg-slate-800"
                  : "bg-indigo-600 hover:bg-indigo-500"
              }`}
            >
              {toggleJoin.isPending
                ? "…"
                : joined
                  ? "Leave game"
                  : "Join game"}
            </button>
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
        <h2 className="mb-3 text-lg font-semibold">Leaderboard</h2>
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
