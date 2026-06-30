/**
 * M5 — layout editor formatter fidelity. The editor's Save writes the whole
 * file through `formatLayoutsJson`; these pin two guarantees (the sibling of
 * tests/tools/archetype-editor.test.ts):
 *
 *  1. Re-emitting the committed config reproduces `config/layouts.json`
 *     byte-for-byte (modulo line-ending / trailing-whitespace, which the repo
 *     doesn't yet normalize via .gitattributes) — so a Save with no edits is a
 *     no-op diff, and an edited Save touches only the lines the author changed.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`LayoutsSchema`) to a value deep-equal to the source — the formatter
 *     drops / reorders nothing the loader cares about.
 *
 * Both derive from the live config + schema (never hardcoded layout values), so
 * a future layout / field change keeps them honest. `formatLayoutJson` (the
 * single-entry Copy / Download snippet) shares the same per-entry generator, so
 * the byte-for-byte guard covers it transitively.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LAYOUTS, LayoutsSchema, type LayoutDef } from '../../src/config/layouts';
import { formatLayoutsJson } from '../../tools/layout-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out (no .gitattributes yet). */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatLayoutsJson', () => {
  it('reproduces the committed config/layouts.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/layouts.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatLayoutsJson(LAYOUTS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal config', () => {
    const reparsed = LayoutsSchema.parse(JSON.parse(formatLayoutsJson(LAYOUTS)));
    expect(reparsed).toEqual([...LAYOUTS]);
  });
});

describe('§37f — the five new terrain tiles + a new theme', () => {
  // A hand-built layout exercising every §37b tile array (deep water / hills /
  // ice / sand / mud, each on a distinct cell) plus a §37e theme. Round-tripping
  // it through the editor formatter → the REAL game schema proves the formatter
  // emits the new keys AND the schema accepts them — the editor's Save path
  // end-to-end for the new tiles.
  const band = (y: number): { x: number; y: number }[] =>
    Array.from({ length: 8 }, (_, x) => ({ x, y }));
  const withNewTiles: LayoutDef = {
    id: 'tile-roundtrip',
    name: 'Tile Roundtrip',
    description: 'fixture exercising the §37 terrain tiles + a new theme.',
    gridW: 8,
    gridH: 8,
    theme: 'tundra', // a §37e new theme — proves it survives the round-trip too
    walls: [],
    deepWater: [{ x: 0, y: 0 }],
    hills: [{ x: 1, y: 0 }],
    ice: [{ x: 2, y: 0 }],
    sand: [{ x: 3, y: 0 }],
    mud: [{ x: 4, y: 0 }],
    spawns: [
      { availability: 'player', tiles: band(6) },
      { availability: 'enemy', tiles: band(7) },
    ],
  };

  it('formats + re-parses to a deep-equal layout', () => {
    const reparsed = LayoutsSchema.parse(JSON.parse(formatLayoutsJson([withNewTiles])));
    expect(reparsed).toEqual([withNewTiles]);
  });

  it('rejects a new-tile cell that overlaps another reservation (mutex per cell)', () => {
    const overlapping: LayoutDef = { ...withNewTiles, mud: [{ x: 0, y: 0 }] }; // mud on deep water
    expect(LayoutsSchema.safeParse([overlapping]).success).toBe(false);
  });
});
