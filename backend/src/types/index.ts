import { Role } from "../db/models";

export { Role } from "../db/models";

// Ladder order from lowest to highest. Index = rank used for comparisons.
export const ROLE_LADDER: Role[] = ["TRAINEE", "HELPER", "KNOWER", "EXPERT", "MENTOR", "PRO"];

export const ROLE_LABELS_RU: Record<Role, string> = {
  TRAINEE: "Стажёр",
  HELPER: "Помощник",
  KNOWER: "Знаток",
  EXPERT: "Эксперт",
  MENTOR: "Наставник",
  PRO: "Профи",
};

// Reputation points required to reach each role automatically.
// isStaff accounts can be assigned a role manually by a university admin,
// independent of accumulated points.
export const ROLE_THRESHOLDS: Record<Role, number> = {
  TRAINEE: 0,
  HELPER: 50,
  KNOWER: 150,
  EXPERT: 350,
  MENTOR: 700,
  PRO: 1500,
};

export function roleRank(role: Role): number {
  return ROLE_LADDER.indexOf(role);
}

export function roleAtLeast(role: Role, minRole: Role): boolean {
  return roleRank(role) >= roleRank(minRole);
}

export interface JwtPayload {
  userId: string;
  isPlatformAdmin: boolean;
  isUniversityAdmin: boolean;
  universityId: string | null;
}
