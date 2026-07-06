import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch, type GameSummary } from "../lib/api";

export function Games() {
  const { data, isPending, error } = useQuery({
    queryKey: ["games"],
    queryFn: () => apiFetch<{ games: GameSummary[] }>("/games"),
  });

  if (isPending) return <p className="text-slate-400">Loading games…</p>;
  if (error) return <p className="text-rose-400">{String(error)}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Games</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.games.map((g) => (
          <Link
            key={g.id}
            to={`/games/${g.slug}`}
            className="block rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition hover:border-indigo-500"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{g.name}</h2>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                {g.participantCount} players
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{g.description}</p>
          </Link>
        ))}
        {data.games.length === 0 && (
          <p className="text-slate-500">No games yet.</p>
        )}
      </div>
    </div>
  );
}
