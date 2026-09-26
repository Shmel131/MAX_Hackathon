import crypto from "crypto";
import { db } from "./connection";
import { University, Category, UserProfile, Student, ChatSession, Question, Message, AuraEvent } from "./models";

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
// staff / answerer / admin accounts
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
      .prepare(`SELECT * FROM user_profiles WHERE universityId = ? AND isAnswerer = 1 ORDER BY aura DESC`)
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
      displayName: data.displayName,
      email: data.email ?? null,
      passwordHash: data.passwordHash ?? null,
      universityId: data.universityId ?? null,
      isAnswerer: data.isAnswerer ? 1 : 0,
      isUniversityAdmin: data.isUniversityAdmin ? 1 : 0,
      isPlatformAdmin: data.isPlatformAdmin ? 1 : 0,
      isStaff: data.isStaff ? 1 : 0,
      role: data.role ?? "HELPER",
      aura: data.aura ?? 0,
      isOnline: 0,
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO user_profiles (id, displayName, email, passwordHash, universityId, isAnswerer, isUniversityAdmin, isPlatformAdmin, isStaff, role, aura, isOnline, createdAt)
       VALUES (@id, @displayName, @email, @passwordHash, @universityId, @isAnswerer, @isUniversityAdmin, @isPlatformAdmin, @isStaff, @role, @aura, @isOnline, @createdAt)`
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
       role=@role, aura=@aura, isOnline=@isOnline WHERE id=@id`
    ).run(merged);
    return merged;
  },
  setOnline(id: string, isOnline: boolean) {
    db.prepare(`UPDATE user_profiles SET isOnline = ? WHERE id = ?`).run(isOnline ? 1 : 0, id);
  },
  countAnswers(userId: string): number {
    return (
      db.prepare(`SELECT COUNT(*) c FROM messages WHERE senderType = 'EXPERT' AND senderId = ?`).get(userId) as { c: number }
    ).c;
  },
};

// ---------------------------------------------------------------------------
// students
// ---------------------------------------------------------------------------
export const students = {
  findById(id: string): Student | undefined {
    return db.prepare(`SELECT * FROM students WHERE id = ?`).get(id) as Student | undefined;
  },
  findByMaxUserId(maxUserId: string): Student | undefined {
    return db.prepare(`SELECT * FROM students WHERE maxUserId = ?`).get(maxUserId) as Student | undefined;
  },
  /**
   * MVP name-only identity (see README, "Известные ограничения MVP"): several
   * people could in theory share a display name, but for the demo/hackathon
   * scope we treat a case-insensitively-matched name as "the same student" so
   * that logging out and back in does not orphan their question history.
   * A real deployment authenticates by login/password or the MAX platform id
   * instead (see findOrCreateByMaxUserId below), where this collision can't happen.
   */
  findByDisplayName(displayName: string): Student | undefined {
    // SQLite's built-in lower()/upper() only fold ASCII, not Cyrillic, so a
    // SQL-side "lower(a) = lower(b)" comparison silently fails to match
    // "Олеся" against "олеся". Compare case-insensitively in JS instead —
    // the students table is tiny (one row per person who has ever asked a
    // question), so scanning it is cheap.
    const target = displayName.trim().toLocaleLowerCase("ru-RU");
    const candidates = db.prepare(`SELECT * FROM students WHERE maxUserId IS NULL ORDER BY createdAt ASC`).all() as Student[];
    return candidates.find((s) => s.displayName.trim().toLocaleLowerCase("ru-RU") === target);
  },
  create(data: { displayName: string; maxUserId?: string | null }): Student {
    const row: Student = {
      id: newId(),
      displayName: data.displayName,
      maxUserId: data.maxUserId ?? null,
      createdAt: now(),
    };
    db.prepare(`INSERT INTO students (id, displayName, maxUserId, createdAt) VALUES (@id, @displayName, @maxUserId, @createdAt)`).run(row);
    return row;
  },
  findOrCreateByMaxUserId(maxUserId: string, displayName: string): Student {
    return this.findByMaxUserId(maxUserId) ?? this.create({ displayName, maxUserId });
  },
  findOrCreateByDisplayName(displayName: string): Student {
    return this.findByDisplayName(displayName) ?? this.create({ displayName: displayName.trim() });
  },
};

