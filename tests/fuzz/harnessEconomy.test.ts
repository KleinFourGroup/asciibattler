/**
 * 59a — the economy strategy seam (`pickPortBuy` / `pickPacketFire`). The
 * load-bearing guarantees, in the 54a parity shape:
 *
 * (1) ABSENT methods = the fixed policies, byte-identical — the anchor arms
 *     (greedy/random) and every existing baseline are untouched;
 * (2) a port stub REPLICATING the 50g buy-all-affordable policy through the
 *     seam is byte-identical to the hardwired branch (the seam itself adds
 *     nothing: zero extra draws, same transactions in the same order);
 * (3) the GATES-ON CONTROL — defining `pickPacketFire` flips
 *     `pauseAtTurnGates` ON, and a method that never fires must STILL be
 *     byte-identical to the headless path (the H4b alignment invariant,
 *     surfaced through the fire arm the way harnessRedraw.test.ts surfaces
 *     it through `level:0`);
 * (4) determinism under live stubs;
 * (5) both seams are LIVE end-to-end (a buying/firing stub changes real
 *     state — `portPurchases` / `packetsFired` are the non-vacuous proofs).
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';
import type { FuzzStrategy, PortBuy } from './Strategy';
import { packetById } from '../../src/config/packets';

const strat = () => makeStrategy('greedy')!;
const SHORT = { runConfig: { hopCount: 4 } } as const;
const SEED_BAND = [1, 2, 3, 4, 5, 6, 7, 8];

/** The 50g buy-all-affordable policy re-expressed through the 59a seam:
 *  first un-sold affordable slot in daemons → units → packets-if-room lane
 *  order. Buying only spends bits and only fills the cache, so a slot
 *  skipped once can never become eligible later — the rescan-per-ask
 *  produces exactly the hardwired single pass's transactions. */
function withPortReplica(s: FuzzStrategy): FuzzStrategy {
  return {
    ...s,
    pickPortBuy: (stock, run): PortBuy | null => {
      const lanes = [
        ['daemon', stock.daemons],
        ['unit', stock.units],
        ['packet', stock.packets],
      ] as const;
      for (const [kind, lane] of lanes) {
        for (let index = 0; index < lane.length; index++) {
          const slot = lane[index]!;
          if (slot.sold || run.bits < slot.price) continue;
          if (kind === 'packet' && !run.cacheHasRoom) continue;
          return { kind, index };
        }
      }
      return null;
    },
  };
}

/** A fire method that never fires — the gates-on control arm. */
function withNullFire(s: FuzzStrategy): FuzzStrategy {
  return { ...s, pickPacketFire: () => null };
}

/** Fires the first held target-less packet legal in the asked context
 *  (patch/reroute/venom/miner — no handIndex/rosterIndex bookkeeping). */
function withGreedyFire(s: FuzzStrategy): FuzzStrategy {
  return {
    ...s,
    pickPacketFire: (context, run) => {
      for (let cacheIndex = 0; cacheIndex < run.cache.length; cacheIndex++) {
        const packet = packetById(run.cache[cacheIndex]!);
        if (packet && packet.target === 'none' && packet.usableIn.includes(context)) {
          return { cacheIndex };
        }
      }
      return null;
    },
  };
}

describe('harness economy seam (59a)', () => {
  it('a port replica of the 50g buy-all policy is byte-identical to the hardwired branch', () => {
    for (const seed of [1, 2, 3]) {
      const hardwired = runOne(seed, strat(), SHORT);
      const viaSeam = runOne(seed, withPortReplica(strat()), SHORT);
      expect(viaSeam).toEqual(hardwired);
    }
  });

  it('GATES-ON CONTROL: a never-firing pickPacketFire is byte-identical to headless', () => {
    // Defining the method flips pauseAtTurnGates ON (the preTurn fire site
    // only exists gated) — the run must still reproduce the straight-through
    // path exactly, or every live-fire read is confounded by gate-path
    // drift rather than packet effect. The H4b invariant, third surfacing
    // (redraw level:0 → empower none → fire null).
    for (const seed of [1, 2, 3]) {
      const headless = runOne(seed, strat(), SHORT);
      const gated = runOne(seed, withNullFire(strat()), SHORT);
      expect(gated).toEqual(headless);
    }
  });

  it('is deterministic for the same seed + live stubs', () => {
    const make = () => withGreedyFire(withPortReplica(strat()));
    const a = runOne(5, make(), SHORT);
    const b = runOne(5, make(), SHORT);
    expect(a).toEqual(b);
  });

  it('the port seam is LIVE — a buy-nothing stub zeroes purchases the baseline made', () => {
    // Seed 12 = the pinned port canary (harnessPort.test.ts; re-pinned
    // 10→12 at 56a) — the walk that provably docks with funds. Same re-pin
    // contract: if an engine round re-deals the streams, re-scan there
    // first and this follows.
    const bought = runOne(12, strat(), SHORT);
    expect(bought.portPurchases).toBeGreaterThan(0);
    const abstained = runOne(12, { ...strat(), pickPortBuy: () => null }, SHORT);
    expect(abstained.portPurchases).toBe(0);
    expect(abstained.finalBits).toBeGreaterThanOrEqual(bought.finalBits);
  });

  it('the fire seam is LIVE — the greedy-fire stub consumes at least one packet on the band', () => {
    // Packets arrive via rewards + the fixed buy policy; over the band at
    // least one run must hold a target-less packet at a legal site. The
    // counter is the direct read; anchor arms stay 0 by construction.
    const fired = SEED_BAND.map((s) => runOne(s, withGreedyFire(strat()), SHORT));
    expect(fired.some((r) => r.packetsFired > 0)).toBe(true);
    const anchors = SEED_BAND.map((s) => runOne(s, strat(), SHORT));
    for (const r of anchors) expect(r.packetsFired).toBe(0);
  });
});
