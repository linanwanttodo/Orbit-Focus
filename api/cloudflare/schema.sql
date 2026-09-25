-- Orbit Focus fresh Cloudflare D1 schema.
-- The runtime also calls initializeSchema() before serving API requests.
-- This file is for provisioning a brand-new D1 database.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('work', 'break', 'longBreak')),
  duration INTEGER NOT NULL CHECK (duration BETWEEN 0 AND 86400),
  work_time INTEGER NOT NULL DEFAULT 0 CHECK (work_time BETWEEN 0 AND 86400),
  start_time TEXT NOT NULL,
  end_time TEXT,
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS countdowns (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  target_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status_order ON tasks(user_id, status, order_index);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_local_date ON sessions(user_id, local_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_start_time ON sessions(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_user_type ON sessions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_countdowns_user_target_date ON countdowns(user_id, target_date);
