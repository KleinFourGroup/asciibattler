import { describe, it, expect } from 'vitest';
import { empowerAvailability, empowerRejection, empowerEffect } from './empower';
import type { EmpowerConfig } from '../config/empower';

/**
 * K4→49d — the pure empower rules against ONE grant queue entry (the §49
 * per-source re-model), exercised in both budget modes. The grants here are
 * deliberately explicit literals, NOT derived from the catalog — the mode
 * contract must hold whatever the shipped knobs say (the Run.test.ts
 * integration block covers the live config).
 */

const BUFF: EmpowerConfig['buff'] = {
  key: 'empowered',
  mods: { strength: { add: 4 }, ranged: { add: 4 }, magic: { add: 4 } },
  merge: 'add',
};

const HAND = 6;
/** One action (the shipped default's shape). */
const ONE = { used: 0, budget: 1 };
/** Raised budget (the L-daemon alternative). */
const MANY = { used: 0, budget: 3 };

describe('empowerAvailability', () => {
  it('reads the full budget on a fresh grant', () => {
    expect(empowerAvailability(ONE)).toEqual({ empowersRemaining: ONE.budget });
  });

  it('decrements per use and clamps at zero', () => {
    expect(empowerAvailability({ ...MANY, used: 1 })).toEqual({ empowersRemaining: 2 });
    // Over-counted state (can't happen via the handler, but the math clamps).
    expect(empowerAvailability({ ...MANY, used: 99 })).toEqual({ empowersRemaining: 0 });
  });
});

describe('empowerRejection — one-action grant', () => {
  it('accepts any hand position on the first action', () => {
    expect(empowerRejection(0, HAND, ONE)).toBeNull();
    expect(empowerRejection(HAND - 1, HAND, ONE)).toBeNull();
  });

  it('rejects a second action on the same grant', () => {
    expect(empowerRejection(3, HAND, { ...ONE, used: 1 })).toMatch(/no empowers left/);
  });

  it('rejects out-of-range and non-integer hand positions', () => {
    expect(empowerRejection(-1, HAND, ONE)).toMatch(/out of range/);
    expect(empowerRejection(HAND, HAND, ONE)).toMatch(/out of range/);
    expect(empowerRejection(1.5, HAND, ONE)).toMatch(/out of range/);
  });
});

describe('empowerRejection — raised-budget grant', () => {
  it('allows repeat actions until the budget runs out', () => {
    expect(empowerRejection(0, HAND, MANY)).toBeNull();
    expect(empowerRejection(0, HAND, { ...MANY, used: 2 })).toBeNull();
    expect(empowerRejection(0, HAND, { ...MANY, used: 3 })).toMatch(/no empowers left/);
  });
});

describe('empowerEffect', () => {
  it('builds the encounter-store shape: magnitude 1, endOfTurn lifetime, buff mods + merge', () => {
    const effect = empowerEffect(BUFF);
    expect(effect).toEqual({
      key: BUFF.key,
      magnitude: 1,
      mods: BUFF.mods,
      lifetime: { kind: 'endOfTurn' },
      merge: BUFF.merge,
    });
  });

  it('deep-copies the mods so the live store never aliases the authored buff', () => {
    const effect = empowerEffect(BUFF);
    effect.mods.strength!.add = 999;
    expect(BUFF.mods.strength!.add).toBe(4);
    // Two builds never share mod objects either (merging mutates in place).
    expect(empowerEffect(BUFF).mods.strength).not.toBe(empowerEffect(BUFF).mods.strength);
  });
});
