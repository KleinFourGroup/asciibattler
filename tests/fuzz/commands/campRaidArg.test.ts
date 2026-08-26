/**
 * 85g6a — `--camp-raid=off|on` exposes the campRaid causal-arm dial to run
 * mode (the enabled-vs-disabled pair of the §85g6 cohort). The site's
 * behavior is pinned in arbitratedStrategy.test.ts (off = the site OMITTED,
 * the pre-85d ABSENT-never-raids contract) — the new surface here is only
 * the parse + guards, the priorLambdaArg pattern.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--camp-raid (85g6a)', () => {
  it('parses on|off alongside --arbitrate; unset when absent', () => {
    expect(parseArgs(['--arbitrate', '--camp-raid=off']).campRaid).toBe('off');
    expect(parseArgs(['--arbitrate', '--camp-raid=on']).campRaid).toBe('on');
    expect(parseArgs(['--arbitrate']).campRaid).toBeUndefined();
    // Bare flag (no value) stays unset — no accidental ablation arm.
    expect(parseArgs(['--arbitrate', '--camp-raid']).campRaid).toBeUndefined();
  });

  it('rejects use without --arbitrate, and any value beyond on|off (the 70a labeling discipline)', () => {
    expect(() => parseArgs(['--camp-raid=off'])).toThrow(/requires --arbitrate/);
    expect(() => parseArgs(['--arbitrate', '--camp-raid=disabled'])).toThrow(/must be on\|off/);
    expect(() => parseArgs(['--arbitrate', '--camp-raid=0'])).toThrow(/must be on\|off/);
  });

  it('is refused with --search (a run-mode ablation dial, the 85g3 instrument class)', () => {
    expect(() => parseArgs(['--search', '--arbitrate', '--camp-raid=off'])).toThrow(
      /run-mode ablation dial/,
    );
  });
});
