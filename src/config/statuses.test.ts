import { describe, it, expect } from 'vitest';
import { STATUS_DEFS, statusDef, assertStatusRefsResolve } from './statuses';
import { parseAbilityDef, type AbilityDef } from '../sim/effects/schema';
import { parseStatusDef, type StatusDef } from '../sim/effects/statusSchema';

/**
 * Phase 27a — the status registry + the `applyStatus` ref boot-check. The
 * catalog ships EMPTY (27c authors content), so the registry tests assert the
 * empty-but-valid state; the boot-check tests build literal fixtures (an ability
 * that authors an `applyStatus` op) rather than reading the shipped catalog.
 */

describe('STATUS_DEFS registry', () => {
  it('ships an empty catalog in 27a (content lands in 27c)', () => {
    expect(Object.keys(STATUS_DEFS)).toHaveLength(0);
  });

  it('statusDef throws loudly on an unknown id', () => {
    expect(() => statusDef('burn')).toThrow(/no definition for status id 'burn'/);
  });
});

/** A melee strike that applies a status on impact (the §29 status-on-hit shape). */
function applyStatusAbility(statusId: string): AbilityDef {
  return parseAbilityDef({
    id: 'flame_sword',
    name: 'Flame Sword',
    cooldownSeconds: 1.5,
    rangeCells: 1,
    target: { kind: 'enemyInRange' },
    timeline: [
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 'fill' },
    ],
    orphanPolicy: 'commit-at-cast',
    priority: 10,
    effects: [
      {
        phase: 'impact',
        op: {
          kind: 'damage',
          scaling: 'strength',
          might: 5,
          accuracy: 0.6,
          critBase: 0.05,
          critable: true,
          evadable: true,
          bypassDefense: false,
        },
      },
      { phase: 'impact', op: { kind: 'applyStatus', statusId } },
    ],
  });
}

function burnDef(): StatusDef {
  return parseStatusDef({
    id: 'burn',
    name: 'Burn',
    durationSeconds: 4,
    merge: 'refresh',
    periodic: {
      everySeconds: 1,
      op: {
        kind: 'damage',
        scaling: 'none',
        might: 1,
        accuracy: 1,
        critBase: 0,
        critable: false,
        evadable: false,
        bypassDefense: true,
      },
    },
  });
}

describe('assertStatusRefsResolve', () => {
  it('passes vacuously when no ability authors an applyStatus op', () => {
    const noApplyStatus = parseAbilityDef({
      id: 'sword',
      name: 'Sword',
      cooldownSeconds: 1.5,
      rangeCells: 1,
      target: { kind: 'enemyInRange' },
      timeline: [
        { phase: 'impact', seconds: 0 },
        { phase: 'recovery', seconds: 'fill' },
      ],
      orphanPolicy: 'commit-at-cast',
      priority: 10,
      effects: [
        {
          phase: 'impact',
          op: {
            kind: 'damage',
            scaling: 'strength',
            might: 5,
            accuracy: 0.6,
            critBase: 0.05,
            critable: true,
            evadable: true,
            bypassDefense: false,
          },
        },
      ],
    });
    expect(() => assertStatusRefsResolve({ sword: noApplyStatus }, {})).not.toThrow();
  });

  it('throws when an applyStatus op references a status absent from the registry', () => {
    expect(() =>
      assertStatusRefsResolve({ flame_sword: applyStatusAbility('burn') }, {}),
    ).toThrow(/applyStatus references unknown status id 'burn'/);
  });

  it('passes when every referenced status resolves', () => {
    expect(() =>
      assertStatusRefsResolve({ flame_sword: applyStatusAbility('burn') }, { burn: burnDef() }),
    ).not.toThrow();
  });
});
