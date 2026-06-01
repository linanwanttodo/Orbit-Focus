import { getDatabase } from '../database';

/** Get today's date as YYYY-MM-DD in local timezone (not UTC). */
function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Get the YYYY-MM-DD string for N days ago in local timezone. */
function getLocalDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getLocalDateString(d);
}

/** Calculate days between two YYYY-MM-DD date strings as local dates. */
function daysBetweenDates(a: string, b: string): number {
  const dateA = new Date(a + 'T00:00:00');
  const dateB = new Date(b + 'T00:00:00');
  return Math.floor(Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24));
}

export interface SessionData {
  id: string;
  type: 'work' | 'break' | 'longBreak';
  duration: number;
  startTime: string;
  endTime?: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SessionCreateData {
  type: 'work' | 'break' | 'longBreak';
  duration: number;
  startTime: string;
  endTime?: string;
  isCompleted?: boolean;
}

export class Session {
  static create(data: SessionCreateData): SessionData {
    const db = getDatabase();
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO sessions (id, type, duration, start_time, end_time, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.type,
      data.duration,
      data.startTime,
      data.endTime || null,
      data.isCompleted ? 1 : 0,
      now,
      now
    );

    return {
      id,
      type: data.type,
      duration: data.duration,
      startTime: data.startTime,
      endTime: data.endTime,
      isCompleted: data.isCompleted || false,
      createdAt: now,
      updatedAt: now
    };
  }

  static findById(id: string): SessionData | undefined {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return undefined;

    return {
      id: row.id,
      type: row.type,
      duration: row.duration,
      startTime: row.start_time,
      endTime: row.end_time,
      isCompleted: row.is_completed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static getAll(): SessionData[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      duration: row.duration,
      startTime: row.start_time,
      endTime: row.end_time,
      isCompleted: row.is_completed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  static update(id: string, data: Partial<Omit<SessionCreateData, 'type'>>): SessionData | undefined {
    const db = getDatabase();
    const now = new Date().toISOString();

    const updates: string[] = [];
    const params: any[] = [];

    if (data.duration !== undefined) {
      updates.push('duration = ?');
      params.push(data.duration);
    }
    if (data.startTime !== undefined) {
      updates.push('start_time = ?');
      params.push(data.startTime);
    }
    if (data.endTime !== undefined) {
      updates.push('end_time = ?');
      params.push(data.endTime);
    }
    if (data.isCompleted !== undefined) {
      updates.push('is_completed = ?');
      params.push(data.isCompleted ? 1 : 0);
    }

    if (updates.length === 0) return this.findById(id);

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`
      UPDATE sessions
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);

    return this.findById(id);
  }

  static delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // 获取统计数据
  static getStats(): any {
    const db = getDatabase();

    // 获取总会话数和总时长
    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(duration) as total_duration
      FROM sessions
      WHERE is_completed = 1
    `).get() as any;

    // 获取最近7天的每日统计 (use local timezone date boundary)
    const sevenDaysAgoStr = getLocalDaysAgo(6);

    const dailyStats = db.prepare(`
      SELECT
        DATE(start_time) as date,
        SUM(duration) as work_time,
        COUNT(*) as work_sessions
      FROM sessions
      WHERE is_completed = 1 AND DATE(start_time) >= ?
      GROUP BY DATE(start_time)
      ORDER BY date DESC
    `).all(sevenDaysAgoStr) as any[];

    // 获取热力图数据（过去365天）
    const oneYearAgoStr = getLocalDaysAgo(365);

    const heatmapData = db.prepare(`
      SELECT
        DATE(start_time) as date,
        SUM(duration) as work_time,
        COUNT(*) as sessions_count
      FROM sessions
      WHERE is_completed = 1 AND DATE(start_time) >= ?
      GROUP BY DATE(start_time)
      ORDER BY date ASC
    `).all(oneYearAgoStr) as any[];

    // 计算连续学习天数
    const streakData = db.prepare(`
      SELECT DISTINCT DATE(start_time) as date
      FROM sessions
      WHERE is_completed = 1 AND type = 'work'
      ORDER BY date DESC
    `).all() as any[];

    const { currentStreak, maxStreak, totalDays } = this.calculateStreak(streakData);

    return {
      totalSessions: totalStats.total_sessions || 0,
      totalDuration: totalStats.total_duration || 0,
      dailyStats,
      heatmapData,
      streak: {
        current: currentStreak,
        max: maxStreak,
        totalDays
      }
    };
  }

  // 计算连续天数 (dates are DESC-sorted YYYY-MM-DD strings)
  private static calculateStreak(streakData: any[]): { currentStreak: number; maxStreak: number; totalDays: number } {
    if (streakData.length === 0) {
      return { currentStreak: 0, maxStreak: 0, totalDays: 0 };
    }

    const today = getLocalDateString();
    const dates = streakData.map(d => d.date);

    // 计算当前连续天数 — try today first, then fallback to yesterday
    let currentStreak = 0;
    let startIndex = -1;

    const todayIndex = dates.indexOf(today);
    if (todayIndex !== -1) {
      currentStreak = 1;
      startIndex = todayIndex;
    } else {
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
        // dates are DESC: dates[i-1] is more recent than dates[i]
        if (daysBetweenDates(dates[i - 1], dates[i]) === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // 计算最大连续天数
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

    return {
      currentStreak,
      maxStreak,
      totalDays: dates.length
    };
  }
}