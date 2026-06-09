/**
 * I4 — archetype editor formatter fidelity. The editor's Save writes the file
 * through `formatArchetypesJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed config reproduces `config/archetypes.json`
 *     byte-for-byte (modulo line-ending / trailing-whitespace, which the repo
 *     doesn't yet normalize via .gitattributes) — so a Save with no edits is a
 *     no-op diff, and an edited Save touches only the lines the author changed.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`ArchetypesSchema`) to a value deep-equal to the source — the formatter
 *     drops/reorders nothing the loader cares about.
 *
 * Both derive from the live config + schema (never hardcoded archetype values),
 * so a future stat/archetype change keeps them honest.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES, ArchetypesSchema } from '../../src/config/archetypes';
import { formatArchetypesJson } from '../../tools/archetype-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out (no .gitattributes yet). */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatArchetypesJson', () => {
  it('reproduces the committed config/archetypes.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/archetypes.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatArchetypesJson(ARCHETYPES))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal config', () => {
    const reparsed = ArchetypesSchema.parse(JSON.parse(formatArchetypesJson(ARCHETYPES)));
    expect(reparsed).toEqual(ARCHETYPES);
  });
});
