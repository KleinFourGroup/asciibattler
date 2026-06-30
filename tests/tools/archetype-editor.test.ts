/**
 * I4 — archetype editor formatter fidelity. The editor's Save writes the file
 * through `formatArchetypesJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed config reproduces `config/units.json`
 *     byte-for-byte (modulo line-ending / trailing-whitespace, which the repo
 *     doesn't yet normalize via .gitattributes) — so a Save with no edits is a
 *     no-op diff, and an edited Save touches only the lines the author changed.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`UnitDefsSchema`) to a value deep-equal to the source — the formatter
 *     drops/reorders nothing the loader cares about.
 *
 * Both derive from the live config + schema (never hardcoded archetype values),
 * so a future stat/archetype change keeps them honest.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  UNIT_DEFS,
  UnitDefSchema,
  UnitDefsSchema,
  type UnitDef,
} from '../../src/config/units';
import { formatArchetypesJson } from '../../tools/archetype-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out (no .gitattributes yet). */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatArchetypesJson', () => {
  it('reproduces the committed config/units.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/units.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatArchetypesJson(UNIT_DEFS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal config', () => {
    const reparsed = UnitDefsSchema.parse(JSON.parse(formatArchetypesJson(UNIT_DEFS)));
    expect(reparsed).toEqual(UNIT_DEFS);
  });

  // §30d — the editor can author a created (not-yet-wired) archetype. The
  // formatter must emit the new key and EVERY entry must re-parse through the
  // per-entry `UnitDefSchema` (the validation the editor runs), including the
  // new entry's `draftable: false`.
  it('emits and per-entry round-trips a created archetype', () => {
    const created: Record<string, UnitDef> = structuredClone(UNIT_DEFS);
    created.necromancer = { ...structuredClone(UNIT_DEFS.mage), glyph: 'N', draftable: false };
    const parsed = JSON.parse(formatArchetypesJson(created)) as Record<string, unknown>;

    expect(Object.keys(parsed)).toContain('necromancer');
    for (const [key, entry] of Object.entries(parsed)) {
      expect(UnitDefSchema.safeParse(entry).success, key).toBe(true);
    }
    expect(UnitDefSchema.parse(parsed.necromancer).draftable).toBe(false);
  });
});
