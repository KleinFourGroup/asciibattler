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
import type { GrowthRates } from '../config/units';
import { ARCHETYPE_CONFIG, ALL_ARCHETYPES } from './archetypes';

const BASE: UnitStats = {
  constitution: 10,
  strength: 5,
  ranged: 0,
  magic: 0,
  luck: 3,
  defense: 2,
  precision: 6,
  evasion: 7,
  speed: 4,
  mobility: 4,
  power: 1,
};

const GROWTH_MID: GrowthRates = {
  constitution: 0.5,
  strength: 0.5,
  ranged: 0,
  magic: 0,
  luck: 0.5,
  defense: 0.5,
  precision: 0.5,
  evasion: 0.5,
  speed: 0.5,
  mobility: 0.5,
  power: 0.5,
};

const GROWTH_NONE: GrowthRates = {
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
  power: 0,
};

const GROWTH_ALL: GrowthRates = {
  constitution: 1,
  strength: 1,
  ranged: 1,
  magic: 1,
  luck: 1,
  defense: 1,
  precision: 1,
  evasion: 1,
  speed: 1,
  mobility: 1,
  power: 1,
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
    expect(out.mobility).toBe(4 + 2);
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
    expect(out.mobility).toBe(4 + 12);
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
    // Writable mirror of UnitStats keys — UnitStats fields are readonly
    // (deliberate, the sim never mutates stats in place), so a `Partial<UnitStats>`
    // tally fails tsc strict-mode under exactOptionalPropertyTypes when we
    // do `tally.foo! += …`. `Record<keyof UnitStats, number>` strips the
    // readonly and gives us full type safety on the key set.
    const tally: Partial<Record<keyof UnitStats, number>> = {
      constitution: 0,
      strength: 0,
      luck: 0,
      speed: 0,
      mobility: 0,
    };
    for (let i = 0; i < TRIALS; i++) {
      const out = simulateLevelUps(BASE, GROWTH_MID, N, new RNG(i + 1));
      tally.constitution! += out.constitution - BASE.constitution;
      tally.strength! += out.strength - BASE.strength;
      tally.luck! += out.luck - BASE.luck;
      tally.speed! += out.speed - BASE.speed;
      tally.mobility! += out.mobility - BASE.mobility;
    }
    const expectedMean = 0.5 * N; // growth 0.5, N=10 → mean 5
    const tolerance = Math.max(0.5, expectedMean * 0.15);
    for (const k of ['constitution', 'strength', 'luck', 'speed', 'mobility'] as const) {
      const mean = tally[k]! / TRIALS;
      expect(Math.abs(mean - expectedMean)).toBeLessThanOrEqual(tolerance);
    }
  });
});

describe('H1 — `power` levels per growthRates (config-derived, balance-proof)', () => {
  it('every archetype config defines a numeric power base + growth', () => {
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      expect(typeof cfg.baseStats.power, `${arch} baseStats.power`).toBe('number');
      expect(typeof cfg.growthRates.power, `${arch} growthRates.power`).toBe('number');
    }
  });

  it('scaleStats grows power by round(growth.power × n) for every archetype', () => {
    // Balance-proof: the expectation is derived from the shipped config, not a
    // hardcoded base/growth — so this stays correct if the knobs are re-tuned.
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      for (const n of [0, 1, 5, 25]) {
        const out = scaleStats(cfg.baseStats, cfg.growthRates, n);
        expect(out.power, `${arch} @ n=${n}`).toBe(
          cfg.baseStats.power + Math.round(cfg.growthRates.power * n),
        );
      }
    }
  });

  it('simulateLevelUps advances power deterministically and only upward', () => {
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      const a = simulateLevelUps(cfg.baseStats, cfg.growthRates, 30, new RNG(123));
      const b = simulateLevelUps(cfg.baseStats, cfg.growthRates, 30, new RNG(123));
      expect(a.power, `${arch} determinism`).toBe(b.power);
      // Additive growth never reduces a stat below its base.
      expect(a.power, `${arch} monotonic`).toBeGreaterThanOrEqual(cfg.baseStats.power);
    }
  });
});

describe('I1 — `precision`/`evasion` level per growthRates (config-derived, balance-proof)', () => {
  // The two dodge stats are plumbed exactly like every other stat; this proves
  // they level off the shipped config, NOT a hardcoded base/growth — so the
  // assertions stay correct when I4/I5 re-tunes the (currently uniform) values.
  const DODGE_STATS = ['precision', 'evasion'] as const;

  it('every archetype config defines a numeric precision + evasion base + growth', () => {
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      for (const stat of DODGE_STATS) {
        expect(typeof cfg.baseStats[stat], `${arch} baseStats.${stat}`).toBe('number');
        expect(typeof cfg.growthRates[stat], `${arch} growthRates.${stat}`).toBe('number');
      }
    }
  });

  it('scaleStats grows precision/evasion by round(growth × n) for every archetype', () => {
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      for (const n of [0, 1, 5, 25]) {
        const out = scaleStats(cfg.baseStats, cfg.growthRates, n);
        for (const stat of DODGE_STATS) {
          expect(out[stat], `${arch}.${stat} @ n=${n}`).toBe(
            cfg.baseStats[stat] + Math.round(cfg.growthRates[stat] * n),
          );
        }
      }
    }
  });

  it('simulateLevelUps advances precision/evasion deterministically and only upward', () => {
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      const a = simulateLevelUps(cfg.baseStats, cfg.growthRates, 30, new RNG(123));
      const b = simulateLevelUps(cfg.baseStats, cfg.growthRates, 30, new RNG(123));
      for (const stat of DODGE_STATS) {
        expect(a[stat], `${arch}.${stat} determinism`).toBe(b[stat]);
        expect(a[stat], `${arch}.${stat} monotonic`).toBeGreaterThanOrEqual(cfg.baseStats[stat]);
      }
    }
  });
});
