/**
 * 65d — the `--draw-add` flag (the max-hand A/B dial): parse-layer pin,
 * mirroring bitsMultiplierArg.test.ts. Run mode's nonzero-integer guard
 * owns rejecting explicit garbage values at dispatch.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--draw-add (65d)', () => {
  it('parses a numeric value and stays unset when absent', () => {
    expect(parseArgs(['--draw-add=2']).drawAdd).toBe(2);
    expect(parseArgs(['--draw-add=-1']).drawAdd).toBe(-1);
    expect(parseArgs(['--count=5']).drawAdd).toBeUndefined();
    // Bare flag (no value) stays unset — run.ts's nonzero-integer guard
    // owns rejecting explicit garbage values at dispatch.
    expect(parseArgs(['--draw-add']).drawAdd).toBeUndefined();
  });
});
