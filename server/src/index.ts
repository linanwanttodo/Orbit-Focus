// Local Express entry. It is a thin bridge: Express requests are converted to
// web-standard Request objects and handled by the same framework-agnostic
// API core that the Cloudflare Worker uses. This keeps local development and
// production behavior identical.

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { randomBytes } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { initializeSchema } from '../../api/core/schema';
import { handleApi } from '../../api/core/handler';
import type { CoreEnv } from '../../api/core/types';
import { createDatabase } from './database';

// Load server/.env first (the documented location), then fall back to the
// repository root .env. Without an explicit path dotenv would only read the
// process working directory.
const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(serverRoot, '.env') });
dotenv.config();

/**
 * Resolve the JWT signing secret. There is intentionally no hardcoded
 * fallback: a secret committed to this repository would let anyone forge
 * tokens for any user. In development we generate an ephemeral random
 * secret (sessions reset on restart); in production startup fails closed.
 */
function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }
  console.warn(
    '[OrbitFocus][server] JWT_SECRET is not set; using an ephemeral random secret. ' +
      'Login sessions are invalidated on every restart. Set JWT_SECRET for stable development.'
  );
  return randomBytes(32).toString('hex');
}

const database = await createDatabase();
await initializeSchema(database.adapter);

const coreEnv: CoreEnv = {
  jwtSecret: resolveJwtSecret(),
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  publicOrigin: process.env.PUBLIC_ORIGIN,
};

const app = express();
app.disable('x-powered-by');
// Behind a TLS-terminating reverse proxy, trust the first hop so
// req.protocol (and therefore the Secure flag of OAuth cookies) reflects
// X-Forwarded-Proto. Only deploy this server behind a proxy you control,
// or set the proxy so it always overwrites X-Forwarded-Proto.
app.set('trust proxy', 1);

function buildWebRequest(req: express.Request): Request {
  const host = req.headers.host || `localhost:${process.env.PORT || 3000}`;
  const url = `${req.protocol}://${host}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === 'string' && key !== 'content-length') {
      headers.set(key, value);
    }
  }
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (typeof req.body === 'string' && req.body.length > 0) {
      init.body = req.body;
    }
  }
  return new Request(url, init);
}

// API bridge: /api/* is fully handled by the shared core.
app.use('/api', express.text({ type: '*/*' }));
app.use('/api', async (req, res, next) => {
  try {
    const response = await handleApi(buildWebRequest(req), coreEnv, database.adapter);
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-length') {
        res.setHeader(key, value);
      }
    });
    const body = await response.text();
    res.send(body);
  } catch (error) {
    next(error);
  }
});

// Static files (production build).
const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
app.use(express.static(distDir));

// SPA fallback so routes like /auth-done serve the single page app.
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Client build not found. Run "npm run build:client" first.');
    }
  });
});

const PORT = process.env.PORT || 3000;

// ESM-compatible check: determine if this file is the entry point
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && resolve(__filename) === resolve(process.argv[1]);

if (isMainModule) {
  app.listen(PORT, () => {
    console.warn(`[OrbitFocus][server] listening on port ${PORT}, database: ${database.describe()}`);
  });
}

export default app;

process.on('SIGINT', () => {
  database.close();
  process.exit(0);
});
