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
  isActive: 0 | 1;
  createdAt: string;
}

export interface Student {
  id: string;
  displayName: string;
  maxUserId: string | null;
  createdAt: string;
}

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
