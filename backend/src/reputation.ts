import { Role } from "./db/models";
import { users, auraEvents } from "./db/store";
import { ROLE_LADDER, ROLE_THRESHOLDS } from "./types";
import { logger } from "./logger";

/**
 * "Аура" — the renamed reputation score (see project changelog / README).
 * Everything below still deals in the same underlying integer; only the
 * user-facing name changed, so the field on UserProfile is `aura`.
 */
export const AURA = {
  ANSWER_HELPFUL: 10,
  ANSWER_RESOLVED: 25,
  FAST_RESPONSE_BONUS: 5,
  ANSWER_NOT_HELPFUL: -5,
  ANSWER_REJECTED_BY_MODERATION: -15,
  COMPLAINT: -10,
};

/** Highest role a user qualifies for purely by accumulated aura. */
export function roleForAura(aura: number): Role {
  let resolved: Role = "HELPER";
  for (const role of ROLE_LADDER) {
    if (aura >= ROLE_THRESHOLDS[role]) {
      resolved = role;
    }
  }
  return resolved;
}

export async function awardAura(userId: string, points: number, reason: string) {
  const user = users.findById(userId);
  if (!user) return undefined;

  const newAura = Math.max(0, user.aura + points);
  const computedRole = roleForAura(newAura);

  // Staff members that were manually promoted by their university admin never
  // drop below their current role purely from automatic recalculation — only
  // an explicit admin action can demote them.
  const staffFloorRank = ROLE_LADDER.indexOf(user.role);
  const computedRank = ROLE_LADDER.indexOf(computedRole);
  const finalRole = user.isStaff === 1 && staffFloorRank > computedRank ? user.role : computedRole;

  const updated = users.update(userId, { aura: newAura, role: finalRole });
  auraEvents.create({ userId, points, reason });

  logger.info("aura.awarded", { userId, points, reason, newAura, finalRole });
  return updated;
}
