import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  addSocialSchema,
  avatarUploadRequestSchema,
  divisionForPoints,
  equipCosmeticSchema,
  idParamSchema,
  markNotificationsSchema,
  updateProfileSchema,
} from "@arena/core";
import {
  achievements,
  cosmetics,
  db,
  games,
  notifications,
  pointsLedger,
  roundParticipants,
  rounds,
  seasons,
  subscriptions,
  user,
  userAchievements,
  userCosmetics,
  userSocials,
} from "@arena/db";
import { requireAuth } from "../middleware/auth";
import { presignedAvatarUpload } from "../storage";
import type { Variables } from "../types";

const me = new Hono<{ Variables: Variables }>();
me.use("*", requireAuth);

/** Current profile + linked social handles. */
me.get("/", async (c) => {
  const current = c.get("user")!;
  const socials = await db
    .select()
    .from(userSocials)
    .where(eq(userSocials.userId, current.id));
  return c.json({ user: current, socials });
});

/** Update first/last name (and derived display name). */
me.patch("/", zValidator("json", updateProfileSchema), async (c) => {
  const current = c.get("user")!;
  const body = c.req.valid("json");
  const first = body.firstName ?? current.firstName ?? "";
  const last = body.lastName ?? current.lastName ?? "";
  const name = [first, last].filter(Boolean).join(" ").trim();
  const [updated] = await db
    .update(user)
    .set({
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(name ? { name } : {}),
      updatedAt: new Date(),
    })
    .where(eq(user.id, current.id))
    .returning();
  return c.json({ user: updated });
});

/** Step 1 of avatar change: get a presigned PUT URL for MinIO. */
me.post(
  "/avatar-upload-url",
  zValidator("json", avatarUploadRequestSchema),
  async (c) => {
    const current = c.get("user")!;
    const { contentType } = c.req.valid("json");
    const result = await presignedAvatarUpload(current.id, contentType);
    return c.json(result);
  },
);

/** Step 2: persist the public URL after the browser uploads the file. */
me.put(
  "/avatar",
  zValidator("json", z.object({ imageUrl: z.string().url() })),
  async (c) => {
    const current = c.get("user")!;
    const { imageUrl } = c.req.valid("json");
    const [updated] = await db
      .update(user)
      .set({ image: imageUrl, updatedAt: new Date() })
      .where(eq(user.id, current.id))
      .returning();
    return c.json({ user: updated });
  },
);

// ─── Socials ─────────────────────────────────────────────────────────────────
me.get("/socials", async (c) => {
  const current = c.get("user")!;
  const socials = await db
    .select()
    .from(userSocials)
    .where(eq(userSocials.userId, current.id));
  return c.json({ socials });
});

me.post("/socials", zValidator("json", addSocialSchema), async (c) => {
  const current = c.get("user")!;
  const body = c.req.valid("json");
  const [social] = await db
    .insert(userSocials)
    .values({
      userId: current.id,
      platform: body.platform,
      username: body.username,
      url: body.url ?? null,
    })
    .returning();
  return c.json({ social }, 201);
});

me.delete(
  "/socials/:id",
  zValidator("param", z.object({ id: z.string().uuid() })),
  async (c) => {
    const current = c.get("user")!;
    const { id } = c.req.valid("param");
    await db
      .delete(userSocials)
      .where(and(eq(userSocials.id, id), eq(userSocials.userId, current.id)));
    return c.json({ deleted: true });
  },
);

