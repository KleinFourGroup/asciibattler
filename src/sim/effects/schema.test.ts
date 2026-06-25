import { describe, it, expect } from 'vitest';
import {
  AbilityDefSchema,
  EffectOpSchema,
  TargetSelectorSchema,
  parseAbilityDef,
  type AbilityDef,
} from './schema';

/**
 * Phase Y1 — the vocabulary's parse/reject/round-trip contract. These pin the
 * SHAPE of the closed discriminated unions with explicit literals (never the
 * shipped `config/abilities.json` catalog): a valid def parses, malformed
 * ops/selectors are rejected, defaults fill, and a def round-trips through JSON
 * unchanged.
 */

/** A complete, valid melee-strike-shaped def (the migration's reference shape). */
function validStrikeDef(): unknown {
  return {
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
  };
}

describe('AbilityDef schema — valid shapes', () => {
  it('parses a complete strike def and fills the optional defaults', () => {
    const def = parseAbilityDef(validStrikeDef());
    expect(def.id).toBe('sword');
    // Yb — the display name is a first-class required field, decoupled from id.
    expect(def.name).toBe('Sword');
    // .default()s applied:
    expect(def.speedScaled).toBe(true);
    expect(def.minRangeCells).toBe(0);
  });

  it('Yb — requires a non-empty display name (no id fallback)', () => {
    const noName = validStrikeDef() as Record<string, unknown>;
    delete noName.name;
    expect(() => parseAbilityDef(noName)).toThrow();
    const emptyName = { ...(validStrikeDef() as Record<string, unknown>), name: '' };
    expect(() => parseAbilityDef(emptyName)).toThrow();
  });

  it('Yb — timeline phases default scalesWithSpeed=false and accept true', () => {
    const def = parseAbilityDef(validStrikeDef());
    expect(def.timeline.every((p) => p.scalesWithSpeed === false)).toBe(true);
    const scaled = validStrikeDef() as {
      timeline: { phase: string; seconds: unknown; scalesWithSpeed?: boolean }[];
    };
    scaled.timeline = [
      { phase: 'windup', seconds: 1.5, scalesWithSpeed: true },
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 'fill' },
    ];
    expect(parseAbilityDef(scaled).timeline[0].scalesWithSpeed).toBe(true);
  });

  it('fills the aoe ringMultiplier default (1 = uniform)', () => {
    const sel = TargetSelectorSchema.parse({
      kind: 'aoe',
      shape: 'square',
      radius: 1,
      anchor: 'targetCell',
      affects: 'enemies',
    });
    expect(sel).toEqual({
      kind: 'aoe',
      shape: 'square',
      radius: 1,
      anchor: 'targetCell',
      affects: 'enemies',
      ringMultiplier: 1,
    });
  });

  it('accepts the reserved move modes + applyStatus op (declared seams)', () => {
    // Schema-valid even though the Y2 interpreter rejects them until their phase.
    expect(() => EffectOpSchema.parse({ kind: 'move', mode: 'knockback', cells: 2 })).not.toThrow();
    expect(() => EffectOpSchema.parse({ kind: 'move', mode: 'pull', cells: 1 })).not.toThrow();
    expect(() =>
      EffectOpSchema.parse({ kind: 'applyStatus', statusId: 'burn', magnitude: 3 }),
    ).not.toThrow();
  });

  it('§29c — accepts a chain op carrying damage + applyStatus inner ops', () => {
    const chain = EffectOpSchema.parse({
      kind: 'chain',
      maxJumps: 3,
      rangeCells: 3,
      falloff: 0.6,
      ops: [
        {
          kind: 'damage',
          scaling: 'magic',
          might: 0,
          accuracy: 0.6,
          critBase: 0,
          critable: false,
          evadable: false,
          bypassDefense: false,
        },
        { kind: 'applyStatus', statusId: 'frozen' },
      ],
    });
    expect(chain.kind).toBe('chain');
    // §29c follow-up — hopDelaySeconds defaults to 0.1s (the per-hop stagger).
    if (chain.kind === 'chain') expect(chain.hopDelaySeconds).toBe(0.1);
  });
});

