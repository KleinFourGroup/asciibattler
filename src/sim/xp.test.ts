/**
 * E4 — XP curve sanity. Pins the quadratic-per-level shape + cap
 * behavior against the config defaults. If `config/leveling.json`
 * changes, these expectations move with it — the test exists to lock
 * the *formula contract* (cap → Infinity, level 1 → baseXp,
 * monotonic), not to enforce the tunable numbers themselves.
 */

import { describe, it, expect } from 'vitest';
import { computeXpAwards, isAtLevelCap, xpToNext } from './xp';
import { LEVELING } from '../config/leveling';

describe('xpToNext', () => {
  it('returns baseXp at level 1 (default exponent 2 → L^2 = 1)', () => {
    expect(xpToNext(1)).toBe(Math.round(LEVELING.baseXp));
  });

  it('scales as baseXp × L^exponent', () => {
    for (let level = 1; level < LEVELING.levelCap; level++) {
      expect(xpToNext(level)).toBe(
        Math.round(LEVELING.baseXp * Math.pow(level, LEVELING.exponent)),
      );
    }
  });

  it('is monotonic non-decreasing for level < cap', () => {
    for (let level = 1; level < LEVELING.levelCap - 1; level++) {
      expect(xpToNext(level + 1)).toBeGreaterThanOrEqual(xpToNext(level));
    }
  });

  it('returns Infinity at and past the cap', () => {
    expect(xpToNext(LEVELING.levelCap)).toBe(Infinity);
    expect(xpToNext(LEVELING.levelCap + 5)).toBe(Infinity);
  });
});

describe('isAtLevelCap', () => {
  it('is false below the cap', () => {
    expect(isAtLevelCap(1)).toBe(false);
    expect(isAtLevelCap(LEVELING.levelCap - 1)).toBe(false);
  });

  it('is true at and past the cap', () => {
    expect(isAtLevelCap(LEVELING.levelCap)).toBe(true);
    expect(isAtLevelCap(LEVELING.levelCap + 1)).toBe(true);
  });
});

describe('computeXpAwards', () => {
  it('returns an empty array when no units are passed', () => {
    expect(computeXpAwards([], new Map())).toEqual([]);
  });

  it('hands out only the flat slice when nobody dealt damage', () => {
    const awards = computeXpAwards([{ id: 1, rosterIndex: 0 }, { id: 2, rosterIndex: 1 }], new Map());
    expect(awards).toHaveLength(2);
    expect(awards[0]!.xpGained).toBe(Math.round(LEVELING.xpFlatPerSurvivor));
    expect(awards[0]!.damageDealt).toBe(0);
  });

  it('stacks flat + per-damage for damage-dealing survivors', () => {
    const damage = new Map<number, number>([[1, 50]]);
    const [award] = computeXpAwards([{ id: 1, rosterIndex: 0 }], damage);
    expect(award!.damageDealt).toBe(50);
    expect(award!.xpGained).toBe(
      Math.round(LEVELING.xpFlatPerSurvivor + LEVELING.xpPerDamage * 50),
    );
  });

  it('iterates units in input order (stable for snapshot determinism)', () => {
    const damage = new Map<number, number>([[2, 10], [1, 30]]);
    const awards = computeXpAwards([{ id: 1, rosterIndex: 0 }, { id: 2, rosterIndex: 1 }, { id: 3, rosterIndex: 2 }], damage);
    expect(awards.map((a) => a.unitId)).toEqual([1, 2, 3]);
    expect(awards[0]!.damageDealt).toBe(30);
    expect(awards[1]!.damageDealt).toBe(10);
    expect(awards[2]!.damageDealt).toBe(0);
  });
});
