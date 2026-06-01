export enum TimerMode {
  WORK = 'WORK',
  SHORT_BREAK = 'SHORT_BREAK',
  LONG_BREAK = 'LONG_BREAK',
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface TimerConfig {
  [TimerMode.WORK]: number;
  [TimerMode.SHORT_BREAK]: number;
  [TimerMode.LONG_BREAK]: number;
}

// --- API Response Types ---

/** Raw task row from the database */
export interface DbTaskRow {
  id: string;
  title: string;
  description: string;
  is_completed: number;
  created_at: string;
  updated_at: string;
}

/** Task as returned by the API */
export interface ApiTask {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  createdAt: string;
}

/** Raw session row from the database */
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

/** Session as returned by the API */
export interface ApiSession {
  id: string;
  type: string;
  duration: number;
  workTime: number;
  startTime: string;
  endTime: string | null;
  isCompleted: boolean;
}

/** Streak information */
export interface StreakData {
  current: number;
  max: number;
  totalDays: number;
}

/** Heatmap data row from the API */
export interface HeatmapRow {
  date: string;
  work_time: number;
  sessions_count: number;
}

/** Full stats response from /api/sessions/stats */
export interface SessionStatsResponse {
  todayFocus: number;        // minutes focused today
  weeklyTotal: number;      // minutes focused in the last 7 days
  totalDuration: number;    // minutes focused all-time
  weeklyData: number[];     // minutes per day, last 7 days (oldest → newest)
  heatmapData: HeatmapRow[];// last 365 days of activity
  streak: StreakData;       // current / max / totalDays
}

// --- Heatmap Calendar Types ---

/** Activity level for a single day in the heatmap calendar */
export interface CalendarDay {
  date: string | null;
  activityLevel: number;
  isEmpty: boolean;
  workTime?: number;
}

/** A single week of calendar days */
export type CalendarWeek = CalendarDay[];

/** A month in the heatmap calendar */
export interface CalendarMonth {
  monthIndex: number;
  monthName: string;
  weeks: CalendarWeek[];
}

// --- Locale Types ---

/** Translation parameter values */
export type TranslationParams = Record<string, string | number>;

/** Flat translation dictionary */
export interface TranslationData {
  [key: string]: string | TranslationData;
}
