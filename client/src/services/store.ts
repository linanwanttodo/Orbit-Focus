import { CountdownItem, SessionStatsResponse, StoredSession, Task } from '../types';
import { calculateLocalStats } from '../lib/stats';
import {
  deleteCountdownCloud,
  deleteTaskCloud,
  fetchCountdownsCloud,
  fetchStatsCloud,
  fetchTasksCloud,
  getAuthToken,
  saveSessionCloud,
  upsertCountdownCloud,
  upsertTaskCloud,
} from './apiService';

// Data store with two modes:
// - signed in (GitHub JWT present): all data lives in the cloud, per user
// - anonymous: everything stays in localStorage, nothing is sent to the server
// On first login, existing local data is uploaded once and then cleared.

const TASKS_KEY = 'orbit-focus-tasks';
const SESSIONS_KEY = 'orbit-focus-sessions';
const COUNTDOWN_KEY = 'orbit-focus-countdowns';
const MAX_LOCAL_SESSIONS = 5000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable - ignore for this session.
  }
}

export function isCloudMode(): boolean {
  return Boolean(getAuthToken());
}

// --- Tasks ---

export async function listTasks(): Promise<Task[]> {
  if (!isCloudMode()) {
    return readJson<Task[]>(TASKS_KEY, []);
  }
  const tasks = await fetchTasksCloud();
  return tasks.map((task) => ({ id: task.id, text: task.title, completed: task.isCompleted }));
}

async function saveTaskLocal(task: Task): Promise<Task[]> {
  const tasks = readJson<Task[]>(TASKS_KEY, []);
  const index = tasks.findIndex((t) => t.id === task.id);
  if (index >= 0) {
    tasks[index] = task;
  } else {
    tasks.push(task);
  }
  writeJson(TASKS_KEY, tasks);
  return tasks;
}

async function saveTask(task: Task): Promise<void> {
  if (!isCloudMode()) {
    await saveTaskLocal(task);
    return;
  }
  await upsertTaskCloud({ id: task.id, title: task.text, completed: task.completed });
}

async function deleteTask(id: string): Promise<void> {
  if (!isCloudMode()) {
    const tasks = readJson<Task[]>(TASKS_KEY, []).filter((t) => t.id !== id);
    writeJson(TASKS_KEY, tasks);
    return;
  }
  await deleteTaskCloud(id);
}

/** Persist the difference between two task list snapshots (optimistic UI). */
export async function syncTasks(previous: Task[], next: Task[]): Promise<void> {
  if (!isCloudMode()) {
    writeJson(TASKS_KEY, next);
    return;
  }
  const previousById = new Map(previous.map((task) => [task.id, task]));
  const nextIds = new Set(next.map((task) => task.id));

  for (const task of next) {
    const before = previousById.get(task.id);
    if (before && before.text === task.text && before.completed === task.completed) {
      continue;
    }
    try {
      await saveTask(task);
    } catch (error) {
      console.error('Task cloud save failed:', error);
    }
  }
  for (const task of previous) {
    if (!nextIds.has(task.id)) {
      try {
        await deleteTask(task.id);
      } catch (error) {
        console.error('Task cloud delete failed:', error);
      }
    }
  }
}

// --- Sessions and stats ---

export async function addFocusSession(durationSeconds: number, startedAt: string): Promise<void> {
  const session: StoredSession = {
    id: `sess_${crypto.randomUUID()}`,
    type: 'work',
    duration: durationSeconds,
    workTime: durationSeconds,
    startTime: startedAt,
    endTime: null,
    isCompleted: true,
  };
  if (!isCloudMode()) {
    const sessions = readJson<StoredSession[]>(SESSIONS_KEY, []);
    sessions.push(session);
    writeJson(SESSIONS_KEY, sessions.slice(-MAX_LOCAL_SESSIONS));
    return;
  }
  await saveSessionCloud(session);
}

export async function getStats(): Promise<SessionStatsResponse> {
  if (!isCloudMode()) {
    return calculateLocalStats(readJson<StoredSession[]>(SESSIONS_KEY, []));
  }
  return fetchStatsCloud();
}

// --- Countdowns ---

export async function listCountdowns(): Promise<CountdownItem[]> {
  if (!isCloudMode()) {
    return readJson<CountdownItem[]>(COUNTDOWN_KEY, []);
  }
  return fetchCountdownsCloud();
}

export async function saveCountdown(item: CountdownItem): Promise<void> {
  if (!isCloudMode()) {
    const items = readJson<CountdownItem[]>(COUNTDOWN_KEY, []);
    const index = items.findIndex((c) => c.id === item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    writeJson(COUNTDOWN_KEY, items);
    return;
  }
  await upsertCountdownCloud(item);
}

export async function deleteCountdown(id: string): Promise<void> {
  if (!isCloudMode()) {
    const items = readJson<CountdownItem[]>(COUNTDOWN_KEY, []).filter((c) => c.id !== id);
    writeJson(COUNTDOWN_KEY, items);
    return;
  }
  await deleteCountdownCloud(id);
}

// --- One-time local -> cloud migration on first login ---

export async function migrateLocalDataToCloud(): Promise<void> {
  const tasks = readJson<Task[]>(TASKS_KEY, []);
  const sessions = readJson<StoredSession[]>(SESSIONS_KEY, []);
  const countdowns = readJson<CountdownItem[]>(COUNTDOWN_KEY, []);
  if (tasks.length === 0 && sessions.length === 0 && countdowns.length === 0) {
    return;
  }

  let migrated = true;
  for (const task of tasks) {
    try {
      await upsertTaskCloud({ id: task.id, title: task.text, completed: task.completed });
    } catch (error) {
      console.error('Migration of task failed:', error);
      migrated = false;
    }
  }
  for (const session of sessions) {
    try {
      await saveSessionCloud(session);
    } catch (error) {
      console.error('Migration of session failed:', error);
      migrated = false;
    }
  }
  for (const countdown of countdowns) {
    try {
      await upsertCountdownCloud(countdown);
    } catch (error) {
      console.error('Migration of countdown failed:', error);
      migrated = false;
    }
  }

  if (migrated) {
    try {
      localStorage.removeItem(TASKS_KEY);
      localStorage.removeItem(SESSIONS_KEY);
      localStorage.removeItem(COUNTDOWN_KEY);
    } catch {
      // Ignore storage errors after upload; duplicates are id-stable.
    }
  }
}
