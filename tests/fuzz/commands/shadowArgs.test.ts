/**
 * 84c — `--shadow-horizon[=run|N]` + `--shadow-sample=<m>` expose the §84
 * long-horizon shadow instrument to run mode. The driver-level behavior is
 * pinned in driver.test.ts (84a/84c); the surface here is the parse + the
 * guards — arbitrate-only, a legal horizon, the 84b run-shape refusal, and
 * a positive integer sample that needs the horizon.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('--shadow-horizon / --shadow-sample (84c)', () => {
  it('parses: bare = run; a battle count; the sample', () => {
    expect(parseArgs(['--arbitrate', '--shadow-horizon']).shadowHorizon).toBe('run');
    expect(parseArgs(['--arbitrate', '--shadow-horizon=run']).shadowHorizon).toBe('run');
    expect(parseArgs(['--arbitrate', '--shadow-horizon=3']).shadowHorizon).toBe('3');
    const a = parseArgs(['--arbitrate', '--shadow-horizon', '--shadow-sample=4']);
    expect(a.shadowSample).toBe(4);
    expect(parseArgs(['--arbitrate']).shadowHorizon).toBeUndefined();
  });

  it('requires --arbitrate and a legal horizon', () => {
    expect(() => parseArgs(['--shadow-horizon'])).toThrow(/requires --arbitrate/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon=0'])).toThrow(/'run' or an integer/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon=abc'])).toThrow(/'run' or an integer/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon=1.5'])).toThrow(/'run' or an integer/);
  });

  it('REFUSES the run-shape probes (the 84b finding: clones drop both dials)', () => {
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--hops=11'])).toThrow(/refused with --hops/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--sector-hops=2'])).toThrow(
      /refused with --hops/,
    );
    // The plain arbitrated probe shapes stay legal — the refusal is the shadow's.
    expect(parseArgs(['--arbitrate', '--hops=11']).hops).toBe(11);
  });

  it('the sample needs the horizon and is a positive integer', () => {
    expect(() => parseArgs(['--arbitrate', '--shadow-sample=3'])).toThrow(/requires --shadow-horizon/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--shadow-sample=0'])).toThrow(/integer ≥ 1/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--shadow-sample=1.5'])).toThrow(/integer ≥ 1/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--shadow-sample=x'])).toThrow(/integer ≥ 1/);
  });
});
