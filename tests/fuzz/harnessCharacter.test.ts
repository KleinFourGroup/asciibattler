/**
 * 63d — the harness character arm. The load-bearing guarantees: (1) an absent
 * selection is BYTE-IDENTICAL to the explicit Soldier (the default is explicit
 * naming, not different behavior); (2) a forced character is LIVE end-to-end
 * (a different roster reshapes battles); (3) determinism per arm.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 3 } } as const;

describe('harness character arm (63d)', () => {
  it('absent is byte-identical to the explicit soldier selection', () => {
    const bare = runOne(3, strat(), SHORT);
    const explicit = runOne(3, strat(), { ...SHORT, character: { id: 'soldier' } });
    expect(explicit).toEqual(bare);
  });

  it('a forced character is live — the priest diverges from the soldier', () => {
    // A healer in place of an archer reshapes battles; over a small seed band
    // at least one run must diverge.
    const differs = [1, 2, 3, 4].some((s) => {
      const soldier = runOne(s, strat(), SHORT);
      const priest = runOne(s, strat(), { ...SHORT, character: { id: 'priest' } });
      return soldier.totalTicks !== priest.totalTicks || soldier.outcome !== priest.outcome;
    });
    expect(differs).toBe(true);
  });

  it('is deterministic per arm', () => {
    const a = runOne(5, strat(), { ...SHORT, character: { id: 'gambler' } });
    const b = runOne(5, strat(), { ...SHORT, character: { id: 'gambler' } });
    expect(a).toEqual(b);
  });
});
