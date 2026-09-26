// Shared types for the framework-agnostic API core.

export interface CoreEnv {
  /** Secret used to sign application JWTs (HS256). */
  jwtSecret: string;
  /** GitHub OAuth App client id. */
  githubClientId: string;
  /** GitHub OAuth App client secret. */
  githubClientSecret: string;
  /**
   * Optional public origin used to build OAuth redirect URIs and post-login
   * redirects, e.g. "http://localhost:5173" during local development behind
   * the Vite proxy. Defaults to the incoming request origin.
   */
  publicOrigin?: string;
}

export type SqlValue = string | number | null;

export type Row = Record<string, unknown>;

/** Minimal async SQL adapter implemented per platform. */
export interface DbAdapter {
  all(sql: string, params?: SqlValue[]): Promise<Row[]>;
  first(sql: string, params?: SqlValue[]): Promise<Row | null>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
}

/** Authenticated user carried inside the application JWT. */
export interface AuthUser {
  id: string;
  login: string;
  avatarUrl: string;
}

export type TaskStatus = 'todo' | 'progress' | 'done';

// --- Row shapes returned by the database ---

export interface DbTaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DbSessionRow {
  id: string;
  user_id: string;
  type: string;
  duration: number;
  start_time: string;
  end_time: string | null;
  local_date: string;
  timezone: string;
  is_completed: number;
  work_time: number;
  created_at: string;
  updated_at: string;
}

export interface DbCountdownRow {
  id: string;
  user_id: string;
  title: string;
  target_date: string;
  created_at: string;
  updated_at: string;
}

export interface DbStatsRow {
  total?: number | null;
}

export interface DbDailyRow {
  date: string;
  work_time: number | null;
}

export interface DbHeatmapRow {
  date: string;
  work_time: number | null;
  sessions_count: number | null;
}
