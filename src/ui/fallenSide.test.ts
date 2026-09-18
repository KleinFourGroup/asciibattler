/**
 * 102d — the fallen cells' TEXT, pinned headless (the DOM half is the
 * render / ui eyeball policy). What is pinned is the shape — one token per
 * fallen vs one per archetype, the counts and the costs carried into the
 * lines — with every glyph and name read from the unit catalog, never
 * spelled here.
 */

import { describe, it, expect } from 'vitest';
import type { FallenRecord } from '../run/Run';
import { summarizeFallen } from '../run/fallenStats';
import { ARCHETYPE_CONFIG, glyphForArchetype } from '../sim/archetypes';
import { archetypeGlyphRun, archetypeLines, fallenGlyphRun, fallenLines } from './fallenSide';

const row = (archetype: string, power: number, level = 1): FallenRecord => ({
  sector: 0,
  node: 1,
  hop: 1,
  encounterId: 'brigands',
  turn: 1,
  side: 'player',
  archetype,
  level,
  power,
  tick: 0,
});

const ROWS = [row('mercenary', 1), row('archer', 2, 4), row('mercenary', 3)];

describe('fallenSide — the text helpers (102d)', () => {
  it('an empty side draws no run (the cell words it as nobody)', () => {
    expect(fallenGlyphRun([])).toBeNull();
    expect(archetypeGlyphRun([])).toBeNull();
  });

  it('the per-fallen run is one catalog glyph per row, in death order', () => {
    expect(fallenGlyphRun(ROWS)!.split(' ')).toEqual(ROWS.map((r) => glyphForArchetype(r.archetype)));
  });

  it('the grouped run is one token per archetype, carrying its count', () => {
    const groups = summarizeFallen(ROWS).player.byArchetype;
    const tokens = archetypeGlyphRun(groups)!.split(' ');
    expect(tokens).toHaveLength(groups.length);
    groups.forEach((g, i) => {
      expect(tokens[i]!.startsWith(glyphForArchetype(g.archetype))).toBe(true);
      expect(tokens[i]!.endsWith(String(g.count))).toBe(true);
    });
  });

  it('the lines name each fallen / each group from the catalog, with its cost', () => {
    const perFallen = fallenLines(ROWS).split('\n');
    expect(perFallen).toHaveLength(ROWS.length);
    ROWS.forEach((r, i) => {
      expect(perFallen[i]).toContain(ARCHETYPE_CONFIG[r.archetype]!.name);
      expect(perFallen[i]).toContain(String(r.level));
      expect(perFallen[i]).toContain(String(r.power));
    });
    const groups = summarizeFallen(ROWS).player.byArchetype;
    const perGroup = archetypeLines(groups).split('\n');
    expect(perGroup).toHaveLength(groups.length);
    groups.forEach((g, i) => {
      expect(perGroup[i]).toContain(ARCHETYPE_CONFIG[g.archetype]!.name);
      expect(perGroup[i]).toContain(String(g.count));
      expect(perGroup[i]).toContain(String(g.power));
    });
  });
});
