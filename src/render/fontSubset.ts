/**
 * The faces we ship and the codepoint ranges their subsets keep.
 * (i18n-ok-file: a build table — the labels are never rendered.)
 *
 * Kept apart from `scripts/build-font.mjs` so the coverage guard
 * (`tests/font-coverage.test.ts`) and the renderer (`FontAtlas`'s font
 * stack) import them without running the generator, whose own checks run
 * only when someone runs gen:font. The test makes the contract structural:
 * a catalog glyph or a UI glyph outside the shipped subsets fails `npm test`
 * instead of falling to an OS face, which on the canvas moves the click boxes
 * and lifts on someone else's machine, and in the DOM grows a line box with
 * its taller ascent.
 *
 * Two faces: JetBrains Mono is the primary and supplies every glyph it has;
 * DejaVu Sans Mono is the one shipped fallback, its subset keeping only what
 * the primary lacks inside SUBSET_RANGES, so a glyph the primary can't paint
 * still comes from a face we ship: the same letterform on every machine, and
 * a line box that never grows (the fallback's ascent and descent, 0.93 / 0.24
 * of the em in hhea and win, sit inside the primary's 1.02 / 0.30, which the
 * guard test pins; its 0.602 advance matches the primary's 0.600 cell). The
 * CSS `font-family` chain and
 * the atlas's `ctx.font` both use FONT_STACK, so the DOM and the atlas share
 * one provenance rule.
 *
 * The ranges are whole blocks, not the glyphs in use, so a new glyph inside a
 * kept block needs no regeneration. Upstream, JetBrains covers ASCII,
 * Latin-1, box drawing and the blocks whole, and every other block in part;
 * the fallback fills the rest where DejaVu has it, and the guard test, not
 * this table, says whether a codepoint is shipped.
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
 * Codepoints the primary face carries but draws wrong, so the generator drops
 * them from its subset and the fallback supplies them. JetBrains Mono 2.304
 * has U+229E SQUARED PLUS and U+22A0 SQUARED TIMES swapped (its ⊞ paints a
 * boxed X, its ⊠ a boxed plus): a drawing error in the vendored TTF, whose
 * cmap and `post` names (`uni229E`, `uni22A0`) are right and whose outlines
 * under them are each other's, known upstream as JetBrains/JetBrainsMono#676.
 * A swap search over the 338 codepoints both faces carry (ink-normalized
 * density grids, JetBrains against DejaVu) found this pair and only this
 * pair. The guard test counts them as missing from the primary, so one in
 * use must come from the fallback. Empty the list
 * only on a vendored release that fixes the pair, after the swap search is
 * run again.
 */
export const PRIMARY_EXCLUDES: readonly number[] = [0x229e, 0x22a0];

/** One shipped face: a vendored source TTF under `assets/fonts/<dir>/`, the
 *  woff2 the generator writes beside it, and the CSS family name. */
interface ShippedFace {
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
