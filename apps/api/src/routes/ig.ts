import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  entries,
  gameParticipants,
  games,
  rankingEntries,
  rankings,
  rounds,
  user,
} from "@arena/db";
import { requireAuth } from "../middleware/auth";
import type { Variables } from "../types";

/**
 * ⚠️ MOCK Instagram layer. These endpoints render the images that WOULD be
 * posted (as SVG) and simulate ingesting commenters as entrants. Real posting
 * and real comment ingestion require the Instagram Graph API — see ROADMAP.
 */
const ig = new Hono<{ Variables: Variables }>();

function esc(s: string): string {
  return s.replace(/[<>&]/g, (ch) =>
    ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&amp;",
  );
}

// Portrait 1080x1350 (IG feed) frame.
function frame(inner: string, badge: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#1e1b4b"/>
  </linearGradient></defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <text x="60" y="100" font-family="Arial" font-size="40" fill="#818cf8" font-weight="bold">🎲 ARENA</text>
  <text x="1020" y="100" text-anchor="end" font-family="Arial" font-size="26" fill="#475569">${esc(badge)}</text>
  ${inner}
  <text x="540" y="1280" text-anchor="middle" font-family="Arial" font-size="34" fill="#94a3b8">Follow + comment to enter the next battle</text>
</svg>`;
}

function svg(c: { header: (k: string, v: string) => void }, body: string) {
  c.header("Content-Type", "image/svg+xml");
  c.header("Cache-Control", "public, max-age=120");
  return body;
}

/** Next-round announcement post. */
ig.get("/game/:slug/announcement", async (c) => {
  const slug = c.req.param("slug");
  const [game] = await db.select().from(games).where(eq(games.slug, slug));
  if (!game) return c.text("Not found", 404);
  const [pc] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(gameParticipants)
    .where(eq(gameParticipants.gameId, game.id));
  const [mx] = await db
    .select({ n: sql<number>`coalesce(max(${rounds.roundNumber}),0)`.mapWith(Number) })
    .from(rounds)
    .where(eq(rounds.gameId, game.id));
  const inner = `
  <text x="540" y="520" text-anchor="middle" font-family="Arial" font-size="120">⚔️</text>
  <text x="540" y="660" text-anchor="middle" font-family="Arial" font-size="84" fill="#f8fafc" font-weight="bold">${esc(game.name)}</text>
  <text x="540" y="760" text-anchor="middle" font-family="Arial" font-size="60" fill="#818cf8" font-weight="bold">ROUND ${(mx?.n ?? 0) + 1} TONIGHT</text>
  <text x="540" y="850" text-anchor="middle" font-family="Arial" font-size="40" fill="#cbd5e1">${pc?.n ?? 0} players already in</text>`;
  return c.body(svg(c, frame(inner, "next round")));
});

/** Winner spotlight post for a specific round. */
ig.get("/round/:roundId/winner", async (c) => {
  const roundId = c.req.param("roundId");
  const [row] = await db
    .select({
      gameName: games.name,
      roundNumber: rounds.roundNumber,
      total: rounds.totalParticipants,
      winner: user.name,
    })
    .from(rounds)
    .innerJoin(games, eq(games.id, rounds.gameId))
    .leftJoin(user, eq(user.id, rounds.firstPlaceUserId))
    .where(eq(rounds.id, roundId));
  if (!row) return c.text("Not found", 404);
  const inner = `
  <text x="540" y="500" text-anchor="middle" font-family="Arial" font-size="160">🏆</text>
  <text x="540" y="650" text-anchor="middle" font-family="Arial" font-size="56" fill="#cbd5e1">${esc(row.gameName)} · Round ${row.roundNumber}</text>
  <text x="540" y="770" text-anchor="middle" font-family="Arial" font-size="90" fill="#fbbf24" font-weight="bold">${esc(row.winner || "Anonymous")}</text>
  <text x="540" y="860" text-anchor="middle" font-family="Arial" font-size="44" fill="#f8fafc">last one standing of ${row.total}</text>`;
  return c.body(svg(c, frame(inner, "winner")));
});

/** Top-10 leaderboard post. */
ig.get("/game/:slug/leaderboard", async (c) => {
  const slug = c.req.param("slug");
  const [game] = await db.select().from(games).where(eq(games.slug, slug));
  if (!game) return c.text("Not found", 404);
  const [latest] = await db
    .select()
    .from(rankings)
    .where(and(eq(rankings.gameId, game.id), isNull(rankings.seasonId)))
    .orderBy(desc(rankings.capturedAt))
    .limit(1);
  const rows = latest
    ? await db
        .select({
          name: user.name,
          points: rankingEntries.currentPoints,
          pos: rankingEntries.rankPosition,
        })
        .from(rankingEntries)
        .innerJoin(user, eq(user.id, rankingEntries.userId))
        .where(eq(rankingEntries.rankingId, latest.id))
        .orderBy(rankingEntries.rankPosition)
        .limit(10)
    : [];
  const list = rows
    .map(
      (r, i) =>
        `<text x="120" y="${420 + i * 78}" font-family="Arial" font-size="46" fill="${i < 3 ? "#fbbf24" : "#e2e8f0"}">${r.pos}. ${esc(r.name || "Anonymous")}</text>` +
        `<text x="960" y="${420 + i * 78}" text-anchor="end" font-family="Arial" font-size="46" fill="#94a3b8">${r.points}</text>`,
    )
    .join("\n");
  const inner = `
  <text x="540" y="300" text-anchor="middle" font-family="Arial" font-size="64" fill="#f8fafc" font-weight="bold">${esc(game.name)}</text>
  <text x="540" y="360" text-anchor="middle" font-family="Arial" font-size="40" fill="#818cf8">TOP 10</text>
  ${list}`;
  return c.body(svg(c, frame(inner, "leaderboard")));
});

/** MOCK: ingest N commenters as instagram_comment entries. */
ig.post(
  "/ingest-comments",
  requireAuth,
  zValidator("json", z.object({ gameId: z.string().uuid(), count: z.number().min(1).max(40).default(10) })),
  async (c) => {
    const { gameId, count } = c.req.valid("json");
    // Pick enrolled players who don't already have a pending entry.
    const pending = await db
      .select({ userId: entries.userId })
      .from(entries)
      .where(and(eq(entries.gameId, gameId), eq(entries.status, "pending")));
    const pendingIds = pending.map((p) => p.userId);
    const roster = await db
      .select({ userId: gameParticipants.userId })
      .from(gameParticipants)
      .where(
        pendingIds.length
          ? and(
              eq(gameParticipants.gameId, gameId),
              notInArray(gameParticipants.userId, pendingIds),
            )
          : eq(gameParticipants.gameId, gameId),
      )
      .limit(count);
    if (roster.length === 0) return c.json({ ingested: 0, mock: true });
    await db
      .insert(entries)
      .values(
        roster.map((r) => ({
          gameId,
          userId: r.userId,
          source: "instagram_comment" as const,
          status: "pending",
        })),
      )
      .onConflictDoNothing();
    return c.json({ ingested: roster.length, mock: true });
  },
);

export default ig;
