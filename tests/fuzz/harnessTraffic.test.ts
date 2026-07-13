/**
 * 54a — the harness traffic-scripts arm. The load-bearing guarantee (the
 * phase exit criterion) is BYTE-IDENTICAL NO-OP PARITY: an absent / `false` /
 * empty-registry arm changes nothing, so every existing fuzz + balance
 * baseline — and the frozen anchors — are untouched unless `trafficScripts`
 * opts in. Plus: the wiring is LIVE end-to-end (a stub script changes runs —
 * without this, a dead branch would hide until 54d), determinism under an
 * active registry, and the frozen-anchor mutual-exclusion throw.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import type { TrafficScript } from '../../src/bot/TrafficScriptDriver';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 4 } } as const;

/** Always-triggered hold — the crudest possible steer; liveness only. */
const HOLD_EVERYTHING: TrafficScript = {
  id: 'test-hold-everything',
  evaluate: () => ({ mode: 'hold' }),
};

describe('harness traffic-scripts arm (54a; parity re-pinned at 54d)', () => {
  // 54d amendment (deliberate): the standard registry stopped being empty
  // when terrain-edge hold landed, so `trafficScripts: true` is the LIVE bot
  // now. The no-op parity contract survives on the arm mechanism itself:
  // absent / false / explicit-EMPTY-registry are byte-identical.
  it('an explicit empty registry is byte-identical to no arm at all', () => {
    const a = runOne(7, strat(), SHORT);
    const b = runOne(7, strat(), { ...SHORT, trafficScripts: [] });
    expect(b).toEqual(a);
  });

  it('the standard registry (live since 54d) is deterministic for the same seed', () => {
    const a = runOne(3, strat(), { ...SHORT, trafficScripts: true });
    const b = runOne(3, strat(), { ...SHORT, trafficScripts: true });
    expect(b).toEqual(a);
  });

  it('is deterministic for the same seed + an active script', () => {
    const opts = { ...SHORT, trafficScripts: [HOLD_EVERYTHING] };
    const a = runOne(5, strat(), opts);
    const b = runOne(5, strat(), opts);
    expect(a).toEqual(b);
  });

  it('the wiring is live — an active script changes at least one run', () => {
    // Holding the whole player team every battle is a drastic steer; over a
    // small seed band at least one run must diverge in ticks / outcome.
    const differs = [1, 2, 3, 4, 5, 6].some((s) => {
      const base = runOne(s, strat(), SHORT);
      const held = runOne(s, strat(), { ...SHORT, trafficScripts: [HOLD_EVERYTHING] });
      return base.totalTicks !== held.totalTicks || base.outcome !== held.outcome;
    });
    expect(differs).toBe(true);
  });

  it('throws when combined with an objective arm (the frozen-anchor contract)', () => {
    expect(() =>
      runOne(1, strat(), { ...SHORT, trafficScripts: true, objective: { kind: 'random' } }),
    ).toThrow(/mutually exclusive/);
    expect(() =>
      runOne(1, strat(), { ...SHORT, trafficScripts: true, coverageObjectives: true }),
    ).toThrow(/mutually exclusive/);
  });
});
