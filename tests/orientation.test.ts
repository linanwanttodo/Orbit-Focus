import assert from 'node:assert/strict';
import test from 'node:test';
import { getClockRotation, shouldUseDeviceOrientation } from '../client/src/lib/orientation';

test('maps device tilt to a horizontal clock rotation direction', () => {
  assert.equal(getClockRotation(null, null), 0);
  assert.equal(getClockRotation(0, 0), 0);
  assert.equal(getClockRotation(20, 0), 0);
  assert.equal(getClockRotation(60, 0), 90);
  assert.equal(getClockRotation(-60, 0), -90);
});

test('limits orientation controls to touch devices with small viewports', () => {
  assert.equal(shouldUseDeviceOrientation(390, 5), true);
  assert.equal(shouldUseDeviceOrientation(1024, 5), true);
  assert.equal(shouldUseDeviceOrientation(1280, 5), false);
  assert.equal(shouldUseDeviceOrientation(390, 0), false);
});
