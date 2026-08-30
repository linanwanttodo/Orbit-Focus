import { Request, Response } from 'express';
import { Task } from '../models/task';

function logServerError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[OrbitFocus][${context}] ${message}`);
}

// Get all tasks
export const getTasks = (req: Request, res: Response) => {
  try {
    const tasks = Task.getAll();
    res.status(200).json(tasks);
  } catch (error) {
    logServerError('server.tasks.list', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new task
export const createTask = (req: Request, res: Response) => {
  try {
    const { title, description, isCompleted, orderIndex, id } = req.body;
    const task = Task.create({
      id,
      title,
      description,
      isCompleted: isCompleted || false,
      orderIndex: orderIndex || 0
    });

    res.status(201).json(task);
  } catch (error) {
    logServerError('server.tasks.create', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a task
export const updateTask = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = Task.update(id, updates);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(task);
  } catch (error) {
    logServerError('server.tasks.update', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a task
export const deleteTask = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = Task.delete(id);
    if (!success) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    logServerError('server.tasks.delete', error);
    res.status(500).json({ message: 'Server error' });
  }
};