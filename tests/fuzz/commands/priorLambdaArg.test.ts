/**
 * 85c — `--prior-lambda=<f>` exposes the fold's λ_prior board arm to run
 * mode ({0, 0.5, 1} at the §85 cohort). The fold's behavior is pinned at
 * evaluator level (priorBonusOf + the λ=0 byte-identity contract) and at
 * driver level (the 12c judgeLong strip) — the new surface here is only
 * the parse + guards, the grantEpsilonArg pattern.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--prior-lambda (85c)', () => {
  it('parses a numeric value alongside --arbitrate; unset when absent', () => {
    expect(parseArgs(['--arbitrate', '--prior-lambda=0']).priorLambda).toBe(0);
    expect(parseArgs(['--arbitrate', '--prior-lambda=0.5']).priorLambda).toBe(0.5);
    expect(parseArgs(['--arbitrate', '--prior-lambda=1']).priorLambda).toBe(1);
    expect(parseArgs(['--arbitrate']).priorLambda).toBeUndefined();
    // Bare flag (no value) stays unset — no accidental λ arm.
    expect(parseArgs(['--arbitrate', '--prior-lambda']).priorLambda).toBeUndefined();
  });

  it('rejects use without --arbitrate, and negative or non-finite values', () => {
    expect(() => parseArgs(['--prior-lambda=0.5'])).toThrow(/requires --arbitrate/);
    expect(() => parseArgs(['--arbitrate', '--prior-lambda=-0.5'])).toThrow(/finite number/);
    expect(() => parseArgs(['--arbitrate', '--prior-lambda=abc'])).toThrow(/finite number/);
  });
});
