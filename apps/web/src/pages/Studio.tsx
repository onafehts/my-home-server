import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { API_BASE, apiFetch, type GameSummary, type RoundSummary } from "../lib/api";

/**
 * Instagram Studio (MOCK). Previews the images that the video job would post to
 * Instagram/TikTok/YouTube, and simulates ingesting commenters as entrants.
 * Real posting + ingestion need the Instagram Graph API — see ROADMAP.
 */
export function Studio() {
  const [slug, setSlug] = useState<string>("");

  const games = useQuery({
    queryKey: ["games"],
    queryFn: () => apiFetch<{ games: GameSummary[] }>("/games"),
  });
  const current = games.data?.games.find((g) => g.slug === slug) ?? games.data?.games[0];
  const gameId = current?.id;

  const rounds = useQuery({
    queryKey: ["rounds", gameId],
    enabled: Boolean(gameId),
    queryFn: () => apiFetch<{ rounds: RoundSummary[] }>(`/games/${gameId}/rounds`),
  });
  const latestRound = rounds.data?.rounds[0];

  const ingest = useMutation({
    mutationFn: () =>
      apiFetch<{ ingested: number }>("/ig/ingest-comments", {
        method: "POST",
        body: JSON.stringify({ gameId, count: 10 }),
      }),
  });

  if (!current) return <p className="text-slate-400">Loading…</p>;
  const s = current.slug;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Instagram Studio</h1>
        <p className="text-sm text-slate-400">
          Previews of what gets posted to the channels.{" "}
          <span className="text-slate-600">
            (mock — real posting/ingestion needs the Instagram Graph API)
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={s}
          onChange={(e) => setSlug(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
        >
          {games.data?.games.map((g) => (
            <option key={g.id} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => ingest.mutate()}
          disabled={ingest.isPending}
          className="rounded-lg border border-emerald-600/60 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-600/10 disabled:opacity-50"
        >
          {ingest.isPending
            ? "…"
            : ingest.isSuccess
              ? `✓ Ingested ${ingest.data?.ingested} comments`
              : "Ingest 10 IG comments (mock)"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Post title="Round announcement" src={`${API_BASE}/ig/game/${s}/announcement`} />
        <Post title="Top-10 leaderboard" src={`${API_BASE}/ig/game/${s}/leaderboard`} />
        {latestRound && (
          <Post
            title="Winner spotlight"
            src={`${API_BASE}/ig/round/${latestRound.id}/winner`}
          />
        )}
      </div>
    </div>
  );
}

function Post({ title, src }: { title: string; src: string }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">{title}</div>
      <img
        src={src}
        alt={title}
        className="w-full rounded-xl border border-slate-800"
      />
    </div>
  );
}
