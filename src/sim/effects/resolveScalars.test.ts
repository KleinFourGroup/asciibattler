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
import { resolveDamageScalars, resolveHealAmount, scalingStatValue } from './resolveScalars';

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
