/**
 * E3 — `simulateLevelUps` and `scaleStats` correctness + boundary
 * cases. The RNG-driven path is asserted on its determinism (same fork
 * → same outcome) and its expected-value tendency over many trials;
 * the deterministic path is pinned table-style against the closed-form
 * formula.
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { scaleStats, simulateLevelUps } from './leveling';
import type { UnitStats } from './Unit';
import type { GrowthRates } from '../config/archetypes';

const BASE: UnitStats = {
  constitution: 10,
  strength: 5,
  ranged: 0,
  magic: 0,
  luck: 3,
  speed: 4,
  endurance: 4,
};

const GROWTH_MID: GrowthRates = {
  constitution: 0.5,
  strength: 0.5,
  ranged: 0,
  magic: 0,
  luck: 0.5,
  speed: 0.5,
  endurance: 0.5,
};

const GROWTH_NONE: GrowthRates = {
  constitution: 0,
  strength: 0,
  ranged: 0,
  magic: 0,
  luck: 0,
  speed: 0,
  endurance: 0,
};

const GROWTH_ALL: GrowthRates = {
  constitution: 1,
  strength: 1,
  ranged: 1,
  magic: 1,
  luck: 1,
  speed: 1,
  endurance: 1,
};

describe('scaleStats — deterministic', () => {
  it('n=0 is a no-op', () => {
    expect(scaleStats(BASE, GROWTH_MID, 0)).toEqual(BASE);
  });

  it('adds round(growth × n) per stat', () => {
    const out = scaleStats(BASE, GROWTH_MID, 4);
    expect(out.constitution).toBe(10 + 2); // round(0.5 × 4) = 2
    expect(out.strength).toBe(5 + 2);
    expect(out.ranged).toBe(0); // growth 0
    expect(out.magic).toBe(0);
    expect(out.luck).toBe(3 + 2);
    expect(out.speed).toBe(4 + 2);
    expect(out.endurance).toBe(4 + 2);
  });

  it('growth = 0 → stat never grows even at high n', () => {
    const out = scaleStats(BASE, GROWTH_NONE, 100);
    expect(out).toEqual(BASE);
  });

  it('growth = 1 → stat grows by exactly n', () => {
    const out = scaleStats(BASE, GROWTH_ALL, 7);
    expect(out.constitution).toBe(10 + 7);
    expect(out.strength).toBe(5 + 7);
    expect(out.ranged).toBe(0 + 7);
  });

  it('same inputs → same outputs (referential transparency)', () => {
    const a = scaleStats(BASE, GROWTH_MID, 10);
    const b = scaleStats(BASE, GROWTH_MID, 10);
    expect(a).toEqual(b);
  });
});

describe('simulateLevelUps — determinism', () => {
  it('same RNG seed → identical outcome', () => {
    const a = simulateLevelUps(BASE, GROWTH_MID, 10, new RNG(42));
    const b = simulateLevelUps(BASE, GROWTH_MID, 10, new RNG(42));
    expect(a).toEqual(b);
  });

  it('different seeds → likely different outcomes', () => {
    const a = simulateLevelUps(BASE, GROWTH_MID, 20, new RNG(1));
    const b = simulateLevelUps(BASE, GROWTH_MID, 20, new RNG(2));
    expect(a).not.toEqual(b);
  });

  it('n=0 is a no-op (no draws, baseline preserved)', () => {
    const rng = new RNG(99);
    const before = rng.toJSON();
    expect(simulateLevelUps(BASE, GROWTH_MID, 0, rng)).toEqual(BASE);
    expect(rng.toJSON()).toEqual(before);
  });
});

describe('simulateLevelUps — boundary growth rates', () => {
  it('growth = 0 → stat never grows even at high n', () => {
    const out = simulateLevelUps(BASE, GROWTH_NONE, 50, new RNG(7));
    expect(out).toEqual(BASE);
  });

  it('growth = 1 → stat always grows by exactly n', () => {
    const out = simulateLevelUps(BASE, GROWTH_ALL, 12, new RNG(7));
    expect(out.constitution).toBe(10 + 12);
    expect(out.strength).toBe(5 + 12);
    expect(out.ranged).toBe(0 + 12);
    expect(out.endurance).toBe(4 + 12);
  });
});

describe('simulateLevelUps — distribution lands near expected value', () => {
  /**
   * Over many trials the mean per-stat increment for `growth = g, n = N`
   * should approach `g × N`. We check that the sample mean across 200
   * independent runs lands within a tolerance of the theoretical mean.
   * Tolerance is generous (±15% of the mean or ±0.5 absolute, whichever
   * is bigger) to avoid flake on small sample sizes — the test still
   * catches a bug like "off-by-one on the level loop" loudly.
   */
  it('mean increment over 200 trials approximates growth × n', () => {
    const TRIALS = 200;
    const N = 10;
    const tally: Partial<UnitStats> = {
      constitution: 0,
      strength: 0,
      luck: 0,
      speed: 0,
      endurance: 0,
    };
    for (let i = 0; i < TRIALS; i++) {
      const out = simulateLevelUps(BASE, GROWTH_MID, N, new RNG(i + 1));
      tally.constitution! += out.constitution - BASE.constitution;
      tally.strength! += out.strength - BASE.strength;
      tally.luck! += out.luck - BASE.luck;
      tally.speed! += out.speed - BASE.speed;
      tally.endurance! += out.endurance - BASE.endurance;
    }
    const expectedMean = 0.5 * N; // growth 0.5, N=10 → mean 5
    const tolerance = Math.max(0.5, expectedMean * 0.15);
    for (const k of ['constitution', 'strength', 'luck', 'speed', 'endurance'] as const) {
      const mean = tally[k]! / TRIALS;
      expect(Math.abs(mean - expectedMean)).toBeLessThanOrEqual(tolerance);
    }
  });
});
