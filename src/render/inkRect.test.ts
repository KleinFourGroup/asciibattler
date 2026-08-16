import { describe, expect, it } from 'vitest';
import {
  FULL_GLYPH_INK,
  INK_ALPHA_THRESHOLD,
  INK_FLOOR_EPSILON,
  INK_PAD_PX,
  baseAnchorYFor,
  inkRectFromRgba,
  padInk,
} from './glyphs';

/**
 * §79a/§79d2 — headless coverage for the pure ink chain: raw bbox derivation
 * (`inkRectFromRgba`), the clickbox padding (`padInk` — the 79a rider, applied
 * at pick-candidate build), and the §79d2 baseline anchor rule
 * (`baseAnchorYFor`). Buffers are synthetic RGBA byte arrays in CANVAS
 * convention (row-major, row 0 = top); the derivation contract is the
 * normalized Y-UP `GlyphInk` (`pick.ts` convention), so these tests pin the y
 * flip explicitly. The live half (FontAtlas measuring real rasterized cells +
 * the TextMetrics baseline) is browser-only and gets the browser probe + the
 * 79g native eyeball.
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

describe('inkRectFromRgba (§79a atlas-derived ink bboxes — RAW since §79d2)', () => {
  it('a fully-inked cell yields the full rect', () => {
    expect(inkRectFromRgba(rgba(8, 8, () => true), 8, 8)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });

  it('an empty cell falls back to FULL_GLYPH_INK (no degenerate box)', () => {
    expect(inkRectFromRgba(rgba(8, 8, () => false), 8, 8)).toBe(FULL_GLYPH_INK);
  });

  it('flips canvas y-down to y-up: ink in the BOTTOM canvas rows → low y0/y1', () => {
    // Canvas rows 4..7 of 8 (the bottom half) → y-up bottom half: y0=0, y1=0.5.
    const ink = inkRectFromRgba(rgba(8, 8, (_x, y) => y >= 4), 8, 8);
    expect(ink).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0.5 });
  });

  it('ink in the TOP canvas rows → high y0/y1', () => {
    const ink = inkRectFromRgba(rgba(8, 8, (_x, y) => y < 2), 8, 8);
    expect(ink).toEqual({ x0: 0, y0: 0.75, x1: 1, y1: 1 });
  });

  it('a narrow centered column is hugged horizontally', () => {
    const ink = inkRectFromRgba(rgba(8, 8, (x) => x >= 3 && x <= 4), 8, 8);
    expect(ink).toEqual({ x0: 3 / 8, y0: 0, x1: 5 / 8, y1: 1 });
  });

  it('a single pixel yields its one-pixel rect (corner conventions exact)', () => {
    // Canvas (0, 0) = top-left → y-up rect hugging the TOP-left pixel.
    const ink = inkRectFromRgba(rgba(4, 4, (x, y) => x === 0 && y === 0), 4, 4);
    expect(ink).toEqual({ x0: 0, y0: 0.75, x1: 0.25, y1: 1 });
  });

  it('alpha at the threshold is NOT ink; one above is (the > contract)', () => {
    const at = rgba(4, 4, (x, y) => x === 1 && y === 1, INK_ALPHA_THRESHOLD);
    expect(inkRectFromRgba(at, 4, 4)).toBe(FULL_GLYPH_INK); // all below/at threshold → empty
    const above = rgba(4, 4, (x, y) => x === 1 && y === 1, INK_ALPHA_THRESHOLD + 1);
    expect(inkRectFromRgba(above, 4, 4)).toEqual({ x0: 0.25, y0: 0.5, x1: 0.5, y1: 0.75 });
  });

  it('rectangular (non-square) cells normalize per-axis', () => {
    // 8 wide × 4 tall, ink in the right half of the bottom row.
    const ink = inkRectFromRgba(rgba(8, 4, (x, y) => y === 3 && x >= 4), 8, 4);
    expect(ink).toEqual({ x0: 0.5, y0: 0, x1: 1, y1: 0.25 });
  });
});

describe('padInk (§79a rider via §79d2 — clickbox breathing room)', () => {
  it('widens every side by the pad, clamped to the cell', () => {
    const p = INK_PAD_PX / 16;
    expect(padInk({ x0: 7 / 16, y0: 7 / 16, x1: 9 / 16, y1: 9 / 16 }, p)).toEqual({
      x0: 7 / 16 - p,
      y0: 7 / 16 - p,
      x1: 9 / 16 + p,
      y1: 9 / 16 + p,
    });
    // Ink already touching an edge clamps rather than overflowing.
    expect(padInk({ x0: 0, y0: 0, x1: 1, y1: 4 / 16 }, p)).toEqual({
      x0: 0,
      y0: 0,
      x1: 1,
      y1: 4 / 16 + p,
    });
  });

  it('FULL_GLYPH_INK and pad 0 pass through untouched (identity)', () => {
    expect(padInk(FULL_GLYPH_INK, 0.05)).toBe(FULL_GLYPH_INK);
    const ink = { x0: 0.2, y0: 0.2, x1: 0.8, y1: 0.8 };
    expect(padInk(ink, 0)).toBe(ink);
  });
});

describe('baseAnchorYFor (§79d2 — the baseline anchor rule)', () => {
  const BASELINE = 0.26; // ≈ JetBrains Mono at 56/64, per the live measurement

  it('a letterform (ink above the cell floor) stands on the BASELINE', () => {
    // Caps and x-height letters: ink bottom == baseline → they stand their ink
    // on the tile; the anchor is the baseline regardless of the exact ink.
    expect(baseAnchorYFor({ x0: 0.27, y0: 0.25, x1: 0.77, y1: 0.91 }, BASELINE)).toBeCloseTo(
      BASELINE - 0.5,
      12,
    );
    // The census's descender (`g`, ink dipping to 0.109): SAME anchor — the
    // tail hangs below the stand line like text on a ruled line.
    expect(baseAnchorYFor({ x0: 0.2, y0: 0.109, x1: 0.8, y1: 0.77 }, BASELINE)).toBeCloseTo(
      BASELINE - 0.5,
      12,
    );
  });

  it('floor-touching blocks (ink.y0 = 0) stay flush on the quad bottom', () => {
    // `▄` rubble / `╥`: byte-identical to the fixed base anchor.
    expect(baseAnchorYFor({ x0: 0.17, y0: 0, x1: 0.83, y1: 0.53 }, BASELINE)).toBe(-0.5);
  });

  it('near-floor ink (a rasterizer that lost a bottom row or two) still classifies FLOOR', () => {
    // §79-post — the robustness the epsilon buys: §79g observed two builds of
    // the same face rasterizing an ink edge ONE row apart at the alpha
    // threshold, so a block glyph a row or two shy of the floor must not flip
    // onto the baseline. Rows quantize to 1/64 of the 64px atlas cell.
    const ROW = 1 / 64;
    expect(baseAnchorYFor({ x0: 0.17, y0: ROW, x1: 0.83, y1: 0.53 }, BASELINE)).toBe(-0.5);
    expect(baseAnchorYFor({ x0: 0.17, y0: 2 * ROW, x1: 0.83, y1: 0.53 }, BASELINE)).toBe(-0.5);
  });

  it('the epsilon boundary is strict: ink AT the epsilon classifies BASELINE', () => {
    // The census's nearest real letterforms (`@`/`g`, ink bottom 7/64) sit
    // well above the boundary; this pins the < contract at the boundary
    // itself so the guard band can't erode silently.
    expect(baseAnchorYFor({ x0: 0.2, y0: INK_FLOOR_EPSILON, x1: 0.8, y1: 0.77 }, BASELINE)).toBeCloseTo(
      BASELINE - 0.5,
      12,
    );
  });

  it('an unmeasured glyph (FULL_GLYPH_INK fallback) lands in the floor branch', () => {
    expect(baseAnchorYFor(FULL_GLYPH_INK, BASELINE)).toBe(-0.5);
  });
});
