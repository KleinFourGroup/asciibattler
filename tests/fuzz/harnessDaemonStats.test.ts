/**
 * L1c3 guarantee (5) — the per-daemon bucketing, split out of
 * `harnessDaemon.test.ts` at 73b: this single case drives 12 full 4-hop runs
 * (~74s, the whole fuzz suite's tail bound) and was pinning its old file at
 * ~136s. Same test, byte-identical assertions; only the file boundary moved.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import { perDaemonStats } from './reporters';
import { DAEMONS } from '../../src/config/daemons';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 4 } } as const;

describe('harness daemon arm (L1c3) — per-daemon bucketing', () => {
  // 12 full (4-hop) runs in one test — the heaviest case in the daemon arm. On a
  // slow machine it brushes the 5s default per-test timeout, so give it generous
  // explicit headroom (it's I/O-free CPU work). 43a — 30s → 90s: the
  // straightness tie-break re-shaped battles (findPath itself benched slightly
  // FASTER) and this test started brushing 30s under the full parallel
  // fuzz:smoke load. Duration here is sim-content, not a perf contract.
  it('perDaemonStats buckets a batch by carried idol, sorted', () => {
    // 63c — the run-start roll is retired (a default run always carries the
    // Soldier's Mars now), so the idol spread is forced per-arm: three runs
    // per idol via the fixed arm exercises the bucketing exactly as the old
    // rolled batch did (still 12 runs total).
    const results = DAEMONS.flatMap((d, i) =>
      [1, 2, 3].map((s) =>
        runOne(s + i * 3, strat(), { ...SHORT, daemon: { kind: 'fixed', id: d.id } }),
      ),
    );
    const buckets = perDaemonStats(results);
    expect(buckets.length).toBe(DAEMONS.length); // one bucket per forced idol
    const keys = buckets.map((b) => b.daemon);
    expect([...keys].sort()).toEqual(keys); // stable sorted output
    for (const k of keys) expect(DAEMONS.some((d) => d.id === k)).toBe(true);
    const total = buckets.reduce((acc, b) => acc + b.stats.totalRuns, 0);
    expect(total).toBe(results.length);
  }, 90_000);
});
