/**
 * K3 commit 3 — the pure redraw-policy rules: which hand positions each policy
 * kind tosses, the budget/pool guards, and the JSON/flag plumbing. Uses
 * explicit literals + hand-built templates (not the shipped balance config)
 * for the mechanic checks, mirroring `objectiveStrategy.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../../src/core/RNG';
import { scaledUnit, ALL_ARCHETYPES, type Archetype } from '../../src/sim/archetypes';
import type { UnitStats, UnitTemplate } from '../../src/sim/Unit';
import type { RedrawAvailability } from '../../src/run/redraw';
import {
  selectRedrawPositions,
  parseRedrawPolicy,
  parseRedrawFlag,
  serializeRedrawPolicy,
  redrawPolicyLabel,
  type RedrawPolicy,
  type ScoredCardWeights,
} from './redrawPolicy';
import { STAT_KEYS } from './strategies/policies';

const BASE = scaledUnit('mercenary', 1).stats;

function card(level: number, archetype: Archetype = 'mercenary', overrides: Partial<UnitStats> = {}): UnitTemplate {
  return { archetype, level, stats: { ...BASE, ...overrides }, xp: 0 };
}

function zeroCardWeights(): {
  level: number;
  stats: Record<keyof UnitStats, number>;
  archetype: Record<Archetype, number>;
} {
  return {
    level: 0,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<keyof UnitStats, number>,
    archetype: Object.fromEntries(ALL_ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>,
  };
}

function scored(weights: ScoredCardWeights, threshold: number): RedrawPolicy {
  return { kind: 'scored', weights, threshold };
}

const FULL: RedrawAvailability = { redrawsRemaining: 1, cardsRemaining: 6 };
const rng = () => new RNG(42);

describe('selectRedrawPositions — guards', () => {
  const hand = [card(1), card(2)];
  const pool = [card(3)];

  it('none never tosses', () => {
    expect(selectRedrawPositions(hand, pool, FULL, { kind: 'none' }, rng())).toEqual([]);
  });

  it('no redraw action left → []', () => {
    const spent: RedrawAvailability = { redrawsRemaining: 0, cardsRemaining: 6 };
    expect(
      selectRedrawPositions(hand, pool, spent, { kind: 'level', cards: 2 }, rng()),
    ).toEqual([]);
  });

  it('no card budget left → []', () => {
    const spent: RedrawAvailability = { redrawsRemaining: 1, cardsRemaining: 0 };
    expect(
      selectRedrawPositions(hand, pool, spent, { kind: 'level', cards: 2 }, rng()),
    ).toEqual([]);
  });

  it('empty pool → [] (the only replacements would be the tossed cards)', () => {
    expect(
      selectRedrawPositions(hand, [], FULL, { kind: 'level', cards: 2 }, rng()),
    ).toEqual([]);
  });
});

describe('selectRedrawPositions — random', () => {
  const hand = [card(1), card(2), card(3), card(4)];
  const pool = [card(5)];

  it('tosses k distinct in-range positions, deterministically per rng seed', () => {
    const a = selectRedrawPositions(hand, pool, FULL, { kind: 'random', cards: 2 }, rng());
    const b = selectRedrawPositions(hand, pool, FULL, { kind: 'random', cards: 2 }, rng());
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(new Set(a).size).toBe(2);
    for (const p of a) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(hand.length);
    }
  });

  it('clamps to the hand / card budget', () => {
    const out = selectRedrawPositions(hand, pool, FULL, { kind: 'random', cards: 99 }, rng());
    expect(out).toHaveLength(4); // hand-size bound (budget 6 > hand 4)
    const tight: RedrawAvailability = { redrawsRemaining: 1, cardsRemaining: 3 };
    expect(
      selectRedrawPositions(hand, pool, tight, { kind: 'random', cards: 99 }, rng()),
    ).toHaveLength(3);
  });

  it('cards: 0 never tosses (the gates-on control shape)', () => {
    expect(selectRedrawPositions(hand, pool, FULL, { kind: 'random', cards: 0 }, rng())).toEqual(
      [],
    );
  });
});

describe('selectRedrawPositions — level', () => {
  const pool = [card(5)];

  it('tosses the k LOWEST-level cards', () => {
    const hand = [card(5), card(1), card(3), card(2)];
    expect(
      selectRedrawPositions(hand, pool, FULL, { kind: 'level', cards: 2 }, rng()),
    ).toEqual([1, 3]); // levels 1 and 2
  });

  it('breaks level ties by ascending hand position', () => {
    const hand = [card(2), card(2), card(2)];
    expect(
      selectRedrawPositions(hand, pool, FULL, { kind: 'level', cards: 2 }, rng()),
    ).toEqual([0, 1]);
  });

  it('clamps to the card budget', () => {
    const hand = [card(1), card(2), card(3)];
    const tight: RedrawAvailability = { redrawsRemaining: 1, cardsRemaining: 1 };
    expect(selectRedrawPositions(hand, pool, tight, { kind: 'level', cards: 3 }, rng())).toEqual([
      0,
    ]);
  });

  it('cards: 0 never tosses (the gates-on control)', () => {
    const hand = [card(1), card(2)];
    expect(selectRedrawPositions(hand, pool, FULL, { kind: 'level', cards: 0 }, rng())).toEqual(
      [],
    );
  });
});

describe('selectRedrawPositions — scored (toss what the pool mean beats by > threshold)', () => {
  it('the level-fisher: one-hot level weight tosses only below-pool-mean cards', () => {
    const w = zeroCardWeights();
    w.level = 1;
    // norm over hand∪pool levels [1,5,3,3]: lvl1→0, lvl5→1, lvl3→0.5.
    // poolMean 0.5 → toss where 0.5 − score > 0 → position 0 only.
    const hand = [card(1), card(5)];
    const pool = [card(3), card(3)];
    expect(selectRedrawPositions(hand, pool, FULL, scored(w, 0), rng())).toEqual([0]);
  });

  it('a high threshold keeps everything', () => {
    const w = zeroCardWeights();
    w.level = 1;
    expect(
      selectRedrawPositions([card(1), card(5)], [card(3)], FULL, scored(w, 5), rng()),
    ).toEqual([]);
  });

  it('a very negative threshold tosses everything (within budget)', () => {
    const w = zeroCardWeights();
    w.level = 1;
    expect(
      selectRedrawPositions([card(1), card(5)], [card(3)], FULL, scored(w, -10), rng()),
    ).toEqual([0, 1]);
  });

  it('the budget clamp keeps the WORST candidates', () => {
    const w = zeroCardWeights();
    w.level = 1;
    const tight: RedrawAvailability = { redrawsRemaining: 1, cardsRemaining: 1 };
    // Both hand cards are below the pool mean at threshold −10; only the
    // lower-scored (position 0, level 1) survives the clamp.
    expect(
      selectRedrawPositions([card(1), card(2)], [card(5)], tight, scored(w, -10), rng()),
    ).toEqual([0]);
  });

  it('archetype affinity tosses the disliked archetype', () => {
    const w = zeroCardWeights();
    w.archetype.healer = -5;
    const hand = [card(3, 'healer'), card(3, 'mercenary')];
    const pool = [card(3, 'mercenary')];
    expect(selectRedrawPositions(hand, pool, FULL, scored(w, 0), rng())).toEqual([0]);
  });

  it('a stat weight reads the card stats (normalized over hand ∪ pool)', () => {
    const w = zeroCardWeights();
    w.stats.strength = 1;
    const hand = [card(3, 'mercenary', { strength: 1 }), card(3, 'mercenary', { strength: 9 })];
    const pool = [card(3, 'mercenary', { strength: 5 })];
    expect(selectRedrawPositions(hand, pool, FULL, scored(w, 0), rng())).toEqual([0]);
  });

  it('consumes no RNG (only `random` draws)', () => {
    const w = zeroCardWeights();
    w.level = 1;
    const used = new RNG(7);
    selectRedrawPositions([card(1), card(5)], [card(3)], FULL, scored(w, 0), used);
    expect(used.next()).toBe(new RNG(7).next());
  });
});

describe('redraw policy JSON + flag parsing', () => {
  it('round-trips every kind through serialize → parse', () => {
    const policies: RedrawPolicy[] = [
      { kind: 'none' },
      { kind: 'random', cards: 2 },
      { kind: 'level', cards: 0 },
      scored(zeroCardWeights(), 0.25),
    ];
    for (const p of policies) {
      expect(parseRedrawPolicy(JSON.parse(serializeRedrawPolicy(p)))).toEqual(p);
    }
  });

  it('parses the inline flag forms', () => {
    expect(parseRedrawFlag('none')).toEqual({ kind: 'none' });
    expect(parseRedrawFlag('random:2')).toEqual({ kind: 'random', cards: 2 });
    expect(parseRedrawFlag('level:6')).toEqual({ kind: 'level', cards: 6 });
    expect(parseRedrawFlag('level:0')).toEqual({ kind: 'level', cards: 0 }); // gates-on control
  });

  it('labels match the inline grammar', () => {
    expect(redrawPolicyLabel({ kind: 'none' })).toBe('none');
    expect(redrawPolicyLabel({ kind: 'random', cards: 3 })).toBe('random:3');
    expect(redrawPolicyLabel({ kind: 'level', cards: 6 })).toBe('level:6');
    expect(redrawPolicyLabel(scored(zeroCardWeights(), 0))).toBe('scored');
  });

  it('rejects malformed policies (zod) and garbage flags', () => {
    expect(() => parseRedrawPolicy({ kind: 'random', cards: -1 })).toThrow();
    expect(() => parseRedrawPolicy({ kind: 'level', cards: 1.5 })).toThrow();
    expect(() => parseRedrawPolicy({ kind: 'scored', weights: zeroCardWeights() })).toThrow(); // no threshold
    expect(() =>
      parseRedrawPolicy({ kind: 'scored', weights: { ...zeroCardWeights(), extra: 1 }, threshold: 0 }),
    ).toThrow();
    expect(() => parseRedrawFlag('biggest-hand')).toThrow();
    expect(() => parseRedrawFlag('level')).toThrow();
  });
});
