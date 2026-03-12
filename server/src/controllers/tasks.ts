import { Request, Response } from 'express';
import { Task } from '../models/task';

// Get all tasks
export const getTasks = (req: Request, res: Response) => {
  try {
    const tasks = Task.getAll();
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new task
export const createTask = (req: Request, res: Response) => {
  try {
    const { title, description, isCompleted, orderIndex } = req.body;
    const task = Task.create({
      title,
      description,
      isCompleted: isCompleted || false,
      orderIndex: orderIndex || 0
    });

    res.status(201).json(task);
  } catch (error) {
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
    res.status(500).json({ message: 'Server error' });
  }
};