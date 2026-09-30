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
