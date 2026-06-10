/**
 * J4 commit 2 — the harness objective injection. The load-bearing guarantee is
 * that a `none` / absent objective is BYTE-IDENTICAL to the pre-J4 run path (so
 * the existing fuzz + balance baselines are untouched unless `--objective` opts
 * in); plus determinism under an active objective, and proof the injection is
 * actually live (not inert) end-to-end through the harness.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import type { ObjectiveProclivity } from './objectiveStrategy';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { floorCount: 4 } } as const;

describe('harness objective injection (J4)', () => {
  it('a none objective is byte-identical to no objective at all', () => {
    const a = runOne(3, strat(), SHORT);
    const b = runOne(3, strat(), { ...SHORT, objective: { kind: 'none' } });
    expect(b).toEqual(a);
  });

  it('is deterministic for the same seed + active objective', () => {
    const obj: ObjectiveProclivity = { kind: 'hp', select: 'lowest' };
    const a = runOne(5, strat(), { ...SHORT, objective: obj });
    const b = runOne(5, strat(), { ...SHORT, objective: obj });
    expect(a).toEqual(b);
  });

  it('an active objective is live — it changes at least one run vs none', () => {
    // The arena already shows the win-rate gradient; this just guards that the
    // wiring actually reaches the battle loop. Focus-firing the lowest-HP enemy
    // re-orders combat vs default nearest-targeting, so over a small seed band
    // at least one run diverges in tick count / outcome.
    const obj: ObjectiveProclivity = { kind: 'hp', select: 'lowest' };
    const differs = [1, 2, 3, 4, 5, 6].some((s) => {
      const none = runOne(s, strat(), SHORT);
      const withObj = runOne(s, strat(), { ...SHORT, objective: obj });
      return none.totalTicks !== withObj.totalTicks || none.outcome !== withObj.outcome;
    });
    expect(differs).toBe(true);
  });
});
