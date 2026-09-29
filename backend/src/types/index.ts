import { Role } from "../db/models";

export { Role } from "../db/models";

export const ROLE_LADDER: Role[] = ["HELPER", "KNOWER", "PRO"];

export const ROLE_LABELS_RU: Record<Role, string> = {
  HELPER: "Помощник",
  KNOWER: "Знаток",
  PRO: "Профи",
};

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
  userId?: string;
  isPlatformAdmin?: boolean;
  isUniversityAdmin?: boolean;
  universityId?: string | null;
  studentId?: string;
  displayName?: string;
}
