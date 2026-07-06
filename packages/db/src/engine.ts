import { randomBytes } from "node:crypto";
import { computeRoundPoints } from "@arena/core";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import {
  achievements,
  entries,
  gameParticipants,
  notifications,
  pointsLedger,
  rankingEntries,
  rankings,
  roundParticipants,
  rounds,
  seasons,
  userAchievements,
} from "./schema";

/**
 * ⚠️ MOCK ROUND ENGINE — stands in for the future video-generation job.
 *
 * A real round would: gather entrants → run a physics sim → render a video →
 * post it, then record results. Here we do everything except the video: a
 * seeded (provably-fair) shuffle assigns placements, we compute points, write
 * results + ledger + ranking snapshots + notifications + achievements, and
 * attach a `mock://` highlight-clip URL. Same DB side-effects as the real job,
 * so the rest of the app is already correct. See ROADMAP.md.
 */

// Deterministic PRNG so a published seed reproduces the exact result.
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SimulateResult = {
  roundId: string;
  roundNumber: number;
  winnerId: string | null;
  totalParticipants: number;
  seed: string;
} | null;

const ROUND_DURATION_SECONDS = 60;

/** Rebuilds a fresh ranking snapshot (all-time when seasonId is null). */
async function rebuildRankings(
  gameId: string,
  seasonId: string | null,
): Promise<void> {
  const totalExpr = sql<number>`sum(${pointsLedger.points})`;
  const rows = await db
    .select({ userId: pointsLedger.userId, total: totalExpr.mapWith(Number) })
    .from(pointsLedger)
    .where(
      seasonId
        ? and(
            eq(pointsLedger.gameId, gameId),
            eq(pointsLedger.seasonId, seasonId),
          )
        : eq(pointsLedger.gameId, gameId),
    )
    .groupBy(pointsLedger.userId)
    .orderBy(desc(totalExpr));

  const [ranking] = await db
    .insert(rankings)
    .values({ gameId, seasonId })
    .returning();
  if (ranking && rows.length > 0) {
    await db.insert(rankingEntries).values(
      rows.map((r, i) => ({
        rankingId: ranking.id,
        userId: r.userId,
        currentPoints: r.total,
        rankPosition: i + 1,
      })),
    );
  }
}

async function awardAchievements(
  participantIds: string[],
  createNotifications: boolean,
): Promise<void> {
  const all = await db.select().from(achievements);
  const byCode = new Map(all.map((a) => [a.code, a]));
  const inserts: { userId: string; achievementId: string }[] = [];
  const push = (code: string, userId: string | undefined) => {
    const a = byCode.get(code);
    if (a && userId) inserts.push({ userId, achievementId: a.id });
  };
  for (const uid of participantIds) push("first_round", uid);
  push("first_win", participantIds[0]);
  participantIds.slice(0, 3).forEach((uid) => push("podium", uid));

  if (inserts.length === 0) return;
  const inserted = await db
    .insert(userAchievements)
    .values(inserts)
    .onConflictDoNothing()
    .returning();

  if (createNotifications && inserted.length > 0) {
    await db.insert(notifications).values(
      inserted.map((ua) => {
        const a = all.find((x) => x.id === ua.achievementId);
        return {
          userId: ua.userId,
          type: "achievement" as const,
          title: `Achievement unlocked: ${a?.name ?? "New badge"}`,
          body: a?.description ?? null,
        };
      }),
    );
  }
}

export async function simulateRound(
  gameId: string,
  opts: { createNotifications?: boolean; seed?: string } = {},
): Promise<SimulateResult> {
  const createNotifications = opts.createNotifications ?? true;
  const seed = opts.seed ?? randomBytes(8).toString("hex");

  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  const seasonId = season?.id ?? null;

  const roster = await db
    .select({ userId: gameParticipants.userId })
    .from(gameParticipants)
    .where(eq(gameParticipants.gameId, gameId));
  if (roster.length === 0) return null;

  const [maxRow] = await db
    .select({
      maxNum: sql<number>`coalesce(max(${rounds.roundNumber}), 0)`.mapWith(
        Number,
      ),
    })
    .from(rounds)
    .where(eq(rounds.gameId, gameId));
  const roundNumber = (maxRow?.maxNum ?? 0) + 1;

  // Seeded shuffle → placement order (index 0 = winner).
  const rng = mulberry32(xmur3(seed)());
  const ordered = roster.map((r) => r.userId);
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = ordered[i]!;
    ordered[i] = ordered[j]!;
    ordered[j] = a;
  }
  const total = ordered.length;

  const [round] = await db
    .insert(rounds)
    .values({
      gameId,
      roundNumber,
      name: `Round ${roundNumber}`,
      playedAt: new Date(),
      status: "posted",
      seed,
      seasonId,
      totalParticipants: total,
      firstPlaceUserId: ordered[0] ?? null,
      secondPlaceUserId: ordered[1] ?? null,
      thirdPlaceUserId: ordered[2] ?? null,
    })
    .returning();
  if (!round) return null;

  const rpValues = ordered.map((userId, idx) => {
    const placement = idx + 1;
    const survivedSeconds = Math.round(
      ROUND_DURATION_SECONDS * ((total - placement + 1) / total),
    );
    const pts = computeRoundPoints({
      placement,
      totalParticipants: total,
      survivedSeconds,
    });
    return {
      roundId: round.id,
      userId,
      placement,
      pointsEarned: pts.total,
      survivedSeconds,
      eliminatedAtSeconds: placement === 1 ? null : survivedSeconds,
      highlightClipUrl: `mock://clips/${round.id}/${userId}.mp4`,
      _points: pts.total,
    };
  });

  await db.insert(roundParticipants).values(
    rpValues.map(({ _points, ...v }) => v),
  );
  await db.insert(pointsLedger).values(
    rpValues.map((v) => ({
      userId: v.userId,
      gameId,
      seasonId,
      roundId: round.id,
      points: v._points,
      reason: "placement" as const,
    })),
  );

  // Bump cumulative per-game points on each enrollment.
  for (const v of rpValues) {
    await db
      .update(gameParticipants)
      .set({ points: sql`${gameParticipants.points} + ${v._points}` })
      .where(
        and(
          eq(gameParticipants.gameId, gameId),
          eq(gameParticipants.userId, v.userId),
        ),
      );
  }

  await rebuildRankings(gameId, null);
  if (seasonId) await rebuildRankings(gameId, seasonId);

  // Consume pending entries for this game.
  await db
    .update(entries)
    .set({ status: "played", roundId: round.id })
    .where(and(eq(entries.gameId, gameId), eq(entries.status, "pending")));

  if (createNotifications) {
    await db.insert(notifications).values(
      rpValues.map((v) => ({
        userId: v.userId,
        type: (v.placement === 1 ? "round_result" : "eliminated") as
          | "round_result"
          | "eliminated",
        title:
          v.placement === 1
            ? `🏆 You won ${round.name}!`
            : `You finished #${v.placement} of ${total}`,
        body:
          v.placement === 1
            ? `You survived the whole round and earned ${v._points} points.`
            : `Eliminated at ${v.eliminatedAtSeconds}s. +${v._points} points.`,
        roundId: round.id,
      })),
    );
  }

  await awardAchievements(ordered, createNotifications);

  return {
    roundId: round.id,
    roundNumber,
    winnerId: ordered[0] ?? null,
    totalParticipants: total,
    seed,
  };
}
