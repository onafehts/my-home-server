import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { simulateRoundSchema } from "@arena/core";
import { simulateRound } from "@arena/db";
import { requireAuth } from "../middleware/auth";
import type { Variables } from "../types";

const admin = new Hono<{ Variables: Variables }>();

/**
 * ⚠️ MOCK / DEMO endpoint. Triggers the mock round engine so the app's loop is
 * observable without the video job. In production this becomes an internal,
 * role-gated operation (or is driven entirely by the generator job). Any
 * authenticated user can call it for now — see ROADMAP.
 */
admin.post(
  "/simulate-round",
  requireAuth,
  zValidator("json", simulateRoundSchema),
  async (c) => {
    const { gameId } = c.req.valid("json");
    const result = await simulateRound(gameId, { createNotifications: true });
    if (!result) return c.json({ error: "No players enrolled in this game" }, 400);
    return c.json({ ...result, mock: true });
  },
);

export default admin;
