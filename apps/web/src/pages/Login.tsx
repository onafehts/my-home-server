import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient, signIn } from "../lib/auth-client";

type Step = "email" | "otp";

export function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? "Could not send code");
      return;
    }
    setStep("otp");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn.emailOtp({ email, otp });
    setBusy(false);
    if (error) {
      setError(error.message ?? "Invalid code");
      return;
    }
    navigate("/games");
  }

  async function google() {
    await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/games`,
    });
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Sign in</h1>

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm text-slate-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-sm text-slate-400">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
          <input
            inputMode="numeric"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-sm text-slate-400 hover:text-white"
          >
            ← Use a different email
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-800" /> or{" "}
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      <button
        onClick={google}
        className="w-full rounded-lg border border-slate-700 px-4 py-2 font-medium hover:bg-slate-800"
      >
        Continue with Google
      </button>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
