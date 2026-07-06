import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
import { idParamSchema } from "@arena/core";
import { content, db, roundParticipants, rounds, user } from "@arena/db";
import type { Variables } from "../types";

const roundsRoute = new Hono<{ Variables: Variables }>();

/** Round detail: the round, its roster, and any posted media. */
roundsRoute.get("/:id", zValidator("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const [round] = await db.select().from(rounds).where(eq(rounds.id, id));
  if (!round) return c.json({ error: "Round not found" }, 404);

  const participants = await db
    .select({
      userId: roundParticipants.userId,
      placement: roundParticipants.placement,
      pointsEarned: roundParticipants.pointsEarned,
      name: user.name,
      image: user.image,
    })
    .from(roundParticipants)
    .innerJoin(user, eq(user.id, roundParticipants.userId))
    .where(eq(roundParticipants.roundId, id))
    .orderBy(asc(roundParticipants.placement));

  const media = await db
    .select()
    .from(content)
    .where(eq(content.roundId, id));

  return c.json({ round, participants, media });
});

export default roundsRoute;
