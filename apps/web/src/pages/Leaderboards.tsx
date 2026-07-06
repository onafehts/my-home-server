import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  apiFetch,
  type Division,
  type GlobalEntry,
  type RankInfo,
} from "../lib/api";
import { useSession } from "../lib/auth-client";

type Scope = "alltime" | "season";

const DIVISION_COLORS: Record<string, string> = {
  bronze: "text-amber-700",
  silver: "text-slate-300",
  gold: "text-yellow-400",
  diamond: "text-cyan-300",
  legend: "text-fuchsia-400",
};

export function Leaderboards() {
  const [scope, setScope] = useState<Scope>("alltime");
  const { data: session } = useSession();

  const board = useQuery({
    queryKey: ["leaderboard-global", scope],
    queryFn: () =>
      apiFetch<{ entries: GlobalEntry[]; season: { name: string } | null }>(
        `/leaderboards?scope=${scope}`,
      ),
  });

  const divisions = useQuery({
    queryKey: ["divisions"],
    queryFn: () => apiFetch<{ divisions: Division[] }>("/divisions"),
  });

  const myRank = useQuery({
    queryKey: ["my-rank"],
    enabled: Boolean(session),
    queryFn: () =>
      apiFetch<{ allTime: RankInfo; season: RankInfo }>("/me/rank"),
  });

  const mine = scope === "alltime" ? myRank.data?.allTime : myRank.data?.season;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <div className="flex rounded-lg border border-slate-800 p-0.5 text-sm">
          {(["alltime", "season"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-md px-3 py-1 ${
                scope === s ? "bg-indigo-600 text-white" : "text-slate-400"
              }`}
            >
              {s === "alltime" ? "All-time" : "This season"}
            </button>
          ))}
        </div>
      </div>

      {session && mine && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3">
          You: <strong>#{mine.rank}</strong> of {mine.totalPlayers} ·{" "}
          {mine.points} pts · top {mine.percentile}%
        </div>
      )}

      {divisions.data && (
        <div className="flex flex-wrap gap-2 text-xs">
          {divisions.data.divisions.map((d) => (
            <span
              key={d.tier}
              className="rounded-full border border-slate-800 px-3 py-1"
            >
              <span className={DIVISION_COLORS[d.tier] ?? ""}>{d.name}</span>{" "}
              <span className="text-slate-500">· {d.playerCount}</span>
            </span>
          ))}
        </div>
      )}

      {board.isPending ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <ol className="space-y-1">
          {board.data?.entries.map((e) => {
            const isMe = session?.user.id === e.userId;
            return (
              <li
                key={e.userId}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  isMe
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-800"
                }`}
              >
                <span className="w-8 text-right font-mono text-slate-500">
                  {e.rank}
                </span>
                {e.image ? (
                  <img
                    src={e.image}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-slate-800" />
                )}
                <span className="flex-1 truncate">
                  {e.name || "Anonymous"}
                  {isMe && <span className="ml-2 text-xs text-indigo-300">you</span>}
                </span>
                <span className={`text-xs ${DIVISION_COLORS[e.division] ?? ""}`}>
                  {e.division}
                </span>
                <span className="w-16 text-right font-mono text-slate-300">
                  {e.points}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
