/**
 * `simulateLevelUps` and `scaleStats` correctness + boundary
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
  speed: 0.5,
  mobility: 0.5,
};

const GROWTH_NONE: GrowthRates = {
  constitution: 0,
  strength: 0,
  ranged: 0,
  magic: 0,
  luck: 0,
  defense: 0,
  speed: 0,
  mobility: 0,
};

const GROWTH_ALL: GrowthRates = {
  constitution: 1,
  strength: 1,
  ranged: 1,
  magic: 1,
  luck: 1,
  defense: 1,
  speed: 1,
  mobility: 1,
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

describe('power has no growth: it stays at its base (config-derived, balance-proof)', () => {
  it('every archetype config defines a numeric power base and no power growth', () => {
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      expect(typeof cfg.baseStats.power, `${arch} baseStats.power`).toBe('number');
      expect(Object.keys(cfg.growthRates), `${arch} growthRates`).not.toContain('power');
    }
  });

  it('scaleStats and simulateLevelUps keep power at its base for every archetype', () => {
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      for (const n of [0, 1, 5, 25]) {
        expect(scaleStats(cfg.baseStats, cfg.growthRates, n).power, `${arch} scaled @ n=${n}`).toBe(cfg.baseStats.power);
        const rolled = simulateLevelUps(cfg.baseStats, cfg.growthRates, n, new RNG(123 + n));
        expect(rolled.power, `${arch} rolled @ n=${n}`).toBe(cfg.baseStats.power);
      }
    }
  });

  it('a level-up draws eight values, one per growing stat', () => {
    for (const n of [1, 3, 10]) {
      const rng = new RNG(7);
      simulateLevelUps(BASE, GROWTH_MID, n, rng);
      const reference = new RNG(7);
      for (let i = 0; i < 8 * n; i++) reference.next();
      expect(rng.toJSON(), `n=${n}`).toEqual(reference.toJSON());
    }
  });
});

/**
 * The roll before power's growth key came out (2026-11-07), kept as the
 * reference: nine draws a level-up, power's last, against a growth of 0 that
 * never succeeds. Taking the key out should change nothing but where the
 * draws fall in the stream, so the new roll on a stream equals this one on the
 * same stream with a value spliced in where power's draw was.
 */
const OLD_KEYS = [
  'constitution',
  'strength',
  'ranged',
  'magic',
  'luck',
  'defense',
  'speed',
  'mobility',
  'power',
] as const;

function oldSimulateLevelUps(
  base: UnitStats,
  growth: Record<(typeof OLD_KEYS)[number], number>,
  n: number,
  rng: { next(): number },
): UnitStats {
  const out: Record<keyof UnitStats, number> = { ...base };
  for (let level = 0; level < n; level++) {
    for (const key of OLD_KEYS) {
      if (rng.next() < growth[key]) out[key] += 1;
    }
  }
  return out;
}

/** `source`'s values in order with a filler spliced in at position `at` of
 *  every block of nine (at 8: after every eighth source value). The filler is
 *  just under 1, so a draw that reads it never succeeds. */
function spliced(source: RNG, at: number): { next(): number } {
  let i = 0;
  return {
    next(): number {
      const slot = i++ % 9;
      return slot === at ? 0.999999 : source.next();
    },
  };
}

describe('the oracle: the roll without power equals the old roll with power spliced back', () => {
  const LEVELS = [1, 4, 9, 19];
  const SEEDS = Array.from({ length: 20 }, (_, k) => k + 1);

  /** The cases where the new roll and the old roll on the spliced stream
   *  differ, splicing at `at`, or leave their streams in different places. */
  function differing(at: number): string[] {
    const out: string[] = [];
    for (const arch of ALL_ARCHETYPES) {
      const cfg = ARCHETYPE_CONFIG[arch];
      for (const n of LEVELS) {
        for (const seed of SEEDS) {
          const fresh = new RNG(seed);
          const now = simulateLevelUps(cfg.baseStats, cfg.growthRates, n, fresh);
          const source = new RNG(seed);
          const before = oldSimulateLevelUps(cfg.baseStats, { ...cfg.growthRates, power: 0 }, n, spliced(source, at));
          const same =
            JSON.stringify(now) === JSON.stringify(before) &&
            JSON.stringify(fresh.toJSON()) === JSON.stringify(source.toJSON());
          if (!same) out.push(`${arch} n=${n} seed=${seed}`);
        }
      }
    }
    return out;
  }

  it('every archetype at four levels on twenty seeds: identical stats, the stream left in the same place', () => {
    expect(differing(8)).toEqual([]);
  });

  it('its failing control: the splice one place early (where mobility draws) differs', () => {
    expect(differing(7).length).toBeGreaterThan(0);
  });
});

