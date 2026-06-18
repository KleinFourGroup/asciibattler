/**
 * K4 commit 3 — the harness empower injection. The load-bearing guarantees:
 * (1) a `none` / absent policy is BYTE-IDENTICAL to the pre-K4c3 run path
 * (gates stay off — the existing fuzz + balance baselines are untouched unless
 * `--empower` opts in); (2) determinism under a live policy; (3) the injection
 * is actually live end-to-end; (4) it composes with the K3c3 redraw bot at the
 * same gate. (The gates-on ≡ headless alignment itself is pinned by the K3c3
 * `level:0` control in harnessRedraw.test.ts — empower rides the same gate
 * path, so it isn't re-proven here.)
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import type { EmpowerPolicy } from './empowerPolicy';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 4 } } as const;
const CARRY: EmpowerPolicy = { kind: 'level', dir: 'hi' };

describe('harness empower injection (K4c3)', () => {
  it('a none policy is byte-identical to no policy at all (gates stay off)', () => {
    const a = runOne(3, strat(), SHORT);
    const b = runOne(3, strat(), { ...SHORT, empower: { kind: 'none' } });
    expect(b).toEqual(a);
  });

  it('is deterministic for the same seed + active policy (incl. the random kind)', () => {
    const policy: EmpowerPolicy = { kind: 'random' };
    const a = runOne(5, strat(), { ...SHORT, empower: policy });
    const b = runOne(5, strat(), { ...SHORT, empower: policy });
    expect(a).toEqual(b);
  });

  it('an active policy is live — it changes at least one run vs none', () => {
    // A +4/+4/+4 buff on the carry every turn shifts battles; over a small
    // seed band at least one run must diverge.
    const differs = [1, 2, 3, 4, 5, 6].some((s) => {
      const none = runOne(s, strat(), SHORT);
      const withEmpower = runOne(s, strat(), { ...SHORT, empower: CARRY });
      return none.totalTicks !== withEmpower.totalTicks || none.outcome !== withEmpower.outcome;
    });
    expect(differs).toBe(true);
  });

  it('composes with the redraw bot at the same gate, deterministically', () => {
    const opts = {
      ...SHORT,
      redraw: { kind: 'level', cards: 2 } as const,
      empower: CARRY,
    };
    const a = runOne(7, strat(), opts);
    const b = runOne(7, strat(), opts);
    expect(a).toEqual(b);
    // And the composition differs from redraw-alone on at least one seed
    // (the empower bot did something on top).
    const differs = [1, 2, 3, 4, 5, 6].some((s) => {
      const redrawOnly = runOne(s, strat(), { ...SHORT, redraw: opts.redraw });
      const both = runOne(s, strat(), opts);
      return redrawOnly.totalTicks !== both.totalTicks || redrawOnly.outcome !== both.outcome;
    });
    expect(differs).toBe(true);
  });
});
