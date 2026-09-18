/**
 * §101b — a minimal sfnt vertical-metrics reader (`head` · `hhea` · `OS/2`),
 * the sibling of ttfCmap.ts. It exists for ONE pin
 * (tests/font-coverage.test.ts): a shipped FALLBACK face must fit INSIDE the
 * primary's line box.
 *
 * Why that is the rule. A line's height under `line-height: normal` follows
 * the TALLEST face that paints a glyph on it, so a fallback whose ascent or
 * descent exceeds the primary's grows every line it touches — the §101
 * layout class (an OS face's taller ascent made the cache chip 46px to the
 * bits chip's 45). The obvious belt — an explicit `line-height` on `#ui` —
 * was probed at 101b and REJECTED: browsers round `normal`'s ascent and
 * descent to whole pixels per font-size while a multiplier does not, so
 * `line-height: 1.32` (the primary's own normal) moved 19 of 65 text leaves
 * on the map by up to 1.5px and made the chips 45.75px. The structural guard
 * is this one, on the path where the mistake happens — adding or upgrading a
 * face — and it costs the sheet nothing.
 *
 * Browsers disagree on WHICH table they read (hhea on macOS; OS/2 win, or
 * typo under USE_TYPO_METRICS, on Windows), so the pin checks all three.
 * Values are normalized by unitsPerEm. DataView-based, no dependency.
 */

export interface VerticalMetrics {
  readonly unitsPerEm: number;
  /** Each pair is [ascent, descent] as POSITIVE em fractions. */
  readonly hhea: readonly [number, number];
  readonly typo: readonly [number, number];
  readonly win: readonly [number, number];
  /** The `normal` line per table, in ems (ascent + descent + line gap). */
  readonly hheaLine: number;
  readonly typoLine: number;
}

export function ttfVerticalMetrics(bytes: Uint8Array): VerticalMetrics {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = dv.getUint16(4);
  const offsets = new Map<string, number>();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(bytes[rec]!, bytes[rec + 1]!, bytes[rec + 2]!, bytes[rec + 3]!);
    offsets.set(tag, dv.getUint32(rec + 8));
  }
  const need = (tag: string): number => {
    const off = offsets.get(tag);
    if (off === undefined) throw new Error(`ttfVerticalMetrics: font has no ${tag} table`);
    return off;
  };
  const upm = dv.getUint16(need('head') + 18);
  const hhea = need('hhea');
  const os2 = need('OS/2');
  const em = (v: number): number => v / upm;

  const hAsc = em(dv.getInt16(hhea + 4));
  const hDesc = em(-dv.getInt16(hhea + 6));
  const hGap = em(dv.getInt16(hhea + 8));
  const tAsc = em(dv.getInt16(os2 + 68));
  const tDesc = em(-dv.getInt16(os2 + 70));
  const tGap = em(dv.getInt16(os2 + 72));
  const wAsc = em(dv.getUint16(os2 + 74));
  const wDesc = em(dv.getUint16(os2 + 76));

  return {
    unitsPerEm: upm,
    hhea: [hAsc, hDesc],
    typo: [tAsc, tDesc],
    win: [wAsc, wDesc],
    hheaLine: hAsc + hDesc + hGap,
    typoLine: tAsc + tDesc + tGap,
  };
}
