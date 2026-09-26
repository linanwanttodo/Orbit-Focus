import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../api/core/handler';
import { signJwt } from '../api/core/jwt';
import { initializeSchema } from '../api/core/schema';
import type { DbAdapter } from '../api/core/types';
import { createTestDb } from './test-db';

const env = { jwtSecret: 'countdown-test-secret', githubClientId: '', githubClientSecret: '' };

async function request(db: DbAdapter, token: string, method: string, path: string, body?: unknown) {
  const response = await handleApi(
    new Request(`http://localhost${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    db
  );
  return { status: response.status, data: await response.json() };
}

test('keeps future countdowns isolated and updates the same id per user', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);
    const tokenA = await signJwt({ id: 'date-user-a', login: 'a', avatarUrl: '' }, env.jwtSecret);
    const tokenB = await signJwt({ id: 'date-user-b', login: 'b', avatarUrl: '' }, env.jwtSecret);

    assert.equal((await request(database.adapter, tokenA, 'POST', '/api/countdowns', {
      id: 'date-shared', title: 'Exam', targetDate: '2026-10-01T00:00',
    })).status, 201);
    assert.equal((await request(database.adapter, tokenA, 'POST', '/api/countdowns', {
      id: 'date-shared', title: 'Exam updated', targetDate: '2026-10-02T00:00',
    })).status, 201);
    assert.equal((await request(database.adapter, tokenB, 'POST', '/api/countdowns', {
      id: 'date-shared', title: 'Other exam', targetDate: '2026-11-01T00:00',
    })).status, 201);

    const listA = await request(database.adapter, tokenA, 'GET', '/api/countdowns');
    const listB = await request(database.adapter, tokenB, 'GET', '/api/countdowns');
    assert.equal(listA.data[0].title, 'Exam updated');
    assert.equal(listB.data[0].title, 'Other exam');
  } finally {
    await database.close();
  }
});
