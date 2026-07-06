import { DIVISION_TIERS, type DivisionTier } from "./enums";

/**
 * Points a player earns in one round. Kept here so the (mock) round engine and
 * the API/UI never disagree on how points are computed.
 *
 *   placement    — reward for finishing well (steep at the top)
 *   survival     — reward for lasting long even if you lose
 *   participation— everyone who shows up earns a little (rewards the loyalists)
 */
export function computeRoundPoints(args: {
  placement: number; // 1 = winner
  totalParticipants: number;
  survivedSeconds: number;
}): {
  placement: number;
  survival: number;
  participation: number;
  total: number;
} {
  const { placement, totalParticipants, survivedSeconds } = args;
  const podium = [100, 70, 50];
  let placementPts: number;
  if (placement <= 3) {
    placementPts = podium[placement - 1] ?? 0;
  } else if (totalParticipants > 1) {
    // Linearly scale the rest from ~40 down to 0.
    const frac = (totalParticipants - placement) / (totalParticipants - 1);
    placementPts = Math.round(frac * 40);
  } else {
    placementPts = 0;
  }
  const survival = Math.round(survivedSeconds * 0.5);
  const participation = 5;
  return {
    placement: placementPts,
    survival,
    participation,
    total: placementPts + survival + participation,
  };
}

/** Division thresholds by cumulative season points (index matches DIVISION_TIERS). */
export const DIVISION_MIN_POINTS: Record<DivisionTier, number> = {
  bronze: 0,
  silver: 300,
  gold: 800,
  diamond: 1600,
  legend: 3000,
};

/** Maps a season-point total to its division tier. */
export function divisionForPoints(points: number): DivisionTier {
  let tier: DivisionTier = "bronze";
  for (const t of DIVISION_TIERS) {
    if (points >= DIVISION_MIN_POINTS[t]) tier = t;
  }
  return tier;
}