// ─── Stats ───────────────────────────────────────────────────────────────────
me.get("/stats", async (c) => {
  const uid = c.get("user")!.id;
  const [agg] = await db
    .select({
      roundsPlayed: sql<number>`count(*)`.mapWith(Number),
      wins: sql<number>`count(*) filter (where ${roundParticipants.placement} = 1)`.mapWith(
        Number,
      ),
      podiums: sql<number>`count(*) filter (where ${roundParticipants.placement} <= 3)`.mapWith(
        Number,
      ),
      bestFinish: sql<number | null>`min(${roundParticipants.placement})`.mapWith(
        Number,
      ),
    })
    .from(roundParticipants)
    .where(eq(roundParticipants.userId, uid));

  const [pts] = await db
    .select({
      total: sql<number>`coalesce(sum(${pointsLedger.points}), 0)`.mapWith(
        Number,
      ),
    })
    .from(pointsLedger)
    .where(eq(pointsLedger.userId, uid));

  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  let seasonPoints = 0;
  if (season) {
    const [sp] = await db
      .select({
        total: sql<number>`coalesce(sum(${pointsLedger.points}), 0)`.mapWith(
          Number,
        ),
      })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.userId, uid),
          eq(pointsLedger.seasonId, season.id),
        ),
      );
    seasonPoints = sp?.total ?? 0;
  }

  return c.json({
    roundsPlayed: agg?.roundsPlayed ?? 0,
    wins: agg?.wins ?? 0,
    podiums: agg?.podiums ?? 0,
    bestFinish: agg?.bestFinish ?? null,
    totalPoints: pts?.total ?? 0,
    seasonPoints,
    division: divisionForPoints(seasonPoints),
    season: season ?? null,
  });
});

// ─── My global rank (all-time + season) ────────────────────────────────────────
me.get("/rank", async (c) => {
  const uid = c.get("user")!.id;
  const totalExpr = sql<number>`sum(${pointsLedger.points})`;

  const allRanked = await db
    .select({ userId: pointsLedger.userId, total: totalExpr.mapWith(Number) })
    .from(pointsLedger)
    .groupBy(pointsLedger.userId)
    .orderBy(desc(totalExpr));
  const allIdx = allRanked.findIndex((r) => r.userId === uid);
  const allTime =
    allIdx >= 0
      ? {
          rank: allIdx + 1,
          points: allRanked[allIdx]!.total,
          totalPlayers: allRanked.length,
          percentile: Math.round(
            ((allRanked.length - allIdx) / allRanked.length) * 100,
          ),
        }
      : null;

  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  let seasonRank = null as null | {
    rank: number;
    points: number;
    totalPlayers: number;
    percentile: number;
  };
  if (season) {
    const seasonRanked = await db
      .select({ userId: pointsLedger.userId, total: totalExpr.mapWith(Number) })
      .from(pointsLedger)
      .where(eq(pointsLedger.seasonId, season.id))
      .groupBy(pointsLedger.userId)
      .orderBy(desc(totalExpr));
    const sIdx = seasonRanked.findIndex((r) => r.userId === uid);
    if (sIdx >= 0) {
      seasonRank = {
        rank: sIdx + 1,
        points: seasonRanked[sIdx]!.total,
        totalPlayers: seasonRanked.length,
        percentile: Math.round(
          ((seasonRanked.length - sIdx) / seasonRanked.length) * 100,
        ),
      };
    }
  }

  return c.json({ allTime, season: seasonRank });
});

// ─── My results (find-your-result / history) ───────────────────────────────────
me.get("/results", async (c) => {
  const uid = c.get("user")!.id;
  const rows = await db
    .select({
      roundId: rounds.id,
      roundNumber: rounds.roundNumber,
      gameName: games.name,
      gameSlug: games.slug,
      placement: roundParticipants.placement,
      totalParticipants: rounds.totalParticipants,
      pointsEarned: roundParticipants.pointsEarned,
      survivedSeconds: roundParticipants.survivedSeconds,
      eliminatedAtSeconds: roundParticipants.eliminatedAtSeconds,
      highlightClipUrl: roundParticipants.highlightClipUrl,
      playedAt: rounds.playedAt,
    })
    .from(roundParticipants)
    .innerJoin(rounds, eq(rounds.id, roundParticipants.roundId))
    .innerJoin(games, eq(games.id, rounds.gameId))
    .where(eq(roundParticipants.userId, uid))
    .orderBy(desc(rounds.playedAt))
    .limit(50);
  return c.json({ results: rows });
});

