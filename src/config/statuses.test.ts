import { describe, it, expect } from 'vitest';
import { STATUS_DEFS, statusDef, assertStatusRefsResolve } from './statuses';
import { TILES_CONFIG } from './tiles';
import { parseAbilityDef, type AbilityDef } from '../sim/effects/schema';
import { parseStatusDef, type StatusDef } from '../sim/effects/statusSchema';

/**
 * Phase 27c — the four periodic statuses (burn / bleed / poison / rejuvenate)
 * authored in `config/statuses.json`. These tests read the SHIPPED catalog (the
 * content is now real) and balance-proof the tile-unification rates from the
 * `tiles.json` config module (never hardcode the authored numbers — gotcha-class
 * balance-proof discipline). The `assertStatusRefsResolve` boot-check tests below
 * still build literal fixtures (they probe the check, not the catalog).
 */

describe('STATUS_DEFS registry (27c content)', () => {
  it('ships the four periodic statuses', () => {
    expect(Object.keys(STATUS_DEFS).sort()).toEqual(['bleed', 'burn', 'poison', 'rejuvenate']);
  });

  it('every entry declares an id matching its registry key', () => {
    for (const [key, def] of Object.entries(STATUS_DEFS)) {
      expect(def.id).toBe(key);
    }
  });

  it('statusDef resolves a known id and throws loudly on an unknown one', () => {
    expect(statusDef('burn').name).toBe('Burn');
    expect(() => statusDef('nonexistent')).toThrow(/no definition for status id 'nonexistent'/);
  });
});

/** A `damage`-op narrowing helper — every DoT's periodic op must be a damage op. */
function periodicDamageOf(id: string) {
  const periodic = statusDef(id).periodic;
  expect(periodic, `${id} must be periodic`).toBeDefined();
  const op = periodic!.op;
  expect(op.kind, `${id} must be a DoT`).toBe('damage');
  if (op.kind !== 'damage') throw new Error('unreachable');
  return { everySeconds: periodic!.everySeconds, op };
}

describe('27c — DoT / HoT content shape', () => {
  it.each(['burn', 'bleed', 'poison'])(
    '%s is a defense-bypassing, non-evadable, flat-might DoT (the locked default)',
    (id) => {
      const { op } = periodicDamageOf(id);
      expect(op.scaling).toBe('none'); // flat `might`, no caster-stat scaling
      expect(op.bypassDefense).toBe(true);
      expect(op.evadable).toBe(false);
      expect(op.critable).toBe(false);
      expect(op.accuracy).toBe(1);
      expect(op.critBase).toBe(0);
    },
  );

  it('rejuvenate is a flat-might HoT', () => {
    const periodic = statusDef('rejuvenate').periodic;
    expect(periodic).toBeDefined();
    expect(periodic!.op.kind).toBe('heal');
    if (periodic!.op.kind !== 'heal') throw new Error('unreachable');
    expect(periodic!.op.scaling).toBe('none');
  });

  it('merge policies: burn/rejuvenate refresh (linger), bleed/poison add (stack)', () => {
    expect(statusDef('burn').merge).toBe('refresh');
    expect(statusDef('rejuvenate').merge).toBe('refresh');
    expect(statusDef('bleed').merge).toBe('add');
    expect(statusDef('poison').merge).toBe('add');
  });
});

describe('27c — balance-proof: tile-unification rates derive from tiles.json', () => {
  // The §27d tile pass applies these at the default magnitude (1), so the
  // per-second rate a standing unit feels is `op.might / everySeconds`. Deriving
  // from TILES_CONFIG keeps the proof honest: change either number in config and
  // this fails until they agree (never a hardcoded constant on either side).
  it('burn matches the fire tile damage rate', () => {
    const { everySeconds, op } = periodicDamageOf('burn');
    expect(op.might / everySeconds).toBe(TILES_CONFIG.fire.damagePerSec);
  });

  it('rejuvenate matches the healing tile heal rate', () => {
    const periodic = statusDef('rejuvenate').periodic!;
    expect(periodic.op.kind).toBe('heal');
    if (periodic.op.kind !== 'heal') throw new Error('unreachable');
    expect(periodic.op.might / periodic.everySeconds).toBe(TILES_CONFIG.healing.amountPerSec);
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
