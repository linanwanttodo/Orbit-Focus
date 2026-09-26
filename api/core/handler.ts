// Framework-agnostic API core. Handles GitHub OAuth login, per-user tasks,
// sessions, stats and countdowns. Platform adapters (Cloudflare Worker,
// Express) convert their request objects to web-standard Request/Response
// and forward them here.

import type {
  AuthUser,
  CoreEnv,
  DbAdapter,
  DbCountdownRow,
  DbDailyRow,
  DbHeatmapRow,
  DbSessionRow,
  DbStatsRow,
  DbTaskRow,
  SqlValue,
  TaskStatus,
} from './types';
import { signJwt, signState, verifyJwt, verifyState } from './jwt';
import { buildAuthorizeUrl, exchangeCodeForToken, fetchGitHubProfile } from './github';
import { calculateStreak, fillLast7Days, getLast7DaysRange, getLocalDateString, getLocalDaysAgo } from './stats';

const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const SESSION_TYPES = new Set(['work']);
const TASK_STATUSES = new Set<TaskStatus>(['todo', 'progress', 'done']);

interface ApiBody {
  [key: string]: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validDateOnly(value: unknown): value is string | null {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validDateTime(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(new Date(value).getTime());
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

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

// --- OAuth state cookie helpers ---
// The signed state token is also mirrored into a short-lived httpOnly cookie
// scoped to the callback path, so the callback only succeeds in the same
// browser that started the flow. Without this binding an attacker could
// complete OAuth elsewhere, then trick a victim into hitting the callback URL
// and silently log the victim into the attacker's account.

const OAUTH_COOKIE = 'of_oauth_state';
const OAUTH_COOKIE_MAX_AGE = 600;

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie') || '';
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (name) cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

function oauthCookie(value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${OAUTH_COOKIE}=${encodeURIComponent(value)}`,
    `Path=/api/auth/github/callback`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * TLS is usually terminated by a reverse proxy (Nginx/Caddy) or Cloudflare,
 * so the request URL alone is not enough. Trust, in order: an already
 * resolved https request URL, the X-Forwarded-Proto header, and an https
 * PUBLIC_ORIGIN. When none prove TLS, the cookie stays non-Secure so local
 * http://localhost development keeps working.
 */
function requestIsSecure(request: Request, url: URL, env: CoreEnv): boolean {
  if (url.protocol === 'https:') return true;
  const forwarded = (request.headers.get('X-Forwarded-Proto') || '').split(',')[0].trim().toLowerCase();
  if (forwarded === 'https') return true;
  return (env.publicOrigin || '').toLowerCase().startsWith('https://');
}

function preflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function readJsonBody(request: Request): Promise<ApiBody | null> {
  try {
    const data = (await request.json()) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as ApiBody;
    }
    return null;
  } catch {
    return null;
  }
}

async function authenticate(request: Request, env: CoreEnv): Promise<AuthUser | null> {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  const payload = await verifyJwt(token, env.jwtSecret);
  if (!payload) return null;
  return { id: payload.sub, login: payload.login || '', avatarUrl: payload.avatar || '' };
}

function originOf(request: Request, env: CoreEnv): string {
  const url = new URL(request.url);
  return (env.publicOrigin || url.origin).replace(/\/+$/, '');
}

function validId(id: string): boolean {
  return ID_PATTERN.test(id);
}

function mapTask(row: DbTaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    orderIndex: row.order_index,
    isCompleted: row.status === 'done',
    createdAt: row.created_at,
  };
}

function mapSession(row: DbSessionRow) {
  return {
    id: row.id,
    type: row.type,
    duration: row.duration,
    workTime: row.work_time,
    startTime: row.start_time,
    endTime: row.end_time,
    localDate: row.local_date,
    timezone: row.timezone,
    isCompleted: row.is_completed === 1,
  };
}

function mapCountdown(row: DbCountdownRow) {
  return {
    id: row.id,
    title: row.title,
    targetDate: row.target_date,
    createdAt: row.created_at,
  };
}

async function upsertUser(db: DbAdapter, user: AuthUser): Promise<void> {
  const now = nowIso();
  await db.run(
    `INSERT INTO users (id, login, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET login = excluded.login, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at`,
    [user.id, user.login, user.avatarUrl, now, now]
  );
}

async function handleAuth(request: Request, url: URL, env: CoreEnv, db: DbAdapter): Promise<Response> {
  const path = url.pathname;
  const secure = requestIsSecure(request, url, env);

  if (path === '/api/auth/github' && request.method === 'GET') {
    if (!env.githubClientId) {
      return errorResponse(501, 'GitHub OAuth is not configured on this server');
    }
    const origin = originOf(request, env);
    const state = await signState('gh-oauth', env.jwtSecret);
    const redirectUri = `${origin}/api/auth/github/callback`;
    const response = redirectResponse(buildAuthorizeUrl(env.githubClientId, redirectUri, state));
    response.headers.append('Set-Cookie', oauthCookie(state, OAUTH_COOKIE_MAX_AGE, secure));
    return response;
  }

  if (path === '/api/auth/github/callback' && request.method === 'GET') {
    const respond = (response: Response): Response => {
      // Always drop the state cookie once the callback has been seen.
      response.headers.append('Set-Cookie', oauthCookie('', 0, secure));
      return response;
    };
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const error = url.searchParams.get('error');
    if (error) {
      return respond(redirectResponse(`${originOf(request, env)}/auth-done#error=${encodeURIComponent(error)}`));
    }
    const cookieState = parseCookies(request)[OAUTH_COOKIE] || '';
    if (
      !code ||
      !state ||
      cookieState.length === 0 ||
      cookieState !== state ||
      !(await verifyState(state, 'gh-oauth', env.jwtSecret))
    ) {
      return respond(errorResponse(400, 'Invalid OAuth state or missing authorization code'));
    }
    if (!env.githubClientId || !env.githubClientSecret) {
      return respond(errorResponse(501, 'GitHub OAuth is not configured on this server'));
    }
    const accessToken = await exchangeCodeForToken(code, env.githubClientId, env.githubClientSecret);
    if (!accessToken) {
      return respond(errorResponse(502, 'Failed to exchange code with GitHub'));
    }
    const profile = await fetchGitHubProfile(accessToken);
    if (!profile) {
      return respond(errorResponse(502, 'Failed to read GitHub profile'));
    }
    const user: AuthUser = { id: String(profile.id), login: profile.login, avatarUrl: profile.avatarUrl };
    await upsertUser(db, user);
    const token = await signJwt(user, env.jwtSecret);
    return respond(redirectResponse(`${originOf(request, env)}/auth-done#token=${encodeURIComponent(token)}`));
  }

  if (path === '/api/auth/me') {
    const user = await authenticate(request, env);
    if (!user) return errorResponse(401, 'Not authenticated');
    return jsonResponse({ id: user.id, login: user.login, avatarUrl: user.avatarUrl });
  }

  return errorResponse(404, 'Not found');
}

async function handleTasks(
  request: Request,
  url: URL,
  db: DbAdapter,
  user: AuthUser
): Promise<Response | null> {
  const path = url.pathname;

  if (path === '/api/tasks') {
    if (request.method === 'GET') {
      const rows = (await db.all(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY order_index ASC, created_at DESC',
        [user.id]
      )) as unknown as DbTaskRow[];
      return jsonResponse(rows.map(mapTask));
    }
    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      if (!body) return errorResponse(400, 'Invalid JSON body');
      const title = str(body.title).trim();
      if (!title || title.length > 500) return errorResponse(400, 'Title is required (max 500 characters)');
      const description = str(body.description);
      if (description.length > 2000) return errorResponse(400, 'Description is too long (max 2000 characters)');
      const status = body.status === undefined ? 'todo' : str(body.status);
      if (!TASK_STATUSES.has(status as TaskStatus)) return errorResponse(400, 'Invalid task status');
      const id = body.id !== undefined ? str(body.id) : `task_${cryptoId()}`;
      if (!validId(id)) return errorResponse(400, 'Invalid id');
      const orderIndex = body.orderIndex === undefined ? 0 : Math.trunc(num(body.orderIndex));
      const now = nowIso();
      await db.run(
        `INSERT INTO tasks (id, user_id, title, description, status, order_index, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           status = excluded.status,
           order_index = excluded.order_index,
           updated_at = excluded.updated_at`,
        [id, user.id, title, description, status, orderIndex, now, now]
      );
      return jsonResponse({
        id,
        title,
        description,
        status,
        orderIndex,
        isCompleted: status === 'done',
        createdAt: now,
      }, 201);
    }
    return null;
  }

  const match = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (!validId(id)) return errorResponse(400, 'Invalid id');
    if (request.method === 'DELETE') {
      await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, user.id]);
      return jsonResponse({ success: true });
    }
    if (request.method === 'PUT') {
      const body = await readJsonBody(request);
      if (!body) return errorResponse(400, 'Invalid JSON body');
      const updates: string[] = [];
      const params: SqlValue[] = [];
      if (body.title !== undefined) {
        const title = str(body.title).trim();
        if (!title || title.length > 500) return errorResponse(400, 'Title is required (max 500 characters)');
        updates.push('title = ?');
        params.push(title);
      }
      if (body.description !== undefined) {
        const description = str(body.description);
        if (description.length > 2000) return errorResponse(400, 'Description is too long (max 2000 characters)');
        updates.push('description = ?');
        params.push(description);
      }
      if (body.status !== undefined) {
        const status = str(body.status);
        if (!TASK_STATUSES.has(status as TaskStatus)) return errorResponse(400, 'Invalid task status');
        updates.push('status = ?');
        params.push(status);
      } else if (body.isCompleted !== undefined) {
        updates.push('status = ?');
        params.push(body.isCompleted ? 'done' : 'todo');
      }
      if (body.orderIndex !== undefined) {
        updates.push('order_index = ?');
        params.push(Math.trunc(num(body.orderIndex)));
      }
      if (updates.length === 0) return jsonResponse({ success: true });
      updates.push('updated_at = ?');
      params.push(nowIso(), id, user.id);
      await db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
      return jsonResponse({ success: true });
    }
  }

  return null;
}

