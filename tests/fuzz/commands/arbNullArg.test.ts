/**
 * 150e — `--arb-null=pass|nominee` exposes the null-arm dial of the grant and
 * fire sites to run mode. The sites' behavior is pinned in
 * arbitratedStrategy.test.ts; the new surface here is only the parse and the
 * guards, the campRaidArg pattern.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--arb-null (150e)', () => {
  it('parses pass|nominee alongside --arbitrate; unset when absent', () => {
    expect(parseArgs(['--arbitrate', '--arb-null=nominee']).arbNull).toBe('nominee');
    expect(parseArgs(['--arbitrate', '--arb-null=pass']).arbNull).toBe('pass');
    expect(parseArgs(['--arbitrate']).arbNull).toBeUndefined();
    // A bare flag (no value) stays unset: no arm runs under a label it lacks.
    expect(parseArgs(['--arbitrate', '--arb-null']).arbNull).toBeUndefined();
  });

  it('rejects use without --arbitrate, and any value beyond pass|nominee', () => {
    expect(() => parseArgs(['--arb-null=nominee'])).toThrow(/requires --arbitrate/);
    expect(() => parseArgs(['--arbitrate', '--arb-null=doctrine'])).toThrow(/must be pass\|nominee/);
  });

  it('is refused with --search (a run-mode dial)', () => {
    expect(() => parseArgs(['--search', '--arbitrate', '--arb-null=nominee'])).toThrow(/run-mode dial/);
  });
});
