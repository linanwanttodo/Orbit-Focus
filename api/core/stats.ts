// Pure date/streak helpers shared by API handlers.
// All dates are "YYYY-MM-DD" strings in the server/browser local timezone.

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

export interface StreakResult {
  current: number;
  max: number;
  totalDays: number;
}

/**
 * Calculate streak from DESC-sorted "YYYY-MM-DD" date strings.
 * If today has no record, the current streak falls back to yesterday.
 */
export function calculateStreak(dates: { date: string }[]): StreakResult {
  if (dates.length === 0) {
    return { current: 0, max: 0, totalDays: 0 };
  }

  const today = getLocalDateString();
  const dateStrings = dates.map((d) => d.date);

  let current = 0;
  let startIndex = -1;

  const todayIndex = dateStrings.indexOf(today);
  if (todayIndex !== -1) {
    current = 1;
    startIndex = todayIndex;
  } else {
    const yesterday = getLocalDaysAgo(1);
    const yesterdayIndex = dateStrings.indexOf(yesterday);
    if (yesterdayIndex !== -1) {
      current = 1;
      startIndex = yesterdayIndex;
    }
  }

  if (startIndex !== -1) {
    for (let i = startIndex + 1; i < dateStrings.length; i++) {
      if (daysBetweenDates(dateStrings[i - 1], dateStrings[i]) === 1) {
        current++;
      } else {
        break;
      }
    }
  }

  let max = 1;
  let temp = 1;
  for (let i = 1; i < dateStrings.length; i++) {
    if (daysBetweenDates(dateStrings[i - 1], dateStrings[i]) === 1) {
      temp++;
      max = Math.max(max, temp);
    } else {
      temp = 1;
    }
  }

  return { current, max, totalDays: dateStrings.length };
}

export function getLast7DaysRange(): { sevenDaysAgo: string } {
  return { sevenDaysAgo: getLocalDaysAgo(6) };
}

/**
 * Build a 7-day list (oldest -> newest) of per-day seconds, filling missing
 * days with zero.
 */
export function fillLast7Days(daily: { date: string; work_time: number | null }[]): { date: string; work_time: number }[] {
  const map = new Map<string, number>();
  for (const row of daily) {
    map.set(row.date, Number(row.work_time || 0));
  }
  const result: { date: string; work_time: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    result.push({ date: dateStr, work_time: map.get(dateStr) || 0 });
  }
  return result;
}
