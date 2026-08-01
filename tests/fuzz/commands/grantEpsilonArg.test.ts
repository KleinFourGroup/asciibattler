/**
 * 71d — `--grant-epsilon=<f>` exposes the arm's `grantEpsilon` override to
 * run mode: the ablation dial for the free-action gate diagnosis (WORKLOG
 * §71). The override's behavior is pinned at driver level (the per-call ε
 * override test, 69e) and arbitrateGrant threads it verbatim — the new
 * surface here is only the parse + guards.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--grant-epsilon (71d)', () => {
  it('parses a numeric value alongside --arbitrate; unset when absent', () => {
    expect(parseArgs(['--arbitrate', '--grant-epsilon=0']).grantEpsilon).toBe(0);
    expect(parseArgs(['--arbitrate', '--grant-epsilon=1.5']).grantEpsilon).toBe(1.5);
    expect(parseArgs(['--arbitrate']).grantEpsilon).toBeUndefined();
    // Bare flag (no value) stays unset — the pinned floor applies.
    expect(parseArgs(['--arbitrate', '--grant-epsilon']).grantEpsilon).toBeUndefined();
  });

  it('rejects use without --arbitrate, and negative or non-finite values', () => {
    expect(() => parseArgs(['--grant-epsilon=0'])).toThrow(/requires --arbitrate/);
    expect(() => parseArgs(['--arbitrate', '--grant-epsilon=-1'])).toThrow(/finite number/);
    expect(() => parseArgs(['--arbitrate', '--grant-epsilon=abc'])).toThrow(/finite number/);
  });
});
