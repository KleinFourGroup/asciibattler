/**
 * The registered glyph set for the font atlas. Lives in its own module —
 * deliberately free of any THREE / DOM dependency — so it can be imported
 * by both `FontAtlas.ts` (which builds the canvas atlas) and headless
 * vitest tests (which can't touch canvas/WebGL).
 *
 * Order is stable: APPEND new glyphs to the end (gotcha #33) so existing
 * UV lookups stay valid. EVERY glyph the renderer asks for must appear
 * here or `FontAtlas.getGlyphUV` throws at render time — in particular
 * every archetype glyph (`glyphForArchetype`). `FontAtlas.test.ts` pins
 * that archetype coverage so a new unit (E7.B `h`, E7.C `m`, E7.D `c`)
 * can't ship without its glyph. The grid is `COLS × ROWS` (8 × 4 = 32)
 * cells in FontAtlas; keep the count under that.
 */
export const GLYPHS = [
  'M', 'a', '@',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '.', ':', '/', '-', '+', '%', '!', '?',
  '#', // C1a: wall obstacle (neutral-team environment entity).
  '╥', // D6: half-cover (LOS-transparent neutral obstacle). U+2565.
  '*', // E6.B: ranged projectile tracer glyph.
  'r', // E7.A: rogue unit glyph.
  'h', // E7.B: healer unit glyph.
  'm', // E7.C: mage unit glyph.
] as const;