async function handleSessions(
  request: Request,
  url: URL,
  db: DbAdapter,
  user: AuthUser
): Promise<Response | null> {
  const path = url.pathname;

  if (path === '/api/sessions/stats' && request.method === 'GET') {
    const requestedToday = url.searchParams.get('today');
    const today = requestedToday || getLocalDateString();
    if (!validDateOnly(today)) return errorResponse(400, 'today must be a valid YYYY-MM-DD date');

    const { sevenDaysAgo } = getLast7DaysRange(today);
    const heatmapFrom = getLocalDaysAgo(365, today);
    const [totalResult, weeklyTotalResult, dailyResult, streakResult, heatmapResult] = await Promise.all([
      db.first('SELECT SUM(work_time) as total FROM sessions WHERE user_id = ? AND is_completed = 1', [user.id]),
      db.first(
        'SELECT SUM(work_time) as total FROM sessions WHERE user_id = ? AND is_completed = 1 AND local_date >= ?',
        [user.id, sevenDaysAgo]
      ),
      db.all(
        'SELECT local_date as date, SUM(work_time) as work_time FROM sessions WHERE user_id = ? AND is_completed = 1 AND local_date >= ? GROUP BY local_date ORDER BY local_date ASC',
        [user.id, sevenDaysAgo]
      ),
      db.all(
        "SELECT DISTINCT local_date as date FROM sessions WHERE user_id = ? AND is_completed = 1 AND type = 'work' ORDER BY local_date DESC",
        [user.id]
      ),
      db.all(
        'SELECT local_date as date, SUM(work_time) as work_time, COUNT(*) as sessions_count FROM sessions WHERE user_id = ? AND is_completed = 1 AND local_date >= ? GROUP BY local_date ORDER BY local_date ASC',
        [user.id, heatmapFrom]
      ),
    ]);

    const totalWorkTime = num((totalResult as DbStatsRow | null)?.total);
    const weeklyWorkTime = num((weeklyTotalResult as DbStatsRow | null)?.total);
    const streak = calculateStreak((streakResult as unknown as { date: string }[]) || [], today);
    const heatmapData = (heatmapResult as unknown as DbHeatmapRow[]).map((row) => ({
      date: row.date,
      work_time: num(row.work_time),
      sessions_count: num(row.sessions_count),
    }));
    const dailyStats = fillLast7Days((dailyResult as unknown as DbDailyRow[]) || [], today);

    return jsonResponse({
      todayFocus: Math.round((dailyStats[6]?.work_time || 0) / 60),
      weeklyTotal: Math.round(weeklyWorkTime / 60),
      totalDuration: Math.round(totalWorkTime / 60),
      weeklyData: dailyStats.map((day) => Math.round(day.work_time / 60)),
      heatmapData,
      streak,
    });
  }

  if (path === '/api/sessions') {
    if (request.method === 'GET') {
      const rows = (await db.all(
        'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC',
        [user.id]
      )) as unknown as DbSessionRow[];
      return jsonResponse(rows.map(mapSession));
    }
    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      if (!body) return errorResponse(400, 'Invalid JSON body');
      const type = str(body.type, 'work');
      if (!SESSION_TYPES.has(type)) return errorResponse(400, 'Invalid session type');
      const duration = Math.trunc(num(body.duration));
      if (duration < 0 || duration > 24 * 3600) return errorResponse(400, 'Invalid duration');
      const id = body.id !== undefined ? str(body.id) : `session_${cryptoId()}`;
      if (!validId(id)) return errorResponse(400, 'Invalid id');
      const localDate = str(body.localDate);
      const timezone = str(body.timezone).trim();
      if (!validDateOnly(localDate)) return errorResponse(400, 'localDate must be a valid YYYY-MM-DD date');
      if (!timezone || timezone.length > 64) return errorResponse(400, 'timezone is required');
      const now = nowIso();
      const startTime = str(body.startTime, now);
      if (!validDateTime(startTime)) return errorResponse(400, 'startTime must be a valid date-time string');
      const endTime = body.endTime ? str(body.endTime) : null;
      if (endTime && !validDateTime(endTime)) return errorResponse(400, 'endTime must be a valid date-time string');
      const workTime = body.workTime === undefined ? duration : Math.trunc(num(body.workTime));
      if (workTime < 0 || workTime > 24 * 3600 || workTime > duration) {
        return errorResponse(400, 'Invalid workTime');
      }
      const isCompleted = body.isCompleted !== false;
      await db.run(
        `INSERT INTO sessions (id, user_id, type, duration, work_time, start_time, end_time, local_date, timezone, is_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO NOTHING`,
        [id, user.id, type, duration, workTime, startTime, endTime, localDate, timezone, isCompleted ? 1 : 0, now, now]
      );
      return jsonResponse({ id, type, duration, workTime, startTime, endTime, localDate, timezone, isCompleted }, 201);
    }
    return null;
  }

  const match = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (!validId(id)) return errorResponse(400, 'Invalid id');
    if (request.method === 'DELETE') {
      await db.run('DELETE FROM sessions WHERE id = ? AND user_id = ?', [id, user.id]);
      return jsonResponse({ success: true });
    }
    if (request.method === 'PUT') {
      const body = await readJsonBody(request);
      if (!body) return errorResponse(400, 'Invalid JSON body');
      const updates: string[] = [];
      const params: SqlValue[] = [];
      if (body.duration !== undefined) {
        const duration = Math.trunc(num(body.duration));
        if (duration < 0 || duration > 24 * 3600) return errorResponse(400, 'Invalid duration');
        updates.push('duration = ?'); params.push(duration);
      }
      if (body.type !== undefined) {
        if (!SESSION_TYPES.has(str(body.type))) return errorResponse(400, 'Invalid session type');
        updates.push('type = ?'); params.push(str(body.type));
      }
      if (body.startTime !== undefined) {
        if (!validDateTime(body.startTime)) return errorResponse(400, 'Invalid startTime');
        updates.push('start_time = ?'); params.push(str(body.startTime));
      }
      if (body.endTime !== undefined) {
        if (body.endTime && !validDateTime(body.endTime)) return errorResponse(400, 'Invalid endTime');
        updates.push('end_time = ?'); params.push(str(body.endTime) || null);
      }
      if (body.localDate !== undefined) {
        if (!validDateOnly(body.localDate)) return errorResponse(400, 'Invalid localDate');
        updates.push('local_date = ?'); params.push(str(body.localDate));
      }
      if (body.timezone !== undefined) {
        const timezone = str(body.timezone).trim();
        if (!timezone || timezone.length > 64) return errorResponse(400, 'Invalid timezone');
        updates.push('timezone = ?'); params.push(timezone);
      }
      if (body.isCompleted !== undefined) { updates.push('is_completed = ?'); params.push(body.isCompleted ? 1 : 0); }
      if (body.workTime !== undefined) {
        const workTime = Math.trunc(num(body.workTime));
        if (workTime < 0 || workTime > 24 * 3600) return errorResponse(400, 'Invalid workTime');
        updates.push('work_time = ?'); params.push(workTime);
      }
      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(nowIso(), id, user.id);
        await db.run(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
      }
      return jsonResponse({ success: true });
    }
  }

  return null;
}

