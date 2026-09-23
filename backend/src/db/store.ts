import crypto from "crypto";
import { db } from "./connection";
import {
  University,
  Category,
  UserProfile,
  ChatSession,
  Question,
  Answer,
  ReputationEvent,
} from "./models";

export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// universities
// ---------------------------------------------------------------------------
export const universities = {
  findActive(): University[] {
    return db.prepare(`SELECT * FROM universities WHERE isActive = 1 ORDER BY name ASC`).all() as University[];
  },
  findById(id: string): University | undefined {
    return db.prepare(`SELECT * FROM universities WHERE id = ?`).get(id) as University | undefined;
  },
  findBySlug(slug: string): University | undefined {
    return db.prepare(`SELECT * FROM universities WHERE slug = ?`).get(slug) as University | undefined;
  },
  create(data: { slug: string; name: string; city?: string; description?: string }): University {
    const row: University = {
      id: newId(),
      slug: data.slug,
      name: data.name,
      city: data.city ?? null,
      description: data.description ?? null,
      isActive: 1,
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO universities (id, slug, name, city, description, isActive, createdAt) VALUES (@id, @slug, @name, @city, @description, @isActive, @createdAt)`
    ).run(row);
    return row;
  },
  update(id: string, data: Partial<Pick<University, "slug" | "name" | "city" | "description" | "isActive">>): University | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...data };
    db.prepare(
      `UPDATE universities SET slug=@slug, name=@name, city=@city, description=@description, isActive=@isActive WHERE id=@id`
    ).run(merged);
    return merged;
  },
  counts(universityId: string) {
    const categories = (db.prepare(`SELECT COUNT(*) c FROM categories WHERE universityId = ?`).get(universityId) as { c: number }).c;
    const users = (db.prepare(`SELECT COUNT(*) c FROM user_profiles WHERE universityId = ?`).get(universityId) as { c: number }).c;
    return { categories, users };
  },
};

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------
export const categories = {
  findByUniversity(universityId: string): Category[] {
    return db
      .prepare(`SELECT * FROM categories WHERE universityId = ? ORDER BY sortOrder ASC`)
      .all(universityId) as Category[];
  },
  findById(id: string): Category | undefined {
    return db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as Category | undefined;
  },
  findByCode(universityId: string, code: string): Category | undefined {
    return db.prepare(`SELECT * FROM categories WHERE universityId = ? AND code = ?`).get(universityId, code) as
      | Category
      | undefined;
  },
  upsertByCode(
    universityId: string,
    data: { code: string; title: string; description?: string; minRole: Category["minRole"]; isSensitive: boolean; sortOrder: number }
  ): Category {
    const existing = this.findByCode(universityId, data.code);
    if (existing) return existing;
    return this.create(universityId, data);
  },
  create(
    universityId: string,
    data: { code: string; title: string; description?: string; minRole: Category["minRole"]; isSensitive: boolean; sortOrder: number }
  ): Category {
    const row: Category = {
      id: newId(),
      universityId,
      code: data.code,
      title: data.title,
      description: data.description ?? null,
      minRole: data.minRole,
      isSensitive: data.isSensitive ? 1 : 0,
      sortOrder: data.sortOrder,
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO categories (id, universityId, code, title, description, minRole, isSensitive, sortOrder, createdAt)
       VALUES (@id, @universityId, @code, @title, @description, @minRole, @isSensitive, @sortOrder, @createdAt)`
    ).run(row);
    return row;
  },
  update(id: string, data: Partial<Omit<Category, "id" | "universityId" | "createdAt">>): Category | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...data } as Category;
    db.prepare(
      `UPDATE categories SET code=@code, title=@title, description=@description, minRole=@minRole, isSensitive=@isSensitive, sortOrder=@sortOrder WHERE id=@id`
    ).run(merged);
    return merged;
  },
  remove(id: string) {
    db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  },
};

