import {
  CountdownItem,
  SessionStatsResponse,
  StoredSession,
  Task,
  TaskPriority,
  TaskStatus,
} from '../types';
import { calculateLocalStats } from '../lib/stats';
import { getBrowserTimezone, getLocalDateString } from '../lib/timer';
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
// - signed in: cloud data, scoped by the authenticated user
// - anonymous: versioned browser storage only
// Old storage keys are intentionally discarded because this release starts a
// fresh data model and does not migrate visitor data.

const STORAGE_VERSION = 'v2';
const TASKS_KEY = `orbit-focus-${STORAGE_VERSION}-tasks`;
const SESSIONS_KEY = `orbit-focus-${STORAGE_VERSION}-sessions`;
const COUNTDOWN_KEY = `orbit-focus-${STORAGE_VERSION}-countdowns`;
const LEGACY_KEYS = [
  'orbit-focus-tasks',
  'orbit-focus-sessions',
  'orbit-focus-countdowns',
];
const MAX_LOCAL_SESSIONS = 5000;

function clearLegacyStorage(): void {
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing; normal reads still work.
  }
}

clearLegacyStorage();

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
    // Storage full or unavailable - keep the current in-memory UI usable.
  }
}

function normalizeTask(value: Partial<Task>): Task {
  const status: TaskStatus =
    value.status === 'progress' || value.status === 'review' || value.status === 'done' || value.status === 'todo'
      ? value.status
      : value.completed
        ? 'done'
        : 'todo';
  const priority: TaskPriority =
    value.priority === 'high' || value.priority === 'low' || value.priority === 'medium'
      ? value.priority
      : 'medium';
  return {
    id: String(value.id || ''),
    text: String(value.text || ''),
    completed: status === 'done',
    description: String(value.description || ''),
    status,
    priority,
    dueDate: typeof value.dueDate === 'string' && value.dueDate ? value.dueDate : null,
    orderIndex: Number.isFinite(value.orderIndex) ? Number(value.orderIndex) : 0,
  };
}

function readLocalTasks(): Task[] {
  return readJson<Partial<Task>[]>(TASKS_KEY, []).map(normalizeTask).filter((task) => task.id && task.text);
}

export function isCloudMode(): boolean {
  return Boolean(getAuthToken());
}

export interface SyncResult {
  ok: boolean;
  errors: string[];
}

// --- Tasks ---

export async function listTasks(): Promise<Task[]> {
  if (!isCloudMode()) return readLocalTasks();
  const tasks = await fetchTasksCloud();
  return tasks.map((task) => normalizeTask({
    id: task.id,
    text: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    orderIndex: task.orderIndex,
    completed: task.isCompleted,
  }));
}

async function saveTaskLocal(task: Task): Promise<void> {
  const tasks = readLocalTasks();
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) tasks[index] = normalizeTask(task);
  else tasks.push(normalizeTask(task));
  writeJson(TASKS_KEY, tasks);
}

async function saveTask(task: Task): Promise<void> {
  if (!isCloudMode()) {
    await saveTaskLocal(task);
    return;
  }
  await upsertTaskCloud(task);
}

async function deleteTask(id: string): Promise<void> {
  if (!isCloudMode()) {
    writeJson(TASKS_KEY, readLocalTasks().filter((task) => task.id !== id));
    return;
  }
  await deleteTaskCloud(id);
}

function tasksEqual(a: Task, b: Task): boolean {
  return a.text === b.text &&
    a.description === b.description &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.dueDate === b.dueDate &&
    a.orderIndex === b.orderIndex;
}

/** Persist the difference between two task list snapshots (optimistic UI). */
export async function syncTasks(previous: Task[], next: Task[]): Promise<SyncResult> {
  if (!isCloudMode()) {
    writeJson(TASKS_KEY, next.map(normalizeTask));
    return { ok: true, errors: [] };
  }

  const errors: string[] = [];
  const previousById = new Map(previous.map((task) => [task.id, task]));
  const nextIds = new Set(next.map((task) => task.id));

  for (const task of next) {
    const before = previousById.get(task.id);
    if (before && tasksEqual(before, task)) continue;
    try {
      await saveTask(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Task cloud save failed: ${message}`);
    }
  }
  for (const task of previous) {
    if (!nextIds.has(task.id)) {
      try {
        await deleteTask(task.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Task cloud delete failed: ${message}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// --- Sessions and stats ---

export async function addFocusSession(
  durationSeconds: number,
  startedAt: string,
  completedAt = new Date()
): Promise<void> {
  const session: StoredSession = {
    id: `sess_${crypto.randomUUID()}`,
    type: 'work',
    duration: durationSeconds,
    workTime: durationSeconds,
    startTime: startedAt,
    endTime: completedAt.toISOString(),
    localDate: getLocalDateString(completedAt),
    timezone: getBrowserTimezone(),
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
  return fetchStatsCloud(getLocalDateString());
}

// --- Countdowns ---

export async function listCountdowns(): Promise<CountdownItem[]> {
  if (!isCloudMode()) return readJson<CountdownItem[]>(COUNTDOWN_KEY, []);
  return fetchCountdownsCloud();
}

export async function saveCountdown(item: CountdownItem): Promise<void> {
  if (!isCloudMode()) {
    const items = readJson<CountdownItem[]>(COUNTDOWN_KEY, []);
    const index = items.findIndex((countdown) => countdown.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    writeJson(COUNTDOWN_KEY, items);
    return;
  }
  await upsertCountdownCloud(item);
}

export async function deleteCountdown(id: string): Promise<void> {
  if (!isCloudMode()) {
    writeJson(COUNTDOWN_KEY, readJson<CountdownItem[]>(COUNTDOWN_KEY, []).filter((item) => item.id !== id));
    return;
  }
  await deleteCountdownCloud(id);
}

// --- One-time local -> cloud migration on first login ---

export async function migrateLocalDataToCloud(): Promise<void> {
  const tasks = readLocalTasks();
  const sessions = readJson<StoredSession[]>(SESSIONS_KEY, []);
  const countdowns = readJson<CountdownItem[]>(COUNTDOWN_KEY, []);
  if (tasks.length === 0 && sessions.length === 0 && countdowns.length === 0) return;

  let migrated = true;
  for (const task of tasks) {
    try {
      await upsertTaskCloud(task);
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
      // Ignore storage errors after upload; ids are stable for retry.
    }
  }
}
