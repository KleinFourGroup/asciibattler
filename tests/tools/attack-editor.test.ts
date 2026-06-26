/**
 * §30a — attack-editor formatter fidelity (the `formatArchetypesJson` sibling).
 * The editor's Save writes `config/abilities.json` through `formatAbilitiesJson`;
 * these pin two guarantees:
 *
 *  1. Re-emitting the committed catalog reproduces `config/abilities.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — so a Save with
 *     no edits is a no-op diff, and an edited Save touches only what changed.
 *     `config/abilities.json` was normalized to the formatter's canonical shape
 *     in §30a; this test keeps it pinned to that shape forever.
 *  2. The formatted output round-trips back through the REAL ability schema to a
 *     value deep-equal to the source — the formatter drops nothing the loader
 *     cares about (it only omits fields equal to their zod default, which the
 *     re-parse fills back in).
 *
 * Both derive from the live catalog + schema (never hardcoded ability values),
 * so a future ability/op change keeps them honest.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ABILITY_DEFS } from '../../src/config/abilities';
import { AbilityDefSchema, parseAbilityDef, type AbilityDef } from '../../src/sim/effects/schema';
import { formatAbilitiesJson } from '../../tools/attack-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out (no .gitattributes yet). */
function norm(str: string): string {
  return str.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatAbilitiesJson', () => {
  it('reproduces the committed config/abilities.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/abilities.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatAbilitiesJson(ABILITY_DEFS))).toBe(norm(onDisk));
  });

  it('round-trips through the ability schema to a deep-equal catalog', () => {
    const FileSchema = z.record(z.string(), AbilityDefSchema);
    const reparsed = FileSchema.parse(JSON.parse(formatAbilitiesJson(ABILITY_DEFS)));
    expect(reparsed).toEqual(ABILITY_DEFS);
  });

  it('§31 — round-trips scaled magnitude / duration / summon level byte-faithfully', () => {
    const catalog: Record<string, AbilityDef> = {
      scaled_afflict: parseAbilityDef({
        id: 'scaled_afflict', name: 'Scaled Afflict', cooldownSeconds: 1.5, rangeCells: 1,
        target: { kind: 'enemyInRange' },
        timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
        orphanPolicy: 'commit-at-cast', priority: 10,
        effects: [{
          phase: 'impact',
          op: {
            kind: 'applyStatus', statusId: 'bleed',
            magnitude: { base: 1, stat: 'strength', perPoint: 0.5, max: 4 },
            durationSeconds: { base: 2, stat: 'magic', perPoint: 1 },
          },
        }],
      }),
      scaled_summon: parseAbilityDef({
        id: 'scaled_summon', name: 'Scaled Summon', cooldownSeconds: 3, rangeCells: 6,
        target: { kind: 'self' },
        timeline: [{ phase: 'impact', seconds: 0 }, { phase: 'recovery', seconds: 'fill' }],
        orphanPolicy: 'commit-at-cast', priority: 10,
        effects: [{
          phase: 'impact',
          op: { kind: 'summon', summon: { archetype: 'ghoul', level: { base: 0, stat: 'level', perPoint: 1 }, maxLive: 3 }, at: { kind: 'self' } },
        }],
      }),
    };
    const text = formatAbilitiesJson(catalog);
    const FileSchema = z.record(z.string(), AbilityDefSchema);
    expect(FileSchema.parse(JSON.parse(text))).toEqual(catalog);
    // The scaled forms emit as OBJECTS (not coerced to a number).
    expect(text).toContain('"magnitude": { "base": 1, "stat": "strength", "perPoint": 0.5, "max": 4 }');
    expect(text).toContain('"level": { "base": 0, "stat": "level", "perPoint": 1 }');
  });
});
