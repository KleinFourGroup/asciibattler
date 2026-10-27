/**
 * The damage trial's draw, through `World.applyDamage` on a seeded stream.
 *
 * Each range arm's landed damage is held, in mean and spread, to what the
 * Kumaraswamy's inverse gives once rounded by chance, derived here by
 * quadrature over the uniform with `a` found the same way. The code solves
 * `a` from the closed-form mean (ln Γ), which this file never calls, so the
 * two meet only in the distribution's definition. The instrument first
 * reads `hit`, whose answer is known, and it must tell a 10 % wrong `a`.
 */

import { describe, it, expect } from 'vitest';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { STATS, type StrikeArm } from '../config/stats';
import { roundByChance, strikeShare } from './strike';
import type { GameEvents } from '../core/events';

/** One attacker, one target that never dies, both stats explicit, and the
 *  World's `combatRng` seeded directly. */
function duel(arm: StrikeArm, defense: number, combatSeed: number) {
  const bus = new EventBus<GameEvents>();
  const world = new World(bus, new RNG(1), 12, 12, undefined, new RNG(combatSeed));
  world.setStrike(arm);
  const mk = (id: number, team: Team, x: number, def: number): Unit => {
    const stats: UnitStats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, defense: def, precision: 0, evasion: 0 };
    return new Unit({
      id,
      team,
      archetype: 'mercenary',
      glyph: 'M',
      stats,
      derived: deriveStats(stats, 1),
      position: { x, y: 0 },
    });
  };
  const attacker = mk(1, 'player', 1, 0);
  const target = mk(2, 'enemy', 3, defense);
  world.placeUnits(attacker, target);
  const missed: number[] = [];
  bus.on('unit:missed', () => missed.push(1));
  return { world, attacker, target, missed };
}

/** `n` strikes of `raw` at hit chance `p`: the damage each landed, 0 for a
 *  miss, and how many missed. */
function strikes(arm: StrikeArm, p: number, raw: number, defense: number, n: number, seed = 136) {
  const { world, attacker, target, missed } = duel(arm, defense, seed);
  const landed: number[] = [];
  for (let i = 0; i < n; i++) {
    target.currentHp = 1_000_000;
    world.applyDamage(attacker.id, target, raw, { crit: false, evadable: true, accuracy: p });
    landed.push(1_000_000 - target.currentHp);
  }
  return { landed, misses: missed.length };
}

const meanOf = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sdOf = (xs: number[]) => {
  const m = meanOf(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};

// The independent derivation: the spec's inverse, a midpoint quadrature, and
// `a` bisected on the quadrature's own mean.
const GRID = 4000;
const inverse = (u: number, a: number, b: number) => (1 - (1 - u) ** (1 / b)) ** (1 / a);
function quadMean(a: number, b: number): number {
  let s = 0;
  for (let i = 0; i < GRID; i++) s += inverse((i + 0.5) / GRID, a, b);
  return s / GRID;
}
function quadA(p: number, b: number): number {
  let lo = 1e-4;
  let hi = 1e4;
  for (let i = 0; i < 70; i++) {
    const mid = Math.sqrt(lo * hi);
    if (quadMean(mid, b) < p) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}
/** The landed damage's mean and spread at damage `d` after defense: a share
 *  `x` of `d` lands `floor` or `floor + 1`, the latter with chance `frac`. */
function expected(a: number, b: number, d: number): { mean: number; sd: number } {
  let m1 = 0;
  let m2 = 0;
  for (let i = 0; i < GRID; i++) {
    const x = inverse((i + 0.5) / GRID, a, b) * d;
    const f = Math.floor(x);
    const frac = x - f;
    m1 += f + frac;
    m2 += f * f + (2 * f + 1) * frac;
  }
  m1 /= GRID;
  m2 /= GRID;
  return { mean: m1, sd: Math.sqrt(m2 - m1 * m1) };
}

/** At 80,000 strikes a cell, four standard errors of the mean are about half
 *  the shift a 10 % wrong `a` makes at `b` 0.25 (0.10 of 8 damage), the
 *  arm it moves least. */
const N = 80_000;
/** Within four standard errors of the mean, and 4 % of the spread. */
function near(sample: number[], want: { mean: number; sd: number }): boolean {
  const se = want.sd / Math.sqrt(sample.length);
  return Math.abs(meanOf(sample) - want.mean) <= 4 * se + 1e-9 && Math.abs(sdOf(sample) - want.sd) <= 0.04 * want.sd;
}

// The damage sizes after defense: 1 (heavy armour's floor), 3 and 8.
const SIZES: [raw: number, defense: number, d: number][] = [
  [4, 6, 1],
  [5, 2, 3],
  [8, 0, 8],
];
const CHANCES = [0.3, 0.6, 0.85];

describe('the instrument, on hit or miss', () => {
  it('reads the known answer: mean p·D, spread D·√(p(1 − p))', () => {
    for (const p of CHANCES) {
      for (const [raw, def, d] of SIZES) {
        const { landed } = strikes('hit', p, raw, def, N);
        expect(near(landed, { mean: p * d, sd: d * Math.sqrt(p * (1 - p)) }), `p ${p}, D ${d}`).toBe(true);
      }
    }
  });
});

describe('the range arms through applyDamage', () => {
  for (const arm of ['range-0.25', 'range-1'] as const) {
    const { b } = STATS.strikeArms[arm];
    it(`${arm}: the landed damage's mean is p·D and its spread the inverse's, rounded by chance`, () => {
      for (const p of CHANCES) {
        const a = quadA(p, b);
        for (const [raw, def, d] of SIZES) {
          const want = expected(a, b, d);
          // The derivation's own check: rounding by chance keeps the mean.
          expect(want.mean).toBeCloseTo(p * d, 3);
          const { landed } = strikes(arm, p, raw, def, N);
          expect(near(landed, want), `p ${p}, D ${d}: mean ${meanOf(landed)}, sd ${sdOf(landed)}`).toBe(true);
        }
      }
    });

    it(`${arm}: the pin tells a 10 % wrong a`, () => {
      const p = 0.6;
      const [raw, def, d] = SIZES[2]!;
      const { landed } = strikes(arm, p, raw, def, N);
      const a = quadA(p, b);
      expect(near(landed, expected(a, b, d))).toBe(true);
      expect(near(landed, expected(a * 1.1, b, d))).toBe(false);
      expect(near(landed, expected(a / 1.1, b, d))).toBe(false);
    });
  }

  it('a strike that rounds to 0 misses: at 1 damage after defense, 1 − p of strikes', () => {
    for (const arm of ['range-0.25', 'range-1'] as const) {
      const p = 0.75;
      const { landed, misses } = strikes(arm, p, 4, 6, N);
      expect(misses).toBe(landed.filter((x) => x === 0).length);
      // By chance, a share x of 1 lands 1 with chance x, so the misses are
      // 1 − p of strikes: hit or miss's, at this size.
      expect(Math.abs(misses / N - (1 - p))).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / N));
    }
  });

  it('a range strike draws twice from combatRng, the strike and its rounding; hit draws once', () => {
    for (const [arm, draws] of [
      ['hit', 1],
      ['range-1', 2],
    ] as const) {
      const { world, attacker, target } = duel(arm, 0, 77);
      world.applyDamage(attacker.id, target, 8, { crit: false, evadable: true, accuracy: 0.6 });
      const twin = new RNG(77);
      for (let i = 0; i < draws; i++) twin.next();
      expect(world.toJSON().combatRng).toEqual(twin.toJSON());
    }
  });
});

