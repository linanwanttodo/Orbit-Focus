import Database from 'better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DbAdapter, Row } from '../api/core/types';

export interface TestDatabase {
  adapter: DbAdapter;
  close: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDatabase> {
  const directory = await mkdtemp(join(tmpdir(), 'orbit-focus-test-'));
  const database = new Database(join(directory, 'test.db'));
  const adapter: DbAdapter = {
    async all(sql: string, params?: (string | number | null)[]): Promise<Row[]> {
      return database.prepare(sql).all(...(params || [])) as Row[];
    },
    async first(sql: string, params?: (string | number | null)[]): Promise<Row | null> {
      return (database.prepare(sql).get(...(params || [])) as Row) ?? null;
    },
    async run(sql: string, params?: (string | number | null)[]): Promise<void> {
      database.prepare(sql).run(...(params || []));
    },
  };

  return {
    adapter,
    close: async () => {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
