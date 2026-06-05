import { describe, it, expect } from 'vitest';
import { fatigueFactor } from './fatigue';

describe('fatigueFactor (H6c)', () => {
  it('ships INERT: the default rate yields 1.0 for any stack count', () => {
    // Config-derived inert proof — `fatigueFactor` (no rate arg) reads the
    // shipped `HEALTH.fatiguePerStack`. These pass iff the default is 0, so
    // this is the canary if H7 ever turns fatigue on.
    for (const stacks of [0, 1, 3, 10, 100]) {
      expect(fatigueFactor(stacks)).toBe(1);
    }
  });

  it('scales linearly with stacks at a positive rate (mechanic, config-free)', () => {
    expect(fatigueFactor(0, 0.1)).toBe(1);
    expect(fatigueFactor(1, 0.1)).toBeCloseTo(0.9);
    expect(fatigueFactor(3, 0.1)).toBeCloseTo(0.7);
  });

  it('is monotone non-increasing in stacks and clamps at 0 (never negative)', () => {
    let prev = Infinity;
    for (let s = 0; s <= 20; s++) {
      const f = fatigueFactor(s, 0.1);
      expect(f).toBeLessThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      prev = f;
    }
    expect(fatigueFactor(100, 0.1)).toBe(0); // 1 − 0.1·100 = −9, clamped to 0
  });
});
