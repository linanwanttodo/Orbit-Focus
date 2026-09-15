// Cloudflare Workers adapter: converts D1 into the shared DbAdapter used by
// the framework-agnostic API core in ../core.

import { handleApi } from '../core/handler';
import { applyMigrations } from '../core/schema';
import type { CoreEnv, DbAdapter, Row } from '../core/types';

export interface Env {
  orbit_focus_db: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  PUBLIC_ORIGIN?: string;
}

let schemaReady = false;

function d1Adapter(db: D1Database): DbAdapter {
  return {
    async all(sql, params) {
      const { results } = await db.prepare(sql).bind(...(params || [])).all();
      return (results || []) as Row[];
    },
    async first(sql, params) {
      const result = await db.prepare(sql).bind(...(params || [])).first();
      return (result as Row) ?? null;
    },
    async run(sql, params) {
      await db.prepare(sql).bind(...(params || [])).run();
    },
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api')) {
      return env.ASSETS.fetch(request);
    }

    if (!env.orbit_focus_db) {
      return new Response(JSON.stringify({ error: 'D1 database binding "orbit_focus_db" is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = d1Adapter(env.orbit_focus_db);

    try {
      if (!schemaReady) {
        await applyMigrations(db, 'sqlite');
        schemaReady = true;
      }
    } catch (error) {
      console.error('[OrbitFocus][cloudflare] schema init failed:', error);
      return new Response(JSON.stringify({ error: 'Database initialization failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fail closed: without a server-side secret anyone could forge tokens
    // and read other users' data. Local dev supplies it via .dev.vars.
    if (!env.JWT_SECRET) {
      console.error('[OrbitFocus][cloudflare] JWT_SECRET is not set; refusing to serve API');
      return new Response(JSON.stringify({ error: 'Server misconfigured: JWT_SECRET is not set' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const coreEnv: CoreEnv = {
      jwtSecret: env.JWT_SECRET,
      githubClientId: env.GITHUB_CLIENT_ID || '',
      githubClientSecret: env.GITHUB_CLIENT_SECRET || '',
      publicOrigin: env.PUBLIC_ORIGIN,
    };

    return handleApi(request, coreEnv, db);
  },
};
