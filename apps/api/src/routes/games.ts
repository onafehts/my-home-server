import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  enterGameSchema,
  idParamSchema,
  leaderboardQuerySchema,
} from "@arena/core";
import {
  db,
  entries,
  gameParticipants,
  games,
  rankingEntries,
  rankings,
  rounds,
  seasons,
  user,
} from "@arena/db";
import { requireAuth } from "../middleware/auth";
import type { Variables } from "../types";

const gamesRoute = new Hono<{ Variables: Variables }>();

/** List games with participant counts. */
gamesRoute.get("/", async (c) => {
  const rows = await db
    .select({
      id: games.id,
      name: games.name,
      slug: games.slug,
      description: games.description,
      status: games.status,
      participantCount: sql<number>`count(${gameParticipants.id})`.mapWith(
        Number,
      ),
    })
    .from(games)
    .leftJoin(gameParticipants, eq(gameParticipants.gameId, games.id))
    .groupBy(games.id)
    .orderBy(games.name);
  return c.json({ games: rows });
});

/** Game detail by slug + whether the current user has joined. */
gamesRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const [game] = await db.select().from(games).where(eq(games.slug, slug));
  if (!game) return c.json({ error: "Game not found" }, 404);

  const [counts] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(gameParticipants)
    .where(eq(gameParticipants.gameId, game.id));

  let joined = false;
  const current = c.get("user");
  if (current) {
    const [membership] = await db
      .select({ id: gameParticipants.id })
      .from(gameParticipants)
      .where(
        and(
          eq(gameParticipants.gameId, game.id),
          eq(gameParticipants.userId, current.id),
        ),
      );
    joined = Boolean(membership);
  }
  return c.json({ game, participantCount: counts?.count ?? 0, joined });
});

/** Join a game (enroll to play). */
gamesRoute.post(
  "/:id/join",
  requireAuth,
  zValidator("param", idParamSchema),
  async (c) => {
    const { id: gameId } = c.req.valid("param");
    const current = c.get("user")!;
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.id, gameId));
    if (!game) return c.json({ error: "Game not found" }, 404);
    await db
      .insert(gameParticipants)
      .values({ gameId, userId: current.id })
      .onConflictDoNothing();
    return c.json({ joined: true });
  },
);

/** Leave a game. */
gamesRoute.delete(
  "/:id/leave",
  requireAuth,
  zValidator("param", idParamSchema),
  async (c) => {
    const { id: gameId } = c.req.valid("param");
    const current = c.get("user")!;
    await db
      .delete(gameParticipants)
      .where(
        and(
          eq(gameParticipants.gameId, gameId),
          eq(gameParticipants.userId, current.id),
        ),
      );
    return c.json({ left: true });
  },
);

/** Latest leaderboard snapshot for a game (scope: alltime | season). */
gamesRoute.get(
  "/:id/leaderboard",
  zValidator("param", idParamSchema),
  zValidator("query", leaderboardQuerySchema),
  async (c) => {
    const { id: gameId } = c.req.valid("param");
    const { scope } = c.req.valid("query");
    let { seasonId } = c.req.valid("query");

    if (scope === "season" && !seasonId) {
      const [active] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.isActive, true))
        .limit(1);
      seasonId = active?.id;
    }

    const [latest] = await db
      .select()
      .from(rankings)
      .where(
        and(
          eq(rankings.gameId, gameId),
          scope === "season" && seasonId
            ? eq(rankings.seasonId, seasonId)
            : isNull(rankings.seasonId),
        ),
      )
      .orderBy(desc(rankings.capturedAt))
      .limit(1);
    if (!latest) return c.json({ ranking: null, entries: [], scope });
    const entries = await db
      .select({
        userId: rankingEntries.userId,
        currentPoints: rankingEntries.currentPoints,
        rankPosition: rankingEntries.rankPosition,
        name: user.name,
        image: user.image,
      })
      .from(rankingEntries)
      .innerJoin(user, eq(user.id, rankingEntries.userId))
      .where(eq(rankingEntries.rankingId, latest.id))
      .orderBy(rankingEntries.rankPosition);
    return c.json({ ranking: latest, entries, scope });
  },
);

/** Rounds for a game (newest first). */
gamesRoute.get(
  "/:id/rounds",
  zValidator("param", idParamSchema),
  async (c) => {
    const { id: gameId } = c.req.valid("param");
    const rows = await db
      .select()
      .from(rounds)
      .where(eq(rounds.gameId, gameId))
      .orderBy(desc(rounds.roundNumber));
    return c.json({ rounds: rows });
  },
);

/** Enter the next round. Ensures enrollment, then queues a pending entry. */
gamesRoute.post(
  "/:id/enter",
  requireAuth,
  zValidator("param", idParamSchema),
  zValidator("json", enterGameSchema),
  async (c) => {
    const { id: gameId } = c.req.valid("param");
    const { source } = c.req.valid("json");
    const current = c.get("user")!;

    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.id, gameId));
    if (!game) return c.json({ error: "Game not found" }, 404);

    // Ensure the player is enrolled, then queue the entry.
    await db
      .insert(gameParticipants)
      .values({ gameId, userId: current.id })
      .onConflictDoNothing();
    await db
      .insert(entries)
      .values({ gameId, userId: current.id, source, status: "pending" })
      .onConflictDoNothing();

    return c.json({ entered: true, source });
  },
);

export default gamesRoute;
