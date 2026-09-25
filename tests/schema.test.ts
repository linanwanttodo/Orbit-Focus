import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeSchema } from '../api/core/schema';
import { createTestDb } from './test-db';

test('initializes the fresh application schema and user-scoped indexes', async () => {
  const database = await createTestDb();

  try {
    await initializeSchema(database.adapter);

    const tables = await database.adapter.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const tableNames = tables.map((row) => String(row.name));
    assert.deepEqual(tableNames, ['countdowns', 'sessions', 'tasks', 'users']);

    const indexes = await database.adapter.all(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const indexNames = indexes.map((row) => String(row.name));
    assert.ok(indexNames.includes('idx_tasks_user_status_order'));
    assert.ok(indexNames.includes('idx_sessions_user_local_date'));

    const taskColumns = await database.adapter.all('PRAGMA table_info(tasks)');
    assert.ok(taskColumns.some((column) => column.name === 'status'));
    assert.ok(taskColumns.some((column) => column.name === 'priority'));
    assert.ok(taskColumns.some((column) => column.name === 'due_date'));

    const sessionColumns = await database.adapter.all('PRAGMA table_info(sessions)');
    assert.ok(sessionColumns.some((column) => column.name === 'local_date'));
    assert.ok(sessionColumns.some((column) => column.name === 'timezone'));
  } finally {
    await database.close();
  }
});
