import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/auth-client";

export function Layout({ children }: { children: ReactNode }) {
  const { data } = useSession();
  const navigate = useNavigate();

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
            {data ? (
              <>
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
