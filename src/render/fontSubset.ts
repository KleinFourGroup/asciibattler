/**
 * §79-post — the codepoint ranges the shipped JetBrains Mono subset keeps.
 *
 * Moved out of `scripts/build-font.mjs` so the coverage guard
 * (`tests/font-coverage.test.ts`) can import them WITHOUT executing the
 * generator: gen:font's own checks only run when someone runs gen:font, which
 * is precisely the moment nobody forgets the font. The test makes the
 * contract structural — a new catalog glyph outside these ranges fails
 * `npm test` instead of degrading to the DEV boot warn (the §79f class: a
 * silent OS fallback whose ink metrics re-classify a stand line on someone
 * else's machine).
 *
 * Deliberate HEADROOM (user-signed at the 79g shape-lock): the atlas needs 47
 * glyphs today, but regenerating on every new glyph is exactly the chore that
 * gets forgotten until it breaks a boss. Upstream coverage measured at 79g:
 * ASCII 95/95, Latin-1 96/96, box-drawing 128/128, blocks 32/32 — all
 * COMPLETE; geometric shapes 43/96 and arrows 35/112 are PARTIAL, so don't
 * assume an arbitrary shape exists there (the vendored-TTF check in the guard
 * test is what tells you).
 *
 * Regenerate the font after changing these: `npm run gen:font`.
 */

/** `[firstCodePoint, lastCodePoint, label]`, inclusive on both ends. */
export type SubsetRange = readonly [number, number, string];

export const SUBSET_RANGES: readonly SubsetRange[] = [
  [0x0020, 0x007e, 'ASCII printable'],
  [0x00a0, 0x00ff, 'Latin-1 supplement'],
  [0x2190, 0x21ff, 'Arrows (partial upstream)'],
  [0x2500, 0x257f, 'Box drawing'],
  [0x2580, 0x259f, 'Block elements'],
  [0x25a0, 0x25ff, 'Geometric shapes (partial upstream)'],
];

/** Whether the kept subset ranges include `codePoint`. */
export function subsetCovers(codePoint: number): boolean {
  return SUBSET_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}
