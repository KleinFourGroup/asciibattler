/**
 * §35d — the occupancy invariant across the fuzz corpus. Opt-in
 * (`npm run fuzz:smoke`). Drives full runs with the harness's `assertOccupancy`
 * flag on, which checks "no two units share a cell (per plane)" after EVERY
 * battle tick and throws on the first breach (with seed + tick + cell). The
 * corpus-wide generalization of the Qb#3 same-cell corridor fixture: where that
 * pins one hand-built scenario, this exercises the invariant across hundreds of
 * thousands of ticks of varied combat (movement, summons, chains, shoves), so a
 * future change that reopens a same-cell overlap window breaks the smoke instead
 * of slipping through.
 *
 * Two strategies for breadth: `greedy` plays to completion (long battles, real
 * pathing pressure), `pure-random` fields chaotic teams (more movement churn).
 */

import { describe, it, expect } from 'vitest';
import { runMany } from './harness';
import { makeStrategy } from './strategies/registry';

describe('§35d — occupancy invariant (no two units share a cell)', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => i + 1);

  // 180s budgets (were 60s): §45's cooperation changes shifted greedy-run
  // TRAJECTORIES (several seeds now run materially deeper/longer — sim
  // content, not compute: per-tick cost measured +~1% on equal seeds during
  // the §45c perf probe; the 43a timeout precedent). §46b's balance
  // spot-check owns the outcome-drift question this hints at.
  it('holds across a greedy corpus', () => {
    expect(() => runMany(seeds, makeStrategy('greedy')!, { assertOccupancy: true })).not.toThrow();
  }, 180000);

  it('holds across a pure-random corpus', () => {
    expect(() =>
      runMany(seeds, makeStrategy('pure-random')!, { assertOccupancy: true }),
    ).not.toThrow();
  }, 180000);
});
