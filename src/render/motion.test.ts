import { describe, it, expect, afterEach } from 'vitest';
import {
  MOTION_ATTR,
  MOTION_REDUCED,
  REDUCED_MOTION_QUERY,
  cycleReducedMotionOverride,
  getReducedMotionOverride,
  osPrefersReducedMotion,
  reducedMotion,
  resolveReducedMotion,
  setReducedMotionOverride,
} from './motion';

/**
 * 99a — the motion gate's PURE half. The resolution is a pure function; the
 * module-level override round-trips without a document (the `node` test
 * environment has no `matchMedia`, so the OS half reads `false` here and the
 * root stamp is a no-op — the stamp and the `change` listener are
 * eyeball-verified via Ctrl+Alt+R, the TESTING policy).
 */

afterEach(() => {
  setReducedMotionOverride(null);
});

describe('99a — resolveReducedMotion', () => {
  it('follows the OS when no override is set', () => {
    expect(resolveReducedMotion(null, false)).toBe(false);
    expect(resolveReducedMotion(null, true)).toBe(true);
  });

  it('an override wins over the OS either way', () => {
    expect(resolveReducedMotion(true, false)).toBe(true);
    expect(resolveReducedMotion(false, true)).toBe(false);
    expect(resolveReducedMotion(true, true)).toBe(true);
    expect(resolveReducedMotion(false, false)).toBe(false);
  });
});

describe('99a — the module gate', () => {
  it('reads false with no matchMedia and no override', () => {
    expect(osPrefersReducedMotion()).toBe(false);
    expect(getReducedMotionOverride()).toBeNull();
    expect(reducedMotion()).toBe(false);
  });

  it('setReducedMotionOverride returns the resolved gate and round-trips', () => {
    expect(setReducedMotionOverride(true)).toBe(true);
    expect(reducedMotion()).toBe(true);
    expect(getReducedMotionOverride()).toBe(true);
    expect(setReducedMotionOverride(false)).toBe(false);
    expect(reducedMotion()).toBe(false);
    expect(setReducedMotionOverride(null)).toBe(false);
    expect(getReducedMotionOverride()).toBeNull();
  });

  it('the dev cycle runs OS → reduced → full → OS', () => {
    expect(cycleReducedMotionOverride()).toBe(true);
    expect(reducedMotion()).toBe(true);
    expect(cycleReducedMotionOverride()).toBe(false);
    expect(reducedMotion()).toBe(false);
    expect(cycleReducedMotionOverride()).toBeNull();
    expect(reducedMotion()).toBe(false);
  });

  it('the CSS contract constants are the ones the sheet keys off', () => {
    // 99b's stylesheet pin derives its selector from these — a rename here
    // that forgets the sheet fails there, on the forgetful path.
    expect(MOTION_ATTR).toBe('data-motion');
    expect(MOTION_REDUCED).toBe('reduced');
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
  });
});
