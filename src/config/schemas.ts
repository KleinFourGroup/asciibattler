/**
 * Zod helpers the loaders share. `RangeSchema` is the one shape for a
 * low/high band, so its check (low ≤ high) is written once.
 */

import { z } from 'zod';

export const RangeSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lo, hi]) => lo <= hi, {
    message: 'range must be [low, high] with low <= high',
  });

export type Range = z.infer<typeof RangeSchema>;
