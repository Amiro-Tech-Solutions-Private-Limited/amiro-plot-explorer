import assert from 'node:assert/strict';
import test from 'node:test';
import { PANORAMA_DURATION, PANORAMA_SETTLE_SECONDS, PANORAMA_SWEEP_SECONDS, panoramaYaw } from '../src/lib/panorama.ts';

test('the room sweep covers exactly 360 degrees from any initial heading', () => {
  for (const start of [-Math.PI, 0, 1.2, Math.PI * 3]) {
    assert.equal(panoramaYaw(start, 0), start);
    assert.ok(Math.abs(panoramaYaw(start, PANORAMA_DURATION) - start - Math.PI * 2) < 1e-10);
    assert.equal(panoramaYaw(start, PANORAMA_DURATION + 60), panoramaYaw(start, PANORAMA_DURATION));
  }
});

test('arrival and departure hold still and rotation stays slow without reversing', () => {
  assert.equal(panoramaYaw(0, PANORAMA_SETTLE_SECONDS), 0);
  assert.equal(panoramaYaw(0, -1), 0);
  const end = PANORAMA_SETTLE_SECONDS + PANORAMA_SWEEP_SECONDS;
  assert.equal(panoramaYaw(0, end), panoramaYaw(0, PANORAMA_DURATION));
  const step = 0.05;
  for (let t = step; t < PANORAMA_DURATION; t += step) {
    const speed = (panoramaYaw(0, t) - panoramaYaw(0, t - step)) / step;
    assert.ok(speed >= 0 && speed < 14 * Math.PI / 180, `Unsafe sweep speed at ${t}s`);
  }
});
