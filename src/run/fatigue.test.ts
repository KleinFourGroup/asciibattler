import { describe, it, expect } from 'vitest';
import { fatigueEffect, FATIGUE_KEY } from './fatigue';
import { foldEffects } from '../sim/statusEffects';
import type { UnitStats } from '../sim/Unit';

function withPower(power: number): UnitStats {
  return {
    constitution: 0,
    strength: 0,
    ranged: 0,
    magic: 0,
    luck: 0,
    defense: 0,
    precision: 0,
    evasion: 0,
    speed: 0,
    mobility: 0,
    power,
  };
}

describe('fatigueEffect (H6c → K1)', () => {
  it('ships INERT: the default rate seeds NO effect for any stack count', () => {
    // Config-derived inert proof — `fatigueEffect` (no rate arg) reads the
    // shipped HEALTH.fatiguePerStack. Passes iff the default is 0 → null; the
    // canary if a balance pass ever turns fatigue on.
    for (const stacks of [0, 1, 3, 10, 100]) {
      expect(fatigueEffect(stacks)).toBeNull();
    }
  });

  it('seeds no effect at 0 stacks even at a positive rate (a debut unit)', () => {
    expect(fatigueEffect(0, 0.1)).toBeNull();
  });

  it('reduces effective power by (1 − rate·stacks) at a positive rate (the H6c curve)', () => {
    const e = fatigueEffect(2, 0.1)!;
    expect(e.key).toBe(FATIGUE_KEY);
    expect(e.magnitude).toBe(2);
    // Folded onto a base power of 10 → 10 × (1 − 0.1·2) = 8.
    expect(foldEffects(withPower(10), [e]).power).toBe(8);
  });

  it('is monotone non-increasing in stacks and clamps effective power at 0', () => {
    let prev = Infinity;
    for (let s = 1; s <= 20; s++) {
      const e = fatigueEffect(s, 0.1);
      const power = e ? foldEffects(withPower(100), [e]).power : 100;
      expect(power).toBeLessThanOrEqual(prev);
      expect(power).toBeGreaterThanOrEqual(0);
      prev = power;
    }
    // 1 − 0.1·100 = −9 → effective power clamped to 0.
    expect(foldEffects(withPower(100), [fatigueEffect(100, 0.1)!]).power).toBe(0);
  });
});
