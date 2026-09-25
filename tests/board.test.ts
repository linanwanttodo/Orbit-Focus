import assert from 'node:assert/strict';
import test from 'node:test';
import { getBoardStats, isOverdue } from '../client/src/lib/board';
import type { Task } from '../client/src/types';

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    text: 'Task',
    completed: false,
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    orderIndex: 0,
    ...overrides,
  };
}

test('calculates board totals, active work, completed work, and overdue tasks', () => {
  const tasks = [
    task({ id: '1', status: 'todo', dueDate: '2026-09-20' }),
    task({ id: '2', status: 'progress', dueDate: '2026-09-25' }),
    task({ id: '3', status: 'review', dueDate: null }),
    task({ id: '4', status: 'done', dueDate: '2026-09-19' }),
  ];

  assert.deepEqual(getBoardStats(tasks, '2026-09-25'), {
    total: 4,
    active: 2,
    done: 1,
    overdue: 1,
  });
  assert.equal(isOverdue(tasks[0], '2026-09-25'), true);
  assert.equal(isOverdue(tasks[1], '2026-09-25'), false);
  assert.equal(isOverdue(tasks[3], '2026-09-25'), false);
});