// ---------------------------------------------------------------------------
// chat sessions (conversation-engine wizard state)
// ---------------------------------------------------------------------------
export const chatSessions = {
  findByExternalId(externalChatId: string): ChatSession | undefined {
    return db.prepare(`SELECT * FROM chat_sessions WHERE externalChatId = ?`).get(externalChatId) as ChatSession | undefined;
  },
  create(data: { channel: ChatSession["channel"]; externalChatId: string; studentId?: string | null }): ChatSession {
    const row: ChatSession = {
      id: newId(),
      channel: data.channel,
      externalChatId: data.externalChatId,
      step: "SELECT_UNIVERSITY",
      universityId: null,
      categoryId: null,
      studentId: data.studentId ?? null,
      updatedAt: now(),
      createdAt: now(),
    };
    db.prepare(
      `INSERT INTO chat_sessions (id, channel, externalChatId, step, universityId, categoryId, studentId, updatedAt, createdAt)
       VALUES (@id, @channel, @externalChatId, @step, @universityId, @categoryId, @studentId, @updatedAt, @createdAt)`
    ).run(row);
    return row;
  },
  update(id: string, data: Partial<Pick<ChatSession, "step" | "universityId" | "categoryId" | "studentId">>): ChatSession {
    const existing = db.prepare(`SELECT * FROM chat_sessions WHERE id = ?`).get(id) as ChatSession;
    const merged = { ...existing, ...data, updatedAt: now() };
    db.prepare(
      `UPDATE chat_sessions SET step=@step, universityId=@universityId, categoryId=@categoryId, studentId=@studentId, updatedAt=@updatedAt WHERE id=@id`
    ).run(merged);
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
      .prepare(`SELECT * FROM questions WHERE universityId = ? AND status != 'CLOSED' ORDER BY createdAt ASC`)
      .all(universityId) as Question[];
  },
  findByStudent(studentId: string): Question[] {
    return db.prepare(`SELECT * FROM questions WHERE studentId = ? ORDER BY createdAt DESC`).all(studentId) as Question[];
  },
  create(data: {
    universityId: string;
    categoryId: string;
    studentId: string;
    channel: Question["channel"];
    externalChatId: string;
    text: string;
    isSensitive: 0 | 1;
    status: Question["status"];
  }): Question {
    const row: Question = {
      ...data,
      id: newId(),
      assignedToId: null,
      askerRating: null,
      createdAt: now(),
      routedAt: null,
      answeredAt: null,
      closedAt: null,
    };
    db.prepare(
      `INSERT INTO questions (id, universityId, categoryId, studentId, channel, externalChatId, text, status, isSensitive, assignedToId, askerRating, createdAt, routedAt, answeredAt, closedAt)
       VALUES (@id, @universityId, @categoryId, @studentId, @channel, @externalChatId, @text, @status, @isSensitive, @assignedToId, @askerRating, @createdAt, @routedAt, @answeredAt, @closedAt)`
    ).run(row);
    return row;
  },
  update(id: string, data: Partial<Question>): Question | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...data } as Question;
    db.prepare(
      `UPDATE questions SET status=@status, assignedToId=@assignedToId, askerRating=@askerRating, routedAt=@routedAt, answeredAt=@answeredAt, closedAt=@closedAt WHERE id=@id`
    ).run(merged);
    return merged;
  },
};

// ---------------------------------------------------------------------------
// messages (thread)
// ---------------------------------------------------------------------------
export const messages = {
  findByQuestion(questionId: string): Message[] {
    return db.prepare(`SELECT * FROM messages WHERE questionId = ? ORDER BY createdAt ASC`).all(questionId) as Message[];
  },
  lastByQuestion(questionId: string): Message | undefined {
    return db.prepare(`SELECT * FROM messages WHERE questionId = ? ORDER BY createdAt DESC LIMIT 1`).get(questionId) as
      | Message
      | undefined;
  },
  hasExpertMessage(questionId: string): boolean {
    const row = db.prepare(`SELECT COUNT(*) c FROM messages WHERE questionId = ? AND senderType = 'EXPERT'`).get(questionId) as {
      c: number;
    };
    return row.c > 0;
  },
  create(data: { questionId: string; senderType: Message["senderType"]; senderId: string; text: string }): Message {
    const row: Message = { id: newId(), ...data, createdAt: now() };
    db.prepare(
      `INSERT INTO messages (id, questionId, senderType, senderId, text, createdAt) VALUES (@id, @questionId, @senderType, @senderId, @text, @createdAt)`
    ).run(row);
    return row;
  },
};

// ---------------------------------------------------------------------------
// aura events (reputation log)
// ---------------------------------------------------------------------------
export const auraEvents = {
  create(data: { userId: string; points: number; reason: string }): AuraEvent {
    const row: AuraEvent = { id: newId(), ...data, createdAt: now() };
    db.prepare(`INSERT INTO aura_events (id, userId, points, reason, createdAt) VALUES (@id, @userId, @points, @reason, @createdAt)`).run(
      row
    );
    return row;
  },
};
