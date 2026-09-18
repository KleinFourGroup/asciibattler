/**
 * §79-post / §101a — the faces we ship + the codepoint ranges their subsets
 * keep. (i18n-ok-file: a build table — the labels are never rendered.)
 *
 * Moved out of `scripts/build-font.mjs` so the coverage guard
 * (`tests/font-coverage.test.ts`) and the renderer (`FontAtlas`'s font stack)
 * can import them WITHOUT executing the generator: gen:font's own checks only
 * run when someone runs gen:font, which is precisely the moment nobody forgets
 * the font. The test makes the contract structural — a new catalog glyph or a
 * new UI glyph outside the shipped subsets fails `npm test` instead of
 * degrading to an OS fallback (the §79f class on the canvas: ink metrics that
 * re-classify a stand line on someone else's machine; the §101 class in the
 * DOM: a fallback face's taller ascent growing a line box — the 46 / 45 px
 * chip).
 *
 * TWO FACES (§101a, user-signed 2026-09-17 — the §79f multi-face trigger
 * fired on purpose): JetBrains Mono is the PRIMARY and supplies every glyph
 * it has; DejaVu Sans Mono is the ONE shipped FALLBACK and its subset keeps
 * only what the primary lacks inside SUBSET_RANGES, so a glyph the primary
 * can't paint still comes from a face we ship — the same letterform on every
 * machine, a line box that never grows (DejaVu's ascent / descent 0.93 / 0.24
 * sit inside JetBrains' 1.02 / 0.30; its 0.602 advance matches the 0.600
 * cell). The CSS `font-family` chain and the canvas atlas's `ctx.font` both
 * use FONT_STACK, so the DOM and the atlas share one provenance rule.
 *
 * Deliberate HEADROOM (user-signed at the 79g shape-lock): whole blocks, not
 * the glyphs in use, so a new glyph choice inside a kept block needs no
 * regeneration. Upstream JetBrains coverage: ASCII, Latin-1, box-drawing and
 * blocks COMPLETE; every other block PARTIAL — the fallback fills the rest
 * where DejaVu has it, and the guard test (not this table) is what says
 * whether a given codepoint is shipped.
 *
 * Regenerate the fonts after changing these: `npm run gen:font`.
 */

/** `[firstCodePoint, lastCodePoint, label]`, inclusive on both ends. */
export type SubsetRange = readonly [number, number, string];

export const SUBSET_RANGES: readonly SubsetRange[] = [
  [0x0020, 0x007e, 'ASCII printable'],
  [0x00a0, 0x00ff, 'Latin-1 supplement'],
  [0x2000, 0x206f, 'General punctuation (partial upstream)'],
  [0x2190, 0x21ff, 'Arrows (partial upstream)'],
  [0x2200, 0x22ff, 'Mathematical operators (partial upstream)'],
  [0x2300, 0x23ff, 'Miscellaneous technical (partial upstream)'],
  [0x2500, 0x257f, 'Box drawing'],
  [0x2580, 0x259f, 'Block elements'],
  [0x25a0, 0x25ff, 'Geometric shapes (partial upstream)'],
  [0x2600, 0x26ff, 'Miscellaneous symbols (partial upstream)'],
  [0x2700, 0x27bf, 'Dingbats (partial upstream)'],
];

/** Whether the kept subset ranges include `codePoint`. */
export function subsetCovers(codePoint: number): boolean {
  return SUBSET_RANGES.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
}

/**
 * 101a-post — codepoints the PRIMARY face carries but draws WRONG, so the
 * generator drops them from its subset and the fallback supplies them.
 * JetBrains Mono 2.304 has U+229E SQUARED PLUS and U+22A0 SQUARED TIMES
 * SWAPPED (its ⊞ paints a boxed X, its ⊠ a boxed plus) — caught by the
 * user's eye on the map chip the morning after 101a widened the ranges
 * (before that, `⊞` sat outside the subset and the OS face painted it
 * right). Audited then: a mutual-swap search over all 338 codepoints both
 * faces carry (ink-bbox-normalized density grids, JetBrains vs DejaVu) found
 * this pair and only this pair. Re-check on a JetBrains upgrade; the guard
 * test pins that a fallback really has every entry.
 *
 * Triaged 2026-09-18: a DRAWING error in the raw vendored TTF (cmap + `post`
 * names are right — `uni229E` / `uni22A0` — the outlines under them are each
 * other's), known upstream as JetBrains/JetBrainsMono#676, OPEN; the fix is
 * PR #702 (unmerged — blocked behind an unrelated regression, #699). v2.304
 * is still the latest release. Nothing of ours to report; empty this list
 * only on a vendored release that carries #702, after a swap-search re-run.
 */
export const PRIMARY_EXCLUDES: readonly number[] = [0x229e, 0x22a0];

/** One shipped face: a vendored source TTF under `assets/fonts/<dir>/`, the
 *  woff2 the generator writes beside it, and the CSS family name. */
export interface ShippedFace {
  readonly family: string;
  readonly dir: string;
  readonly source: string;
  readonly out: string;
  /** `primary` supplies everything it has; a `fallback` keeps only what the
   *  primary lacks. Exactly one primary, listed first. */
  readonly role: 'primary' | 'fallback';
}

export const FACES: readonly ShippedFace[] = [
  {
    family: 'JetBrains Mono',
    dir: 'jetbrains-mono',
    source: 'JetBrainsMono-Regular.ttf',
    out: 'jetbrains-mono-subset-400.woff2',
    role: 'primary',
  },
  {
    family: 'DejaVu Sans Mono',
    dir: 'dejavu-sans-mono',
    source: 'DejaVuSansMono.ttf',
    out: 'dejavu-sans-mono-subset-400.woff2',
    role: 'fallback',
  },
];

/** The font stack every consumer names — the shipped faces, primary first,
 *  each quoted for CSS / canvas `font` strings (`'JetBrains Mono', 'DejaVu
 *  Sans Mono'`). The sheet's `--font-mono` appends the generic tail. */
export const FONT_STACK = FACES.map((face) => `'${face.family}'`).join(', ');
