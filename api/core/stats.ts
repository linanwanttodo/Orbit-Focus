// Pure date and streak helpers. Calendar arithmetic uses UTC midnight for
// date-only strings, so daylight-saving transitions cannot create or remove a
// day. The caller supplies the user's browser-local "today" value.

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOnlyToUtc(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: string, amount: number): string {
  const parsed = dateOnlyToUtc(date);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

export function getLocalDaysAgo(n: number, today = getLocalDateString()): string {
  return addDays(today, -n);
}

export function daysBetweenDates(a: string, b: string): number {
  const difference = dateOnlyToUtc(a).getTime() - dateOnlyToUtc(b).getTime();
  return Math.round(Math.abs(difference) / (1000 * 60 * 60 * 24));
}

export interface StreakResult {
  current: number;
  max: number;
  totalDays: number;
}

/**
 * Calculate streak from date strings. The current streak includes today, or
 * yesterday when the user has not focused yet today.
 */
export function calculateStreak(
  dates: { date: string }[],
  today = getLocalDateString()
): StreakResult {
  const dateStrings = Array.from(new Set(dates.map((entry) => entry.date))).sort((a, b) => b.localeCompare(a));
  if (dateStrings.length === 0) return { current: 0, max: 0, totalDays: 0 };

  let current = 0;
  let startIndex = dateStrings.indexOf(today);
  if (startIndex === -1) startIndex = dateStrings.indexOf(addDays(today, -1));
  if (startIndex !== -1) {
    current = 1;
    for (let i = startIndex + 1; i < dateStrings.length; i++) {
      if (daysBetweenDates(dateStrings[i - 1], dateStrings[i]) !== 1) break;
      current++;
    }
  }

  let max = 1;
  let run = 1;
  for (let i = 1; i < dateStrings.length; i++) {
    if (daysBetweenDates(dateStrings[i - 1], dateStrings[i]) === 1) {
      run++;
      max = Math.max(max, run);
    } else {
      run = 1;
    }
  }

  return { current, max, totalDays: dateStrings.length };
}

export function getLast7DaysRange(today = getLocalDateString()): { sevenDaysAgo: string } {
  return { sevenDaysAgo: getLocalDaysAgo(6, today) };
}

/** Build a seven-day list (oldest -> newest) of per-day seconds. */
export function fillLast7Days(
  daily: { date: string; work_time: number | null }[],
  today = getLocalDateString()
): { date: string; work_time: number }[] {
  const values = new Map<string, number>();
  for (const row of daily) values.set(row.date, Number(row.work_time || 0));

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return { date, work_time: values.get(date) || 0 };
  });
}
