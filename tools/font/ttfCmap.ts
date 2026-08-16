/**
 * §79-post — a minimal TTF cmap reader (formats 4 and 12), shared by
 * `scripts/build-font.mjs` (the gen:font hard gate) and
 * `tests/font-coverage.test.ts` (the every-`npm test` guard), so both can
 * PROVE the vendored source font carries a codepoint instead of discovering a
 * gap at runtime as an OS fallback. Ported from the §79g inline version;
 * DataView-based (no Buffer) so the module carries no node type dependency.
 * No dependency worth taking for ~50 lines.
 */

/** Returns a lookup: does the font's best cmap subtable map `codePoint`? */
export function ttfCmapLookup(bytes: Uint8Array): (codePoint: number) => boolean {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (off: number): string =>
    String.fromCharCode(bytes[off]!, bytes[off + 1]!, bytes[off + 2]!, bytes[off + 3]!);

  const numTables = dv.getUint16(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (tag(rec) === 'cmap') cmap = dv.getUint32(rec + 8);
  }
  if (cmap < 0) throw new Error('ttfCmapLookup: font has no cmap table');

  // Prefer the full-Unicode subtable (3,10), then Windows BMP (3,1), then any
  // Unicode-platform table.
  let best = -1;
  let bestScore = -1;
  const n = dv.getUint16(cmap + 2);
  for (let i = 0; i < n; i++) {
    const rec = cmap + 4 + i * 8;
    const plat = dv.getUint16(rec);
    const enc = dv.getUint16(rec + 2);
    const score = plat === 3 && enc === 10 ? 3 : plat === 3 && enc === 1 ? 2 : plat === 0 ? 1 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = cmap + dv.getUint32(rec + 4);
    }
  }
  const format = dv.getUint16(best);

  return (cp: number): boolean => {
    if (format === 12) {
      const groups = dv.getUint32(best + 12);
      for (let i = 0; i < groups; i++) {
        const g = best + 16 + i * 12;
        if (cp >= dv.getUint32(g) && cp <= dv.getUint32(g + 4)) return true;
      }
      return false;
    }
    // Format 4 — BMP only.
    if (cp > 0xffff) return false;
    const segX2 = dv.getUint16(best + 6);
    const ends = best + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      if (dv.getUint16(ends + s) < cp) continue;
      if (dv.getUint16(starts + s) > cp) return false;
      const ro = dv.getUint16(ranges + s);
      if (ro === 0) return ((cp + dv.getInt16(deltas + s)) & 0xffff) !== 0;
      const gi = dv.getUint16(ranges + s + ro + (cp - dv.getUint16(starts + s)) * 2);
      return gi !== 0;
    }
    return false;
  };
}
