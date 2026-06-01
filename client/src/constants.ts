import { TimerMode, TimerConfig } from './types';

export const DEFAULT_TIMES: TimerConfig = {
  [TimerMode.WORK]: 25 * 60,
  [TimerMode.SHORT_BREAK]: 5 * 60,
  [TimerMode.LONG_BREAK]: 15 * 60,
};

export const MODE_LABELS: Record<TimerMode, string> = {
  [TimerMode.WORK]: 'Focus',
  [TimerMode.SHORT_BREAK]: 'Short Break',
  [TimerMode.LONG_BREAK]: 'Long Break',
};

export const MODE_COLORS: Record<TimerMode, string> = {
  [TimerMode.WORK]: 'text-gh-danger',
  [TimerMode.SHORT_BREAK]: 'text-gh-accent',
  [TimerMode.LONG_BREAK]: 'text-gh-success',
};

export const RING_COLORS: Record<TimerMode, string> = {
  [TimerMode.WORK]: 'stroke-gh-danger',
  [TimerMode.SHORT_BREAK]: 'stroke-gh-accent',
  [TimerMode.LONG_BREAK]: 'stroke-gh-success',
};