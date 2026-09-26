import { Role } from "../db/models";

export { Role } from "../db/models";

// Ladder order from lowest to highest. Index = rank used for comparisons.
// Reduced to the three tiers the team decided to keep for the demo.
export const ROLE_LADDER: Role[] = ["HELPER", "KNOWER", "PRO"];

export const ROLE_LABELS_RU: Record<Role, string> = {
  HELPER: "Помощник",
  KNOWER: "Знаток",
  PRO: "Профи",
};

// Aura ("аура" — the renamed reputation score, see backend/src/reputation.ts)
// required to reach each role automatically. isStaff accounts can be
// assigned a role manually by a university admin, independent of aura.
export const ROLE_THRESHOLDS: Record<Role, number> = {
  HELPER: 0,
  KNOWER: 150,
  PRO: 600,
};

export function roleRank(role: Role): number {
  return ROLE_LADDER.indexOf(role);
}

export function roleAtLeast(role: Role, minRole: Role): boolean {
  return roleRank(role) >= roleRank(minRole);
}

export interface JwtPayload {
  kind: "staff" | "student";
  // staff fields
  userId?: string;
  isPlatformAdmin?: boolean;
  isUniversityAdmin?: boolean;
  universityId?: string | null;
  // student fields
  studentId?: string;
  displayName?: string;
}