describe('AbilityDef schema — rejects malformed shapes', () => {
  it('rejects an unknown op kind', () => {
    const bad = validStrikeDef() as { effects: { op: unknown }[] };
    bad.effects[0].op = { kind: 'frobnicate', might: 1 };
    expect(() => parseAbilityDef(bad)).toThrow();
  });

  it('rejects an unknown selector kind', () => {
    const bad = validStrikeDef() as { target: unknown };
    bad.target = { kind: 'everyoneEverywhere' };
    expect(() => parseAbilityDef(bad)).toThrow();
  });

  it('rejects a damage op missing a required field', () => {
    const bad = validStrikeDef() as { effects: { op: Record<string, unknown> }[] };
    delete bad.effects[0].op.might;
    expect(() => parseAbilityDef(bad)).toThrow();
  });

  it('rejects an out-of-range scaling enum', () => {
    const bad = validStrikeDef() as { effects: { op: Record<string, unknown> }[] };
    bad.effects[0].op.scaling = 'charisma';
    expect(() => parseAbilityDef(bad)).toThrow();
  });

  it('rejects a non-positive move distance', () => {
    expect(() => EffectOpSchema.parse({ kind: 'move', mode: 'advance', cells: 0 })).toThrow();
  });

  it('rejects more than one fill phase', () => {
    const bad = validStrikeDef() as { timeline: { phase: string; seconds: unknown }[] };
    bad.timeline = [
      { phase: 'windup', seconds: 'fill' },
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 'fill' },
    ];
    expect(() => parseAbilityDef(bad)).toThrow(/at most one 'fill'/);
  });

  it('Yb — rejects scalesWithSpeed on a fill phase (a no-op footgun)', () => {
    const bad = validStrikeDef() as {
      timeline: { phase: string; seconds: unknown; scalesWithSpeed?: boolean }[];
    };
    bad.timeline = [
      { phase: 'impact', seconds: 0 },
      { phase: 'recovery', seconds: 'fill', scalesWithSpeed: true },
    ];
    expect(() => parseAbilityDef(bad)).toThrow(/scalesWithSpeed/);
  });

  it('rejects an effect on a phase absent from the timeline', () => {
    const bad = validStrikeDef() as { effects: { phase: string; op: unknown }[] };
    bad.effects[0].phase = 'travel'; // timeline has only impact + recovery
    expect(() => parseAbilityDef(bad)).toThrow(/phase present in the timeline/);
  });

  it('rejects an empty timeline', () => {
    const bad = validStrikeDef() as { timeline: unknown[] };
    bad.timeline = [];
    expect(() => parseAbilityDef(bad)).toThrow();
  });

  it('§29c — rejects a chain whose inner op is itself a chain (no nesting)', () => {
    // ChainInnerOp = damage | applyStatus only; a nested chain is excluded by
    // construction (no z.lazy recursion, no nested-falloff footgun).
    expect(() =>
      EffectOpSchema.parse({
        kind: 'chain',
        maxJumps: 2,
        rangeCells: 3,
        falloff: 0.5,
        ops: [{ kind: 'chain', maxJumps: 2, rangeCells: 3, falloff: 0.5, ops: [] }],
      }),
    ).toThrow();
  });

  it('§29c — rejects a chain carrying a move/heal inner op', () => {
    expect(() =>
      EffectOpSchema.parse({
        kind: 'chain',
        maxJumps: 2,
        rangeCells: 3,
        falloff: 0.5,
        ops: [{ kind: 'move', mode: 'advance', cells: 1 }],
      }),
    ).toThrow();
  });

  it('§29c — rejects an empty chain ops list and a falloff above 1', () => {
    const base = { kind: 'chain', maxJumps: 2, rangeCells: 3, falloff: 0.5 };
    expect(() => EffectOpSchema.parse({ ...base, ops: [] })).toThrow();
    expect(() =>
      EffectOpSchema.parse({
        ...base,
        falloff: 1.5,
        ops: [{ kind: 'applyStatus', statusId: 'frozen' }],
      }),
    ).toThrow();
  });
});

describe('AbilityDef schema — round-trips through JSON', () => {
  it('parse → serialize → parse is stable (idempotent with defaults filled)', () => {
    const once: AbilityDef = AbilityDefSchema.parse(validStrikeDef());
    const twice: AbilityDef = AbilityDefSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});
