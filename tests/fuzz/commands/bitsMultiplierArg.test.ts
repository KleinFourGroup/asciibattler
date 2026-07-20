/**
 * 60c — `--bits-multiplier=<f>` exposes the 48f RunConfig lever to run mode
 * (the economy lever sweeps at the fixed operating point). The lever's
 * behavior is pinned at Run level (Run.test.ts §48f: gainBits scaling +
 * the multiplicative bitsGain-fold stack); runConfig passthrough is the
 * long-proven --hops path — so the new surface here is only the parse.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--bits-multiplier (60c)', () => {
  it('parses a numeric value and stays unset when absent', () => {
    expect(parseArgs(['--bits-multiplier=1.5']).bitsMultiplier).toBe(1.5);
    expect(parseArgs(['--count=5']).bitsMultiplier).toBeUndefined();
    // Bare flag (no value) stays unset — run.ts's positive-finite guard
    // owns rejecting explicit garbage values at dispatch.
    expect(parseArgs(['--bits-multiplier']).bitsMultiplier).toBeUndefined();
  });
});
