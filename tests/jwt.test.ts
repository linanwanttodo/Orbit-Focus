import assert from 'node:assert/strict';
import test from 'node:test';
import { signJwt, signState, verifyJwt, verifyState } from '../api/core/jwt';

const secret = 'jwt-test-secret';
const encoder = new TextEncoder();

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSegment(value: unknown): string {
  return encodeBytes(encoder.encode(JSON.stringify(value)));
}

function decodeSegment(segment: string): Uint8Array {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Build tokens the signing helpers would never emit, to probe the verifiers. */
async function rawToken(header: unknown, payload: unknown, signingKey: string): Promise<string> {
  const unsigned = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(unsigned));
  return `${unsigned}.${encodeBytes(new Uint8Array(signature))}`;
}

function epochPlus(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

test('verifies a session token and returns its subject', async () => {
  const token = await signJwt({ id: 'user-1', login: 'octo', avatarUrl: 'https://example.test/a.png' }, secret);
  const payload = await verifyJwt(token, secret);
  assert.ok(payload);
  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.login, 'octo');
  assert.equal(payload.avatar, 'https://example.test/a.png');
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
});

test('rejects a session token signed with another secret', async () => {
  const token = await signJwt({ id: 'user-1', login: 'octo', avatarUrl: '' }, secret);
  assert.equal(await verifyJwt(token, 'jwt-test-secret-tampered'), null);
});

test('rejects a session token with a damaged signature', async () => {
  const token = await signJwt({ id: 'user-1', login: 'octo', avatarUrl: '' }, secret);
  const [header, payload, signature] = token.split('.');
  // The trailing base64url character carries padding bits, so damage the leading one.
  const damaged = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  assert.notEqual(damaged, signature);
  assert.equal(await verifyJwt(`${header}.${payload}.${damaged}`, secret), null);
});

test('rejects a session token whose payload was swapped for another subject', async () => {
  const token = await signJwt({ id: 'user-1', login: 'octo', avatarUrl: '' }, secret);
  const header = token.split('.')[0];
  const signature = token.split('.')[2];
  const forged = encodeSegment({ sub: 'victim', login: 'victim', avatar: '', iat: epochPlus(-1), exp: epochPlus(3600) });
  assert.equal(await verifyJwt(`${header}.${forged}.${signature}`, secret), null);
});

test('rejects an expired session token', async () => {
  const token = await signJwt({ id: 'user-1', login: 'octo', avatarUrl: '' }, secret, -1);
  assert.equal(await verifyJwt(token, secret), null);
});

test('rejects a validly signed session token with a missing or non-string subject', async () => {
  const claims = { login: 'octo', avatar: '', iat: epochPlus(-1), exp: epochPlus(3600) };
  assert.equal(await verifyJwt(await rawToken({ alg: 'HS256', typ: 'JWT' }, { ...claims, sub: '' }, secret), secret), null);
  assert.equal(await verifyJwt(await rawToken({ alg: 'HS256', typ: 'JWT' }, claims, secret), secret), null);
});

test('rejects a validly signed session token whose exp is not a number', async () => {
  const token = await rawToken(
    { alg: 'HS256', typ: 'JWT' },
    { sub: 'user-1', login: 'octo', avatar: '', iat: epochPlus(-1), exp: `${epochPlus(3600)}` },
    secret
  );
  assert.equal(await verifyJwt(token, secret), null);
});

test('rejects structurally invalid session tokens', async () => {
  for (const value of ['', 'not-a-token', 'a.b', 'a.b.c.d', '...', 'a.b.']) {
    assert.equal(await verifyJwt(value, secret), null, `expected null for ${JSON.stringify(value)}`);
  }
});

test('accepts a state token only for the purpose it was signed with', async () => {
  const state = await signState('gh-oauth', secret);
  assert.equal(await verifyState(state, 'gh-oauth', secret), true);
  assert.equal(await verifyState(state, 'password-reset', secret), false);
});

test('rejects a state token signed with another secret', async () => {
  const state = await signState('gh-oauth', secret);
  assert.equal(await verifyState(state, 'gh-oauth', 'jwt-test-secret-tampered'), false);
});

test('rejects an expired state token', async () => {
  const state = await signState('gh-oauth', secret, -1);
  assert.equal(await verifyState(state, 'gh-oauth', secret), false);
});

test('rejects a damaged state token', async () => {
  const state = await signState('gh-oauth', secret);
  const [header, payload, signature] = state.split('.');
  assert.equal(await verifyState(`${header}.${payload}.${signature.slice(0, -2)}`, 'gh-oauth', secret), false);
  const forged = encodeSegment({ p: 'gh-oauth', nonce: 'reused', iat: epochPlus(-1), exp: epochPlus(600) });
  assert.equal(await verifyState(`${header}.${forged}.${signature}`, 'gh-oauth', secret), false);
});

test('rejects structurally invalid state tokens', async () => {
  for (const value of ['', 'not-a-token', 'a.b', 'a.b.c.d']) {
    assert.equal(await verifyState(value, 'gh-oauth', secret), false, `expected false for ${JSON.stringify(value)}`);
  }
});

test('issues a distinct nonce per state token for the same purpose', async () => {
  const [first, second] = await Promise.all([signState('gh-oauth', secret), signState('gh-oauth', secret)]);
  assert.notEqual(first, second);
  assert.equal(await verifyState(second, 'gh-oauth', secret), true);

  const decode = (token: string): { nonce?: string } =>
    JSON.parse(new TextDecoder().decode(decodeSegment(token.split('.')[1])));
  assert.notEqual(decode(first).nonce, decode(second).nonce);
});
