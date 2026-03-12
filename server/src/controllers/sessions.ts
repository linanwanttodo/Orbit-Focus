import { Request, Response } from 'express';
import { Session } from '../models/session';

// Get all sessions
export const getSessions = (req: Request, res: Response) => {
  try {
    const sessions = Session.getAll();
    res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new session
export const createSession = (req: Request, res: Response) => {
  try {
    const { type, duration, startTime, endTime, isCompleted } = req.body;
    const session = Session.create({
      type,
      duration,
      startTime,
      endTime,
      isCompleted: isCompleted || false
    });

    res.status(201).json(session);
  } catch (error) {
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
    res.status(500).json({ message: 'Server error' });
  }
};

// Get session statistics
export const getSessionStats = (req: Request, res: Response) => {
  try {
    const stats = Session.getStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};