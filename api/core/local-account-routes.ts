// QQ-email account registration and password login.
//
// Split out of handler.ts to keep the credential rules readable; the routing
// entry point is wired into handleAuth() and delegates here.
//
// Account identity: GitHub accounts keep their raw numeric provider id, so QQ
// ids are namespaced as 'qq-<digits>'. A GitHub id is always numeric and an
// "qq-<digits>" id is never numeric, so the two can never
// collide and no existing GitHub row has to be rewritten.

import type { AuthUser, CoreEnv, DbAdapter } from './types';
import { signJwt } from './jwt';
import { hashPassword, verifyPassword } from './password';
import { consumeRateLimit } from './rate-limit';
import { isAcceptableQqAccount, qqEmailFor, validateQqAccount } from './local-auth';

export interface DbCredentialRow {
  qq: string;
  user_id: string;
  email: string;
  password_hash: string;
}

/**
 * Rate limits. The two are deliberately different: registration is cheap on
 * the server but pollutes the accounts table, so it is capped per IP; login is
 * the online-guessing surface, so it is capped per account as well as per IP.
 *
 * A malformed registration still consumes the budget, because otherwise the
 * limit would not bound how many requests reach the handler at all. The
 * budget is generous enough that a person correcting a typo is unaffected.
 */
const REGISTER_LIMIT = 20;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * A real PBKDF2 hash of a value nobody knows, used to keep the timing of a
 * failed login close to that of a wrong password. Regenerate it if the
 * iteration count in password.ts ever changes.
 */
const DUMMY_HASH =
  'pbkdf2-sha256$120000$lxtoUPaTT53bTacptEi9FQ$KBaEtU4CAHCGEwxCv1ujINiRr6PeS5hDr84quS4T6Lw';

function clientIp(request: Request): string {
  const forwarded = request.headers.get('X-Forwarded-For') || '';
  const first = forwarded.split(',')[0].trim();
  if (first) return first;
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function nowIso(): string {
  return new Date().toISOString();
}

export function qqUserId(qq: string): string {
  return 'qq-' + qq;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

function tooMany(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many attempts. Try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

function validationFailure(reason: string): Response {
  // The reason code is a stable machine-readable token; the client maps it to
  // a localized message. No detail about the stored account leaks here.
  return jsonResponse({ error: 'Invalid request', reason }, 400);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = (await request.json()) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    // fall through to the empty-object case below
  }
  return {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
/**
 * POST /api/auth/register
 *
 * Creates the credentials row and the users row together. The users row is
 * what every other API keys on, so a credential without a user would be an
 * account that can log in but cannot store anything.
 */
export async function handleRegister(
  request: Request,
  env: CoreEnv,
  db: DbAdapter,
  upsertUser: (user: AuthUser) => Promise<void>
): Promise<Response> {
  const ipLimit = consumeRateLimit('register:' + clientIp(request), REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSeconds);

  const body = await readBody(request);
  const qq = text(body.qq).trim();
  // Rate-limit per attempted account too, so one IP cannot spray QQ ids and
  // learn which ones are registered from a difference in the responses.
  if (qq) {
    const accountLimit = consumeRateLimit('register:qq:' + qq, REGISTER_LIMIT, REGISTER_WINDOW_MS);
    if (!accountLimit.allowed) return tooMany(accountLimit.retryAfterSeconds);
  }

  const reason = validateQqAccount({
    email: text(body.email),
    qq,
    password: text(body.password),
  });
  if (reason) return validationFailure(reason);

  const email = qqEmailFor(qq);
  const existing = await db.first('SELECT qq FROM credentials WHERE qq = ?', [qq]);
  if (existing) return validationFailure('alreadyRegistered');

  const userId = qqUserId(qq);
  const passwordHash = await hashPassword(text(body.password));
  const now = nowIso();

  await db.run(
    'INSERT INTO credentials (qq, user_id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [qq, userId, email, passwordHash, now, now]
  );

  // login is the QQ number: a mailbox carries no profile to read.
  const user: AuthUser = { id: userId, login: qq, avatarUrl: '' };
  await upsertUser(user);

  const token = await signJwt(user, env.jwtSecret);
  return jsonResponse({
    token,
    user: { id: user.id, login: user.login, avatarUrl: user.avatarUrl },
  }, 201);
}

/**
 * Normalize whatever the client typed into the QQ digits.
 * Accepts the bare number and the full mailbox, because people type both and
 * rejecting one of them would be a papercut with no security cost.
 */
function normalizeQqInput(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const at = value.lastIndexOf('@');
  const digits = at === -1 ? value : value.slice(0, at);
  return digits.trim();
}

/**
 * POST /api/auth/login
 */
export async function handleLogin(
  request: Request,
  env: CoreEnv,
  db: DbAdapter,
  upsertUser: (user: AuthUser) => Promise<void>
): Promise<Response> {
  const body = await readBody(request);
  const qq = normalizeQqInput(text(body.qq) || text(body.email));
  const password = text(body.password);

  const ipLimit = consumeRateLimit('login:' + clientIp(request), LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSeconds);

  // Answer unknown and wrong-password identically: a distinct error is an
  // account-existence oracle. The verification still runs against a dummy
  // hash so the timing of the two paths does not differ either.
  const row: DbCredentialRow | null =
    qq && /^[0-9]{5,11}$/.test(qq)
      ? ((await db.first(
          'SELECT qq, user_id, email, password_hash FROM credentials WHERE qq = ?',
          [qq]
        )) as DbCredentialRow | null)
      : null;

  if (!isAcceptableQqAccount(row)) {
    await verifyPassword(password, DUMMY_HASH);
    return errorResponse(401, 'Incorrect QQ number or password');
  }

  const accountLimit = consumeRateLimit('login:qq:' + row!.qq, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!accountLimit.allowed) return tooMany(accountLimit.retryAfterSeconds);

  if (!(await verifyPassword(password, row!.password_hash))) {
    return errorResponse(401, 'Incorrect QQ number or password');
  }

  // Re-create the user row if it is missing (restored backup, partial write),
  // so a valid credential never resolves to an account that cannot store data.
  const user: AuthUser = { id: row!.user_id, login: row!.qq, avatarUrl: '' };
  await upsertUser(user);

  const token = await signJwt(user, env.jwtSecret);
  return jsonResponse({
    token,
    user: { id: user.id, login: user.login, avatarUrl: user.avatarUrl },
  });
}
