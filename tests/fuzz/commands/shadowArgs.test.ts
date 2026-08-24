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

  // 85-pre F3 (user-signed) — the 84b class closed: Run.fromJSON drops
  // EVERY RunConfig probe dial, so an arbitrated arm may not combine with
  // one (rollouts would judge futures the dialed run cannot have).
  it('85-pre F3 — REFUSES the RunConfig probe dials with --arbitrate', () => {
    expect(() => parseArgs(['--arbitrate', '--encounter=bandit-king'])).toThrow(
      /refused with --encounter/,
    );
    expect(() => parseArgs(['--arbitrate', '--layout=arena'])).toThrow(/refused with --layout/);
    expect(() => parseArgs(['--arbitrate', '--draw-add=1'])).toThrow(/refused with --draw-add/);
    expect(() => parseArgs(['--arbitrate', '--bits-multiplier=1.5'])).toThrow(
      /refused with --bits-multiplier/,
    );
    // Scatter chances bite only at a sector TRANSITION (the start map rides
    // the clone's wire): refused on the walk shape, legal on a single-sector
    // (--hops) probe — the act-1 probe combos survive.
    expect(() => parseArgs(['--arbitrate', '--event-chance=0'])).toThrow(
      /refused with --event-chance/,
    );
    expect(parseArgs(['--arbitrate', '--hops=11', '--event-chance=0']).eventChance).toBe(0);
    // The dials stay legal without the arm.
    expect(parseArgs(['--encounter=bandit-king']).encounter).toBe('bandit-king');
  });

  it('the sample needs the horizon and is a positive integer', () => {
    expect(() => parseArgs(['--arbitrate', '--shadow-sample=3'])).toThrow(/requires --shadow-horizon/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--shadow-sample=0'])).toThrow(/integer ≥ 1/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--shadow-sample=1.5'])).toThrow(/integer ≥ 1/);
    expect(() => parseArgs(['--arbitrate', '--shadow-horizon', '--shadow-sample=x'])).toThrow(/integer ≥ 1/);
  });
});
