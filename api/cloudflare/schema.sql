-- Orbit Focus - Cloudflare D1 database schema (fresh-database bootstrap)
--
-- The runtime (api/cloudflare/index.ts) applies api/core/schema.ts migrations
-- automatically on first request; this file is only for one-time provisioning
-- of a brand-new D1 database via:
--   wrangler d1 execute orbit_focus_db --remote --file=./api/cloudflare/schema.sql
--
-- Keep this file in sync with MIGRATIONS in api/core/schema.ts. The trailing
-- inserts mark both migrations as applied so the runtime does not replay them.

-- ==================== Migration ledger ====================
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- ==================== Users (GitHub login) ====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ==================== Tasks ====================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_completed INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ==================== Focus sessions ====================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('work', 'break', 'longBreak')),
  duration INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  is_completed INTEGER DEFAULT 0,
  work_time INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ==================== Countdowns ====================
CREATE TABLE IF NOT EXISTS countdowns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  target_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ==================== Indexes ====================
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_countdowns_user_id ON countdowns(user_id);

-- ==================== Mark migrations as applied ====================
INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES ('0001_init', datetime('now'));
INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES ('0002_legacy_auth_columns', datetime('now'));
