/**
 * The glyph set the font atlas rasterizes. Its own module, free of THREE and
 * the DOM, so `FontAtlas.ts` and the headless tests can both import it.
 *
 * The unit glyphs come from the `config/units.json` catalog (`ALL_UNIT_DEFS`),
 * so a unit authored in the archetype editor renders with no code edit. Only
 * the glyphs no catalog entry owns stay a static list.
 *
 * Every glyph the renderer asks for must be in `GLYPHS`, or
 * `FontAtlas.getGlyphUV` throws at render time (gotcha #33). A catalog
 * entry's glyph is in the set by construction, so `FontAtlas.test.ts`
 * guards the two things left: the set fits the atlas's grid, and the static
 * glyphs are present.
 *
 * The atlas is rebuilt from this list at every boot and addressed by the
 * glyph, not by index, so order is free; the count must stay within
 * `ATLAS_CELL_BUDGET`.
 */

import { ALL_UNIT_DEFS } from '../config/units';

/**
 * The atlas grid's capacity (FontAtlas's `COLS × ROWS`, 8 × 6): the one budget
 * the headless test and the archetype editor check against. FontAtlas owns
 * the grid and checks the count again at build; a larger set needs both
 * grown.
 */
export const ATLAS_CELL_BUDGET = 48;

/**
 * The glyphs no catalog unit owns, hand-listed: the sprites' own (`*` for
 * tracers, sparkles and blasts, `.` for the aura ring, `X` and `!` for the
 * objective marker) and `@`, a body in the board panel's clump pose
 * (src/dev/boardPanel/fixtures.ts), which copies the board geometry tests'
 * clump. A new non-unit glyph goes here; a new unit glyph needs no edit.
 */
const NON_UNIT_GLYPHS: readonly string[] = ['@', '.', '!', '*', 'X'];

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
 * The atlas cells a catalog with these unit glyphs would take: the static
 * glyphs plus the distinct unit glyphs. The archetype editor calls it on its
 * working set to warn, and to block Save, before an authored unit would grow
 * the atlas past `ATLAS_CELL_BUDGET`.
 */
export function atlasCellsFor(unitGlyphs: Iterable<string>): number {
  const set = new Set<string>(NON_UNIT_GLYPHS);
  for (const g of unitGlyphs) set.add(g);
  return set.size;
}

/**
 * A glyph's normalized ink rectangle within its atlas cell, which, since
 * `FontAtlas.getGlyphUV` maps the whole cell onto the billboard quad, is also
 * the part of the quad the visible ink fills. Coordinates are in [0, 1] with
 * the origin at the bottom-left and y up (the quad's and view space's
 * convention), so a half-height glyph inking the bottom of its cell has a low
 * `y1`.
 *
 * The click hit-test (`pickInstanceAtNdc`) builds its box from this and not
 * the whole quad, so the click box hugs the glyph, not the empty corners and
 * top. The rectangles are measured at the atlas's build (`FontAtlas`, through
 * `inkRectFromRgba` below), so every glyph is tight and a new glyph needs no
 * measuring by hand.
 */
export interface GlyphInk {
  readonly x0: number; // left   (0 = cell left)
  readonly y0: number; // bottom (0 = cell bottom; y is UP)
  readonly x1: number; // right  (1 = cell right)
  readonly y1: number; // top    (1 = cell top)
}

/** The whole cell: the fallback for a glyph the atlas hasn't measured, and
 *  for an all-transparent cell, so the pick box stays the full quad. */
export const FULL_GLYPH_INK: GlyphInk = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** Alpha above this counts as ink when measuring a glyph's box: low enough
 *  to catch faint antialiased edges, high enough to ignore blend noise. */
export const INK_ALPHA_THRESHOLD = 16;

/**
 * Pixels of room added on every side of the measured box (clamped to the
 * cell), so the click box hugs the glyph without asking for pixel-perfect
 * aim. In cell pixels (of `CELL_PX`, 64). Shipped 5; 3 read as a touch
 * tight. At 5 the box is still tight to the letterform, and a click aimed at
 * a thin glyph's stroke lands.
 */
export const INK_PAD_PX = 5;

/**
 * The alpha bounding box of one rasterized cell, as a normalized, y-up
 * `GlyphInk`. Pure and free of the DOM (it takes the raw RGBA bytes an
 * `ImageData.data` holds, row-major, row 0 at the top), so it is tested
 * headless on synthetic buffers; `FontAtlas.create` feeds it each glyph's
 * cell at build. The canvas-to-GL y flip happens here, as in `getGlyphUV`.
 * An all-transparent cell returns `FULL_GLYPH_INK`, the full quad rather
 * than a degenerate box.
 *
 * The box is raw (no padding): the lifts (`liftToCellY`) read it, and
 * `padInk` adds the click's room where pick candidates are built.
 */
export function inkRectFromRgba(
  data: ArrayLike<number>,
  width: number,
  height: number,
  threshold = INK_ALPHA_THRESHOLD,
): GlyphInk {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]!;
      if (alpha <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return FULL_GLYPH_INK;
  return {
    x0: minX / width,
    y0: 1 - (maxY + 1) / height, // canvas bottom row → y-up bottom edge
    x1: (maxX + 1) / width,
    y1: 1 - minY / height, // canvas top row → y-up top edge
  };
}

/**
 * Widen an ink box by `pad` (a fraction of the cell; FontAtlas passes
 * `INK_PAD_PX` of its cell) on every side, clamped to the cell. Pick
 * candidates get the room; the lifts read the raw box. `FULL_GLYPH_INK`
 * passes through untouched.
 */
export function padInk(ink: GlyphInk, pad: number): GlyphInk {
  if (ink === FULL_GLYPH_INK || pad === 0) return ink;
  return {
    x0: Math.max(0, ink.x0 - pad),
    y0: Math.max(0, ink.y0 - pad),
    x1: Math.min(1, ink.x1 + pad),
    y1: Math.min(1, ink.y1 + pad),
  };
}

/**
 * The quad-local y ([-0.5, 0.5], y up) a base-anchored sprite stands on: the
 * quad bottom, for every glyph. The ground mark under each body says where it
 * touches the ground, so no glyph needs a stand line of its own; a letterform's
 * ink therefore starts at the font baseline, about a quarter-cell up. The
 * pick candidates and the vertex shader's anchor attribute both read this.
 */
export const BASE_ANCHOR_Y = -0.5;

/**
 * The camera-up lift, in world units at size 1, from a base-anchored sprite's
 * anchor to height `cellY` in its cell (0 = the cell floor, 1 = its top).
 * Callers pass an ink edge and scale by the sprite's size.
 */
export function liftToCellY(cellY: number): number {
  return cellY - 0.5 - BASE_ANCHOR_Y;
}
