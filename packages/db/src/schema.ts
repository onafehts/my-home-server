import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  COSMETIC_TYPES,
  DIVISION_TIERS,
  ENTRY_SOURCES,
  GAME_STATUSES,
  MEDIA_TYPES,
  NOTIFICATION_TYPES,
  PLATFORMS,
  POINTS_REASONS,
  ROUND_STATUSES,
  SUBSCRIPTION_TIERS,
} from "@arena/core";

/**
 * Postgres schema. Enum values come from @arena/core so validation (Zod) and
 * storage (pgEnum) share one source of truth.
 *
 * Tables split into two groups:
 *   1. Better Auth tables (`user`, `session`, `account`, `verification`) — their
 *      property names must match Better Auth's model fields exactly.
 *   2. Domain tables — the games platform.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────
export const platformEnum = pgEnum("platform", PLATFORMS);
export const gameStatusEnum = pgEnum("game_status", GAME_STATUSES);
export const roundStatusEnum = pgEnum("round_status", ROUND_STATUSES);
export const mediaTypeEnum = pgEnum("media_type", MEDIA_TYPES);
export const entrySourceEnum = pgEnum("entry_source", ENTRY_SOURCES);
export const notificationTypeEnum = pgEnum(
  "notification_type",
  NOTIFICATION_TYPES,
);
export const subscriptionTierEnum = pgEnum(
  "subscription_tier",
  SUBSCRIPTION_TIERS,
);
export const cosmeticTypeEnum = pgEnum("cosmetic_type", COSMETIC_TYPES);
export const divisionTierEnum = pgEnum("division_tier", DIVISION_TIERS);
export const pointsReasonEnum = pgEnum("points_reason", POINTS_REASONS);

// ─── Better Auth: user ─────────────────────────────────────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Custom profile fields (registered as additionalFields in Better Auth config)
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Better Auth: session ──────────────────────────────────────────────────────
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// ─── Better Auth: account (OAuth links; password unused/passwordless) ──────────
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Better Auth: verification (holds email OTP codes) ─────────────────────────
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Domain: user_socials (normalizes the `socials[]` array) ───────────────────
export const userSocials = pgTable("user_socials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  username: text("username").notNull(),
  url: text("url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Domain: games ─────────────────────────────────────────────────────────────
export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: gameStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Domain: game_profiles (posting channels e.g. @onafehts / instagram) ───────
export const gameProfiles = pgTable("game_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  platform: platformEnum("platform").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Domain: profiles_by_game (M:N games <-> game_profiles) ────────────────────
export const profilesByGame = pgTable(
  "profiles_by_game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => gameProfiles.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uq: uniqueIndex("profiles_by_game_uq").on(t.gameId, t.profileId),
  }),
);

// ─── Domain: game_participants (enrollment "register to play") ─────────────────
export const gameParticipants = pgTable(
  "game_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    points: integer("points").notNull().default(0),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("game_participants_uq").on(t.gameId, t.userId),
  }),
);

// ─── Domain: rounds ────────────────────────────────────────────────────────────
export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    name: text("name"),
    playedAt: timestamp("played_at"),
    status: roundStatusEnum("status").notNull().default("pending"),
    // Published so results are provably-fair / verifiable.
    seed: text("seed"),
    firstPlaceUserId: text("first_place_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    secondPlaceUserId: text("second_place_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    thirdPlaceUserId: text("third_place_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    totalParticipants: integer("total_participants").notNull().default(0),
    calculatedDataUrl: text("calculated_data_url"),
    // Season this round counts toward (nullable for one-off/exhibition rounds).
    seasonId: uuid("season_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("rounds_game_number_uq").on(t.gameId, t.roundNumber),
  }),
);

// ─── Domain: round_participants (roster; `list_of_participant_ids`) ────────────
export const roundParticipants = pgTable(
  "round_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    placement: integer("placement"),
    pointsEarned: integer("points_earned").notNull().default(0),
    survivedSeconds: integer("survived_seconds").notNull().default(0),
    eliminatedAtSeconds: integer("eliminated_at_seconds"),
    // MOCK: per-player highlight clip. Real clips come from the video job.
    highlightClipUrl: text("highlight_clip_url"),
  },
  (t) => ({
    uq: uniqueIndex("round_participants_uq").on(t.roundId, t.userId),
  }),
);

// ─── Domain: rankings (leaderboard snapshot header; `rankings_by_date`) ────────
export const rankings = pgTable("rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  // Null = all-time snapshot; set = season-scoped snapshot.
  seasonId: uuid("season_id"),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
});

// ─── Domain: ranking_entries (snapshot rows; `list_of_participants`) ───────────
export const rankingEntries = pgTable(
  "ranking_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rankingId: uuid("ranking_id")
      .notNull()
      .references(() => rankings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currentPoints: integer("current_points").notNull().default(0),
    rankPosition: integer("rank_position").notNull(),
  },
  (t) => ({
    uq: uniqueIndex("ranking_entries_uq").on(t.rankingId, t.userId),
  }),
);

// ─── Domain: content (posted media) ────────────────────────────────────────────
export const content = pgTable("content", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => gameProfiles.id, { onDelete: "cascade" }),
  roundId: uuid("round_id").references(() => rounds.id, {
    onDelete: "set null",
  }),
  url: text("url"),
  mediaType: mediaTypeEnum("media_type").notNull().default("video"),
  sourceUrl: text("source_url"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  postedAt: timestamp("posted_at"),
});

// ─── Relations ──────────────────────────────────────────────────────────────────
export const userRelations = relations(user, ({ many }) => ({
  socials: many(userSocials),
  participations: many(gameParticipants),
}));

export const userSocialsRelations = relations(userSocials, ({ one }) => ({
  user: one(user, { fields: [userSocials.userId], references: [user.id] }),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  participants: many(gameParticipants),
  rounds: many(rounds),
  rankings: many(rankings),
  profileLinks: many(profilesByGame),
}));

export const gameProfilesRelations = relations(gameProfiles, ({ many }) => ({
  gameLinks: many(profilesByGame),
  content: many(content),
}));

export const profilesByGameRelations = relations(profilesByGame, ({ one }) => ({
  game: one(games, { fields: [profilesByGame.gameId], references: [games.id] }),
  profile: one(gameProfiles, {
    fields: [profilesByGame.profileId],
    references: [gameProfiles.id],
  }),
}));

export const gameParticipantsRelations = relations(
  gameParticipants,
  ({ one }) => ({
    game: one(games, {
      fields: [gameParticipants.gameId],
      references: [games.id],
    }),
    user: one(user, {
      fields: [gameParticipants.userId],
      references: [user.id],
    }),
  }),
);

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  game: one(games, { fields: [rounds.gameId], references: [games.id] }),
  participants: many(roundParticipants),
  content: many(content),
}));

export const roundParticipantsRelations = relations(
  roundParticipants,
  ({ one }) => ({
    round: one(rounds, {
      fields: [roundParticipants.roundId],
      references: [rounds.id],
    }),
    user: one(user, {
      fields: [roundParticipants.userId],
      references: [user.id],
    }),
  }),
);

export const rankingsRelations = relations(rankings, ({ one, many }) => ({
  game: one(games, { fields: [rankings.gameId], references: [games.id] }),
  entries: many(rankingEntries),
}));

export const rankingEntriesRelations = relations(rankingEntries, ({ one }) => ({
  ranking: one(rankings, {
    fields: [rankingEntries.rankingId],
    references: [rankings.id],
  }),
  user: one(user, { fields: [rankingEntries.userId], references: [user.id] }),
}));

export const contentRelations = relations(content, ({ one }) => ({
  profile: one(gameProfiles, {
    fields: [content.profileId],
    references: [gameProfiles.id],
  }),
  round: one(rounds, { fields: [content.roundId], references: [rounds.id] }),
}));

// ══════════════════════════════════════════════════════════════════════════
// Phase 2: seasons, divisions, achievements, notifications, points, entries,
// subscriptions, cosmetics.
// ══════════════════════════════════════════════════════════════════════════

// ─── seasons (monthly competition windows; rankings reset per season) ──────────
export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── divisions (static ladder; a player's division is derived from points) ─────
export const divisions = pgTable("divisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: divisionTierEnum("tier").notNull().unique(),
  name: text("name").notNull(),
  minPoints: integer("min_points").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── achievements / badges ─────────────────────────────────────────────────────
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("🏅"),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("user_achievements_uq").on(t.userId, t.achievementId),
  }),
);

// ─── notifications ──────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  roundId: uuid("round_id").references(() => rounds.id, {
    onDelete: "set null",
  }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── points_ledger (auditable scoring; rankings are aggregates of this) ────────
export const pointsLedger = pgTable("points_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id"),
  roundId: uuid("round_id").references(() => rounds.id, {
    onDelete: "set null",
  }),
  points: integer("points").notNull().default(0),
  reason: pointsReasonEnum("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── entries (queue for the next round; instagram_* sources are MOCKED) ────────
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    roundId: uuid("round_id").references(() => rounds.id, {
      onDelete: "set null",
    }),
    source: entrySourceEnum("source").notNull().default("site"),
    status: text("status").notNull().default("pending"), // pending | played
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    idx: uniqueIndex("entries_pending_uq").on(t.gameId, t.userId, t.status),
  }),
);

// ─── subscriptions (Club premium; billing MOCKED) ─────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  tier: subscriptionTierEnum("tier").notNull().default("free"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── cosmetics (ball skins / trails / name colors) ────────────────────────────
export const cosmetics = pgTable("cosmetics", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: cosmeticTypeEnum("type").notNull(),
  rarity: text("rarity").notNull().default("common"),
  value: text("value").notNull(), // e.g. hex color or trail id
  clubOnly: boolean("club_only").notNull().default(false),
});

export const userCosmetics = pgTable(
  "user_cosmetics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cosmeticId: uuid("cosmetic_id")
      .notNull()
      .references(() => cosmetics.id, { onDelete: "cascade" }),
    equipped: boolean("equipped").notNull().default(false),
    acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("user_cosmetics_uq").on(t.userId, t.cosmeticId),
  }),
);

// ─── Phase 2 relations (the ones queried relationally) ─────────────────────────
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
  round: one(rounds, {
    fields: [notifications.roundId],
    references: [rounds.id],
  }),
}));

export const userAchievementsRelations = relations(
  userAchievements,
  ({ one }) => ({
    user: one(user, {
      fields: [userAchievements.userId],
      references: [user.id],
    }),
    achievement: one(achievements, {
      fields: [userAchievements.achievementId],
      references: [achievements.id],
    }),
  }),
);

export const userCosmeticsRelations = relations(userCosmetics, ({ one }) => ({
  user: one(user, { fields: [userCosmetics.userId], references: [user.id] }),
  cosmetic: one(cosmetics, {
    fields: [userCosmetics.cosmeticId],
    references: [cosmetics.id],
  }),
}));
