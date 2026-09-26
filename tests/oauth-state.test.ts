import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../api/core/handler';
import { signState } from '../api/core/jwt';
import { initializeSchema } from '../api/core/schema';
import type { DbAdapter } from '../api/core/types';
import { createTestDb } from './test-db';

const secret = 'oauth-state-test-secret';
const env = { jwtSecret: secret, githubClientId: 'client-id', githubClientSecret: 'client-secret' };

async function callback(db: DbAdapter, options: { state?: string; cookieState?: string; code?: string }) {
  const url = new URL('http://localhost/api/auth/github/callback');
  url.searchParams.set('code', options.code === undefined ? 'test-code' : options.code);
  if (options.state) url.searchParams.set('state', options.state);

  const headers = new Headers();
  if (options.cookieState) {
    headers.set('Cookie', `of_oauth_state=${encodeURIComponent(options.cookieState)}`);
  }

  const response = await handleApi(new Request(url.toString(), { headers }), env, db);
  return { status: response.status, setCookie: response.headers.get('Set-Cookie') || '' };
}

test('rejects an OAuth callback whose state has no matching cookie', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);
    const state = await signState('gh-oauth', secret);

    const noCookie = await callback(database.adapter, { state });
    assert.equal(noCookie.status, 400);

    const mismatched = await callback(database.adapter, { state, cookieState: await signState('gh-oauth', secret) });
    assert.equal(mismatched.status, 400);

    const noState = await callback(database.adapter, { cookieState: state });
    assert.equal(noState.status, 400);

    const noCode = await callback(database.adapter, { state, cookieState: state, code: '' });
    assert.equal(noCode.status, 400);
  } finally {
    await database.close();
  }
});

test('rejects a callback state that is forged, expired, or signed for another purpose', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);

    const foreignSecret = await signState('gh-oauth', 'oauth-state-test-secret-other');
    assert.equal((await callback(database.adapter, { state: foreignSecret, cookieState: foreignSecret })).status, 400);

    const expired = await signState('gh-oauth', secret, -1);
    assert.equal((await callback(database.adapter, { state: expired, cookieState: expired })).status, 400);

    const otherPurpose = await signState('password-reset', secret);
    assert.equal((await callback(database.adapter, { state: otherPurpose, cookieState: otherPurpose })).status, 400);
  } finally {
    await database.close();
  }
});

test('clears the OAuth state cookie when the callback is rejected', async () => {
  const database = await createTestDb();
  try {
    await initializeSchema(database.adapter);
    const state = await signState('gh-oauth', secret);
    const { status, setCookie } = await callback(database.adapter, { state });
    assert.equal(status, 400);
    assert.match(setCookie, /of_oauth_state=;/);
    assert.match(setCookie, /Max-Age=0/);
  } finally {
    await database.close();
  }
});
