import { PLATFORMS, type Platform } from "@arena/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiFetch,
  type Achievement,
  type Cosmetic,
  type MeResponse,
  type RankInfo,
  type Stats,
} from "../lib/api";
import { authClient } from "../lib/auth-client";

// Response shape from POST /me/avatar-upload-url.
type UploadResp = {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
};

export function Profile() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/me"),
  });
  const stats = useQuery({
    queryKey: ["me-stats"],
    queryFn: () => apiFetch<Stats>("/me/stats"),
  });
  const rank = useQuery({
    queryKey: ["my-rank"],
    queryFn: () => apiFetch<{ allTime: RankInfo }>("/me/rank"),
  });
  const achievements = useQuery({
    queryKey: ["me-achievements"],
    queryFn: () => apiFetch<{ achievements: Achievement[] }>("/me/achievements"),
  });
  const cosmeticsQ = useQuery({
    queryKey: ["cosmetics"],
    queryFn: () => apiFetch<{ cosmetics: Cosmetic[] }>("/me/cosmetics"),
  });
  const equip = useMutation({
    mutationFn: (cosmeticId: string) =>
      apiFetch("/me/cosmetics/equip", {
        method: "POST",
        body: JSON.stringify({ cosmeticId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cosmetics"] }),
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [platform, setPlatform] = useState<Platform>(PLATFORMS[0]);
  const [username, setUsername] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (me.data) {
      setFirstName(me.data.user.firstName ?? "");
      setLastName(me.data.user.lastName ?? "");
    }
  }, [me.data]);

  const saveProfile = useMutation({
    // Route through Better Auth's updateUser so the client session cache (used
    // by the nav) updates immediately, instead of writing the DB behind its back.
    mutationFn: async () => {
      const name = [firstName, lastName].filter(Boolean).join(" ").trim();
      const { error } = await authClient.updateUser({
        firstName,
        lastName,
        ...(name ? { name } : {}),
      });
      if (error) throw new Error(error.message ?? "Update failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const addSocial = useMutation({
    mutationFn: () =>
      apiFetch("/me/socials", {
        method: "POST",
        body: JSON.stringify({ platform, username }),
      }),
    onSuccess: () => {
      setUsername("");
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const removeSocial = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/socials/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // 1. ask API for a presigned PUT URL
      const presign = await apiFetch<UploadResp>("/me/avatar-upload-url", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type }),
      });
      // 2. upload the bytes straight to MinIO
      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      // 3. persist the public URL on the user
      await apiFetch("/me/avatar", {
        method: "PUT",
        body: JSON.stringify({ imageUrl: presign.publicUrl }),
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } finally {
      setUploading(false);
    }
  }

  if (me.isPending) return <p className="text-slate-400">Loading…</p>;
  if (me.error) return <p className="text-rose-400">{String(me.error)}</p>;

  return (
    <div className="max-w-lg space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <Link to="/club" className="text-sm text-yellow-400 hover:text-yellow-300">
          👑 Club
        </Link>
      </div>

      {stats.data && (
        <section className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <StatTile label="Division" value={stats.data.division} />
          <StatTile
            label="Rank"
            value={rank.data?.allTime ? `#${rank.data.allTime.rank}` : "—"}
          />
          <StatTile label="Points" value={String(stats.data.totalPoints)} />
          <StatTile label="Rounds" value={String(stats.data.roundsPlayed)} />
          <StatTile label="Wins" value={String(stats.data.wins)} />
          <StatTile
            label="Best"
            value={stats.data.bestFinish ? `#${stats.data.bestFinish}` : "—"}
          />
        </section>
      )}

      <section className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-800">
          {me.data.user.image && (
            <img
              src={me.data.user.image}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          {uploading ? "Uploading…" : "Change picture"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onAvatarChange}
            disabled={uploading}
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">Name</h2>
        <div className="flex gap-2">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </div>
        <button
          onClick={() => saveProfile.mutate()}
          disabled={saveProfile.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {saveProfile.isPending ? "Saving…" : "Save"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">
          Social handles
        </h2>
        <ul className="space-y-1">
          {me.data.socials.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2"
            >
              <span>
                <span className="mr-2 rounded bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-400">
                  {s.platform}
                </span>
                @{s.username}
              </span>
              <button
                onClick={() => removeSocial.mutate(s.id)}
                className="text-sm text-rose-400 hover:text-rose-300"
              >
                Remove
              </button>
            </li>
          ))}
          {me.data.socials.length === 0 && (
            <li className="text-sm text-slate-500">No handles added yet.</li>
          )}
        </ul>
        <div className="flex gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 capitalize"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
          <button
            onClick={() => addSocial.mutate()}
            disabled={!username || addSocial.isPending}
            className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      {achievements.data && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400">Achievements</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {achievements.data.achievements.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                  a.earned
                    ? "border-slate-700"
                    : "border-slate-800 opacity-40"
                }`}
                title={a.description}
              >
                <span className="text-xl">{a.icon}</span>
                <span className="text-sm">{a.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {cosmeticsQ.data && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400">
            Cosmetics <span className="text-slate-600">(mock — equip to try)</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cosmeticsQ.data.cosmetics.map((cos) => (
              <button
                key={cos.id}
                onClick={() => equip.mutate(cos.id)}
                disabled={equip.isPending}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${
                  cos.equipped
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-800 hover:border-slate-600"
                }`}
              >
                <span
                  className="h-5 w-5 rounded-full"
                  style={{
                    background: cos.type === "name_color" ? undefined : cos.value,
                    color: cos.value,
                  }}
                >
                  {cos.type === "name_color" ? "A" : ""}
                </span>
                <span className="flex-1 text-sm">
                  {cos.name}
                  {cos.clubOnly && <span className="ml-1 text-xs text-yellow-400">👑</span>}
                </span>
                {cos.equipped && <span className="text-xs text-indigo-300">on</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 py-2">
      <div className="font-mono text-lg capitalize">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
