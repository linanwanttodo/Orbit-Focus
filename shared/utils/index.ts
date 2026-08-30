export interface DbTaskRow {
  id: string;
  title: string;
  description: string;
  is_completed: number;
  created_at: string;
  updated_at: string;
}

export interface DbSessionRow {
  id: string;
  type: string;
  duration: number;
  start_time: string;
  end_time: string | null;
  is_completed: number;
  work_time: number;
  created_at: string;
  updated_at: string;
}

export interface DbStatsRow {
  total?: number;
}

export interface DbDailyRow {
  date: string;
  work_time: number;
}

export interface DbHeatmapRow {
  date: string;
  work_time: number;
  sessions_count: number;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${random}`;
}

export function getNow(): string {
  return new Date().toISOString();
}

export function corsResponse(): Response {
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

export async function safeJsonParse(request: Request): Promise<{ data: unknown; error: Response | null }> {
  try {
    const data = await request.json();
    return { data, error: null };
  } catch {
    return { data: null, error: jsonResponse({ error: 'Invalid JSON body' }, 400) };
  }
}

export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getLocalDateString(d);
}

export function daysBetweenDates(a: string, b: string): number {
  const dateA = new Date(a + 'T00:00:00');
  const dateB = new Date(b + 'T00:00:00');
  return Math.floor(Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
}

export function calculateStreak(dates: { date: string }[]): { current: number; max: number; totalDays: number } {
  if (dates.length === 0) {
    return { current: 0, max: 0, totalDays: 0 };
  }

  const today = getLocalDateString();
  const dateStrings = dates.map(d => d.date);

  let currentStreak = 0;
  let startIndex = -1;

  const todayIndex = dateStrings.indexOf(today);
  if (todayIndex !== -1) {
    currentStreak = 1;
    startIndex = todayIndex;
  } else {
    const yesterday = getLocalDaysAgo(1);
    const yesterdayIndex = dateStrings.indexOf(yesterday);
    if (yesterdayIndex !== -1) {
      currentStreak = 1;
      startIndex = yesterdayIndex;
    }
  }

  if (startIndex !== -1) {
    for (let i = startIndex + 1; i < dateStrings.length; i++) {
      if (daysBetweenDates(dateStrings[i - 1], dateStrings[i]) === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let maxStreak = 1;
  let tempStreak = 1;
  for (let i = 1; i < dateStrings.length; i++) {
    if (daysBetweenDates(dateStrings[i - 1], dateStrings[i]) === 1) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return {
    current: currentStreak,
    max: maxStreak,
    totalDays: dateStrings.length,
  };
}

export interface Last7DaysRange {
  sevenDaysAgo: string;
}

export function getLast7DaysRange(): Last7DaysRange {
  return {
    sevenDaysAgo: getLocalDaysAgo(6),
  };
}

export function toApiError(status: number, message: string): { error: string } {
  return { error: message };
}

export function logApiError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[OrbitFocus][${context}] ${message}`);
}