// ---------------------------------------------------------------------------
// user profiles
// ---------------------------------------------------------------------------
export const users = {
  findById(id: string): UserProfile | undefined {
    return db.prepare(`SELECT * FROM user_profiles WHERE id = ?`).get(id) as UserProfile | undefined;
  },
  findByEmail(email: string): UserProfile | undefined {
    return db.prepare(`SELECT * FROM user_profiles WHERE email = ?`).get(email) as UserProfile | undefined;
  },
  findAnswerersByUniversity(universityId: string): UserProfile[] {
    return db
      .prepare(`SELECT * FROM user_profiles WHERE universityId = ? AND isAnswerer = 1 ORDER BY reputationPoints DESC`)
      .all(universityId) as UserProfile[];
  },
  findOnlineAnswerers(universityId: string): UserProfile[] {
    return db
      .prepare(`SELECT * FROM user_profiles WHERE universityId = ? AND isAnswerer = 1 AND isOnline = 1`)
      .all(universityId) as UserProfile[];
  },
  create(data: Partial<UserProfile> & { displayName: string }): UserProfile {
    const row: UserProfile = {
      id: newId(),
      maxUserId: data.maxUserId ?? null,
      displayName: data.displayName,
      email: data.email ?? null,
      passwordHash: data.passwordHash ?? null,
      universityId: data.universityId ?? null,
      isAnswerer: data.isAnswerer ? 1 : 0,
      isUniversityAdmin: data.isUniversityAdmin ? 1 : 0,
      isPlatformAdmin: data.isPlatformAdmin ? 1 : 0,
      isStaff: data.isStaff ? 1 : 0,
      role: data.role ?? "TRAINEE",
      reputationPoints: data.reputationPoints ?? 0,
      isOnline: 0,
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO user_profiles (id, maxUserId, displayName, email, passwordHash, universityId, isAnswerer, isUniversityAdmin, isPlatformAdmin, isStaff, role, reputationPoints, isOnline, createdAt)
       VALUES (@id, @maxUserId, @displayName, @email, @passwordHash, @universityId, @isAnswerer, @isUniversityAdmin, @isPlatformAdmin, @isStaff, @role, @reputationPoints, @isOnline, @createdAt)`
    ).run(row);
    return row;
  },
  update(id: string, data: Partial<UserProfile>): UserProfile | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...data } as UserProfile;
    db.prepare(
      `UPDATE user_profiles SET displayName=@displayName, email=@email, passwordHash=@passwordHash, universityId=@universityId,
       isAnswerer=@isAnswerer, isUniversityAdmin=@isUniversityAdmin, isPlatformAdmin=@isPlatformAdmin, isStaff=@isStaff,
       role=@role, reputationPoints=@reputationPoints, isOnline=@isOnline WHERE id=@id`
    ).run(merged);
    return merged;
  },
  setOnline(id: string, isOnline: boolean) {
    db.prepare(`UPDATE user_profiles SET isOnline = ? WHERE id = ?`).run(isOnline ? 1 : 0, id);
  },
  countAnswers(userId: string): number {
    return (db.prepare(`SELECT COUNT(*) c FROM answers WHERE responderId = ?`).get(userId) as { c: number }).c;
  },
};

// ---------------------------------------------------------------------------
// chat sessions (conversation-engine state machine)
// ---------------------------------------------------------------------------
export const chatSessions = {
  findByExternalId(externalChatId: string): ChatSession | undefined {
    return db.prepare(`SELECT * FROM chat_sessions WHERE externalChatId = ?`).get(externalChatId) as ChatSession | undefined;
  },
  create(data: { channel: ChatSession["channel"]; externalChatId: string; askerName?: string }): ChatSession {
    const row: ChatSession = {
      id: newId(),
      channel: data.channel,
      externalChatId: data.externalChatId,
      step: "SELECT_UNIVERSITY",
      universityId: null,
      categoryId: null,
      askerName: data.askerName ?? null,
      updatedAt: now(),
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO chat_sessions (id, channel, externalChatId, step, universityId, categoryId, askerName, updatedAt, createdAt)
       VALUES (@id, @channel, @externalChatId, @step, @universityId, @categoryId, @askerName, @updatedAt, @createdAt)`
    ).run(row);
    return row;
  },
  update(id: string, data: Partial<Pick<ChatSession, "step" | "universityId" | "categoryId" | "askerName">>): ChatSession {
    const existing = db.prepare(`SELECT * FROM chat_sessions WHERE id = ?`).get(id) as ChatSession;
    const merged = { ...existing, ...data, updatedAt: now() };
    db.prepare(`UPDATE chat_sessions SET step=@step, universityId=@universityId, categoryId=@categoryId, askerName=@askerName, updatedAt=@updatedAt WHERE id=@id`).run(
      merged
    );
    return merged;
  },
};