describe('the mixture through applyDamage', () => {
  const { b, missesKept } = STATS.strikeArms.mix;
  /** Whole misses on `m = s·(1 − p)` of strikes, and the range at the mean
   *  `p / (1 − m)` on the rest: the landed damage's mean and spread, and
   *  the share of strikes that miss, rounded zeros included. */
  function expectedMix(p: number, d: number, s = missesKept, aScale = 1) {
    const m = s * (1 - p);
    const a = quadA(p / (1 - m), b) * aScale;
    const r = expected(a, b, d);
    const m1 = (1 - m) * r.mean;
    const m2 = (1 - m) * (r.sd ** 2 + r.mean ** 2);
    let zeros = 0;
    for (let i = 0; i < GRID; i++) zeros += Math.max(0, 1 - inverse((i + 0.5) / GRID, a, b) * d);
    return { mean: m1, sd: Math.sqrt(m2 - m1 * m1), misses: m + (1 - m) * (zeros / GRID) };
  }
  const missesNear = (misses: number, want: number) =>
    Math.abs(misses / N - want) <= 4 * Math.sqrt((want * (1 - want)) / N);

  it("mix: the landed damage's mean is p·D, its spread the mixture's, and its misses m and the zeros", () => {
    for (const p of CHANCES) {
      for (const [raw, def, d] of SIZES) {
        const want = expectedMix(p, d);
        expect(want.mean).toBeCloseTo(p * d, 3);
        const { landed, misses } = strikes('mix', p, raw, def, N);
        const where = `p ${p}, D ${d}: mean ${meanOf(landed)}, sd ${sdOf(landed)}, misses ${misses / N}`;
        expect(near(landed, want), where).toBe(true);
        expect(missesNear(misses, want.misses), where).toBe(true);
      }
    }
  });

  it("mix: the spec's numbers at p 0.75 and 6 damage, 12.5 % whole misses", () => {
    const { misses } = strikes('mix', 0.75, 6, 0, N);
    expect(missesNear(misses, expectedMix(0.75, 6).misses)).toBe(true);
    expect(Math.abs(misses / N - 0.125)).toBeLessThan(0.006);
  });

  it('mix: the pin tells a 10 % wrong a, and 0.4 of the misses kept for 0.5', () => {
    const p = 0.6;
    const [raw, def, d] = SIZES[2]!;
    const { landed, misses } = strikes('mix', p, raw, def, N);
    expect(near(landed, expectedMix(p, d))).toBe(true);
    expect(near(landed, expectedMix(p, d, missesKept, 1.1))).toBe(false);
    expect(missesNear(misses, expectedMix(p, d).misses)).toBe(true);
    expect(missesNear(misses, expectedMix(p, d, 0.4).misses)).toBe(false);
  });

  it('a whole miss draws once, since nothing is rounded', () => {
    const m = missesKept * (1 - 0.6);
    let seed = 1;
    while (new RNG(seed).next() >= m) seed++;
    const { world, attacker, target, missed } = duel('mix', 0, seed);
    world.applyDamage(attacker.id, target, 8, { crit: false, evadable: true, accuracy: 0.6 });
    expect(missed).toHaveLength(1);
    const twin = new RNG(seed);
    twin.next();
    expect(world.toJSON().combatRng).toEqual(twin.toJSON());
  });
});

