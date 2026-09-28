export type Role = "HELPER" | "KNOWER" | "PRO";
export type QuestionStatus = "PENDING" | "ROUTED" | "ANSWERED" | "ESCALATED" | "CLOSED";
export type AskerRating = "HELPFUL" | "NOT_HELPFUL" | "RESOLVED";
export type Channel = "MAX" | "SIMULATOR";
export type SenderType = "STUDENT" | "EXPERT";

export interface University {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  description: string | null;
  isActive: 0 | 1;
  createdAt: string;
}

export interface Category {
  id: string;
  universityId: string;
  code: string;
  title: string;
  description: string | null;
  minRole: Role;
  isSensitive: 0 | 1;
  sortOrder: number;
  createdAt: string;
}

/** Staff/answerer/admin accounts — log in with e-mail + password. */
export interface UserProfile {
  id: string;
  displayName: string;
  email: string | null;
  passwordHash: string | null;
  universityId: string | null;
  isAnswerer: 0 | 1;
  isUniversityAdmin: 0 | 1;
  isPlatformAdmin: 0 | 1;
  isStaff: 0 | 1;
  role: Role;
  aura: number;
  isOnline: 0 | 1;
  createdAt: string;
}

/**
 * Student accounts. MVP auth: log in with just a display name (see README) —
 * a persistent id/JWT is issued and stored in the browser so the same
 * student keeps their question history across visits. A real MAX chat
 * identifies the student automatically via maxUserId, no name prompt needed.
 */
export interface Student {
  id: string;
  displayName: string;
  maxUserId: string | null;
  createdAt: string;
}

/** Ephemeral wizard state for the university→category→question selection flow. */
export interface ChatSession {
  id: string;
  channel: Channel;
  externalChatId: string;
  step: string;
  universityId: string | null;
  categoryId: string | null;
  studentId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface Question {
  id: string;
  universityId: string;
  categoryId: string;
  studentId: string;
  channel: Channel;
  externalChatId: string;
  text: string;
  status: QuestionStatus;
  isSensitive: 0 | 1;
  assignedToId: string | null;
  askerRating: AskerRating | null;
  createdAt: string;
  routedAt: string | null;
  answeredAt: string | null;
  closedAt: string | null;
}

/** One message in a question's thread — either the student or the assigned expert. */
export interface Message {
  id: string;
  questionId: string;
  senderType: SenderType;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface AuraEvent {
  id: string;
  userId: string;
  points: number;
  reason: string;
  createdAt: string;
}
