/**
 * 50g — the harness port purchase policy (the reward accept-all analog).
 * The load-bearing guarantees:
 * (1) the arm is NON-VACUOUS — a pinned seed's walk docks at a port and
 *     buys (the 47b "vacuously passes" lesson: an arm nothing exercises is
 *     indistinguishable from no arm);
 * (2) determinism — the policy makes ZERO draws of its own (every price is
 *     serialized state), so same seed ⇒ same purchases, same closing bits;
 * (3) a no-purchase run still reports coherent economy fields (the columns
 *     are unconditional, not buy-gated).
 */

import { describe, expect, it } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 4 } } as const;

describe('harness port purchase policy (50g)', () => {
  it('is non-vacuous: the pinned seed docks and buys', () => {
    // Seed pinned by a one-shot scan (worklog §50g): this walk crosses a
    // port with bits in hand. If a future engine round re-deals the streams
    // and this reads 0, re-scan and re-pin — the contract is that the ARM
    // buys, not that this particular seed does. Re-pinned 10→12 at 56a (the
    // SwapAction in-flight-partner fix re-dealt battle trajectories; scan
    // read seeds 12/15/24 buying — worklog §56a).
    const r = runOne(12, strat(), SHORT);
    expect(r.portPurchases).toBeGreaterThan(0);
  });

  it('is deterministic: same seed, same purchases, same closing bits', () => {
    const a = runOne(12, strat(), SHORT);
    const b = runOne(12, strat(), SHORT);
    expect(b).toEqual(a);
  });

  it('a run that never buys still reports coherent economy fields', () => {
    const r = runOne(1, strat(), SHORT); // scan: no dock-with-funds on this walk
    expect(r.portPurchases).toBe(0);
    expect(r.finalBits).toBeGreaterThanOrEqual(0);
  });
});
