// Vercel API - 数据库层（使用 @libsql/client / Turso）
// 兼容 SQLite，可连接 Turso、Local SQLite 等

import { createClient, Client } from '@libsql/client';

let db: Client | null = null;

function getDb(): Client {
  if (!db) {
    const url = process.env.TURSO_DATABASE_URL || process.env.DB_URL || 'file:local.db';
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

    db = createClient({
      url,
      authToken,
    });
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const client = getDb();

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_completed INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      duration INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      is_completed INTEGER DEFAULT 0,
      work_time INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
    CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
  `);
}

export { getDb };
