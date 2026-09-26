import { ApiTask, AuthUser, CountdownItem, SessionStatsResponse, StoredSession } from '../types';

// API service - uses relative paths, served from the same origin as the
// backend (Express in local dev via the Vite proxy, Cloudflare Worker in
// production). All requests carry the GitHub login JWT when present.

const API_BASE_URL = '/api';
const TOKEN_KEY = 'orbit-focus-token';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage unavailable (private mode) - session stays anonymous.
  }
}

export function githubLoginUrl(): string {
  return `${API_BASE_URL}/auth/github`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  const text = await response.text().catch(() => '');
  let parsed: { error?: string; message?: string } | null = null;
  try {
    parsed = text ? (JSON.parse(text) as { error?: string; message?: string }) : null;
  } catch {
    // Non-JSON error body - fall through to status-based message.
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      parsed?.message || parsed?.error || `Request failed: ${response.status}`
    );
  }

  return (parsed ?? null) as T;
}

// --- Auth ---

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    return await request<AuthUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 501)) {
      return null;
    }
    throw error;
  }
}

// --- Tasks (cloud) ---

export async function fetchTasksCloud(): Promise<ApiTask[]> {
  const data = await request<ApiTask[]>('/tasks');
  return data || [];
}

export async function upsertTaskCloud(task: {
  id: string;
  text: string;
  description: string;
  status: string;
  orderIndex: number;
}): Promise<void> {
  await request('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      id: task.id,
      title: task.text,
      description: task.description,
      status: task.status,
      orderIndex: task.orderIndex,
    }),
  });
}

export async function deleteTaskCloud(id: string): Promise<void> {
  await request(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// --- Sessions and stats (cloud) ---

export async function saveSessionCloud(session: StoredSession): Promise<void> {
  await request('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      id: session.id,
      type: session.type,
      duration: session.duration,
      workTime: session.workTime,
      startTime: session.startTime,
      endTime: session.endTime,
      localDate: session.localDate,
      timezone: session.timezone,
      isCompleted: session.isCompleted,
    }),
  });
}

export async function fetchStatsCloud(today: string): Promise<SessionStatsResponse> {
  const data = await request<Partial<SessionStatsResponse>>(`/sessions/stats?today=${encodeURIComponent(today)}`);
  return {
    todayFocus: data?.todayFocus ?? 0,
    weeklyTotal: data?.weeklyTotal ?? 0,
    weeklyData: data?.weeklyData ?? [0, 0, 0, 0, 0, 0, 0],
    heatmapData: data?.heatmapData ?? [],
    totalDuration: data?.totalDuration ?? 0,
    streak: data?.streak ?? { current: 0, max: 0, totalDays: 0 },
  };
}

// --- Countdowns (cloud) ---

export async function fetchCountdownsCloud(): Promise<CountdownItem[]> {
  const data = await request<CountdownItem[]>('/countdowns');
  return data || [];
}

export async function upsertCountdownCloud(item: CountdownItem): Promise<void> {
  await request('/countdowns', {
    method: 'POST',
    body: JSON.stringify({ id: item.id, title: item.title, targetDate: item.targetDate }),
  });
}

export async function deleteCountdownCloud(id: string): Promise<void> {
  await request(`/countdowns/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
