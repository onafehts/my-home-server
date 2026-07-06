const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** Thin fetch wrapper for our own API. Sends the session cookie. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`Request failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

// ─── Response shapes (kept in sync with apps/api by hand for now) ─────────────
export type GameSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  participantCount: number;
};

export type GameDetail = {
  game: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
  };
  participantCount: number;
  joined: boolean;
};

export type Social = {
  id: string;
  platform: string;
  username: string;
  url: string | null;
};

export type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  socials: Social[];
};

export type RoundSummary = {
  id: string;
  roundNumber: number;
  name: string | null;
  status: string;
  playedAt: string | null;
  totalParticipants: number;
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  image: string | null;
  currentPoints: number;
  rankPosition: number;
};
