import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBrowserTimezone,
  getLocalDateString,
  getRemainingSeconds,
  isTimerComplete,
  pauseTimer,
  startTimer,
  tickTimer,
  type TimerSnapshot,
} from '../client/src/lib/timer';

const initial: TimerSnapshot = {
  duration: 1800,
  remaining: 1800,
  active: false,
  deadline: null,
  startTime: null,
};

test('calculates remaining time from an absolute deadline', () => {
  assert.equal(getRemainingSeconds(10_000, 2_500), 8);
  assert.equal(getRemainingSeconds(10_000, 10_001), 0);
  assert.equal(isTimerComplete(10_000, 10_000), true);
  assert.equal(isTimerComplete(10_000, 9_999), false);
});

test('pausing preserves progress and resuming creates a new deadline', () => {
  const running = startTimer(initial, 1_000);
  const afterFiveSeconds = tickTimer(running, 6_000);
  const paused = pauseTimer(afterFiveSeconds, 6_000);

  assert.equal(paused.active, false);
  assert.equal(paused.deadline, null);
  assert.equal(paused.remaining, 1795);
  assert.equal(paused.startTime, running.startTime);

  const resumed = startTimer(paused, 10_000);
  assert.equal(resumed.active, true);
  assert.equal(resumed.deadline, 10_000 + paused.remaining * 1_000);
  assert.equal(resumed.remaining, paused.remaining);
});

test('a passed deadline completes once without resetting the start time', () => {
  const running = startTimer(initial, 1_000);
  const completed = tickTimer(running, 1_000 + 1_800_000);

  assert.equal(completed.active, false);
  assert.equal(completed.remaining, 0);
  assert.equal(completed.deadline, null);
  assert.equal(completed.startTime, running.startTime);
  assert.deepEqual(tickTimer(completed, 2_000_000), completed);
});

test('uses the browser local calendar date and timezone', () => {
  assert.equal(getLocalDateString(new Date(2026, 8, 25, 23, 30)), '2026-09-25');
  assert.equal(typeof getBrowserTimezone(), 'string');
  assert.ok(getBrowserTimezone().length > 0);
});
