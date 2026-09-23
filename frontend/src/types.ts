export type Role = "TRAINEE" | "HELPER" | "KNOWER" | "EXPERT" | "MENTOR" | "PRO";

export const ROLE_LABELS_RU: Record<Role, string> = {
  TRAINEE: "Стажёр",
  HELPER: "Помощник",
  KNOWER: "Знаток",
  EXPERT: "Эксперт",
  MENTOR: "Наставник",
  PRO: "Профи",
};

export const ROLE_ORDER: Role[] = ["TRAINEE", "HELPER", "KNOWER", "EXPERT", "MENTOR", "PRO"];

export interface University {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  description: string | null;
  _count?: { categories: number; users: number };
}

export interface Category {
  id: string;
  universityId: string;
  code: string;
  title: string;
  description: string | null;
  minRole: Role;
  isSensitive: 0 | 1 | boolean;
  sortOrder: number;
}

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;
  role: Role;
  reputationPoints: number;
  isAnswerer: boolean;
  isUniversityAdmin: boolean;
  isPlatformAdmin: boolean;
  isStaff: boolean;
  universityId: string | null;
}

export interface QuestionItem {
  id: string;
  universityId: string;
  categoryId: string;
  text: string;
  status: string;
  isSensitive: 0 | 1;
  askerName: string | null;
  createdAt: string;
  category: Category;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  role: Role;
  roleLabel: string;
  reputationPoints: number;
  isOnline: boolean;
  isStaff: boolean;
  answersCount: number;
}
