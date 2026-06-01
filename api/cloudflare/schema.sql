-- Orbit Focus - Cloudflare D1 数据库 Schema
-- 使用方法: wrangler d1 execute orbit-focus-db --file=./api/cloudflare/schema.sql

-- ==================== 任务表 ====================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_completed INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ==================== 会话表 ====================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('work', 'break', 'longBreak')),
  duration INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  is_completed INTEGER DEFAULT 0,
  work_time INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ==================== 索引 ====================
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);

-- ==================== 示例数据（可选）====================
-- INSERT INTO tasks (id, title, description, is_completed, order_index, created_at, updated_at)
-- VALUES ('task_example_1', '完成项目文档', '编写 API 文档', 0, 1, datetime('now'), datetime('now'));
