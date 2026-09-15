// Database access for the self-hosted Express server. The backend is
// selectable through the DB_CLIENT environment variable:
//
//   DB_CLIENT=sqlite    (default) single-file database via better-sqlite3,
//                                 path configurable with SQLITE_PATH.
//   DB_CLIENT=postgres  PostgreSQL via the "pg" driver, configured with
//                                 DATABASE_URL (or standard PG* variables).
//
// Every driver is wrapped into the shared DbAdapter (async all/first/run with
// "?" placeholders) used by the framework-agnostic API core, and the SQL in
// api/core stays inside the subset both engines understand. Additional
// engines (MySQL, ...) only need a new case in createDatabase().

import fs from 'fs';
import path from 'path';

import type { DbAdapter, Row, SqlValue } from '../../api/core/types';
import type { SqlDialect } from '../../api/core/schema';

export interface DatabaseHandle {
  adapter: DbAdapter;
  dialect: SqlDialect;
  /** Human-readable description for startup logs. */
  describe(): string;
  close(): void;
}

async function openSqlite(): Promise<DatabaseHandle> {
  // Lazy import keeps the native better-sqlite3 dependency out of the code
  // path when another engine is selected.
  const { default: Database } = await import('better-sqlite3');

  const dbPath = path.resolve(process.cwd(), process.env.SQLITE_PATH || 'data/orbit-focus.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  return {
    dialect: 'sqlite',
    describe: () => `sqlite (${dbPath})`,
    close: () => db.close(),
    adapter: {
      async all(sql: string, params?: SqlValue[]): Promise<Row[]> {
        return db.prepare(sql).all(...(params || [])) as Row[];
      },
      async first(sql: string, params?: SqlValue[]): Promise<Row | null> {
        return (db.prepare(sql).get(...(params || [])) as Row) ?? null;
      },
      async run(sql: string, params?: SqlValue[]): Promise<void> {
        db.prepare(sql).run(...(params || []));
      },
    },
  };
}

/**
 * Rewrite SQLite-style "?" placeholders into PostgreSQL "$1..$n" form.
 * Question marks inside single-quoted literals are left untouched.
 * Exported for unit testing.
 */
export function toPositionalParams(sql: string): string {
  let out = '';
  let index = 0;
  let inLiteral = false;
  for (const ch of sql) {
    if (ch === "'") {
      inLiteral = !inLiteral;
      out += ch;
    } else if (ch === '?' && !inLiteral) {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function maskConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) parsed.password = '****';
    return parsed.toString();
  } catch {
    // keyword/value form (host=... password=...): never echo it into logs.
    return 'connection string hidden';
  }
}

async function openPostgres(): Promise<DatabaseHandle> {
  const { Pool } = await import('pg');
  const connectionString = process.env.DATABASE_URL || undefined;
  const pool = new Pool(connectionString ? { connectionString } : {});

  const query = async (sql: string, params?: SqlValue[]) =>
    pool.query(toPositionalParams(sql), params as unknown[] | undefined);

  return {
    dialect: 'postgres',
    describe: () =>
      `postgres (${connectionString ? maskConnectionString(connectionString) : 'PGHOST/PGDATABASE environment'})`,
    close: () => {
      void pool.end();
    },
    adapter: {
      async all(sql: string, params?: SqlValue[]): Promise<Row[]> {
        const result = await query(sql, params);
        return result.rows as Row[];
      },
      async first(sql: string, params?: SqlValue[]): Promise<Row | null> {
        const result = await query(sql, params);
        return (result.rows[0] as Row) ?? null;
      },
      async run(sql: string, params?: SqlValue[]): Promise<void> {
        await query(sql, params);
      },
    },
  };
}

export async function createDatabase(): Promise<DatabaseHandle> {
  const client = (process.env.DB_CLIENT || 'sqlite').trim().toLowerCase();
  switch (client) {
    case '':
    case 'sqlite':
      return await openSqlite();
    case 'postgres':
    case 'postgresql':
      return await openPostgres();
    default:
      throw new Error(`Unsupported DB_CLIENT "${client}" (expected sqlite or postgres)`);
  }
}
