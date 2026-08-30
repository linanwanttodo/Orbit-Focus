import { Request, Response } from 'express';
import { Session } from '../models/session';

function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function logServerError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[OrbitFocus][${context}] ${message}`);
}

// Get all sessions
export const getSessions = (req: Request, res: Response) => {
  try {
    const sessions = Session.getAll();
    res.status(200).json(sessions);
  } catch (error) {
    logServerError('server.sessions.list', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new session
export const createSession = (req: Request, res: Response) => {
  try {
    const { type, duration, startTime, endTime, isCompleted, workTime } = req.body;
    const session = Session.create({
      type,
      duration,
      startTime,
      endTime,
      isCompleted: isCompleted || false,
      workTime: workTime || duration,
    });

    res.status(201).json(session);
  } catch (error) {
    logServerError('server.sessions.create', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a session
export const updateSession = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const session = Session.update(id, updates);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.status(200).json(session);
  } catch (error) {
    logServerError('server.sessions.update', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a session
export const deleteSession = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = Session.delete(id);
    if (!success) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.status(200).json({ message: 'Session deleted successfully' });
  } catch (error) {
    logServerError('server.sessions.delete', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get session statistics
export const getSessionStats = (req: Request, res: Response) => {
  try {
    const stats = Session.getStats();

    const dailyMap = new Map<string, number>();
    for (const row of stats.dailyStats) {
      dailyMap.set(row.date, Number(row.work_time || 0));
    }

    const dailyStats: { date: string; work_time: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      dailyStats.push({ date: dateStr, work_time: dailyMap.get(dateStr) || 0 });
    }

    const weeklyWorkTime = dailyStats.reduce((sum, d) => sum + d.work_time, 0);

    res.status(200).json({
      todayFocus: Math.round((dailyStats[6]?.work_time || 0) / 60),
      weeklyTotal: Math.round(weeklyWorkTime / 60),
      totalDuration: Math.round((stats.totalDuration || 0) / 60),
      weeklyData: dailyStats.map(d => Math.round(d.work_time / 60)),
      heatmapData: stats.heatmapData.map((row: { date: string; work_time: number; sessions_count: number }) => ({
        date: row.date,
        work_time: Number(row.work_time || 0),
        sessions_count: Number(row.sessions_count || 0),
      })),
      streak: stats.streak,
    });
  } catch (error) {
    logServerError('server.sessions.stats', error);
    res.status(500).json({ message: 'Server error' });
  }
};