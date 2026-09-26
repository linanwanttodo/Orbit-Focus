import assert from 'node:assert/strict';
import test from 'node:test';
import { getBoardStats, BOARD_COLUMNS } from '../client/src/lib/board';
import type { Task } from '../client/src/types';

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    text: 'Task',
    completed: false,
    description: '',
    status: 'todo',
    orderIndex: 0,
    ...overrides,
  };
}

test('renders the three board columns without a review stage', () => {
  assert.deepEqual(BOARD_COLUMNS, ['todo', 'progress', 'done']);
});

test('calculates board totals, active work and completed work', () => {
  const tasks = [
    task({ id: '1', status: 'todo' }),
    task({ id: '2', status: 'progress' }),
    task({ id: '3', status: 'progress' }),
    task({ id: '4', status: 'done' }),
  ];

  assert.deepEqual(getBoardStats(tasks), {
    total: 4,
    active: 2,
    done: 1,
  });
});
