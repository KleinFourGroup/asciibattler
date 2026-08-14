import { describe, expect, it } from 'vitest';
import { FULL_GLYPH_INK, INK_ALPHA_THRESHOLD, INK_PAD_PX, inkRectFromRgba } from './glyphs';

/**
 * §79a — headless coverage for the pure ink-bbox derivation (`inkRectFromRgba`),
 * the piece of the atlas-derived clickbox chain that doesn't need a canvas.
 * Buffers are synthetic RGBA byte arrays in CANVAS convention (row-major,
 * row 0 = top); the function's contract is the normalized Y-UP `GlyphInk`
 * (`pick.ts` convention), so these tests pin the y flip explicitly. Geometry
 * pins pass `padPx: 0` so they assert the raw bbox; the padding rider (user
 * call, 2026-08-14) gets its own pins below. The live half of the chain
 * (FontAtlas measuring real rasterized cells) is browser-only and gets the
 * §79a browser probe + the 79g native eyeball.
 */

/** Build a w×h RGBA buffer, alpha = 0 except where `on(x, y)` (canvas coords,
 *  y = 0 at the TOP) says ink lives. */
function rgba(
  w: number,
  h: number,
  on: (x: number, y: number) => boolean,
  alpha = 255,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (on(x, y)) data[(y * w + x) * 4 + 3] = alpha;
    }
  }
  return data;
}

/** The raw (unpadded) bbox — the geometry pins' subject. */
const raw = (data: Uint8ClampedArray, w: number, h: number) =>
  inkRectFromRgba(data, w, h, INK_ALPHA_THRESHOLD, 0);

describe('inkRectFromRgba (§79a atlas-derived ink bboxes)', () => {
  it('a fully-inked cell yields the full rect', () => {
    expect(raw(rgba(8, 8, () => true), 8, 8)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });

  it('an empty cell falls back to FULL_GLYPH_INK (no degenerate box)', () => {
    expect(raw(rgba(8, 8, () => false), 8, 8)).toBe(FULL_GLYPH_INK);
  });

  it('flips canvas y-down to y-up: ink in the BOTTOM canvas rows → low y0/y1', () => {
    // Canvas rows 4..7 of 8 (the bottom half) → y-up bottom half: y0=0, y1=0.5.
    const ink = raw(rgba(8, 8, (_x, y) => y >= 4), 8, 8);
    expect(ink).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0.5 });
  });

  it('ink in the TOP canvas rows → high y0/y1', () => {
    const ink = raw(rgba(8, 8, (_x, y) => y < 2), 8, 8);
    expect(ink).toEqual({ x0: 0, y0: 0.75, x1: 1, y1: 1 });
  });

  it('a narrow centered column is hugged horizontally', () => {
    const ink = raw(rgba(8, 8, (x) => x >= 3 && x <= 4), 8, 8);
    expect(ink).toEqual({ x0: 3 / 8, y0: 0, x1: 5 / 8, y1: 1 });
  });

  it('a single pixel yields its one-pixel rect (corner conventions exact)', () => {
    // Canvas (0, 0) = top-left → y-up rect hugging the TOP-left pixel.
    const ink = raw(rgba(4, 4, (x, y) => x === 0 && y === 0), 4, 4);
    expect(ink).toEqual({ x0: 0, y0: 0.75, x1: 0.25, y1: 1 });
  });

  it('alpha at the threshold is NOT ink; one above is (the > contract)', () => {
    const at = rgba(4, 4, (x, y) => x === 1 && y === 1, INK_ALPHA_THRESHOLD);
    expect(raw(at, 4, 4)).toBe(FULL_GLYPH_INK); // all below/at threshold → empty
    const above = rgba(4, 4, (x, y) => x === 1 && y === 1, INK_ALPHA_THRESHOLD + 1);
    expect(raw(above, 4, 4)).toEqual({ x0: 0.25, y0: 0.5, x1: 0.5, y1: 0.75 });
  });

  it('rectangular (non-square) cells normalize per-axis', () => {
    // 8 wide × 4 tall, ink in the right half of the bottom row.
    const ink = raw(rgba(8, 4, (x, y) => y === 3 && x >= 4), 8, 4);
    expect(ink).toEqual({ x0: 0.5, y0: 0, x1: 1, y1: 0.25 });
  });

  it('the default pad widens every side by INK_PAD_PX, clamped to the cell', () => {
    // A 2×2 ink block centered in 16×16: default-pad call = raw box ± pad/16.
    const data = rgba(16, 16, (x, y) => (x === 7 || x === 8) && (y === 7 || y === 8));
    const p = INK_PAD_PX / 16;
    expect(inkRectFromRgba(data, 16, 16)).toEqual({
      x0: 7 / 16 - p,
      y0: 7 / 16 - p,
      x1: 9 / 16 + p,
      y1: 9 / 16 + p,
    });
    // Ink already touching an edge clamps rather than overflowing: bottom rows.
    const edge = inkRectFromRgba(rgba(16, 16, (_x, y) => y >= 12), 16, 16);
    expect(edge).toEqual({ x0: 0, y0: 0, x1: 1, y1: Math.min(1, 4 / 16 + p) });
    // An empty cell is untouched by padding (fallback, not a padded nothing).
    expect(inkRectFromRgba(rgba(8, 8, () => false), 8, 8)).toBe(FULL_GLYPH_INK);
  });
});
