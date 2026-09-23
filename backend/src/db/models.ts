export type Role = "TRAINEE" | "HELPER" | "KNOWER" | "EXPERT" | "MENTOR" | "PRO";
export type QuestionStatus = "PENDING" | "ROUTED" | "ANSWERED" | "ESCALATED" | "CLOSED";
export type AnswerRating = "HELPFUL" | "NOT_HELPFUL" | "RESOLVED";
export type Channel = "MAX" | "SIMULATOR";

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
  maxUserId: string | null;
  displayName: string;
  email: string | null;
  passwordHash: string | null;
  universityId: string | null;
  isAnswerer: 0 | 1;
  isUniversityAdmin: 0 | 1;
  isPlatformAdmin: 0 | 1;
  isStaff: 0 | 1;
  role: Role;
  reputationPoints: number;
  isOnline: 0 | 1;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  channel: Channel;
  externalChatId: string;
  step: string;
  universityId: string | null;
  categoryId: string | null;
  askerName: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface Question {
  id: string;
  universityId: string;
  categoryId: string;
  askerId: string | null;
  channel: Channel;
  externalChatId: string;
  askerName: string | null;
  text: string;
  status: QuestionStatus;
  isSensitive: 0 | 1;
  assignedToId: string | null;
  createdAt: string;
  routedAt: string | null;
  answeredAt: string | null;
}

export interface Answer {
  id: string;
  questionId: string;
  responderId: string;
  text: string;
  rating: AnswerRating | null;
  respondedInSeconds: number | null;
  createdAt: string;
}

export interface ReputationEvent {
  id: string;
  userId: string;
  points: number;
  reason: string;
  createdAt: string;
}
