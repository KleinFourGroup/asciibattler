import { describe, it, expect } from 'vitest';
import {
  StatusDefSchema,
  StatusMergeSchema,
  parseStatusDef,
  type StatusDef,
} from './statusSchema';

/**
 * Phase 27a — the StatusDef vocabulary's parse/reject/round-trip contract.
 * These pin the SHAPE with explicit literals (never the shipped
 * `config/statuses.json` — the catalog's CONTENT is proven in
 * `src/config/statuses.test.ts`): a valid def parses, the periodic op is
 * restricted to damage|heal, malformed shapes are rejected, and a def round-trips
 * through JSON unchanged.
 */

/** A burn-shaped DoT def (the §27 reference shape). */
function validBurnDef(): unknown {
  return {
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
    fx: { active: 'burn_overlay', ticked: 'burn_tick' },
  };
}

/** A rejuvenate-shaped HoT def (heal periodic op). */
function validRejuvenateDef(): unknown {
  return {
    id: 'rejuvenate',
    name: 'Rejuvenate',
    durationSeconds: 1,
    merge: 'refresh',
    periodic: { everySeconds: 1, op: { kind: 'heal', scaling: 'none', might: 1 } },
  };
}

describe('StatusDef schema — valid shapes', () => {
  it('parses a complete burn def', () => {
    const def = parseStatusDef(validBurnDef());
    expect(def.id).toBe('burn');
    expect(def.name).toBe('Burn');
    expect(def.merge).toBe('refresh');
    expect(def.periodic?.everySeconds).toBe(1);
    expect(def.periodic?.op.kind).toBe('damage');
  });

  it('parses a heal-periodic (HoT) def', () => {
    const def = parseStatusDef(validRejuvenateDef());
    expect(def.periodic?.op.kind).toBe('heal');
  });

  it('parses a status with no periodic block (a pure-fx / future stat-mod status)', () => {
    const def = parseStatusDef({
      id: 'marked',
      name: 'Marked',
      durationSeconds: 5,
      merge: 'refresh',
    });
    expect(def.periodic).toBeUndefined();
    expect(def.fx).toBeUndefined();
  });

  it('accepts all four merge policies (instances/ignore reserved)', () => {
    for (const merge of ['refresh', 'add', 'instances', 'ignore'] as const) {
      expect(() => StatusMergeSchema.parse(merge)).not.toThrow();
    }
  });
});

describe('StatusDef schema — periodic op is restricted to damage|heal', () => {
  it('rejects a periodic move op', () => {
    const bad = validBurnDef() as { periodic: { op: unknown } };
    bad.periodic.op = { kind: 'move', mode: 'advance', cells: 1 };
    expect(() => parseStatusDef(bad)).toThrow();
  });

  it('rejects a periodic applyStatus op', () => {
    const bad = validBurnDef() as { periodic: { op: unknown } };
    bad.periodic.op = { kind: 'applyStatus', statusId: 'poison' };
    expect(() => parseStatusDef(bad)).toThrow();
  });
});

describe('StatusDef schema — rejects malformed shapes', () => {
  it('requires a non-empty display name', () => {
    const noName = validBurnDef() as Record<string, unknown>;
    delete noName.name;
    expect(() => parseStatusDef(noName)).toThrow();
    expect(() => parseStatusDef({ ...(validBurnDef() as object), name: '' })).toThrow();
  });

  it('rejects an unknown merge policy', () => {
    expect(() => parseStatusDef({ ...(validBurnDef() as object), merge: 'stack' })).toThrow();
  });

  it('rejects a non-positive duration', () => {
    expect(() => parseStatusDef({ ...(validBurnDef() as object), durationSeconds: 0 })).toThrow();
  });

  it('rejects a non-positive periodic interval', () => {
    const bad = validBurnDef() as { periodic: { everySeconds: number } };
    bad.periodic.everySeconds = 0;
    expect(() => parseStatusDef(bad)).toThrow();
  });

  it('rejects a malformed periodic damage op (missing field)', () => {
    const bad = validBurnDef() as { periodic: { op: Record<string, unknown> } };
    delete bad.periodic.op.might;
    expect(() => parseStatusDef(bad)).toThrow();
  });
});

describe('StatusDef schema — round-trips through JSON', () => {
  it('parse → serialize → parse is stable', () => {
    const once: StatusDef = StatusDefSchema.parse(validBurnDef());
    const twice: StatusDef = StatusDefSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});