async function handleCountdowns(
  request: Request,
  url: URL,
  db: DbAdapter,
  user: AuthUser
): Promise<Response | null> {
  const path = url.pathname;

  if (path === '/api/countdowns') {
    if (request.method === 'GET') {
      const rows = (await db.all(
        'SELECT * FROM countdowns WHERE user_id = ? ORDER BY target_date ASC',
        [user.id]
      )) as unknown as DbCountdownRow[];
      return jsonResponse(rows.map(mapCountdown));
    }
    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      if (!body) return errorResponse(400, 'Invalid JSON body');
      const title = str(body.title).trim();
      const targetDate = str(body.targetDate);
      if (!title || title.length > 200) return errorResponse(400, 'Title is required (max 200 characters)');
      if (!targetDate || Number.isNaN(new Date(targetDate).getTime())) {
        return errorResponse(400, 'targetDate must be a valid date-time string');
      }
      const id = body.id !== undefined ? str(body.id) : `cd_${cryptoId()}`;
      if (!validId(id)) return errorResponse(400, 'Invalid id');
      const now = nowIso();
      await db.run(
        `INSERT INTO countdowns (id, user_id, title, target_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET title = excluded.title, target_date = excluded.target_date, updated_at = excluded.updated_at`,
        [id, user.id, title, targetDate, now, now]
      );
      return jsonResponse({ id, title, targetDate, createdAt: now }, 201);
    }
    return null;
  }

  const match = path.match(/^\/api\/countdowns\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (!validId(id)) return errorResponse(400, 'Invalid id');
    if (request.method === 'DELETE') {
      await db.run('DELETE FROM countdowns WHERE id = ? AND user_id = ?', [id, user.id]);
      return jsonResponse({ success: true });
    }
    if (request.method === 'PUT') {
      const body = await readJsonBody(request);
      if (!body) return errorResponse(400, 'Invalid JSON body');
      const updates: string[] = [];
      const params: SqlValue[] = [];
      if (body.title !== undefined) {
        const title = str(body.title).trim();
        if (!title || title.length > 200) return errorResponse(400, 'Title is required (max 200 characters)');
        updates.push('title = ?');
        params.push(title);
      }
      if (body.targetDate !== undefined) {
        const targetDate = str(body.targetDate);
        if (!targetDate || Number.isNaN(new Date(targetDate).getTime())) {
          return errorResponse(400, 'targetDate must be a valid date-time string');
        }
        updates.push('target_date = ?');
        params.push(targetDate);
      }
      if (updates.length === 0) return jsonResponse({ success: true });
      updates.push('updated_at = ?');
      params.push(nowIso(), id, user.id);
      await db.run(`UPDATE countdowns SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
      return jsonResponse({ success: true });
    }
  }

  return null;
}

function cryptoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let out = '';
  for (const byte of bytes) out += byte.toString(36).padStart(2, '0');
  return `${Date.now().toString(36)}${out.slice(0, 9)}`;
}

export async function handleApi(request: Request, env: CoreEnv, db: DbAdapter): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') return preflightResponse();

    if (path === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: nowIso() });
    }

    if (path.startsWith('/api/auth/')) {
      return await handleAuth(request, url, env, db);
    }

    if (path.startsWith('/api/')) {
      const user = await authenticate(request, env);
      if (!user) return errorResponse(401, 'Authentication required');

      const taskResponse = await handleTasks(request, url, db, user);
      if (taskResponse) return taskResponse;

      const sessionResponse = await handleSessions(request, url, db, user);
      if (sessionResponse) return sessionResponse;

      const countdownResponse = await handleCountdowns(request, url, db, user);
      if (countdownResponse) return countdownResponse;

      return errorResponse(404, 'Not found');
    }

    return errorResponse(404, 'Not found');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[OrbitFocus][core] ${message}`);
    return errorResponse(500, 'Internal server error');
  }
}
