/**
 * K3 commit 3 — the harness redraw injection. The load-bearing guarantees:
 * (1) a `none` / absent policy is BYTE-IDENTICAL to the pre-K3c3 run path
 * (gates stay off — the existing fuzz + balance baselines are untouched unless
 * `--redraw` opts in); (2) the GATES-ON CONTROL — `level:0` flips the gated
 * turn path on but never tosses a card, and the run is STILL byte-identical,
 * pinning H4b's "the gated path is RNG-aligned with the headless path" through
 * the whole harness; (3) determinism under a live policy; (4) the injection is
 * actually live end-to-end.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import type { RedrawPolicy } from './redrawPolicy';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { floorCount: 4 } } as const;

describe('harness redraw injection (K3c3)', () => {
  it('a none policy is byte-identical to no policy at all (gates stay off)', () => {
    const a = runOne(3, strat(), SHORT);
    const b = runOne(3, strat(), { ...SHORT, redraw: { kind: 'none' } });
    expect(b).toEqual(a);
  });

  it('GATES-ON CONTROL: level:0 (gates on, zero tosses) is byte-identical to headless', () => {
    // This is the H4b alignment invariant surfaced through the harness: the
    // gated turn path (turn-intro → advanceTurn → battle → turn-outcome →
    // advanceTurn) must reproduce the straight-through headless path exactly
    // when no card is ever redrawn. If this breaks, every live-policy read is
    // confounded by gate-path drift rather than redraw effect.
    const control: RedrawPolicy = { kind: 'level', cards: 0 };
    for (const seed of [1, 2, 3]) {
      const headless = runOne(seed, strat(), SHORT);
      const gated = runOne(seed, strat(), { ...SHORT, redraw: control });
      expect(gated).toEqual(headless);
    }
  });

  it('is deterministic for the same seed + active policy (incl. the random kind)', () => {
    const policy: RedrawPolicy = { kind: 'random', cards: 3 };
    const a = runOne(5, strat(), { ...SHORT, redraw: policy });
    const b = runOne(5, strat(), { ...SHORT, redraw: policy });
    expect(a).toEqual(b);
  });

  it('an active policy is live — it changes at least one run vs none', () => {
    // Tossing the whole hand every turn re-fields different cards, which
    // shifts battles; over a small seed band at least one run must diverge.
    const policy: RedrawPolicy = { kind: 'level', cards: 6 };
    const differs = [1, 2, 3, 4, 5, 6].some((s) => {
      const none = runOne(s, strat(), SHORT);
      const withRedraw = runOne(s, strat(), { ...SHORT, redraw: policy });
      return none.totalTicks !== withRedraw.totalTicks || none.outcome !== withRedraw.outcome;
    });
    expect(differs).toBe(true);
  });
});
