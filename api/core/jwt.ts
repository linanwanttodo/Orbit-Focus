// JSON Web Token (HS256) sign/verify implemented with Web Crypto, so the same
// code runs on Cloudflare Workers and Node.js 18+.

import type { AuthUser } from './types';

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function jsonBytes(value: unknown) {
  return encoder.encode(JSON.stringify(value));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface JwtPayload {
  sub: string;
  login: string;
  avatar: string;
  iat: number;
  exp: number;
}

export async function signJwt(user: AuthUser, secret: string, expiresInSeconds = 7 * 24 * 60 * 60): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: JwtPayload = {
    sub: user.id,
    login: user.login,
    avatar: user.avatarUrl,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  };
  const unsigned = `${toBase64Url(jsonBytes(header))}.${toBase64Url(jsonBytes(payload))}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(unsigned));
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromBase64Url(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as JwtPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Sign a short-lived, signed-and-opaque value such as an OAuth state token. */
export async function signState(purpose: string, secret: string, expiresInSeconds = 10 * 60): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { p: purpose, nonce, iat: issuedAt, exp: issuedAt + expiresInSeconds };
  const unsigned = `${toBase64Url(jsonBytes(header))}.${toBase64Url(jsonBytes(payload))}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(unsigned));
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyState(token: string, purpose: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromBase64Url(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as { p?: string; exp?: number };
    if (payload.p !== purpose) return false;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}
