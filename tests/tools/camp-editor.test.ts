/**
 * §75i — camp editor formatter fidelity (the encounter-editor pattern). The
 * editor's Save (and Copy / Download) write the file through `formatCampsJson`;
 * these pin two guarantees:
 *
 *  1. Re-emitting the committed catalog reproduces `config/camps.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — so a Save with
 *     no edits is a no-op diff, and an edited Save touches only changed lines.
 *     (The file was normalized to the arrays-expand / leafs-inline convention
 *     when this formatter landed — a whitespace-only change; `configHash`
 *     stringifies the PARSED value, so the trace era was untouched.)
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`CampsSchema`) to a value deep-equal to the source — the formatter
 *     drops / reorders nothing the loader cares about.
 *
 * Both derive from the live catalog + schema (never hardcoded camp values). A
 * third case pins the optional-key paths (no description / no rewards / bare
 * unit entries) the shipped smoke catalog doesn't fully exercise.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CAMPS, CampsSchema, type CampDef } from '../../src/config/camps';
import { formatCampsJson } from '../../tools/camp-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatCampsJson', () => {
  it('reproduces the committed config/camps.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/camps.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatCampsJson(CAMPS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal catalog', () => {
    const reparsed = CampsSchema.parse(JSON.parse(formatCampsJson(CAMPS)));
    expect(reparsed).toEqual([...CAMPS]);
  });

  it('formats the optional-key paths, round-tripping deep-equal', () => {
    // A synthetic camp with NO description, NO rewards, and a fully-bare unit
    // entry (count + level both defaulted). Parse it through the schema first
    // so the fixture can't drift from the real shape, then assert the
    // formatter round-trips it and the omitted keys stay omitted in the emit.
    const fixture: CampDef[] = CampsSchema.parse([
      {
        id: 'bare-camp',
        name: 'Bare Camp',
        leashRadius: 4,
        units: [{ archetype: 'bandit' }],
      },
    ]);
    const json = formatCampsJson(fixture);
    expect(CampsSchema.parse(JSON.parse(json))).toEqual(fixture);
    expect(json).toContain('{ "archetype": "bandit" }'); // bare entry stays bare
    expect(json).not.toContain('"description"');
    expect(json).not.toContain('"rewards"');
  });

  it('emits an empty catalog as [] (legal — a camp-free game is coherent)', () => {
    expect(formatCampsJson([])).toBe('[]');
  });
});
