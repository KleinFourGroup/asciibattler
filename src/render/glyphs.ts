/**
 * The registered glyph set for the font atlas. Lives in its own module —
 * deliberately free of any THREE / DOM dependency — so it can be imported
 * by both `FontAtlas.ts` (which builds the canvas atlas) and headless
 * vitest tests (which can't touch canvas/WebGL).
 *
 * §38e — the KEYSTONE payoff: the **unit** glyphs are now DERIVED from the
 * `config/units.json` catalog (`ALL_UNIT_DEFS`) rather than hand-listed here, so
 * authoring a brand-new unit in the archetype editor renders with **no code
 * edit** — the last code-edit dependency the unit-data keystone set out to
 * remove. Only the NON-unit glyphs (the root marker, the numeric HUD
 * digits/punctuation, the projectile tracer, the objective marker) stay a static
 * list, since nothing in the catalog owns them.
 *
 * EVERY glyph the renderer asks for must appear in the exported `GLYPHS` or
 * `FontAtlas.getGlyphUV` throws at render time. Unit-glyph coverage is now
 * STRUCTURAL (a catalog entry's glyph is in the set by construction — it can't
 * drift), so `FontAtlas.test.ts` only has to guard the two things left: the
 * derived set fits the atlas grid, and the static non-unit glyphs are present.
 *
 * The atlas is rebuilt from this list every boot and UVs are addressed by the
 * glyph char (not by index), so ordering is free — but the count must stay under
 * `ATLAS_CELL_BUDGET` (the `COLS × ROWS` grid in FontAtlas).
 */

import { ALL_UNIT_DEFS } from '../config/units';

/**
 * The FontAtlas grid capacity (`COLS × ROWS` = 8 × 6). Kept here as the single
 * budget the headless test asserts against; FontAtlas owns the actual grid dims
 * and re-checks this at build time. §29 grew the grid 8×4 = 32 → 8×6 = 48; the
 * next overflow needs another FontAtlas.ts resize (and this constant bumped).
 */
export const ATLAS_CELL_BUDGET = 48;

/**
 * Glyphs the renderer needs that AREN'T owned by any unit in the catalog: the
 * player root/base marker, the numeric HUD digits + punctuation, the projectile
 * tracer, and the in-battle objective marker. These stay hand-listed because no
 * `config/units.json` entry declares them. Append new NON-unit glyphs here; a new
 * UNIT glyph needs no edit at all (it flows in from the catalog below).
 */
const NON_UNIT_GLYPHS: readonly string[] = [
  '@', // player root / base marker (Phase A).
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '.', ':', '/', '-', '+', '%', '!', '?', // numeric HUD punctuation.
  '*', // E6.B: ranged projectile tracer glyph.
  'X', // J3: in-battle objective marker (the rally-tile / target-enemy 'X').
];

/**
 * The registered atlas glyph set: the static non-unit glyphs followed by every
 * distinct glyph the unit catalog declares (combatants + neutrals, in
 * `config/units.json` key order), deduped. FontAtlas rasterizes these into the
 * `ATLAS_CELL_BUDGET`-cell grid; a count over budget throws at build time.
 */
export const GLYPHS: readonly string[] = ((): readonly string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (g: string): void => {
    if (seen.has(g)) return;
    seen.add(g);
    out.push(g);
  };
  for (const g of NON_UNIT_GLYPHS) push(g);
  for (const def of Object.values(ALL_UNIT_DEFS)) push(def.glyph);
  return out;
})();
