import { jsonResponse, generateId, getNow, corsResponse, safeJsonParse, calculateStreak, getLast7DaysRange, DbTaskRow, DbSessionRow, DbStatsRow, DbDailyRow, DbHeatmapRow } from '../shared/utils';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

let dbInitialized = false;

async function initDatabase(db: D1Database): Promise<void> {
  if (dbInitialized) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      duration INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      is_completed INTEGER DEFAULT 0,
      work_time INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  dbInitialized = true;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // CORS preflight
      if (method === 'OPTIONS') {
        return corsResponse();
      }

      // Initialize database (only on first request per isolate)
      await initDatabase(env.DB);

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: getNow() });
      }

      // Tasks API
      if (path === '/api/tasks') {
        if (method === 'GET') {
          try {
            const result = await env.DB.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
            return jsonResponse((result.results || []).map((r: DbTaskRow) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              isCompleted: r.is_completed === 1,
              createdAt: r.created_at,
            })));
          } catch {
            return jsonResponse({ error: 'Failed to fetch tasks' }, 500);
          }
        }
        if (method === 'POST') {
          const { data: body, error } = await safeJsonParse(request);
          if (error) return error;
          try {
            const id = generateId('task');
            const now = getNow();
            const title = String(body.title || '');
            const description = String(body.description || '');
            await env.DB.prepare(
              'INSERT INTO tasks (id, title, description, is_completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(id, title, description, 0, now, now).run();
            return jsonResponse({ id, title, description, isCompleted: false, createdAt: now }, 201);
          } catch {
            return jsonResponse({ error: 'Failed to create task' }, 500);
          }
        }
      }

      const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
      if (taskMatch) {
        const id = taskMatch[1];
        if (method === 'DELETE') {
          try {
            await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
            return jsonResponse({ success: true });
          } catch {
            return jsonResponse({ error: 'Failed to delete task' }, 500);
          }
        }
        if (method === 'PUT') {
          const { data: body, error } = await safeJsonParse(request);
          if (error) return error;
          try {
            await env.DB.prepare(
              'UPDATE tasks SET title = ?, description = ?, is_completed = ?, updated_at = ? WHERE id = ?'
            ).bind(String(body.title || ''), String(body.description || ''), body.isCompleted ? 1 : 0, getNow(), id).run();
            return jsonResponse({ success: true });
          } catch {
            return jsonResponse({ error: 'Failed to update task' }, 500);
          }
        }
      }

      // Sessions API
      if (path === '/api/sessions') {
        if (method === 'GET') {
          try {
            const result = await env.DB.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
            return jsonResponse((result.results || []).map((r: DbSessionRow) => ({
              id: r.id,
              type: r.type,
              duration: r.duration,
              workTime: r.work_time || r.duration,
              startTime: r.start_time,
              endTime: r.end_time,
              isCompleted: r.is_completed === 1,
            })));
          } catch {
            return jsonResponse({ error: 'Failed to fetch sessions' }, 500);
          }
        }
        if (method === 'POST') {
          const { data: body, error } = await safeJsonParse(request);
          if (error) return error;
          try {
            const id = generateId('session');
            const now = getNow();
            await env.DB.prepare(
              'INSERT INTO sessions (id, type, duration, start_time, end_time, is_completed, work_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(id, String(body.type || 'work'), Number(body.duration || 0), String(body.startTime || now), body.endTime ? String(body.endTime) : null, 1, Number(body.workTime || body.duration || 0), now, now).run();
            return jsonResponse({ id, ...body, createdAt: now }, 201);
          } catch {
            return jsonResponse({ error: 'Failed to create session' }, 500);
          }
        }
      }

      // Session stats - must be before generic /api/sessions/:id
      if (path === '/api/sessions/stats') {
        try {
          const { sevenDaysAgo } = getLast7DaysRange();

          // Batch: all-time total + 7-day total + last 7 days daily stats + streak dates + heatmap (5 parallel queries)
          const oneYearAgo = new Date();
          oneYearAgo.setDate(oneYearAgo.getDate() - 365);
          const [totalResult, weeklyTotalResult, dailyResult, streakResult, heatmapResult] = await Promise.all([
            env.DB.prepare(
              'SELECT SUM(work_time) as total FROM sessions WHERE is_completed = 1'
            ).first(),
            env.DB.prepare(
              'SELECT SUM(work_time) as total FROM sessions WHERE is_completed = 1 AND date(start_time) >= ?'
            ).bind(sevenDaysAgo).first(),
            env.DB.prepare(
              'SELECT date(start_time) as date, SUM(work_time) as work_time FROM sessions WHERE is_completed = 1 AND date(start_time) >= ? GROUP BY date(start_time) ORDER BY date ASC'
            ).bind(sevenDaysAgo).all(),
            env.DB.prepare(
              "SELECT DISTINCT date(start_time) as date FROM sessions WHERE is_completed = 1 AND type = 'work' ORDER BY date DESC"
            ).all(),
            env.DB.prepare(
              'SELECT date(start_time) as date, SUM(work_time) as work_time, COUNT(*) as sessions_count FROM sessions WHERE is_completed = 1 AND date(start_time) >= ? GROUP BY date(start_time) ORDER BY date ASC'
            ).bind(oneYearAgo.toISOString()).all(),
          ]);

          const totalWorkTime = Number((totalResult as unknown as DbStatsRow)?.total || 0);
          const weeklyWorkTime = Number((weeklyTotalResult as unknown as DbStatsRow)?.total || 0);
          const streak = calculateStreak((streakResult.results || []) as { date: string }[]);
          const heatmapData = (heatmapResult.results || []).map((r: DbHeatmapRow) => ({
            date: r.date,
            work_time: Number(r.work_time || 0),
            sessions_count: Number(r.sessions_count || 0),
          }));

          // Fill in missing days for last 7 days
          const dailyMap = new Map<string, number>();
          for (const row of (dailyResult.results || []) as DbDailyRow[]) {
            dailyMap.set(row.date, Number(row.work_time || 0));
          }
          const dailyStats: { date: string; work_time: number }[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyStats.push({ date: dateStr, work_time: dailyMap.get(dateStr) || 0 });
          }

          return jsonResponse({
            todayFocus: Math.round((dailyStats[6]?.work_time || 0) / 60),
            weeklyTotal: Math.round(weeklyWorkTime / 60),
            totalDuration: Math.round(totalWorkTime / 60),
            weeklyData: dailyStats.map(d => Math.round(d.work_time / 60)),
            heatmapData,
            streak,
          });
        } catch {
          return jsonResponse({ error: 'Failed to fetch stats' }, 500);
        }
      }

      // Session by ID (PUT/DELETE)
      const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionMatch) {
        const id = sessionMatch[1];
        if (method === 'DELETE') {
          try {
            await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
            return jsonResponse({ success: true });
          } catch {
            return jsonResponse({ error: 'Failed to delete session' }, 500);
          }
        }
        if (method === 'PUT') {
          const { data: body, error } = await safeJsonParse(request);
          if (error) return error;
          try {
            const updates: string[] = [];
            const params: (string | number)[] = [];

            if (body.duration !== undefined) { updates.push('duration = ?'); params.push(Number(body.duration)); }
            if (body.type !== undefined) { updates.push('type = ?'); params.push(String(body.type)); }
            if (body.startTime !== undefined) { updates.push('start_time = ?'); params.push(String(body.startTime)); }
            if (body.endTime !== undefined) { updates.push('end_time = ?'); params.push(String(body.endTime)); }
            if (body.isCompleted !== undefined) { updates.push('is_completed = ?'); params.push(body.isCompleted ? 1 : 0); }
            if (body.workTime !== undefined) { updates.push('work_time = ?'); params.push(Number(body.workTime)); }

            if (updates.length > 0) {
              updates.push('updated_at = ?');
              params.push(getNow());
              params.push(id);
              await env.DB.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
            }
            return jsonResponse({ success: true });
          } catch {
            return jsonResponse({ error: 'Failed to update session' }, 500);
          }
        }
      }

      // For API routes not found
      if (path.startsWith('/api/')) {
        return jsonResponse({ error: 'Not found' }, 404);
      }

      // Serve static assets via ASSETS binding
      return env.ASSETS.fetch(request);
    } catch {
      // Catch-all for unexpected errors
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};
