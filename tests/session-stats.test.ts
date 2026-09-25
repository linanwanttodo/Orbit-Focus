import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../api/core/handler';
import { signJwt } from '../api/core/jwt';
import { initializeSchema } from '../api/core/schema';
import type { DbAdapter } from '../api/core/types';
import { createTestDb } from './test-db';

const env = {
  jwtSecret: 'session-stats-test-secret',
  githubClientId: '',
  githubClientSecret: '',
};

async function request(db: DbAdapter, token: string, method: string, path: string, body?: unknown) {
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

test('stores browser-local session dates and aggregates stats by local_date', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);
    const token = await signJwt({ id: 'stats-user', login: 'stats', avatarUrl: '' }, env.jwtSecret);

    const created = await request(database.adapter, token, 'POST', '/api/sessions', {
      id: 'session-local-1',
      type: 'work',
      duration: 1500,
      workTime: 1500,
      startTime: '2026-09-25T15:00:00.000Z',
      endTime: '2026-09-25T15:25:00.000Z',
      localDate: '2026-09-25',
      timezone: 'Asia/Shanghai',
      isCompleted: true,
    });
    assert.equal(created.status, 201);

    const stats = await request(database.adapter, token, 'GET', '/api/sessions/stats?today=2026-09-25');
    assert.equal(stats.status, 200);
    assert.equal(stats.data.todayFocus, 25);
    assert.equal(stats.data.weeklyData[6], 25);
    assert.deepEqual(stats.data.heatmapData, [
      { date: '2026-09-25', work_time: 1500, sessions_count: 1 },
    ]);
  } finally {
    await database.close();
  }
});

test('rejects sessions without browser-local date metadata', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);
    const token = await signJwt({ id: 'stats-user', login: 'stats', avatarUrl: '' }, env.jwtSecret);
    const response = await request(database.adapter, token, 'POST', '/api/sessions', {
      id: 'session-missing-local-date',
      type: 'work',
      duration: 1500,
      startTime: '2026-09-25T15:00:00.000Z',
    });

    assert.equal(response.status, 400);
  } finally {
    await database.close();
  }
});
