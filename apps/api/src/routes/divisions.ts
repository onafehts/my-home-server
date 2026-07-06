import { Hono } from "hono";
import { asc, eq, sql } from "drizzle-orm";
import { divisionForPoints } from "@arena/core";
import { db, divisions, pointsLedger, seasons } from "@arena/db";
import type { Variables } from "../types";

const divisionsRoute = new Hono<{ Variables: Variables }>();

/** The division ladder + how many players sit in each for the active season. */
divisionsRoute.get("/", async (c) => {
  const ladder = await db.select().from(divisions).orderBy(asc(divisions.sortOrder));

  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);

  const counts: Record<string, number> = {};
  if (season) {
    const rows = await db
      .select({
        userId: pointsLedger.userId,
        total: sql<number>`sum(${pointsLedger.points})`.mapWith(Number),
      })
      .from(pointsLedger)
      .where(eq(pointsLedger.seasonId, season.id))
      .groupBy(pointsLedger.userId);
    for (const r of rows) {
      const tier = divisionForPoints(r.total);
      counts[tier] = (counts[tier] ?? 0) + 1;
    }
  }

  return c.json({
    season: season ?? null,
    divisions: ladder.map((d) => ({ ...d, playerCount: counts[d.tier] ?? 0 })),
  });
});

export default divisionsRoute;
