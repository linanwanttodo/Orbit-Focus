import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../api/core/handler';
import { initializeSchema } from '../api/core/schema';
import type { DbAdapter } from '../api/core/types';
import { verifyPassword } from '../api/core/password';
import { resetRateLimits } from '../api/core/rate-limit';
import { createTestDb } from './test-db';

const env = {
  jwtSecret: 'local-auth-test-secret',
  githubClientId: '',
  githubClientSecret: '',
};

async function post(db: DbAdapter, path: string, body: unknown): Promise<{ status: number; data: any }> {
  const response = await handleApi(
    new Request('http://localhost' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    db
  );
  return { status: response.status, data: await response.json() };
}

async function ready(): Promise<{ db: DbAdapter; close: () => Promise<void> }> {
  // Rate-limit counters live in module state, so every test starts clean.
  resetRateLimits();
  const database = await createTestDb();
  await initializeSchema(database.adapter);
  return { db: database.adapter, close: database.close };
}

const VALID = { qq: '123456', email: '123456@qq.com', password: 'correct-horse' };
test('registers a QQ account and returns a usable token', async () => {
  const { db, close } = await ready();
  try {
    const result = await post(db, '/api/auth/register', VALID);
    assert.equal(result.status, 201);
    assert.equal(result.data.user.id, 'qq-123456');
    assert.equal(result.data.user.login, '123456');
    assert.ok(result.data.token);

    // The stored hash must not be the password in any reversible form.
    const row = await db.first('SELECT * FROM credentials WHERE qq = ?', ['123456']);
    assert.ok(row);
    assert.ok(!String(row!.password_hash).includes('correct-horse'));
    assert.equal(await verifyPassword('correct-horse', String(row!.password_hash)), true);
    assert.equal(await verifyPassword('wrong-password', String(row!.password_hash)), false);

    // The user row must exist, or the account could log in but store nothing.
    const user = await db.first('SELECT id FROM users WHERE id = ?', ['qq-123456']);
    assert.ok(user);
  } finally {
    await close();
  }
});

test('logs in with the QQ number or the full mailbox', async () => {
  const { db, close } = await ready();
  try {
    await post(db, '/api/auth/register', VALID);

    const byNumber = await post(db, '/api/auth/login', { qq: '123456', password: VALID.password });
    assert.equal(byNumber.status, 200);
    assert.ok(byNumber.data.token);

    const byEmail = await post(db, '/api/auth/login', {
      email: '123456@qq.com',
      password: VALID.password,
    });
    assert.equal(byEmail.status, 200);
    assert.equal(byEmail.data.token, byNumber.data.token);
  } finally {
    await close();
  }
});

test('rejects a wrong password and an unknown account identically', async () => {
  const { db, close } = await ready();
  try {
    await post(db, '/api/auth/register', VALID);

    const wrongPassword = await post(db, '/api/auth/login', { qq: '123456', password: 'nope-nope-nope' });
    const unknown = await post(db, '/api/auth/login', { qq: '999999', password: 'nope-nope-nope' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknown.status, 401);
    // Identical bodies: a difference here would be an account-existence oracle.
    assert.deepEqual(wrongPassword.data, unknown.data);
  } finally {
    await close();
  }
});

test('refuses a duplicate QQ number', async () => {
  const { db, close } = await ready();
  try {
    assert.equal((await post(db, '/api/auth/register', VALID)).status, 201);
    const again = await post(db, '/api/auth/register', VALID);
    assert.equal(again.status, 400);
    assert.equal(again.data.reason, 'alreadyRegistered');

    const rows = await db.all('SELECT qq FROM credentials');
    assert.equal(rows.length, 1);
  } finally {
    await close();
  }
});
test('rejects non-numeric and non-QQ addresses before touching the database', async () => {
  const { db, close } = await ready();
  try {
    const cases: Array<[Record<string, string>, string]> = [
      [{ ...VALID, email: 'someone@gmail.com' }, 'emailNotQq'],
      [{ ...VALID, email: 'vip.qq.com@qq.com' }, 'qqNotNumeric'],
      [{ ...VALID, email: '123456@foxmail.com' }, 'emailNotQq'],
      [{ ...VALID, qq: 'abcdef', email: 'abcdef@qq.com' }, 'qqNotNumeric'],
      [{ ...VALID, qq: '123', email: '123@qq.com' }, 'qqTooShort'],
      [{ ...VALID, qq: '123456789012', email: '123456789012@qq.com' }, 'qqTooLong'],
      [{ ...VALID, qq: '654321', email: '123456@qq.com' }, 'emailMismatch'],
      [{ ...VALID, password: 'short' }, 'passwordTooShort'],
    ];

    for (const [body, reason] of cases) {
      const result = await post(db, '/api/auth/register', body);
      assert.equal(result.status, 400, 'expected 400 for ' + JSON.stringify(body));
      assert.equal(result.data.reason, reason, JSON.stringify(body));
    }

    assert.equal((await db.all('SELECT qq FROM credentials')).length, 0);
  } finally {
    await close();
  }
});

test('blocks a password-guessing burst with 429', async () => {
  const { db, close } = await ready();
  try {
    await post(db, '/api/auth/register', VALID);

    let sawRateLimit = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const result = await post(db, '/api/auth/login', { qq: '123456', password: 'guess-' + attempt });
      if (result.status === 429) {
        sawRateLimit = true;
        break;
      }
    }
    assert.ok(sawRateLimit, 'login must rate-limit repeated guesses');
  } finally {
    await close();
  }
});

test('keeps GitHub and QQ account ids from colliding', async () => {
  const { db, close } = await ready();
  try {
    await post(db, '/api/auth/register', VALID);

    // A GitHub user whose provider id is literally 123456 must not share rows
    // with the QQ account 123456.
    const githubUser = { id: '123456', login: 'octocat', avatarUrl: '' };
    await db.run(
      'INSERT INTO users (id, login, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      ['123456', 'octocat', '', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    );

    const ids = await db.all('SELECT id FROM users ORDER BY id');
    assert.deepEqual(ids.map((row) => String(row.id)), ['123456', 'qq-123456']);
    assert.ok(githubUser.id !== 'qq-123456');
  } finally {
    await close();
  }
});
