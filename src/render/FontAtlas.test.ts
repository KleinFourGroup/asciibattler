import { describe, it, expect } from 'vitest';
import { GLYPHS, ATLAS_CELL_BUDGET } from './glyphs';
import { ALL_UNIT_DEFS } from '../config/units';

/**
 * The render layer isn't unit-tested (canvas/WebGL needs a browser), so
 * the one piece of the FontAtlas contract that IS checkable headlessly is that
 * every glyph the renderer will ask for is registered. A glyph missing from
 * `GLYPHS` passes the rest of the suite and fails only live (`FontAtlas: no
 * UV for glyph "x"`). The UNIT glyphs are CATALOG-DERIVED, so per-unit
 * coverage is STRUCTURAL — a `config/units.json` entry's glyph is in the set
 * by construction and can't drift. What still needs guarding: the derived set
 * must fit the atlas grid, and the static non-unit glyphs must survive.
 */
describe('FontAtlas glyph coverage', () => {
  const registered = new Set<string>(GLYPHS);

  it('registers a glyph for every unit in the catalog (combatants + neutrals)', () => {
    for (const [id, def] of Object.entries(ALL_UNIT_DEFS)) {
      expect(
        registered.has(def.glyph),
        `glyph "${def.glyph}" for unit "${id}" is missing from GLYPHS — the catalog derivation in glyphs.ts is broken.`,
      ).toBe(true);
    }
  });

  it('keeps the non-unit glyphs (tracer / aura ring / objective / the clump pose) registered', () => {
    // The static NON_UNIT_GLYPHS set, whole: the glyphs drawn directly (not via
    // the catalog), which a botched refactor of glyphs.ts could drop.
    for (const glyph of ['@', '.', '!', '*', 'X']) {
      expect(registered.has(glyph), `non-unit glyph "${glyph}" dropped from GLYPHS`).toBe(true);
    }
  });

  it('fits the FontAtlas cell budget', () => {
    // Over budget silently pushes glyphs off-canvas (row ≥ ROWS) — FontAtlas
    // throws at build time, but this catches it headlessly at pre-commit.
    expect(GLYPHS.length).toBeLessThanOrEqual(ATLAS_CELL_BUDGET);
  });

  it('has no duplicate glyph slots', () => {
    expect(new Set(GLYPHS).size).toBe(GLYPHS.length);
  });
});
