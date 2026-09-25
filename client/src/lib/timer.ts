export interface TimerSnapshot {
  duration: number;
  remaining: number;
  active: boolean;
  deadline: number | null;
  startTime: string | null;
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getRemainingSeconds(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function isTimerComplete(deadline: number | null, now = Date.now()): boolean {
  return deadline !== null && now >= deadline;
}

export function startTimer(snapshot: TimerSnapshot, now = Date.now()): TimerSnapshot {
  const remaining = snapshot.remaining > 0 ? snapshot.remaining : snapshot.duration;
  return {
    ...snapshot,
    remaining,
    active: true,
    deadline: now + remaining * 1_000,
    startTime: snapshot.startTime || new Date(now).toISOString(),
  };
}

export function pauseTimer(snapshot: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (!snapshot.active || snapshot.deadline === null) return snapshot;
  return {
    ...snapshot,
    active: false,
    deadline: null,
    remaining: getRemainingSeconds(snapshot.deadline, now),
  };
}

export function tickTimer(snapshot: TimerSnapshot, now = Date.now()): TimerSnapshot {
  if (!snapshot.active || snapshot.deadline === null) return snapshot;
  const remaining = getRemainingSeconds(snapshot.deadline, now);
  if (remaining > 0) return { ...snapshot, remaining };
  return {
    ...snapshot,
    active: false,
    deadline: null,
    remaining: 0,
  };
}
