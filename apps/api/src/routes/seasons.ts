import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db, seasons } from "@arena/db";
import type { Variables } from "../types";

const seasonsRoute = new Hono<{ Variables: Variables }>();

seasonsRoute.get("/", async (c) => {
  const all = await db.select().from(seasons).orderBy(desc(seasons.startsAt));
  return c.json({ seasons: all, current: all.find((s) => s.isActive) ?? null });
});

export default seasonsRoute;
