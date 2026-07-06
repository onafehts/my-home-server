import { Link } from "react-router-dom";

export function Landing() {
  return (
    <div className="space-y-6 py-10 text-center">
      <h1 className="text-4xl font-black tracking-tight">
        Games decided by pure chance.
      </h1>
      <p className="mx-auto max-w-xl text-slate-400">
        Register, join a game, and watch fate play out. Every round becomes a
        video posted to Instagram, YouTube Shorts, and TikTok. You just pick
        your games — the universe picks the winner.
      </p>
      <div className="flex justify-center gap-3">
        <Link
          to="/games"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium hover:bg-indigo-500"
        >
          Browse games
        </Link>
        <Link
          to="/login"
          className="rounded-lg border border-slate-700 px-5 py-2.5 font-medium hover:bg-slate-800"
        >
          Sign in to play
        </Link>
      </div>
    </div>
  );
}
