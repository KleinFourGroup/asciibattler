/**
 * §57f — the harness rollout-searcher arm. The load-bearing guarantee (the
 * 54a shape): an absent / `false` / empty-registry arm changes NOTHING —
 * byte-identical no-op parity, so every baseline and frozen anchor is
 * untouched unless `rolloutSearch` opts in. Plus: the wiring is LIVE
 * end-to-end (a forced-commit config diverges runs — without this, a dead
 * branch would hide until 57g), determinism under an active searcher, and
 * the frozen-anchor mutual-exclusion throws against all three other arms.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import type { TrafficScript } from '../../src/bot/TrafficScriptDriver';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 4 } } as const;

/** Always-nominating hold — with a forced-negative ε every search commits,
 *  so liveness is guaranteed rather than luck-dependent. */
const HOLD_ALWAYS: TrafficScript = {
  id: 'test-hold-always',
  evaluate: () => ({ mode: 'hold' }),
};

describe('harness rollout-searcher arm (57f)', () => {
  it('an explicit empty nominator registry is byte-identical to no arm at all', () => {
    const a = runOne(7, strat(), SHORT);
    const b = runOne(7, strat(), { ...SHORT, rolloutSearch: { scripts: [] } });
    expect(b).toEqual(a);
  });

  it('false is byte-identical to absent', () => {
    const a = runOne(11, strat(), SHORT);
    const b = runOne(11, strat(), { ...SHORT, rolloutSearch: false });
    expect(b).toEqual(a);
  });

  it('is deterministic for the same seed under the default dials', () => {
    const opts = { ...SHORT, rolloutSearch: true } as const;
    const a = runOne(3, strat(), opts);
    const b = runOne(3, strat(), opts);
    expect(b).toEqual(a);
  });

  it('the wiring is live end-to-end: a forced-commit config diverges runs', () => {
    // ε = -1000 makes every search commit its best challenger (hold), so
    // the searcher steers every battle — at least one run in the band must
    // diverge in ticks or outcome.
    const differs = [1, 2, 3, 4, 5, 6].some((s) => {
      const base = runOne(s, strat(), SHORT);
      const steered = runOne(s, strat(), {
        ...SHORT,
        rolloutSearch: { scripts: [HOLD_ALWAYS], epsilon: -1000 },
      });
      return base.totalTicks !== steered.totalTicks || base.outcome !== steered.outcome;
    });
    expect(differs).toBe(true);
  });

  it('throws when combined with any other bot arm (the frozen-anchor contract)', () => {
    expect(() =>
      runOne(1, strat(), { ...SHORT, rolloutSearch: true, objective: { kind: 'random' } }),
    ).toThrow(/mutually exclusive/);
    expect(() =>
      runOne(1, strat(), { ...SHORT, rolloutSearch: true, trafficScripts: true }),
    ).toThrow(/mutually exclusive/);
    expect(() =>
      runOne(1, strat(), { ...SHORT, rolloutSearch: true, coverageObjectives: true }),
    ).toThrow(/mutually exclusive/);
  });
});
