/**
 * 32-bit FNV-1a over a string, as 8 lowercase hex characters. A change
 * detector, not a security boundary.
 *
 * Its output is stored, so the function and its rendering are permanent,
 * as the RNG stream keys are (gotcha #125): the config fingerprint a trace
 * is refused on (`src/config/configHash.ts`); the source hash on each
 * translation (`src/i18n/provenance.ts`), where a changed hash would mark
 * every entry of every shipped locale fuzzy; and the snapshot hash a
 * journal stamps at a segment's end (`src/journal/journal.ts`). The test
 * vectors are in `src/config/configHash.test.ts`.
 */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
