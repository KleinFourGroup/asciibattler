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
  it('returns baseXp at level 1 (default exponent → L^exp = 1)', () => {
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
  it('returns an empty array when no units spawned', () => {
    expect(computeXpAwards(new Map(), new Set(), new Map())).toEqual([]);
  });

  it('survivor with no damage → flat survivor slice only', () => {
    const roster = new Map<number, number>([[1, 0]]);
    const living = new Set<number>([1]);
    const [award] = computeXpAwards(roster, living, new Map());
    expect(award!.damageDealt).toBe(0);
    expect(award!.xpGained).toBe(Math.round(LEVELING.xpFlatPerSurvivor));
  });

  it('survivor with damage → flat survivor + per-damage share', () => {
    const roster = new Map<number, number>([[1, 0]]);
    const living = new Set<number>([1]);
    const damage = new Map<number, number>([[1, 50]]);
    const [award] = computeXpAwards(roster, living, damage);
    expect(award!.damageDealt).toBe(50);
    expect(award!.xpGained).toBe(
      Math.round(LEVELING.xpFlatPerSurvivor + LEVELING.xpPerDamage * 50),
    );
  });

  it('fallen with damage → flat fallen + per-damage share (the suicide-DPS path)', () => {
    const roster = new Map<number, number>([[7, 3]]);
    const living = new Set<number>(); // unit 7 died this battle
    const damage = new Map<number, number>([[7, 40]]);
    const [award] = computeXpAwards(roster, living, damage);
    expect(award!.rosterIndex).toBe(3);
    expect(award!.damageDealt).toBe(40);
    expect(award!.xpGained).toBe(
      Math.round(LEVELING.xpFlatPerFallen + LEVELING.xpPerDamage * 40),
    );
  });

  it('fallen with no damage → flat fallen only (0 at default knobs)', () => {
    const roster = new Map<number, number>([[9, 4]]);
    const [award] = computeXpAwards(roster, new Set(), new Map());
    expect(award!.damageDealt).toBe(0);
    expect(award!.xpGained).toBe(Math.round(LEVELING.xpFlatPerFallen));
  });

  it('iterates roster in insertion order (stable for snapshot determinism)', () => {
    const roster = new Map<number, number>([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
    const living = new Set<number>([1, 3]);
    const damage = new Map<number, number>([[2, 10], [1, 30]]);
    const awards = computeXpAwards(roster, living, damage);
    expect(awards.map((a) => a.unitId)).toEqual([1, 2, 3]);
    expect(awards[0]!.damageDealt).toBe(30);
    expect(awards[1]!.damageDealt).toBe(10);
    expect(awards[2]!.damageDealt).toBe(0);
    // Index 1 (unit 2) died → flat-fallen slice; the other two survived.
    expect(awards[1]!.xpGained).toBe(
      Math.round(LEVELING.xpFlatPerFallen + LEVELING.xpPerDamage * 10),
    );
  });
});
