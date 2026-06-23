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
    // .default()s applied:
    expect(def.speedScaled).toBe(true);
    expect(def.minRangeCells).toBe(0);
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
});

describe('AbilityDef schema — round-trips through JSON', () => {
  it('parse → serialize → parse is stable (idempotent with defaults filled)', () => {
    const once: AbilityDef = AbilityDefSchema.parse(validStrikeDef());
    const twice: AbilityDef = AbilityDefSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});
