import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { signOut, useSession } from "../lib/auth-client";

export function Layout({ children }: { children: ReactNode }) {
  const { data } = useSession();
  const navigate = useNavigate();

  const notifs = useQuery({
    queryKey: ["notifications"],
    enabled: Boolean(data),
    queryFn: () => apiFetch<{ unreadCount: number }>("/me/notifications"),
  });

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">
            🎲 Arena
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/games" className="text-slate-300 hover:text-white">
              Games
            </Link>
            <Link to="/leaderboards" className="text-slate-300 hover:text-white">
              Leaderboard
            </Link>
            {data ? (
              <>
                <Link to="/results" className="text-slate-300 hover:text-white">
                  Results
                </Link>
                <Link to="/studio" className="text-slate-300 hover:text-white">
                  Studio
                </Link>
                <Link
                  to="/notifications"
                  className="relative text-slate-300 hover:text-white"
                  aria-label="Notifications"
                >
                  🔔
                  {notifs.data && notifs.data.unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold">
                      {notifs.data.unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/profile"
                  className="text-slate-300 hover:text-white"
                >
                  {data.user.name || data.user.email}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded bg-indigo-600 px-3 py-1 font-medium hover:bg-indigo-500"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
