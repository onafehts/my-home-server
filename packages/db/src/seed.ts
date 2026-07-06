import "./load-env";
import { DIVISION_MIN_POINTS, DIVISION_TIERS } from "@arena/core";
import { eq, sql } from "drizzle-orm";
import { db, queryClient } from "./client";
import { simulateRound } from "./engine";
import {
  achievements,
  cosmetics,
  divisions,
  gameParticipants,
  gameProfiles,
  games,
  rounds,
  seasons,
  subscriptions,
  user,
  userCosmetics,
} from "./schema";

/**
 * Rich, re-runnable seed: reference data (divisions, achievements, cosmetics,
 * season), games + channels, ~40 mock players, then several MOCK-simulated
 * rounds so leaderboards/results/stats are populated. Safe to re-run.
 */

const NAMES = [
  "Alex", "Sam", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Jamie",
  "Drew", "Quinn", "Avery", "Parker", "Skyler", "Reese", "Rowan", "Sage",
  "Emerson", "Finley", "Harper", "Kai", "Luca", "Mia", "Noah", "Ava",
  "Liam", "Emma", "Lucas", "Sofia", "Mateo", "Valentina", "Enzo", "Helena",
  "Miguel", "Laura", "Pedro", "Julia", "Bruno", "Beatriz", "Rafael", "Larissa",
];

async function seed() {
  console.log("Seeding reference data...");

  // Divisions (static ladder)
  await db
    .insert(divisions)
    .values(
      DIVISION_TIERS.map((tier, i) => ({
        tier,
        name: tier.charAt(0).toUpperCase() + tier.slice(1),
        minPoints: DIVISION_MIN_POINTS[tier],
        sortOrder: i,
      })),
    )
    .onConflictDoNothing();

  // Achievements
  await db
    .insert(achievements)
    .values([
      { code: "first_round", name: "First Blood", description: "Entered your first battle.", icon: "🎬" },
      { code: "first_win", name: "Champion", description: "Won a round.", icon: "🏆" },
      { code: "podium", name: "On the Podium", description: "Finished in the top 3.", icon: "🥉" },
      { code: "survivor", name: "Survivor", description: "Reached the final 5.", icon: "⏱️" },
      { code: "veteran", name: "Veteran", description: "Played 10 rounds.", icon: "🎖️" },
    ])
    .onConflictDoNothing();

  // Cosmetics
  await db
    .insert(cosmetics)
    .values([
      { code: "skin_classic", name: "Classic", type: "skin", rarity: "common", value: "#e2e8f0", clubOnly: false },
      { code: "skin_ocean", name: "Ocean", type: "skin", rarity: "common", value: "#38bdf8", clubOnly: false },
      { code: "skin_neon", name: "Neon", type: "skin", rarity: "rare", value: "#22c55e", clubOnly: true },
      { code: "skin_gold", name: "Gold", type: "skin", rarity: "legendary", value: "#f59e0b", clubOnly: true },
      { code: "trail_sparkle", name: "Sparkle Trail", type: "trail", rarity: "common", value: "sparkle", clubOnly: false },
      { code: "trail_fire", name: "Fire Trail", type: "trail", rarity: "rare", value: "fire", clubOnly: true },
      { code: "name_cyan", name: "Cyan Name", type: "name_color", rarity: "common", value: "#06b6d4", clubOnly: false },
      { code: "name_gold", name: "Gold Name", type: "name_color", rarity: "rare", value: "#f59e0b", clubOnly: true },
    ])
    .onConflictDoNothing();

  // Current-month season (active)
  const now = new Date();
  const slug = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  await db
    .insert(seasons)
    .values({
      name: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
      slug,
      startsAt: start,
      endsAt: end,
      isActive: true,
    })
    .onConflictDoNothing();

  // Games + posting channels
  const [marble] = await db
    .insert(games)
    .values({ name: "Marble Collision", slug: "marble-collision", description: "Every player is a marble. They collide until only one remains standing.", status: "active" })
    .onConflictDoNothing({ target: games.slug })
    .returning();
  const [downhill] = await db
    .insert(games)
    .values({ name: "Downhill Derby", slug: "downhill-derby", description: "Each player is a ball rolling down a chaotic hill. First to the bottom wins.", status: "active" })
    .onConflictDoNothing({ target: games.slug })
    .returning();

  await db
    .insert(gameProfiles)
    .values([
      { name: "Marble Collision IG", handle: "marblecollision", platform: "instagram" },
      { name: "Downhill Derby Shorts", handle: "downhillderby", platform: "youtube" },
    ])
    .onConflictDoNothing();

  // Resolve game ids (works whether inserted now or previously).
  const allGames = await db.select().from(games).where(eq(games.status, "active"));
  const marbleId = marble?.id ?? allGames.find((g) => g.slug === "marble-collision")?.id;
  const downhillId = downhill?.id ?? allGames.find((g) => g.slug === "downhill-derby")?.id;

  // Mock players
  console.log("Seeding mock players...");
  await db
    .insert(user)
    .values(
      NAMES.map((name, i) => {
        const n = String(i + 1).padStart(2, "0");
        const id = `seed-user-${n}`;
        return {
          id,
          name,
          email: `${name.toLowerCase()}${i + 1}@arena.local`,
          emailVerified: true,
          image: `https://i.pravatar.cc/150?u=${id}`,
          firstName: name,
        };
      }),
    )
    .onConflictDoNothing();

  // A few Club members (mock)
  await db
    .insert(subscriptions)
    .values(
      ["seed-user-01", "seed-user-02", "seed-user-03"].map((userId) => ({
        userId,
        tier: "club" as const,
        status: "active",
        currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      })),
    )
    .onConflictDoNothing();

  // Enroll EVERY user (mock + any real accounts) into both games.
  const everyone = await db.select({ id: user.id }).from(user);
  const gameIds = [marbleId, downhillId].filter(Boolean) as string[];
  for (const gameId of gameIds) {
    await db
      .insert(gameParticipants)
      .values(everyone.map((u) => ({ gameId, userId: u.id })))
      .onConflictDoNothing();
  }

  // Grant the demo login (if present) some owned cosmetics.
  const [demo] = await db.select().from(user).where(eq(user.email, "browsertest@arena.local"));
  if (demo) {
    const freeSkins = await db.select().from(cosmetics).where(eq(cosmetics.clubOnly, false));
    if (freeSkins.length > 0) {
      await db
        .insert(userCosmetics)
        .values(
          freeSkins.slice(0, 3).map((c, i) => ({
            userId: demo.id,
            cosmeticId: c.id,
            equipped: i === 0,
          })),
        )
        .onConflictDoNothing();
    }
  }

  // Simulate rounds (only if a game has none yet) — MOCK engine.
  console.log("Simulating rounds (mock engine)...");
  for (const gameId of gameIds) {
    const [existing] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(rounds)
      .where(eq(rounds.gameId, gameId));
    if ((existing?.n ?? 0) > 0) {
      console.log(`  game ${gameId} already has rounds, skipping simulation`);
      continue;
    }
    const ROUNDS = 8;
    for (let i = 1; i <= ROUNDS; i++) {
      const res = await simulateRound(gameId, {
        seed: `${gameId}-r${i}`,
        // Only the final round emits notifications (avoids noise for demo).
        createNotifications: i === ROUNDS,
      });
      if (res) console.log(`  round ${res.roundNumber} winner=${res.winnerId} players=${res.totalParticipants}`);
    }
  }

  console.log("Seed complete.");
  await queryClient.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
