import type { Task } from '../types';

export const BOARD_COLUMNS: Task['status'][] = ['todo', 'progress', 'done'];

export function getBoardStats(tasks: Task[]) {
  return {
    total: tasks.length,
    active: tasks.filter((task) => task.status === 'progress').length,
    done: tasks.filter((task) => task.status === 'done').length,
  };
}
