"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const database_1 = require("../database");
class Session {
    static create(data) {
        const db = (0, database_1.getDatabase)();
        const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO sessions (id, type, duration, start_time, end_time, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.type, data.duration, data.startTime, data.endTime || null, data.isCompleted ? 1 : 0, now, now);
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
    static findById(id) {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return undefined;
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
    static getAll() {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
        const rows = stmt.all();
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
    static update(id, data) {
        const db = (0, database_1.getDatabase)();
        const now = new Date().toISOString();
        const updates = [];
        const params = [];
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
        if (updates.length === 0)
            return this.findById(id);
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
    static delete(id) {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    // 获取统计数据
    static getStats() {
        const db = (0, database_1.getDatabase)();
        // 获取总会话数和总时长
        const totalStats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(duration) as total_duration
      FROM sessions
      WHERE is_completed = 1
    `).get();
        // 获取最近7天的每日统计
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dailyStats = db.prepare(`
      SELECT
        DATE(start_time) as date,
        SUM(duration) as work_time,
        COUNT(*) as work_sessions
      FROM sessions
      WHERE is_completed = 1 AND start_time >= ?
      GROUP BY DATE(start_time)
      ORDER BY date DESC
    `).all(sevenDaysAgo.toISOString());
        // 获取热力图数据（过去365天）
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);
        const heatmapData = db.prepare(`
      SELECT
        DATE(start_time) as date,
        SUM(duration) as work_time,
        COUNT(*) as sessions_count
      FROM sessions
      WHERE is_completed = 1 AND start_time >= ?
      GROUP BY DATE(start_time)
      ORDER BY date ASC
    `).all(oneYearAgo.toISOString());
        // 计算连续学习天数
        const streakData = db.prepare(`
      SELECT DISTINCT DATE(start_time) as date
      FROM sessions
      WHERE is_completed = 1 AND type = 'work'
      ORDER BY date DESC
    `).all();
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
    // 计算连续天数
    static calculateStreak(streakData) {
        if (streakData.length === 0) {
            return { currentStreak: 0, maxStreak: 0, totalDays: 0 };
        }
        const today = new Date().toISOString().split('T')[0];
        const dates = streakData.map(d => d.date);
        // 计算当前连续天数
        let currentStreak = 0;
        // 如果最近的一天是今天，或者昨天（如果今天还没开始专注，连续天数应该保留到昨天）
        const lastDate = new Date(dates[0]);
        const todayDate = new Date(today);
        const diffWithToday = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffWithToday <= 1) {
            currentStreak = 1;
            for (let i = 1; i < dates.length; i++) {
                const prevDate = new Date(dates[i - 1]);
                const currDate = new Date(dates[i]);
                const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    currentStreak++;
                }
                else {
                    break;
                }
            }
        }
        // 计算最大连续天数
        let maxStreak = 1;
        let tempStreak = 1;
        for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempStreak++;
                maxStreak = Math.max(maxStreak, tempStreak);
            }
            else {
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
exports.Session = Session;
