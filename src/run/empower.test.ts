import { describe, it, expect } from 'vitest';
import {
  empowerAvailability,
  empowerRejection,
  empowerEffect,
  type EmpowerTurnState,
} from './empower';
import type { EmpowerConfig } from '../config/empower';

/**
 * K4 — the pure empower rules, exercised in BOTH config modes (the reason
 * this module exists outside `Run`): the shipped "one empower per turn"
 * default and the raised-budget alternative a Phase-L daemon would grant.
 * The configs here are deliberately explicit literals, NOT `EMPOWER` — the
 * mode contract must hold whatever the shipped knobs say (the Run.test.ts
 * integration block covers the live config).
 */

const BUFF: EmpowerConfig['buff'] = {
  key: 'empowered',
  mods: { strength: { add: 4 }, ranged: { add: 4 }, magic: { add: 4 } },
  merge: 'add',
};

/** One empower per turn (the shipped default's shape). */
const ONE: EmpowerConfig = { enabled: true, empowersPerTurn: 1, buff: BUFF };
/** Raised budget (the L-daemon alternative). */
const MANY: EmpowerConfig = { enabled: true, empowersPerTurn: 3, buff: BUFF };
const DISABLED: EmpowerConfig = { enabled: false, empowersPerTurn: 1, buff: BUFF };

const HAND = 6;
const fresh = (): EmpowerTurnState => ({ empowersUsed: 0 });

describe('empowerAvailability', () => {
  it('reads the full budget on a fresh turn', () => {
    expect(empowerAvailability(fresh(), ONE)).toEqual({
      empowersRemaining: ONE.empowersPerTurn,
    });
  });

  it('decrements per use and clamps at zero', () => {
    expect(empowerAvailability({ empowersUsed: 1 }, MANY)).toEqual({ empowersRemaining: 2 });
    // Over-counted state (can't happen via the handler, but the math clamps).
    expect(empowerAvailability({ empowersUsed: 99 }, MANY)).toEqual({ empowersRemaining: 0 });
  });

  it('disabled config reads as 0 regardless of the dial', () => {
    expect(empowerAvailability(fresh(), DISABLED)).toEqual({ empowersRemaining: 0 });
  });
});

describe('empowerRejection — one-per-turn mode', () => {
  it('accepts any hand position on the first action', () => {
    expect(empowerRejection(0, HAND, fresh(), ONE)).toBeNull();
    expect(empowerRejection(HAND - 1, HAND, fresh(), ONE)).toBeNull();
  });

  it('rejects a second action the same turn', () => {
    expect(empowerRejection(3, HAND, { empowersUsed: 1 }, ONE)).toMatch(/no empowers left/);
  });

  it('rejects out-of-range and non-integer hand positions', () => {
    expect(empowerRejection(-1, HAND, fresh(), ONE)).toMatch(/out of range/);
    expect(empowerRejection(HAND, HAND, fresh(), ONE)).toMatch(/out of range/);
    expect(empowerRejection(1.5, HAND, fresh(), ONE)).toMatch(/out of range/);
  });

  it('rejects everything when disabled', () => {
    expect(empowerRejection(0, HAND, fresh(), DISABLED)).toMatch(/disabled/);
  });
});

describe('empowerRejection — raised-budget mode', () => {
  it('allows repeat actions until the budget runs out', () => {
    expect(empowerRejection(0, HAND, fresh(), MANY)).toBeNull();
    expect(empowerRejection(0, HAND, { empowersUsed: 2 }, MANY)).toBeNull();
    expect(empowerRejection(0, HAND, { empowersUsed: 3 }, MANY)).toMatch(/no empowers left/);
  });
});

describe('empowerEffect', () => {
  it('builds the encounter-store shape: magnitude 1, endOfTurn lifetime, config mods + merge', () => {
    const effect = empowerEffect(ONE);
    expect(effect).toEqual({
      key: BUFF.key,
      magnitude: 1,
      mods: BUFF.mods,
      lifetime: { kind: 'endOfTurn' },
      merge: BUFF.merge,
    });
  });

  it('deep-copies the mods so the live store never aliases the config', () => {
    const effect = empowerEffect(ONE);
    effect.mods.strength!.add = 999;
    expect(ONE.buff.mods.strength!.add).toBe(4);
    // Two builds never share mod objects either (merging mutates in place).
    expect(empowerEffect(ONE).mods.strength).not.toBe(empowerEffect(ONE).mods.strength);
  });
});
