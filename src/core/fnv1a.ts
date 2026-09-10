/**
 * 32-bit FNV-1a over a string, as 8 lowercase hex chars. Not cryptographic —
 * a change-detector, not a security boundary. Two consumers with FORMAT
 * contracts on the output: the 53b config fingerprint (src/dev/configHash.ts —
 * a trace refuses a mismatched replay) and the 95e i18n provenance `source`
 * hash (src/i18n/provenance.ts — a translation whose stored hash no longer
 * matches its English is FUZZY). Changing the function or its rendering
 * would fuzzy every entry of every shipped locale at once: PERMANENT, the
 * rngStreams discipline (gotcha #125). Test vectors: src/dev/configHash.test.ts.
 */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
