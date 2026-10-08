/**
 * 117c — `--escalation=<n>` exposes the RunConfig Escalation level to run
 * mode. What a level does is pinned at the Run and at the ladder
 * (Run.test.ts, src/config/escalation.test.ts); the runConfig wiring is the
 * long-proven --hops path. So the surface here is the parse, the one thing
 * that sets this dial apart from its neighbours (it is legal with
 * --arbitrate), and the result field run mode counts the level from.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';
import { runOne } from '../harness';
import { makeStrategy } from '../strategies/registry';
import { ESCALATION_MAX } from '../../../src/config/escalation';

describe('--escalation (117c)', () => {
  it('parses a numeric value and stays unset when absent', () => {
    expect(parseArgs(['--escalation=3']).escalation).toBe(3);
    expect(parseArgs(['--escalation=0']).escalation).toBe(0);
    expect(parseArgs(['--count=5']).escalation).toBeUndefined();
    // A bare flag stays unset; run.ts's range check owns rejecting a value
    // that is not a level.
    expect(parseArgs(['--escalation']).escalation).toBeUndefined();
  });

  it('is legal with --arbitrate, where a probe dial beside it is still refused', () => {
    // The level is in the run's snapshot, so a rollout clone plays at it; the
    // probe dials ride the config alone and a clone drops them.
    expect(parseArgs(['--arbitrate', '--escalation=3']).escalation).toBe(3);
    expect(() => parseArgs(['--arbitrate', '--escalation=3', '--draw-add=1'])).toThrow(
      /refused with --draw-add/,
    );
  });
});

describe('the level a run was played at, in its result (117c)', () => {
  const strat = () => makeStrategy('greedy')!;
  const SHORT = { hopCount: 3 } as const;

  it('is read from the run: 0 with no level, the level with one', () => {
    expect(runOne(3, strat(), { runConfig: SHORT }).escalation).toBe(0);
    expect(runOne(3, strat(), { runConfig: { ...SHORT, escalation: ESCALATION_MAX } }).escalation).toBe(
      ESCALATION_MAX,
    );
  });

  it('a level is live in the harness: the same seeds play out differently at the top level', () => {
    const differs = [1, 2, 3, 4].some((seed) => {
      const off = runOne(seed, strat(), { runConfig: SHORT });
      const top = runOne(seed, strat(), { runConfig: { ...SHORT, escalation: ESCALATION_MAX } });
      return off.totalTicks !== top.totalTicks || off.outcome !== top.outcome;
    });
    expect(differs).toBe(true);
  });
});
