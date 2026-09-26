import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Where the SQLite file lives (see README "Где хранятся данные"):
//  - in Docker: /app/data/askvuz.db, bind-mounted to ./backend/data on the host
//  - running locally with `npm run dev`: ./backend/data/askvuz.db
const DB_PATH = process.env.DATABASE_FILE || path.join(__dirname, "..", "..", "data", "askvuz.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// MVP schema — a lightweight hand-rolled equivalent of a relational ORM
// migration, applied idempotently on boot. Kept deliberately simple (no
// migration framework) so the whole backend starts from a clean Docker image
// with a single `npm start`, no native engine downloads required.
db.exec(`
CREATE TABLE IF NOT EXISTS universities (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  description TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  universityId TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  minRole TEXT NOT NULL DEFAULT 'HELPER',
  isSensitive INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  UNIQUE(universityId, code)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  email TEXT UNIQUE,
  passwordHash TEXT,
  universityId TEXT REFERENCES universities(id),
  isAnswerer INTEGER NOT NULL DEFAULT 0,
  isUniversityAdmin INTEGER NOT NULL DEFAULT 0,
  isPlatformAdmin INTEGER NOT NULL DEFAULT 0,
  isStaff INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'HELPER',
  aura INTEGER NOT NULL DEFAULT 0,
  isOnline INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  maxUserId TEXT UNIQUE,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  externalChatId TEXT UNIQUE NOT NULL,
  step TEXT NOT NULL DEFAULT 'SELECT_UNIVERSITY',
  universityId TEXT REFERENCES universities(id),
  categoryId TEXT REFERENCES categories(id),
  studentId TEXT REFERENCES students(id),
  updatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  universityId TEXT NOT NULL REFERENCES universities(id),
  categoryId TEXT NOT NULL REFERENCES categories(id),
  studentId TEXT NOT NULL REFERENCES students(id),
  channel TEXT NOT NULL,
  externalChatId TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  isSensitive INTEGER NOT NULL DEFAULT 0,
  assignedToId TEXT REFERENCES user_profiles(id),
  askerRating TEXT,
  createdAt TEXT NOT NULL,
  routedAt TEXT,
  answeredAt TEXT,
  closedAt TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  questionId TEXT NOT NULL REFERENCES questions(id),
  senderType TEXT NOT NULL,
  senderId TEXT NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aura_events (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user_profiles(id),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_university ON categories(universityId);
CREATE INDEX IF NOT EXISTS idx_users_university ON user_profiles(universityId);
CREATE INDEX IF NOT EXISTS idx_questions_university ON questions(universityId);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(studentId);
CREATE INDEX IF NOT EXISTS idx_messages_question ON messages(questionId);
`);
