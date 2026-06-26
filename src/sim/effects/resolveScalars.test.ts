/**
 * §30c — the shared cast-time scalar kernel (`resolveScalars`). Mechanic test:
 * explicit-literal stat blocks, never the shipped config. Crit DEFERS to
 * `critChanceFor` (the one balance-owning helper), so the critable assertion
 * checks the wiring against it rather than re-deriving the capped probability.
 */

import { describe, expect, it } from 'vitest';
import type { UnitStats } from '../Unit';
import { critChanceFor } from '../stats';
import type { DamageOp, HealOp } from './schema';
import { ScalarOrScaledSchema } from './schema';
import {
  evalScaled,
  resolveDamageScalars,
  resolveHealAmount,
  scalingStatValue,
  type ScalingSource,
} from './resolveScalars';

function stats(overrides: Partial<UnitStats>): UnitStats {
  return {
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
    ...overrides,
  };
}

function damageOp(overrides: Partial<DamageOp>): DamageOp {
  return {
    kind: 'damage',
    scaling: 'strength',
    might: 0,
    accuracy: 0.6,
    critBase: 0,
    critable: true,
    evadable: true,
    bypassDefense: false,
    ...overrides,
  };
}

describe('scalingStatValue', () => {
  const s = stats({ strength: 3, ranged: 5, magic: 7 });
  it('picks the named caster stat', () => {
    expect(scalingStatValue('strength', s)).toBe(3);
    expect(scalingStatValue('ranged', s)).toBe(5);
    expect(scalingStatValue('magic', s)).toBe(7);
  });
  it('returns 0 for `none` (flat might only)', () => {
    expect(scalingStatValue('none', s)).toBe(0);
  });
});

describe('resolveDamageScalars', () => {
  it('baseDamage = might + the scaling stat', () => {
    const op = damageOp({ scaling: 'magic', might: 4, critable: false });
    expect(resolveDamageScalars(op, stats({ magic: 6 })).baseDamage).toBe(10);
  });

  it('critChance is 0 when the op is not critable', () => {
    const op = damageOp({ critable: false, critBase: 0.5 });
    expect(resolveDamageScalars(op, stats({ luck: 9 })).critChance).toBe(0);
  });

  it('critable defers the probability to critChanceFor(critBase, luck)', () => {
    const op = damageOp({ critable: true, critBase: 0.1 });
    const s = stats({ luck: 4 });
    expect(resolveDamageScalars(op, s).critChance).toBe(critChanceFor(0.1, 4));
  });
});

describe('resolveHealAmount', () => {
  it('is might + magic (magic scaling)', () => {
    const op: HealOp = { kind: 'heal', scaling: 'magic', might: 2 };
    expect(resolveHealAmount(op, stats({ magic: 5 }))).toBe(7);
  });
  it('is flat might under `none` scaling', () => {
    const op: HealOp = { kind: 'heal', scaling: 'none', might: 3 };
    expect(resolveHealAmount(op, stats({ magic: 5 }))).toBe(3);
  });
});

/* -------------------------------------------------------------------------- */
/* §31 — the ScaledValue union + the cast-time evaluator.                       */
/* -------------------------------------------------------------------------- */

function source(overrides: { level?: number } & Partial<UnitStats>): ScalingSource {
  const { level = 1, ...statOverrides } = overrides;
  return { level, effectiveStats: stats(statOverrides) };
}

describe('ScalarOrScaledSchema', () => {
  it('parses a bare number (the non-breaking arm)', () => {
    expect(ScalarOrScaledSchema.parse(2)).toBe(2);
  });
  it('parses a full scaled descriptor', () => {
    const v = { base: 1, stat: 'magic', perPoint: 0.5, max: 4 };
    expect(ScalarOrScaledSchema.parse(v)).toEqual(v);
  });
  it('parses a scaled descriptor without the optional max', () => {
    const v = { base: 2, stat: 'level', perPoint: 1 };
    expect(ScalarOrScaledSchema.parse(v)).toEqual(v);
  });
  it('rejects a descriptor missing the required base', () => {
    expect(() => ScalarOrScaledSchema.parse({ stat: 'magic', perPoint: 1 })).toThrow();
  });
  it('rejects an unknown scaling stat (speed is excluded)', () => {
    expect(() => ScalarOrScaledSchema.parse({ base: 0, stat: 'speed', perPoint: 1 })).toThrow();
  });
});

describe('evalScaled', () => {
  it('passes a bare number through untouched', () => {
    expect(evalScaled(3, source({ magic: 9 }))).toBe(3);
  });
  it('returns undefined for undefined (an unauthored optional)', () => {
    expect(evalScaled(undefined, source({}))).toBeUndefined();
  });
  it('computes base + perPoint × stat off effectiveStats', () => {
    // 1 + 0.5 × 8 = 5
    expect(evalScaled({ base: 1, stat: 'magic', perPoint: 0.5 }, source({ magic: 8 }))).toBe(5);
  });
  it('reads the `level` stat off the unit, not effectiveStats', () => {
    // 2 + 1 × level(5) = 7 — magic is irrelevant
    expect(evalScaled({ base: 2, stat: 'level', perPoint: 1 }, source({ level: 5, magic: 99 }))).toBe(7);
  });
  it('honors the optional max ceiling', () => {
    // 1 + 1 × 10 = 11, clamped to 4
    expect(evalScaled({ base: 1, stat: 'strength', perPoint: 1, max: 4 }, source({ strength: 10 }))).toBe(4);
  });
  it('does not clamp when the raw value is under max', () => {
    expect(evalScaled({ base: 1, stat: 'strength', perPoint: 1, max: 10 }, source({ strength: 2 }))).toBe(3);
  });
});
