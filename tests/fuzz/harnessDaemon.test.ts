/**
 * L1c3 — the harness daemon arm. The load-bearing guarantees:
 * (1) `random` is BYTE-IDENTICAL to the flag being absent (the Run's own roll
 * IS the default — the existing baselines already carry it); (2) `none`
 * forces the daemon-less control arm and `fixed` forces one idol, visible in
 * `RunResult.daemonId`; (3) determinism per arm (incl. Mercury's per-turn
 * coin); (4) the arm is LIVE — with a redraw bot active, a redraw idol
 * diverges from the daemon-less control. Guarantee (5) — the per-daemon
 * bucketing — lives in `harnessDaemonStats.test.ts` (split at 73b: its 12
 * full runs are the suite's tail bound).
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import { DAEMONS } from '../../src/config/daemons';
import type { RedrawPolicy } from './redrawPolicy';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 4 } } as const;

describe('harness daemon arm (L1c3)', () => {
  it('random is byte-identical to no daemon option at all (the roll is the default)', () => {
    const a = runOne(3, strat(), SHORT);
    const b = runOne(3, strat(), { ...SHORT, daemon: { kind: 'random' } });
    expect(b).toEqual(a);
    expect(a.daemonId).not.toBeNull(); // the default run DOES carry an idol
  });

  it('none forces the daemon-less control arm on every run', () => {
    for (const seed of [1, 2, 3]) {
      const r = runOne(seed, strat(), { ...SHORT, daemon: { kind: 'none' } });
      expect(r.daemonId).toBeNull();
    }
  });

  it('fixed forces the chosen idol on every run', () => {
    for (const d of DAEMONS) {
      const r = runOne(2, strat(), { ...SHORT, daemon: { kind: 'fixed', id: d.id } });
      expect(r.daemonId).toBe(d.id);
    }
  });

  it('is deterministic per arm — including mercury (the per-turn coin)', () => {
    const arm = { kind: 'fixed', id: 'mercury' } as const;
    const policy: RedrawPolicy = { kind: 'level', cards: 6 };
    const a = runOne(5, strat(), { ...SHORT, daemon: arm, redraw: policy });
    const b = runOne(5, strat(), { ...SHORT, daemon: arm, redraw: policy });
    expect(a).toEqual(b);
  });

  it('the arm is LIVE: with a redraw bot, a redraw idol diverges from the control', () => {
    // Under `none` the redraw bot no-ops every turn (zero availability); under
    // janus it actually tosses cards, which re-fields different units. Over a
    // small seed band at least one run must diverge.
    const policy: RedrawPolicy = { kind: 'level', cards: 6 };
    const differs = [1, 2, 3, 4, 5, 6].some((s) => {
      const control = runOne(s, strat(), { ...SHORT, daemon: { kind: 'none' }, redraw: policy });
      const janus = runOne(s, strat(), {
        ...SHORT,
        daemon: { kind: 'fixed', id: 'janus' },
        redraw: policy,
      });
      return control.totalTicks !== janus.totalTicks || control.outcome !== janus.outcome;
    });
    expect(differs).toBe(true);
  });
});
