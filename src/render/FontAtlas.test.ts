import { describe, it, expect } from 'vitest';
import { GLYPHS, ATLAS_CELL_BUDGET } from './glyphs';
import { ALL_UNIT_DEFS } from '../config/units';

/**
 * §38e — the render layer isn't unit-tested (canvas/WebGL needs a browser), so
 * the one piece of the FontAtlas contract that IS checkable headlessly is that
 * every glyph the renderer will ask for is registered. Pre-38e a new archetype
 * whose glyph wasn't hand-added to `GLYPHS` sailed through the whole suite and
 * only blew up live (`FontAtlas: no UV for glyph "x"` — how the rogue's `r` got
 * shipped missing). §38e made the UNIT glyphs CATALOG-DERIVED, so per-unit
 * coverage is now STRUCTURAL — a `config/units.json` entry's glyph is in the set
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

  it('keeps the non-unit glyphs (root / HUD digits / projectile / objective) registered', () => {
    // A representative sample of the static NON_UNIT_GLYPHS set — the glyphs the
    // renderer draws directly (not via the catalog), which a botched refactor of
    // glyphs.ts could drop.
    for (const glyph of ['@', '0', '9', '*', 'X']) {
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
