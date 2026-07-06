import { z } from "zod";

/**
 * Shared enums for the platform. Kept as `const` tuples so they can drive both
 * Zod validation (API layer) and Drizzle pgEnum definitions (db layer) from a
 * single source of truth.
 */

export const PLATFORMS = ["instagram", "youtube", "tiktok"] as const;
export const platformSchema = z.enum(PLATFORMS);
export type Platform = (typeof PLATFORMS)[number];

export const GAME_STATUSES = ["draft", "active", "paused", "archived"] as const;
export const gameStatusSchema = z.enum(GAME_STATUSES);
export type GameStatus = (typeof GAME_STATUSES)[number];

export const ROUND_STATUSES = [
  "pending",
  "calculated",
  "approved",
  "posted",
] as const;
export const roundStatusSchema = z.enum(ROUND_STATUSES);
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const MEDIA_TYPES = ["video", "image"] as const;
export const mediaTypeSchema = z.enum(MEDIA_TYPES);
export type MediaType = (typeof MEDIA_TYPES)[number];

// How a player got into a round. `instagram_*` sources are MOCKED until the
// Instagram Graph API ingestion is built (see ROADMAP).
export const ENTRY_SOURCES = [
  "site",
  "instagram_comment",
  "instagram_follow",
] as const;
export const entrySourceSchema = z.enum(ENTRY_SOURCES);
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const NOTIFICATION_TYPES = [
  "round_entered",
  "round_result",
  "eliminated",
  "achievement",
  "season_end",
  "promotion",
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Club is the premium tier. Billing is MOCKED (no real payment provider yet).
export const SUBSCRIPTION_TIERS = ["free", "club"] as const;
export const subscriptionTierSchema = z.enum(SUBSCRIPTION_TIERS);
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const COSMETIC_TYPES = ["skin", "trail", "name_color"] as const;
export const cosmeticTypeSchema = z.enum(COSMETIC_TYPES);
export type CosmeticType = (typeof COSMETIC_TYPES)[number];

// Ordered ladder (index = strength). Division is derived from season points.
export const DIVISION_TIERS = [
  "bronze",
  "silver",
  "gold",
  "diamond",
  "legend",
] as const;
export const divisionTierSchema = z.enum(DIVISION_TIERS);
export type DivisionTier = (typeof DIVISION_TIERS)[number];

export const POINTS_REASONS = [
  "placement",
  "survival",
  "participation",
  "bonus",
] as const;
export const pointsReasonSchema = z.enum(POINTS_REASONS);
export type PointsReason = (typeof POINTS_REASONS)[number];

// Leaderboard scope selector used by the ranking endpoints/UI.
export const LEADERBOARD_SCOPES = ["alltime", "season"] as const;
export const leaderboardScopeSchema = z.enum(LEADERBOARD_SCOPES);
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];