describe('what rides a range strike: damage, and never a 0', () => {
  it('dealHit fires on every strike that deals damage and on no other; a 0 fires dealMiss and evade', () => {
    for (const arm of ['range-0.25', 'range-1', 'mix'] as const) {
      // 4 against defense 6 leaves 1, where zeros are common.
      const { world, attacker, target } = duel(arm, 6, 136);
      const hits: number[] = [];
      let dealMisses = 0;
      let evades = 0;
      world.registerTrigger('dealHit', ({ damage }) => hits.push(damage));
      world.registerTrigger('dealMiss', () => dealMisses++);
      world.registerTrigger('evade', () => evades++);
      const landed: number[] = [];
      for (let i = 0; i < 4000; i++) {
        target.currentHp = 1_000_000;
        world.applyDamage(attacker.id, target, 4, { crit: false, evadable: true, accuracy: 0.6 });
        landed.push(1_000_000 - target.currentHp);
      }
      const zeros = landed.filter((x) => x === 0).length;
      expect(hits, arm).toEqual(landed.filter((x) => x > 0));
      expect(dealMisses, arm).toBe(zeros);
      expect(evades, arm).toBe(zeros);
      expect(zeros, arm).toBeGreaterThan(0);
      expect(hits.length, arm).toBeGreaterThan(0);
    }
  });

  it('a camp turns on a strike that deals damage, and never on a 0', () => {
    let zeros = 0;
    let damaging = 0;
    for (let seed = 1; seed < 400 && (zeros < 5 || damaging < 5); seed++) {
      const world = new World(new EventBus<GameEvents>(), new RNG(1), 12, 12, undefined, new RNG(seed));
      world.setStrike('range-1');
      world.installCamps(
        [{ id: 1, defId: 'bandit-squatters', anchor: { x: 3, y: 0 }, hostileTo: new Set(), pending: [], killedBy: null }],
        new RNG(31),
      );
      const stats = (def: number): UnitStats => ({ ...ARCHETYPE_CONFIG.mercenary.baseStats, defense: def, precision: 0, evasion: 0 });
      const attacker = new Unit({ id: 1, team: 'player', archetype: 'mercenary', glyph: 'M', stats: stats(0), derived: deriveStats(stats(0), 1), position: { x: 1, y: 0 } });
      const member = new Unit({ id: 2, team: 'neutral', archetype: 'mercenary', glyph: 'M', stats: stats(6), derived: deriveStats(stats(6), 1), position: { x: 3, y: 0 }, campId: 1 });
      world.placeUnits(attacker, member);
      const before = member.currentHp;
      world.applyDamage(attacker.id, member, 4, { crit: false, evadable: true, accuracy: 0.6 });
      const dealt = before - member.currentHp;
      expect(world.campHostileTo(1, 'player'), `seed ${seed}, dealt ${dealt}`).toBe(dealt > 0);
      if (dealt > 0) damaging++;
      else zeros++;
    }
    expect(zeros).toBeGreaterThanOrEqual(5);
    expect(damaging).toBeGreaterThanOrEqual(5);
  });
});

describe('the draw', () => {
  it('lands the whole damage at a hit chance of 1, as hit or miss always hits there', () => {
    for (const u of [0, 0.3, 0.999]) expect(strikeShare(u, 1, 0.25)).toBe(1);
  });

  it("solves a so the share's mean is the hit chance, at the floor and near the cap", () => {
    for (const b of [0.25, 1]) {
      for (const p of [STATS.hitChanceFloor, 0.5, 0.99]) {
        let s = 0;
        for (let i = 0; i < GRID; i++) s += strikeShare((i + 0.5) / GRID, p, b);
        expect(s / GRID, `b ${b}, p ${p}`).toBeCloseTo(p, 3);
      }
    }
  });

  it('rounds by chance: up when the uniform is under the fraction, and a whole number stays', () => {
    expect(roundByChance(2.3, 0.2)).toBe(3);
    expect(roundByChance(2.3, 0.3)).toBe(2);
    expect(roundByChance(2.3, 0.9)).toBe(2);
    expect(roundByChance(4, 0)).toBe(4);
    expect(roundByChance(0, 0)).toBe(0);
  });
});
