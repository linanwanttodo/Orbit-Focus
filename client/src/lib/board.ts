import type { Task } from '../types';
import { getLocalDateString } from './timer';

export const BOARD_COLUMNS: Task['status'][] = ['todo', 'progress', 'review', 'done'];

export function isOverdue(task: Task, today = getLocalDateString()): boolean {
  return task.status !== 'done' && Boolean(task.dueDate && task.dueDate < today);
}

export function getBoardStats(tasks: Task[], today = getLocalDateString()) {
  return {
    total: tasks.length,
    active: tasks.filter((task) => task.status === 'progress' || task.status === 'review').length,
    done: tasks.filter((task) => task.status === 'done').length,
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
  };
}
