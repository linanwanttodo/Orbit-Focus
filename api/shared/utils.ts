// Shared utility functions for Cloudflare and Vercel API handlers

// --- Database Row Types ---

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
  total: number | null;
  totalDuration: number | null;
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

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function safeJsonParse(request: Request): Promise<{ data: Record<string, unknown>; error: null } | { data: null; error: Response }> {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    return { data: null, error: jsonResponse({ error: 'Content-Type must be application/json' }, 415) };
  }
  try {
    const text = await request.text();
    if (!text || text.trim() === '') {
      return { data: null, error: jsonResponse({ error: 'Request body is empty' }, 400) };
    }
    const data = JSON.parse(text);
    return { data, error: null };
  } catch {
    return { data: null, error: jsonResponse({ error: 'Invalid JSON in request body' }, 400) };
  }
}

/**
 * Get today's date as YYYY-MM-DD in the server's local timezone.
 * Avoids UTC offset issues that occur with toISOString().split('T')[0].
 */
export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the YYYY-MM-DD string for N days ago in local timezone.
 */
export function getLocalDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getLocalDateString(d);
}

/**
 * Calculate days between two YYYY-MM-DD date strings.
 * Handles the fact that these are local dates, not UTC.
 */
export function daysBetweenDates(a: string, b: string): number {
  const dateA = new Date(a + 'T00:00:00');
  const dateB = new Date(b + 'T00:00:00');
  return Math.floor(Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate streak from date data (DESC-sorted YYYY-MM-DD strings).
 * Dates are compared as local dates, not UTC.
 * Supports yesterday fallback: if today has no record, checks from yesterday.
 */
export function calculateStreak(streakData: { date: string }[]): { currentStreak: number; maxStreak: number; totalDays: number } {
  if (streakData.length === 0) {
    return { currentStreak: 0, maxStreak: 0, totalDays: 0 };
  }

  const today = getLocalDateString();
  const dates = streakData.map(d => d.date);

  // Calculate current streak — try today first, then fallback to yesterday
  let currentStreak = 0;
  let startIndex = -1;

  const todayIndex = dates.indexOf(today);
  if (todayIndex !== -1) {
    currentStreak = 1;
    startIndex = todayIndex;
  } else {
    // Fallback: check yesterday
    const yesterday = getLocalDaysAgo(1);
    const yesterdayIndex = dates.indexOf(yesterday);
    if (yesterdayIndex !== -1) {
      currentStreak = 1;
      startIndex = yesterdayIndex;
    }
  }

  // Extend current streak backwards through consecutive days
  if (startIndex !== -1) {
    for (let i = startIndex + 1; i < dates.length; i++) {
      // dates are DESC, so dates[i-1] is more recent than dates[i]
      if (daysBetweenDates(dates[i - 1], dates[i]) === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate max streak across all dates
  let maxStreak = 1;
  let tempStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetweenDates(dates[i - 1], dates[i]) === 1) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return { currentStreak, maxStreak, totalDays: dates.length };
}

/**
 * Build the last 7 days date range string for date comparisons.
 * Uses local timezone (not UTC) for correct daily boundaries.
 */
export function getLast7DaysRange(): { sevenDaysAgo: string; today: string } {
  return {
    sevenDaysAgo: getLocalDaysAgo(6),
    today: getLocalDateString(),
  };
}
