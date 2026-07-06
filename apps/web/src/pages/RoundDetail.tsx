import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type RoundResponse = {
  round: {
    id: string;
    roundNumber: number;
    name: string | null;
    status: string;
    playedAt: string | null;
    totalParticipants: number;
  };
  participants: {
    userId: string;
    name: string;
    image: string | null;
    placement: number | null;
    pointsEarned: number;
  }[];
  media: {
    id: string;
    mediaType: string;
    url: string | null;
    sourceUrl: string | null;
    thumbnailUrl: string | null;
    postedAt: string | null;
  }[];
};

export function RoundDetail() {
  const { id = "" } = useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ["round", id],
    queryFn: () => apiFetch<RoundResponse>(`/rounds/${id}`),
  });

  if (isPending) return <p className="text-slate-400">Loading…</p>;
  if (error) return <p className="text-rose-400">{String(error)}</p>;

  const { round, participants, media } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Round {round.roundNumber}
        {round.name ? ` — ${round.name}` : ""}
      </h1>
      <p className="text-sm text-slate-500">
        Status: {round.status} · {round.totalParticipants} participants
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Posted videos</h2>
        {media.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {media.map((m) => (
              <a
                key={m.id}
                href={m.url ?? m.sourceUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-slate-800 p-3 hover:border-indigo-500"
              >
                {m.thumbnailUrl ? (
                  <img
                    src={m.thumbnailUrl}
                    alt="thumbnail"
                    className="mb-2 aspect-video w-full rounded object-cover"
                  />
                ) : (
                  <div className="mb-2 aspect-video w-full rounded bg-slate-800" />
                )}
                <span className="text-sm capitalize text-slate-400">
                  {m.mediaType}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No media posted for this round yet.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Results</h2>
        <ol className="space-y-1">
          {participants.map((p) => (
            <li
              key={p.userId}
              className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2"
            >
              <span>
                <span className="mr-2 text-slate-500">
                  {p.placement ? `#${p.placement}` : "—"}
                </span>
                {p.name || "Anonymous"}
              </span>
              <span className="font-mono text-slate-300">
                +{p.pointsEarned}
              </span>
            </li>
          ))}
          {participants.length === 0 && (
            <li className="text-sm text-slate-500">No participants recorded.</li>
          )}
        </ol>
      </section>
    </div>
  );
}
