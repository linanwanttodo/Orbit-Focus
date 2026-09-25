import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../api/core/handler';
import { signJwt } from '../api/core/jwt';
import { initializeSchema } from '../api/core/schema';
import type { DbAdapter } from '../api/core/types';
import { createTestDb } from './test-db';

const env = {
  jwtSecret: 'task-api-test-secret',
  githubClientId: '',
  githubClientSecret: '',
};

async function apiRequest(
  db: DbAdapter,
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const response = await handleApi(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    db
  );
  return { status: response.status, data: await response.json() };
}

async function tokenFor(id: string): Promise<string> {
  return signJwt({ id, login: id, avatarUrl: '' }, env.jwtSecret);
}

test('persists task board fields when the same task id is updated', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);
    const token = await tokenFor('user-a');

    const created = await apiRequest(database.adapter, token, 'POST', '/api/tasks', {
      id: 'task-1',
      title: 'Ship the board',
      description: 'Implement the new task board',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-10-01',
    });
    assert.equal(created.status, 201);

    const updated = await apiRequest(database.adapter, token, 'POST', '/api/tasks', {
      id: 'task-1',
      title: 'Ship the board',
      description: 'Implement the new task board',
      status: 'progress',
      priority: 'medium',
      dueDate: '2026-10-02',
      orderIndex: 3,
    });
    assert.equal(updated.status, 201);

    const listed = await apiRequest(database.adapter, token, 'GET', '/api/tasks');
    assert.equal(listed.status, 200);
    assert.equal(listed.data.length, 1);
    assert.deepEqual(
      {
        status: listed.data[0].status,
        priority: listed.data[0].priority,
        dueDate: listed.data[0].dueDate,
        orderIndex: listed.data[0].orderIndex,
      },
      { status: 'progress', priority: 'medium', dueDate: '2026-10-02', orderIndex: 3 }
    );
  } finally {
    await database.close();
  }
});

test('isolates tasks by user while allowing the same client id for two users', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);
    const tokenA = await tokenFor('user-a');
    const tokenB = await tokenFor('user-b');

    await apiRequest(database.adapter, tokenA, 'POST', '/api/tasks', {
      id: 'shared-id',
      title: 'A task',
      status: 'todo',
      priority: 'low',
    });
    await apiRequest(database.adapter, tokenB, 'POST', '/api/tasks', {
      id: 'shared-id',
      title: 'B task',
      status: 'done',
      priority: 'high',
    });

    const listA = await apiRequest(database.adapter, tokenA, 'GET', '/api/tasks');
    const listB = await apiRequest(database.adapter, tokenB, 'GET', '/api/tasks');
    assert.equal(listA.data.length, 1);
    assert.equal(listA.data[0].title, 'A task');
    assert.equal(listB.data.length, 1);
    assert.equal(listB.data[0].title, 'B task');

    const forbiddenUpdate = await apiRequest(database.adapter, tokenB, 'PUT', '/api/tasks/shared-id', {
      title: 'stolen',
    });
    assert.equal(forbiddenUpdate.status, 200);
    const unchanged = await apiRequest(database.adapter, tokenA, 'GET', '/api/tasks');
    assert.equal(unchanged.data[0].title, 'A task');
  } finally {
    await database.close();
  }
});
