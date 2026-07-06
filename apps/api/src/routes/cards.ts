import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, games, roundParticipants, rounds, user } from "@arena/db";
import type { Variables } from "../types";

const cards = new Hono<{ Variables: Variables }>();

function esc(s: string): string {
  return s.replace(/[<>&]/g, (ch) =>
    ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&amp;",
  );
}

function renderCard(d: {
  userName: string;
  gameName: string;
  roundNumber: number;
  placement: number | null;
  total: number;
  points: number;
}): string {
  const medal =
    d.placement === 1 ? "🥇" : d.placement === 2 ? "🥈" : d.placement === 3 ? "🥉" : "🎯";
  const headline =
    d.placement === 1
      ? "WINNER"
      : d.placement
        ? `Finished #${d.placement} of ${d.total}`
        : "Played";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="60" y="110" font-family="Arial, sans-serif" font-size="34" fill="#818cf8" font-weight="bold">🎲 ARENA · ${esc(d.gameName)}</text>
  <text x="600" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="180">${medal}</text>
  <text x="600" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" fill="#f8fafc" font-weight="bold">${esc(headline)}</text>
  <text x="600" y="490" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" fill="#cbd5e1">${esc(d.userName)} · Round ${d.roundNumber} · +${d.points} pts</text>
  <text x="600" y="580" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#64748b">Follow to enter the next battle</text>
</svg>`;
}

/** Public shareable result card as SVG (embeddable as an <img>). */
cards.get("/round/:roundId/user/:userId", async (c) => {
  const roundId = c.req.param("roundId");
  const userId = c.req.param("userId");
  const [row] = await db
    .select({
      userName: user.name,
      gameName: games.name,
      roundNumber: rounds.roundNumber,
      placement: roundParticipants.placement,
      total: rounds.totalParticipants,
      points: roundParticipants.pointsEarned,
    })
    .from(roundParticipants)
    .innerJoin(rounds, eq(rounds.id, roundParticipants.roundId))
    .innerJoin(games, eq(games.id, rounds.gameId))
    .innerJoin(user, eq(user.id, roundParticipants.userId))
    .where(
      and(
        eq(roundParticipants.roundId, roundId),
        eq(roundParticipants.userId, userId),
      ),
    );
  if (!row) return c.text("Not found", 404);
  c.header("Content-Type", "image/svg+xml");
  c.header("Cache-Control", "public, max-age=300");
  return c.body(renderCard(row));
});

export default cards;