// ---------------------------------------------------------------------------
// questions
// ---------------------------------------------------------------------------
export const questions = {
  findById(id: string): Question | undefined {
    return db.prepare(`SELECT * FROM questions WHERE id = ?`).get(id) as Question | undefined;
  },
  findOpenByUniversity(universityId: string): Question[] {
    return db
      .prepare(`SELECT * FROM questions WHERE universityId = ? AND status IN ('PENDING','ESCALATED') ORDER BY createdAt ASC`)
      .all(universityId) as Question[];
  },
  create(data: Omit<Question, "id" | "createdAt" | "routedAt" | "answeredAt" | "assignedToId">): Question {
    const row: Question = {
      ...data,
      id: newId(),
      assignedToId: null,
      createdAt: now(),
      routedAt: null,
      answeredAt: null,
    };
    db.prepare(
      `INSERT INTO questions (id, universityId, categoryId, askerId, channel, externalChatId, askerName, text, status, isSensitive, assignedToId, createdAt, routedAt, answeredAt)
       VALUES (@id, @universityId, @categoryId, @askerId, @channel, @externalChatId, @askerName, @text, @status, @isSensitive, @assignedToId, @createdAt, @routedAt, @answeredAt)`
    ).run(row);
    return row;
  },
  update(id: string, data: Partial<Question>): Question | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...data } as Question;
    db.prepare(
      `UPDATE questions SET status=@status, assignedToId=@assignedToId, routedAt=@routedAt, answeredAt=@answeredAt WHERE id=@id`
    ).run(merged);
    return merged;
  },
};

// ---------------------------------------------------------------------------
// answers
// ---------------------------------------------------------------------------
export const answers = {
  findById(id: string): Answer | undefined {
    return db.prepare(`SELECT * FROM answers WHERE id = ?`).get(id) as Answer | undefined;
  },
  findByQuestion(questionId: string): (Answer & { responder: UserProfile })[] {
    const rows = db.prepare(`SELECT * FROM answers WHERE questionId = ? ORDER BY createdAt ASC`).all(questionId) as Answer[];
    return rows.map((a) => ({ ...a, responder: users.findById(a.responderId)! }));
  },
  create(data: { questionId: string; responderId: string; text: string; respondedInSeconds: number }): Answer {
    const row: Answer = {
      id: newId(),
      questionId: data.questionId,
      responderId: data.responderId,
      text: data.text,
      rating: null,
      respondedInSeconds: data.respondedInSeconds,
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO answers (id, questionId, responderId, text, rating, respondedInSeconds, createdAt)
       VALUES (@id, @questionId, @responderId, @text, @rating, @respondedInSeconds, @createdAt)`
    ).run(row);
    return row;
  },
  setRating(id: string, rating: Answer["rating"]): Answer | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, rating };
    db.prepare(`UPDATE answers SET rating = @rating WHERE id = @id`).run(merged);
    return merged;
  },
};

// ---------------------------------------------------------------------------
// reputation events
// ---------------------------------------------------------------------------
export const reputationEvents = {
  create(data: { userId: string; points: number; reason: string }): ReputationEvent {
    const row: ReputationEvent = { id: newId(), ...data, createdAt: now() };
    db.prepare(`INSERT INTO reputation_events (id, userId, points, reason, createdAt) VALUES (@id, @userId, @points, @reason, @createdAt)`).run(
      row
    );
    return row;
  },
};
