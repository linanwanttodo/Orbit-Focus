// Schema management for every backend (Cloudflare D1, better-sqlite3,
// PostgreSQL). The database is versioned through an ordered list of
// migrations tracked in the "schema_migrations" table, so new columns or
// indexes are introduced by appending an entry to MIGRATIONS - never by
// editing statements that already shipped.
//
// Dialect notes:
// - "sqlite" covers both D1 and better-sqlite3 (identical SQL).
// - All queries in the API core stay inside the portable subset shared by
//   both dialects (TEXT/INTEGER columns, ? placeholders rewritten by the
//   PostgreSQL adapter, substr() for day bucketing).

import type { DbAdapter } from './types';

export type SqlDialect = 'sqlite' | 'postgres';

export interface Migration {
  /** Ordered, never-reused identifier, e.g. "0003_add_task_priority". */
  id: string;
  /** Statements executed once per dialect, in order. */
  statements: Record<SqlDialect, string[]>;
  /**
   * When true, "column/table already exists" failures are tolerated. Only
   * used for the one-off legacy upgrade below; new migrations should be
   * written idempotently instead (IF NOT EXISTS) and leave this false.
   */
  tolerateDuplicates?: boolean;
}

// Shared table DDL: valid on both SQLite (D1/better-sqlite3) and PostgreSQL.
const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_completed INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
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
  )`,
  `CREATE TABLE IF NOT EXISTS countdowns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    target_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

// Indexes that only reference columns present in the original pre-auth
// schema; safe to create before the legacy upgrade migration.
const BASE_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)',
];

// These reference user_id, so they must run AFTER 0002 adds the column to
// databases created before per-user auth existed.
const USER_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_countdowns_user_id ON countdowns(user_id)',
];

export const MIGRATIONS: Migration[] = [
  {
    id: '0001_init',
    statements: {
      sqlite: [...TABLES, ...BASE_INDEXES],
      postgres: [...TABLES, ...BASE_INDEXES],
    },
  },
  {
    // Upgrades databases created before per-user auth (missing user_id on
    // tasks/sessions and work_time on sessions). Fresh databases created by
    // 0001 already have these columns, hence tolerateDuplicates. The
    // user-scoped indexes live here so they are never created against a
    // column that does not exist yet on a legacy database.
    id: '0002_legacy_auth_columns',
    tolerateDuplicates: true,
    statements: {
      sqlite: [
        "ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
        'ALTER TABLE sessions ADD COLUMN work_time INTEGER DEFAULT 0',
        ...USER_INDEXES,
      ],
      postgres: [
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''",
        'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS work_time INTEGER DEFAULT 0',
        ...USER_INDEXES,
      ],
    },
  },
];

function isAlreadyExistsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column name|already exists/i.test(message);
}

/** Apply every pending migration for the given dialect. Idempotent. */
export async function applyMigrations(db: DbAdapter, dialect: SqlDialect): Promise<void> {
  await db.run(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)'
  );
  const rows = await db.all('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((row) => String(row.id)));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    for (const statement of migration.statements[dialect]) {
      try {
        await db.run(statement);
      } catch (error) {
        if (!migration.tolerateDuplicates || !isAlreadyExistsError(error)) {
          throw error;
        }
      }
    }
    await db.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [
      migration.id,
      new Date().toISOString(),
    ]);
  }
}
