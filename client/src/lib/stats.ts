import { HeatmapRow, SessionStatsResponse, StoredSession } from '../types';

// Local statistics computed entirely from browser-stored sessions. The shape
// and rounding rules mirror the server endpoint so the UI does not need to
// care which mode produced the data.

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateString(d);
}

function daysBetweenDates(a: string, b: string): number {
  const dateA = new Date(`${a}T00:00:00.000Z`);
  const dateB = new Date(`${b}T00:00:00.000Z`);
  return Math.round(Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
}

interface DayAggregate {
  workTime: number;
  sessionsCount: number;
  hasWork: boolean;
}

function aggregateByDay(sessions: StoredSession[]): Map<string, DayAggregate> {
  const map = new Map<string, DayAggregate>();
  for (const session of sessions) {
    if (!session.isCompleted) continue;
    const started = new Date(session.startTime);
    if (Number.isNaN(started.getTime())) continue;
    const date = session.localDate || localDateString(started);
    const entry = map.get(date) || { workTime: 0, sessionsCount: 0, hasWork: false };
    entry.workTime += session.workTime || 0;
    entry.sessionsCount += 1;
    if (session.type === 'work') entry.hasWork = true;
    map.set(date, entry);
  }
  return map;
}

function calculateStreak(map: Map<string, DayAggregate>): SessionStatsResponse['streak'] {
  const workDates = Array.from(map.entries())
    .filter(([, v]) => v.hasWork)
    .map(([date]) => date)
    .sort((a, b) => (a < b ? 1 : -1));

  if (workDates.length === 0) {
    return { current: 0, max: 0, totalDays: 0 };
  }

  const today = localDateString(new Date());
  const yesterday = localDaysAgo(1);

  let current = 0;
  if (workDates.includes(today) || workDates.includes(yesterday)) {
    let cursor = workDates.includes(today) ? today : yesterday;
    current = 1;
    for (;;) {
      const d = new Date(cursor + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      const next = localDateString(d);
      if (workDates.includes(next)) {
        current++;
        cursor = next;
      } else {
        break;
      }
    }
  }

  let max = 1;
  let temp = 1;
  for (let i = 1; i < workDates.length; i++) {
    if (daysBetweenDates(workDates[i - 1], workDates[i]) === 1) {
      temp++;
      max = Math.max(max, temp);
    } else {
      temp = 1;
    }
  }

  return { current, max, totalDays: workDates.length };
}

export function calculateLocalStats(sessions: StoredSession[]): SessionStatsResponse {
  const map = aggregateByDay(sessions);

  let totalSeconds = 0;
  let weekSeconds = 0;
  for (const [date, entry] of map) {
    totalSeconds += entry.workTime;
    if (daysBetweenDates(date, localDaysAgo(6)) <= 6 && date >= localDaysAgo(6)) {
      weekSeconds += entry.workTime;
    }
  }

  const weeklyData: number[] = [];
  const heatmapData: HeatmapRow[] = [];
  const heatmapFrom = localDaysAgo(365);
  for (const [date, entry] of map) {
    if (date >= heatmapFrom) {
      heatmapData.push({ date, work_time: entry.workTime, sessions_count: entry.sessionsCount });
    }
  }
  heatmapData.sort((a, b) => (a.date < b.date ? -1 : 1));

  for (let i = 6; i >= 0; i--) {
    const date = localDaysAgo(i);
    weeklyData.push(Math.round((map.get(date)?.workTime || 0) / 60));
  }

  const todayEntry = map.get(localDateString(new Date()));

  return {
    todayFocus: Math.round((todayEntry?.workTime || 0) / 60),
    weeklyTotal: Math.round(weekSeconds / 60),
    totalDuration: Math.round(totalSeconds / 60),
    weeklyData,
    heatmapData,
    streak: calculateStreak(map),
  };
}
