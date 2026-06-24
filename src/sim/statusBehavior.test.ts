import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { behaviorFlags, NEUTRAL_BEHAVIOR } from './statusBehavior';
import type { StatusEffect } from './statusEffects';
import { STATUS_DEFS } from '../config/statuses';
import { parseStatusDef } from './effects/statusSchema';

/**
 * §28 — the behavior-axis def-resolve fold. Behavior lives on the DEF and is
 * resolved by the effect's `key`, so (like the §27 periodic tests) these inject
 * FIXTURE defs into the file-isolated `STATUS_DEFS` registry rather than reading
 * the shipped catalog. The fold itself is pure — given the effects + the defs it
 * resolves, the merged flags are deterministic.
 */

const FIXTURES = {
  t_frozen: { durationSeconds: 2, merge: 'refresh', behavior: { preventsAttack: true, preventsMove: true } },
  t_panic: { durationSeconds: 3, merge: 'refresh', behavior: { preventsAttack: true, movement: 'flee' as const } },
  t_blind: { durationSeconds: 4, merge: 'refresh', behavior: { movement: 'wander' as const, acquisitionRange: 1 } },
  t_blind_wide: { durationSeconds: 4, merge: 'refresh', behavior: { movement: 'wander' as const, acquisitionRange: 3 } },
  t_confusion: { durationSeconds: 4, merge: 'refresh', behavior: { targeting: 'random' as const, affects: 'all' as const } },
  // A periodic-only status (a DoT) — a real STATUS_DEFS entry with NO behavior,
  // to prove it contributes nothing to the fold.
  t_burn: {
    durationSeconds: 4,
    merge: 'refresh',
    periodic: {
      everySeconds: 1,
      op: { kind: 'damage' as const, scaling: 'none' as const, might: 1, accuracy: 1, critBase: 0, critable: false, evadable: false, bypassDefense: true },
    },
  },
} as const;

beforeAll(() => {
  for (const [id, body] of Object.entries(FIXTURES)) {
    STATUS_DEFS[id] = parseStatusDef({ id, name: id, ...body });
  }
});
afterAll(() => {
  for (const id of Object.keys(FIXTURES)) delete STATUS_DEFS[id];
});

/** A minimal `StatusEffect` carrying just the `key` the fold resolves on. */
function effect(key: string): StatusEffect {
  return { key, magnitude: 1, mods: {}, lifetime: { kind: 'endOfTurn' }, merge: 'replace' };
}

describe('behaviorFlags — the neutral cases', () => {
  it('an empty effect list returns the shared NEUTRAL singleton', () => {
    expect(behaviorFlags([])).toBe(NEUTRAL_BEHAVIOR);
  });

  it('a plain K1 effect (no STATUS_DEFS entry) contributes nothing', () => {
    expect(behaviorFlags([effect('fatigued'), effect('empowered')])).toBe(NEUTRAL_BEHAVIOR);
  });

  it('a periodic-only status (a def, but no behavior block) contributes nothing', () => {
    expect(behaviorFlags([effect('t_burn')])).toBe(NEUTRAL_BEHAVIOR);
  });
});

describe('behaviorFlags — the four statuses in isolation', () => {
  it('frozen prevents attack and movement', () => {
    const f = behaviorFlags([effect('t_frozen')]);
    expect(f.preventsAttack).toBe(true);
    expect(f.preventsMove).toBe(true);
    expect(f.movement).toBeNull();
  });

  it('panic prevents attack and flees', () => {
    const f = behaviorFlags([effect('t_panic')]);
    expect(f.preventsAttack).toBe(true);
    expect(f.preventsMove).toBe(false);
    expect(f.movement).toBe('flee');
  });

  it('blind wanders and caps acquisition at 1', () => {
    const f = behaviorFlags([effect('t_blind')]);
    expect(f.movement).toBe('wander');
    expect(f.acquisitionRange).toBe(1);
    expect(f.preventsAttack).toBe(false);
  });

  it('confusion forces random targeting and all-affects', () => {
    const f = behaviorFlags([effect('t_confusion')]);
    expect(f.targeting).toBe('random');
    expect(f.affects).toBe('all');
  });
});

describe('behaviorFlags — merging multiple statuses', () => {
  it('flee outranks wander regardless of effect order', () => {
    expect(behaviorFlags([effect('t_panic'), effect('t_blind')]).movement).toBe('flee');
    expect(behaviorFlags([effect('t_blind'), effect('t_panic')]).movement).toBe('flee');
  });

  it('acquisitionRange takes the MIN (most restrictive) across contributors', () => {
    expect(behaviorFlags([effect('t_blind'), effect('t_blind_wide')]).acquisitionRange).toBe(1);
    expect(behaviorFlags([effect('t_blind_wide'), effect('t_blind')]).acquisitionRange).toBe(1);
  });

  it('frozen + panic: preventsMove holds and preventsAttack ORs true', () => {
    const f = behaviorFlags([effect('t_frozen'), effect('t_panic')]);
    expect(f.preventsAttack).toBe(true);
    expect(f.preventsMove).toBe(true);
    // panic still authors flee, even though preventsMove will trump it downstream.
    expect(f.movement).toBe('flee');
  });

  it('does not mutate the shared NEUTRAL singleton across calls', () => {
    behaviorFlags([effect('t_frozen')]); // would corrupt NEUTRAL if it mutated in place
    expect(behaviorFlags([])).toEqual({
      preventsAttack: false,
      preventsMove: false,
      movement: null,
      targeting: null,
      acquisitionRange: null,
      affects: null,
    });
  });
});
