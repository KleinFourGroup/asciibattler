/**
 * Shared scored-policy plumbing: the min–max normalization primitives every
 * linear "weighted sum of normalized features → argmax" policy uses, plus the
 * vocabulary-tracking zod record-schema helper their weight vectors share.
 *
 * Extracted from `strategies/scored.ts` / `strategies/scoredWeights.ts` (H7a,
 * where the pattern was born for recruitment) when the scored OBJECTIVE
 * proclivity arrived (K3c3) — the redraw policy reuses these too. Pure math +
 * schema helpers only; each consumer owns its feature extraction.
 */

import { z } from 'zod';

export interface MinMax {
  readonly mn: number;
  readonly mx: number;
}

export function minMax(values: readonly number[]): MinMax {
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of values) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return { mn, mx };
}

/** Min–max to [0,1]; degenerate (max == min) → 0 so the term simply drops out. */
export function norm(v: number, { mn, mx }: MinMax): number {
  return mx > mn ? (v - mn) / (mx - mn) : 0;
}

/** A strict zod object of `number` fields, one per supplied key — built from a
 *  live constant so the schema tracks the vocabulary automatically. */
export function numberRecordSchema<K extends string>(keys: readonly K[]) {
  const shape = Object.fromEntries(keys.map((k) => [k, z.number()])) as Record<
    K,
    z.ZodNumber
  >;
  return z.strictObject(shape);
}
