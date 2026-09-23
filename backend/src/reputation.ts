import { Role } from "./db/models";
import { users, reputationEvents } from "./db/store";
import { ROLE_LADDER, ROLE_THRESHOLDS } from "./types";
import { logger } from "./logger";

export const POINTS = {
  ANSWER_HELPFUL: 10,
  ANSWER_RESOLVED: 25,
  FAST_RESPONSE_BONUS: 5,
  ANSWER_NOT_HELPFUL: -5,
  ANSWER_REJECTED_BY_MODERATION: -15,
  COMPLAINT: -10,
};

/** Highest role a user qualifies for purely by accumulated points. */
export function roleForPoints(points: number): Role {
  let resolved: Role = "TRAINEE";
  for (const role of ROLE_LADDER) {
    if (points >= ROLE_THRESHOLDS[role]) {
      resolved = role;
    }
  }
  return resolved;
}

export async function awardPoints(userId: string, points: number, reason: string) {
  const user = users.findById(userId);
  if (!user) return undefined;

  const newPoints = Math.max(0, user.reputationPoints + points);
  const computedRole = roleForPoints(newPoints);

  // Staff members that were manually promoted by their university admin never
  // drop below their current role purely from automatic point recalculation —
  // only an explicit admin action can demote them.
  const staffFloorRank = ROLE_LADDER.indexOf(user.role);
  const computedRank = ROLE_LADDER.indexOf(computedRole);
  const finalRole = user.isStaff === 1 && staffFloorRank > computedRank ? user.role : computedRole;

  const updated = users.update(userId, { reputationPoints: newPoints, role: finalRole });
  reputationEvents.create({ userId, points, reason });

  logger.info("reputation.awarded", { userId, points, reason, newPoints, finalRole });
  return updated;
}
