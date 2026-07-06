import { z } from "zod";
import {
  entrySourceSchema,
  leaderboardScopeSchema,
  platformSchema,
} from "./enums";

/**
 * API request/response contracts. Shared between apps/api (validation) and
 * apps/web (typed client) so the two can never drift.
 */

// ─── Auth (passwordless) ─────────────────────────────────────────────────────
export const requestOtpSchema = z.object({
  email: z.string().email(),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(12),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// ─── Profile ─────────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const addSocialSchema = z.object({
  platform: platformSchema,
  username: z.string().trim().min(1).max(120),
  url: z.string().url().max(500).optional(),
});
export type AddSocialInput = z.infer<typeof addSocialSchema>;

// ─── Avatar upload ───────────────────────────────────────────────────────────
export const avatarUploadRequestSchema = z.object({
  contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});
export type AvatarUploadRequest = z.infer<typeof avatarUploadRequestSchema>;

export const avatarUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  publicUrl: z.string().url(),
  objectKey: z.string(),
});
export type AvatarUploadResponse = z.infer<typeof avatarUploadResponseSchema>;

// ─── Games ───────────────────────────────────────────────────────────────────
export const gameSlugParamSchema = z.object({
  slug: z.string().min(1).max(120),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

// ─── Phase 2 ─────────────────────────────────────────────────────────────────
export const leaderboardQuerySchema = z.object({
  scope: leaderboardScopeSchema.default("alltime"),
  seasonId: z.string().uuid().optional(),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export const enterGameSchema = z.object({
  // Defaults to a site entry; instagram_* sources are used by the mock ingester.
  source: entrySourceSchema.default("site"),
});
export type EnterGameInput = z.infer<typeof enterGameSchema>;

export const equipCosmeticSchema = z.object({
  cosmeticId: z.string().uuid(),
});
export type EquipCosmeticInput = z.infer<typeof equipCosmeticSchema>;

export const markNotificationsSchema = z.object({
  // Omit to mark all as read.
  ids: z.array(z.string().uuid()).optional(),
});
export type MarkNotificationsInput = z.infer<typeof markNotificationsSchema>;

// MOCK: simulate a round. Real rounds will come from the video-generation job.
export const simulateRoundSchema = z.object({
  gameId: z.string().uuid(),
});
export type SimulateRoundInput = z.infer<typeof simulateRoundSchema>;
