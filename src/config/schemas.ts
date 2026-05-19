/**
 * Shared zod helpers for config validation. Kept here rather than
 * inlined per loader because (a) `RangeSchema` is the common shape for
 * every "low/high stat band" and pulling it into one place keeps the
 * refinement (low <= high) consistent, and (b) one import surface for
 * future extensions (Tuple3, optional range, etc).
 */

import { z } from 'zod';

export const RangeSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lo, hi]) => lo <= hi, {
    message: 'range must be [low, high] with low <= high',
  });

export type Range = z.infer<typeof RangeSchema>;