// ─── Achievements (earned + locked) ─────────────────────────────────────────────
me.get("/achievements", async (c) => {
  const uid = c.get("user")!.id;
  const all = await db.select().from(achievements);
  const earned = await db
    .select({
      achievementId: userAchievements.achievementId,
      earnedAt: userAchievements.earnedAt,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, uid));
  const earnedMap = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));
  return c.json({
    achievements: all.map((a) => ({
      ...a,
      earned: earnedMap.has(a.id),
      earnedAt: earnedMap.get(a.id) ?? null,
    })),
  });
});

// ─── Notifications ───────────────────────────────────────────────────────────────
me.get("/notifications", async (c) => {
  const uid = c.get("user")!.id;
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, uid))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  return c.json({
    notifications: rows,
    unreadCount: rows.filter((r) => !r.read).length,
  });
});

me.post(
  "/notifications/read",
  zValidator("json", markNotificationsSchema),
  async (c) => {
    const uid = c.get("user")!.id;
    const { ids } = c.req.valid("json");
    const base = eq(notifications.userId, uid);
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        ids && ids.length > 0
          ? and(base, inArray(notifications.id, ids))
          : base,
      );
    return c.json({ ok: true });
  },
);

// ─── Subscription (Club) — MOCK billing ─────────────────────────────────────────
me.get("/subscription", async (c) => {
  const uid = c.get("user")!.id;
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, uid));
  return c.json({
    subscription: sub ?? { tier: "free", status: "active" },
  });
});

me.post("/subscription/subscribe", async (c) => {
  const uid = c.get("user")!.id;
  const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: uid,
      tier: "club",
      status: "active",
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        tier: "club",
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    })
    .returning();
  return c.json({ subscription: sub, mock: true });
});

me.post("/subscription/cancel", async (c) => {
  const uid = c.get("user")!.id;
  const [sub] = await db
    .insert(subscriptions)
    .values({ userId: uid, tier: "free", status: "active" })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { tier: "free", updatedAt: new Date() },
    })
    .returning();
  return c.json({ subscription: sub, mock: true });
});

// ─── Cosmetics — MOCK acquisition (no payment) ──────────────────────────────────
me.get("/cosmetics", async (c) => {
  const uid = c.get("user")!.id;
  const all = await db.select().from(cosmetics);
  const owned = await db
    .select()
    .from(userCosmetics)
    .where(eq(userCosmetics.userId, uid));
  const ownedMap = new Map(owned.map((o) => [o.cosmeticId, o]));
  return c.json({
    cosmetics: all.map((cos) => ({
      ...cos,
      owned: ownedMap.has(cos.id),
      equipped: ownedMap.get(cos.id)?.equipped ?? false,
    })),
  });
});

me.post(
  "/cosmetics/equip",
  zValidator("json", equipCosmeticSchema),
  async (c) => {
    const uid = c.get("user")!.id;
    const { cosmeticId } = c.req.valid("json");
    const [cos] = await db
      .select()
      .from(cosmetics)
      .where(eq(cosmetics.id, cosmeticId));
    if (!cos) return c.json({ error: "Cosmetic not found" }, 404);

    if (cos.clubOnly) {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, uid));
      if (!sub || sub.tier !== "club") {
        return c.json({ error: "Club members only" }, 403);
      }
    }

    // MOCK: grant on equip (no purchase flow yet).
    await db
      .insert(userCosmetics)
      .values({ userId: uid, cosmeticId, equipped: true })
      .onConflictDoUpdate({
        target: [userCosmetics.userId, userCosmetics.cosmeticId],
        set: { equipped: true },
      });

    // Unequip other cosmetics of the same type.
    const sameType = await db
      .select({ id: cosmetics.id })
      .from(cosmetics)
      .where(eq(cosmetics.type, cos.type));
    const others = sameType.map((s) => s.id).filter((x) => x !== cosmeticId);
    if (others.length > 0) {
      await db
        .update(userCosmetics)
        .set({ equipped: false })
        .where(
          and(
            eq(userCosmetics.userId, uid),
            inArray(userCosmetics.cosmeticId, others),
          ),
        );
    }
    return c.json({ equipped: true, mock: true });
  },
);

export default me;
