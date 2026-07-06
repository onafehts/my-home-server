import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type SubResp = { subscription: { tier: string; status: string } };

const PERKS = [
  "Guaranteed entry into every round",
  "Exclusive small-field Club games (better odds to win — and to be seen)",
  "Club-only cosmetics: skins, trails, name colors",
  "Early access to results",
];

export function Club() {
  const queryClient = useQueryClient();
  const sub = useQuery({
    queryKey: ["subscription"],
    queryFn: () => apiFetch<SubResp>("/me/subscription"),
  });
  const isClub = sub.data?.subscription.tier === "club";

  const subscribe = useMutation({
    mutationFn: () =>
      apiFetch("/me/subscription/subscribe", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["cosmetics"] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => apiFetch("/me/subscription/cancel", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscription"] }),
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-transparent p-6 text-center">
        <div className="text-4xl">👑</div>
        <h1 className="mt-2 text-2xl font-bold">Arena Club</h1>
        <p className="mt-1 text-slate-400">
          The premium tier for players who want the edge.
        </p>
        <span className="mt-2 inline-block rounded bg-black/40 px-2 py-0.5 text-xs text-yellow-300">
          billing is mocked (no real charge)
        </span>
      </div>

      <ul className="space-y-2">
        {PERKS.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-yellow-400">✓</span>
            <span className="text-slate-300">{p}</span>
          </li>
        ))}
      </ul>

      {isClub ? (
        <div className="space-y-3 text-center">
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 py-3 font-medium text-yellow-300">
            You're a Club member 👑
          </div>
          <button
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
            className="text-sm text-slate-400 hover:text-white"
          >
            Cancel membership
          </button>
        </div>
      ) : (
        <button
          onClick={() => subscribe.mutate()}
          disabled={subscribe.isPending}
          className="w-full rounded-lg bg-yellow-500 px-4 py-3 font-bold text-slate-900 hover:bg-yellow-400 disabled:opacity-50"
        >
          {subscribe.isPending ? "…" : "Join the Club (mock)"}
        </button>
      )}
    </div>
  );
}
