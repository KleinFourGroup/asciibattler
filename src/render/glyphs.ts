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

/**
 * §38e — the atlas cell count a catalog with these unit glyphs would occupy: the
 * static non-unit glyphs plus the distinct unit glyphs. The archetype editor
 * calls this on its working set to warn (and block Save) before an authored unit
 * would grow the atlas past `ATLAS_CELL_BUDGET` — a check that used to live in the
 * editor's now-deleted closed-union "wire-up" panel, but now that unit glyphs are
 * catalog-derived it's the real budget guard.
 */
export function atlasCellsFor(unitGlyphs: Iterable<string>): number {
  const set = new Set<string>(NON_UNIT_GLYPHS);
  for (const g of unitGlyphs) set.add(g);
  return set.size;
}

/**
 * A glyph's normalized INK rectangle within its atlas cell — which, since
 * `FontAtlas.getGlyphUV` maps the FULL cell onto the billboard quad, is also the
 * fraction of the QUAD the visible ink actually fills. Coordinates are in [0,1]
 * with the ORIGIN at the bottom-left and y pointing UP (the quad / view-space
 * convention), so a half-height glyph that inks the bottom of its cell has a low
 * `y1`.
 *
 * The click hit-test (`pickInstanceAtNdc`) derives its box from this instead of
 * the whole quad, so the clickbox HUGS the glyph rather than the empty corners /
 * top. The default is the full cell (`FULL_GLYPH_INK`), so every normal full-cell
 * glyph is unchanged — only glyphs that declare a tighter rect below get a
 * trimmed box.
 *
 * FORWARD NOTE: for a glyph where a rectangle over-selects (an irregular shape —
 * a future giant, say) this same per-glyph table is where a pixel-perfect alpha
 * COVERAGE mask would live; the ink-rect then becomes that mask's cheap
 * bounding-box pre-reject — a stepping stone, not a throwaway.
 */
export interface GlyphInk {
  readonly x0: number; // left   (0 = cell left)
  readonly y0: number; // bottom (0 = cell bottom; y is UP)
  readonly x1: number; // right  (1 = cell right)
  readonly y1: number; // top    (1 = cell top)
}

/** The whole cell — the default for any glyph without an override (→ the pick box
 *  stays the symmetric full quad, byte-identical to the pre-ink hit-test). */
export const FULL_GLYPH_INK: GlyphInk = { x0: 0, y0: 0, x1: 1, y1: 1 };

/**
 * Per-glyph ink overrides. MEASURED, not guessed: each value is the alpha
 * bounding box from rasterizing the glyph exactly as `FontAtlas` does (JetBrains
 * Mono, `FONT_PX` 56 centered in a `CELL_PX` 64 cell, `textBaseline:'middle'`),
 * normalized to the cell + flipped to y-up. Anything absent = `FULL_GLYPH_INK`.
 */
const GLYPH_INK: Readonly<Record<string, GlyphInk>> = {
  // `▄` (U+2584 LOWER HALF BLOCK) = the rubble slab (`RUBBLE_GLYPH`): the ink
  // fills the central ~66% width and the bottom ~53% height, so its full-quad
  // clickbox otherwise reached ~1 cell above the visible slab (worse the larger
  // the rubble, since the pick quad scales with the footprint).
  '▄': { x0: 0.17, y0: 0, x1: 0.83, y1: 0.53 },
};

/** The ink rectangle for `glyph` — its measured override, or the full cell. Used
 *  by the billboard builders to stamp each pick candidate's hit-box. */
export function glyphInk(glyph: string): GlyphInk {
  return GLYPH_INK[glyph] ?? FULL_GLYPH_INK;
}
