import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type Notification } from "../lib/api";

const ICON: Record<string, string> = {
  round_result: "🏆",
  eliminated: "💥",
  achievement: "🏅",
  round_entered: "✅",
  season_end: "📅",
  promotion: "⬆️",
};

export function Notifications() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      apiFetch<{ notifications: Notification[]; unreadCount: number }>(
        "/me/notifications",
      ),
  });

  const markRead = useMutation({
    mutationFn: () =>
      apiFetch("/me/notifications/read", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (q.isPending) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Notifications{" "}
          {q.data && q.data.unreadCount > 0 && (
            <span className="ml-1 rounded-full bg-rose-500 px-2 py-0.5 text-sm">
              {q.data.unreadCount}
            </span>
          )}
        </h1>
        <button
          onClick={() => markRead.mutate()}
          className="text-sm text-slate-400 hover:text-white"
        >
          Mark all read
        </button>
      </div>

      <ul className="space-y-1">
        {q.data?.notifications.map((n) => (
          <li
            key={n.id}
            className={`flex gap-3 rounded-lg border px-4 py-3 ${
              n.read ? "border-slate-800" : "border-indigo-500/40 bg-indigo-500/5"
            }`}
          >
            <span className="text-xl">{ICON[n.type] ?? "🔔"}</span>
            <div>
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-sm text-slate-400">{n.body}</div>}
            </div>
          </li>
        ))}
        {q.data?.notifications.length === 0 && (
          <li className="text-slate-500">Nothing yet.</li>
        )}
      </ul>
    </div>
  );
}
