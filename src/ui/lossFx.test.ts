/**
 * 96.5b2 — the loss fx's PURE parts, pinned headless (the orb's flight and
 * the shake's motion are eyeball-only per TESTING; the thresholds, the
 * sizing and the policy seam are arithmetic). Every expectation derives
 * from the exported constants, never from re-typed numbers, so a retune
 * from a playtest moves the pins with it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHAKE_MAX_FRACTION,
  SHAKE_MAX_PX,
  SHAKE_MIN_FRACTION,
  SHAKE_MIN_PX,
  cycleShakePolicy,
  getShakePolicy,
  orbSizePx,
  setShakePolicy,
  shakeAllowed,
  shakePx,
} from './lossFx';

describe('lossFx — the shake threshold + amplitude (96.5b2)', () => {
  const MAX = 40;

  it('below SHAKE_MIN_FRACTION of the max nothing shakes (a one-point loss on a 40 pool)', () => {
    const below = Math.ceil(SHAKE_MIN_FRACTION * MAX) - 1;
    expect(shakePx(below, MAX)).toBe(0);
    expect(shakePx(0, MAX)).toBe(0);
    expect(shakePx(1, 0)).toBe(0); // an empty pool never divides by zero
  });

  it('at the threshold the amplitude is SHAKE_MIN_PX; at SHAKE_MAX_FRACTION and above it is SHAKE_MAX_PX', () => {
    expect(shakePx(SHAKE_MIN_FRACTION * MAX, MAX)).toBe(SHAKE_MIN_PX);
    expect(shakePx(SHAKE_MAX_FRACTION * MAX, MAX)).toBe(SHAKE_MAX_PX);
    expect(shakePx(MAX, MAX)).toBe(SHAKE_MAX_PX);
  });

  it('between the two it interpolates monotonically', () => {
    const mid = ((SHAKE_MIN_FRACTION + SHAKE_MAX_FRACTION) / 2) * MAX;
    const px = shakePx(mid, MAX);
    expect(px).toBeGreaterThan(SHAKE_MIN_PX);
    expect(px).toBeLessThan(SHAKE_MAX_PX);
    expect(px).toBeCloseTo((SHAKE_MIN_PX + SHAKE_MAX_PX) / 2, 6);
  });
});

describe('lossFx — the orb size', () => {
  it('grows with the loss as a fraction of the max, from a floor, capped at the whole pool', () => {
    const one = orbSizePx(1, 40);
    const four = orbSizePx(4, 40);
    const whole = orbSizePx(40, 40);
    expect(one).toBeGreaterThan(0);
    expect(four).toBeGreaterThan(one);
    expect(whole).toBeGreaterThan(four);
    expect(orbSizePx(80, 40)).toBe(whole); // overkill does not outgrow the pool
    expect(orbSizePx(1, 0)).toBe(orbSizePx(0, 40)); // an empty pool reads as the floor
  });
});

describe('lossFx — the shake policy seam (the user\'s A/B)', () => {
  beforeEach(() => setShakePolicy('player'));

  it('ships as `player`: a loss to YOUR pool shakes, a loss to theirs does not', () => {
    expect(getShakePolicy()).toBe('player');
    expect(shakeAllowed('player')).toBe(true);
    expect(shakeAllowed('enemy')).toBe(false);
  });

  it('`enemy` flips it (a shake marks what you achieved); `both` and `none` are the corners', () => {
    setShakePolicy('enemy');
    expect(shakeAllowed('player')).toBe(false);
    expect(shakeAllowed('enemy')).toBe(true);
    setShakePolicy('both');
    expect(shakeAllowed('player')).toBe(true);
    expect(shakeAllowed('enemy')).toBe(true);
    setShakePolicy('none');
    expect(shakeAllowed('player')).toBe(false);
    expect(shakeAllowed('enemy')).toBe(false);
  });

  it('the dev key cycles player → enemy → both → none → player', () => {
    expect(cycleShakePolicy()).toBe('enemy');
    expect(cycleShakePolicy()).toBe('both');
    expect(cycleShakePolicy()).toBe('none');
    expect(cycleShakePolicy()).toBe('player');
  });
});
