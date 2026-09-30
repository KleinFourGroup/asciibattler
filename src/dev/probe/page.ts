/**
 * 112a — the probe kit's pure checks, kept apart from the page so a test can
 * plant each trap without a browser (page.test.ts).
 */

/** What the canvas check reads off the page. */
export interface CanvasReading {
  /** `innerWidth` × `innerHeight`. */
  readonly viewport: readonly [number, number];
  /** The canvas's CSS box (`clientWidth` × `clientHeight`). */
  readonly client: readonly [number, number];
  /** The canvas's drawing buffer (`width` × `height`). */
  readonly buffer: readonly [number, number];
  readonly dpr: number;
}

/**
 * What is wrong with the canvas for a read, or null.
 * - `viewport`: the page or the canvas is zero-sized (a hidden pane).
 * - `layout`: the canvas box isn't the page. `ui.css` sizes it to exactly
 *   `100vw` × `100vh`, so a box that differs means the layout is off (a
 *   stylesheet that failed to load left it at the HTML default 300×150).
 * - `buffer`: the Renderer sizes the drawing buffer to the box times the
 *   pixel ratio on each `resize` event (Renderer.handleResize), so a box that
 *   changed without one leaves a stale buffer and a stale camera aspect.
 */
export function canvasProblem(r: CanvasReading): 'viewport' | 'layout' | 'buffer' | null {
  const [vw, vh] = r.viewport;
  const [cw, ch] = r.client;
  if (vw === 0 || vh === 0 || cw === 0 || ch === 0) return 'viewport';
  if (Math.abs(cw - vw) > 1 || Math.abs(ch - vh) > 1) return 'layout';
  const [bw, bh] = r.buffer;
  if (bw !== Math.round(cw * r.dpr) || bh !== Math.round(ch * r.dpr)) return 'buffer';
  return null;
}

/**
 * The `key=value` pairs of `want` that `search` lacks. A board fixture
 * rewrites the run dials in its URL (boardPanel/boot.ts), so `go()` checks
 * the pairs it asked for, not the whole string.
 */
export function missingPairs(search: string, want: string): string[] {
  const have = new URLSearchParams(search);
  const missing: string[] = [];
  for (const [key, value] of new URLSearchParams(want)) {
    if (!have.getAll(key).includes(value)) missing.push(value === '' ? key : `${key}=${value}`);
  }
  return missing;
}

/** A query as `go()` takes it: with or without its `?`. */
export function normalizeQuery(query: string): string {
  return query.startsWith('?') ? query.slice(1) : query;
}

/** A rectangle in CSS pixels from the page's top-left, as a screenshot reads. */
export interface PageRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * 112b — a page rectangle as `gl.readPixels` takes it: drawing-buffer pixels
 * (CSS × the pixel ratio), with y counted up from the buffer's bottom row.
 * Throws when the rectangle is empty or leaves the buffer, rather than
 * reading a clipped crop that looks whole.
 */
export function glReadRect(
  rect: PageRect,
  dpr: number,
  buffer: readonly [number, number],
): { x: number; y: number; w: number; h: number } {
  const x = Math.round(rect.x * dpr);
  const top = Math.round(rect.y * dpr);
  const w = Math.round(rect.w * dpr);
  const h = Math.round(rect.h * dpr);
  const [bw, bh] = buffer;
  if (w <= 0 || h <= 0) throw new Error(`__probe.pixels: the rect is empty (${w}x${h} buffer pixels)`);
  if (x < 0 || top < 0 || x + w > bw || top + h > bh) {
    throw new Error(
      `__probe.pixels: the rect (${x},${top} ${w}x${h} in buffer pixels) leaves the ${bw}x${bh} canvas`,
    );
  }
  return { x, y: bh - top - h, w, h };
}

/** The most pixels `pixels()` lists one by one. */
export const PIXEL_ROWS_MAX = 256;

export interface PixelSummary {
  /** FNV-1a over the RGBA bytes, top row first: equal crops, equal hashes. */
  readonly hash: string;
  readonly mean: readonly [number, number, number];
  /** Distinct RGB colours, counted to 64 (`64` means 64 or more). */
  readonly distinct: number;
  /** Whether any pixel's alpha is below 255. */
  readonly translucent: boolean;
  /** Each row as `#rrggbb` strings, top row first, for a crop of at most
   *  PIXEL_ROWS_MAX pixels; null above that. */
  readonly rows: string[][] | null;
}

/**
 * Summarize a `gl.readPixels` result (`w` × `h` RGBA, bottom row first, as
 * GL returns it) in top-row-first order, the way the page shows it.
 */
export function summarizePixels(bottomUp: Uint8Array, w: number, h: number): PixelSummary {
  if (bottomUp.length !== w * h * 4) throw new Error(`summarizePixels: ${bottomUp.length} bytes for ${w}x${h}`);
  let hash = 0x811c9dc5;
  const sum = [0, 0, 0];
  const colours = new Set<number>();
  let translucent = false;
  const rows: string[][] | null = w * h <= PIXEL_ROWS_MAX ? [] : null;
  for (let row = 0; row < h; row++) {
    const src = (h - 1 - row) * w * 4;
    const line: string[] = [];
    for (let i = src; i < src + w * 4; i += 4) {
      const r = bottomUp[i]!;
      const g = bottomUp[i + 1]!;
      const b = bottomUp[i + 2]!;
      const a = bottomUp[i + 3]!;
      for (const byte of [r, g, b, a]) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
      sum[0]! += r;
      sum[1]! += g;
      sum[2]! += b;
      if (a < 255) translucent = true;
      if (colours.size < 64) colours.add((r << 16) | (g << 8) | b);
      if (rows) line.push(`#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`);
    }
    rows?.push(line);
  }
  const n = w * h;
  return {
    hash: hash.toString(16).padStart(8, '0'),
    mean: [Math.round(sum[0]! / n), Math.round(sum[1]! / n), Math.round(sum[2]! / n)],
    distinct: colours.size,
    translucent,
    rows,
  };
}
