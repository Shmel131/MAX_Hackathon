export type Role = "HELPER" | "KNOWER" | "PRO";

export const ROLE_LABELS_RU: Record<Role, string> = {
  HELPER: "Помощник",
  KNOWER: "Знаток",
  PRO: "Профи",
};

export const ROLE_ORDER: Role[] = ["HELPER", "KNOWER", "PRO"];

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

/** Whoever is currently logged in — either a staff/expert/admin account or a student. */
export type Identity =
  | ({ kind: "staff" } & StaffUser)
  | ({ kind: "student" } & { id: string; displayName: string });

export interface StaffUser {
  id: string;
  displayName: string;
  email: string | null;
  role: Role;
  aura: number;
  isAnswerer: boolean;
  isUniversityAdmin: boolean;
  isPlatformAdmin: boolean;
  isStaff: boolean;
  universityId: string | null;
}

export type QuestionStatus = "PENDING" | "ROUTED" | "ANSWERED" | "ESCALATED" | "CLOSED";

export const STATUS_LABELS_RU: Record<QuestionStatus, string> = {
  PENDING: "Ожидает специалиста",
  ROUTED: "Взят в работу",
  ANSWERED: "Есть ответ",
  ESCALATED: "Передан специалисту",
  CLOSED: "Закрыт",
};

export interface Message {
  id: string;
  questionId: string;
  senderType: "STUDENT" | "EXPERT";
  senderId: string;
  text: string;
  createdAt: string;
}

export interface StudentQuestionSummary {
  id: string;
  text: string;
  status: QuestionStatus;
  isSensitive: boolean;
  askerRating: "HELPFUL" | "NOT_HELPFUL" | "RESOLVED" | null;
  createdAt: string;
  category: { id: string; title: string } | null;
  university: { id: string; name: string } | null;
  expert: { displayName: string; role: Role } | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
}

export interface ExpertQuestionItem {
  id: string;
  universityId: string;
  categoryId: string;
  text: string;
  status: QuestionStatus;
  isSensitive: 0 | 1;
  assignedToId: string | null;
  studentName: string;
  createdAt: string;
  category: Category;
  assignedTo: { id: string; displayName: string } | null;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string;
  role: Role;
  roleLabel: string;
  aura: number;
  isOnline: boolean;
  isStaff: boolean;
  answersCount: number;
}
