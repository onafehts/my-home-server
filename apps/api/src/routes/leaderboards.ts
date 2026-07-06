import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { desc, eq, sql } from "drizzle-orm";
import { divisionForPoints, leaderboardQuerySchema } from "@arena/core";
import { db, pointsLedger, seasons, user } from "@arena/db";
import type { Variables } from "../types";

const leaderboards = new Hono<{ Variables: Variables }>();

/** Global, cross-game leaderboard (scope: alltime | season). */
leaderboards.get("/", zValidator("query", leaderboardQuerySchema), async (c) => {
  const { scope } = c.req.valid("query");
  let seasonId = c.req.valid("query").seasonId;
  let season = null;

  if (scope === "season") {
    if (seasonId) {
      const [s] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      season = s ?? null;
    } else {
      const [a] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.isActive, true))
        .limit(1);
      season = a ?? null;
      seasonId = a?.id;
    }
  }

  const totalExpr = sql<number>`sum(${pointsLedger.points})`;
  const rows = await db
    .select({
      userId: pointsLedger.userId,
      total: totalExpr.mapWith(Number),
      name: user.name,
      image: user.image,
    })
    .from(pointsLedger)
    .innerJoin(user, eq(user.id, pointsLedger.userId))
    .where(
      scope === "season" && seasonId
        ? eq(pointsLedger.seasonId, seasonId)
        : sql`true`,
    )
    .groupBy(pointsLedger.userId, user.name, user.image)
    .orderBy(desc(totalExpr))
    .limit(100);

  return c.json({
    scope,
    season,
    entries: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      name: r.name,
      image: r.image,
      points: r.total,
      division: divisionForPoints(r.total),
    })),
  });
});

export default leaderboards;
