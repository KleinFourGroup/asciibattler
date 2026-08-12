/**
 * 69a — the run-clone seam's load-bearing contracts, foresee-the-rolls
 * FIRST (the rollout.test.ts shape, one layer up):
 *
 * 1. THE CLAIRVOYANCE GUARD — a rollout clone must NOT share the live
 *    run's future rolls. The control documents the hazard the seam
 *    exists for: a plain toJSON→fromJSON clone DOES share the live
 *    `streamRoot` verbatim (77d2 — every stream derives from it, so a
 *    plain clone re-derives the identical future; H5 in
 *    snapshot-roundtrip.test.ts is the behavioral proof).
 * 2. PRE-ROLLED FACTS PRESERVED — everything BUT `streamRoot` rides
 *    the wire untouched (map DAG, boss forewarning, offer/stock/prices,
 *    the occurrence counters — a clone continues from the same position).
 * 3. LIVE-RUN PURITY — cloning and advancing a clone never perturbs the
 *    live run (byte-identical snapshot before/after).
 * 4. DETERMINISM / CRN — same rolloutSeed ⇒ byte-identical clone
 *    futures; different seeds ⇒ diverged.
 * 5. BUS ISOLATION — clone events never reach the live bus.
 *
 * Fixture note: the live run is advanced one `enterNode` into its first
 * encounter (phase 'battle', deck dealt, encounter selected) so clones
 * carry non-trivial mid-run state; a clone is then advanced past the
 * battle by emitting a draw-chip `battle:ended` on ITS bus (the H5
 * idiom) — headless straight-through resolves the turn and deals the
 * next hand off the re-seeded streams.
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Run, type RunSnapshot } from '../run/Run';
import { cloneRunForRollout } from './runRollout';

/** A live run one hop in: mid-encounter, deck dealt, counters advanced. */
function liveRun(seed: number): Run {
  const run = new Run(seed, new EventBus<GameEvents>());
  run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
  return run;
}

/** The sub-lethal turn resolution chip (the H5 idiom). */
const DRAW_CHIP = {
  winner: 'draw' as const,
  xpAwards: [],
  survivorPower: { player: 0, enemy: 0 },
};

function stripRoot(wire: RunSnapshot): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...wire };
  delete copy['streamRoot'];
  return copy;
}

describe('cloneRunForRollout (69a — the clairvoyance guard, one layer up)', () => {
  it('foresee-the-rolls: the clone cannot see the live future; a plain clone CAN (the control)', () => {
    const live = liveRun(20260730);
    const liveWire = live.toJSON();

    // The control documents the hazard: an undiverged round-trip clone
    // carries the live streamRoot verbatim — every future occurrence
    // re-derives identically (77d2).
    const plain = Run.fromJSON(
      JSON.parse(JSON.stringify(liveWire)) as RunSnapshot,
      new EventBus<GameEvents>(),
    );
    expect(plain.toJSON().streamRoot).toBe(liveWire.streamRoot);

    // The seam replaces the root, diverging every future occurrence.
    const cloneWire = cloneRunForRollout(live, 777).run.toJSON();
    expect(cloneWire.streamRoot).not.toBe(liveWire.streamRoot);
  });

  it('pre-rolled facts ride the wire untouched: everything but streamRoot is byte-equal', () => {
    // The spec's clairvoyance inventory — map DAG + node kinds, the §66
    // boss forewarning pair, offer/stock/prices, hand + pile contents,
    // the occurrence counters — is LEGITIMATE rollout knowledge and must
    // survive the clone exactly.
    const live = liveRun(20260730);
    const clone = cloneRunForRollout(live, 777);
    expect(stripRoot(clone.run.toJSON())).toEqual(stripRoot(live.toJSON()));
  });

  it('cloning and advancing a clone never perturbs the live run', () => {
    const live = liveRun(9001);
    const before = JSON.stringify(live.toJSON());

    const clone = cloneRunForRollout(live, 123);
    clone.bus.emit('battle:ended', DRAW_CHIP); // resolve turn 1, deal turn 2

    expect(JSON.stringify(live.toJSON())).toBe(before);
  });

  it('same rolloutSeed ⇒ byte-identical clone futures (the CRN contract)', () => {
    const live = liveRun(31337);
    const a = cloneRunForRollout(live, 555);
    const b = cloneRunForRollout(live, 555);
    a.bus.emit('battle:ended', DRAW_CHIP);
    b.bus.emit('battle:ended', DRAW_CHIP);
    expect(JSON.stringify(a.run.toJSON())).toBe(JSON.stringify(b.run.toJSON()));
  });

  it('different rolloutSeeds ⇒ diverged clone futures', () => {
    const live = liveRun(31337);
    const a = cloneRunForRollout(live, 555);
    const b = cloneRunForRollout(live, 556);
    a.bus.emit('battle:ended', DRAW_CHIP);
    b.bus.emit('battle:ended', DRAW_CHIP);
    expect(JSON.stringify(a.run.toJSON())).not.toBe(JSON.stringify(b.run.toJSON()));
  });

  it('clone events never reach the live bus', () => {
    const liveBus = new EventBus<GameEvents>();
    const live = new Run(7, liveBus);
    live.dispatch({ kind: 'enterNode', nodeId: live.nodeMap.rootId });

    let liveEvents = 0;
    liveBus.on('battle:started', () => liveEvents++);
    liveBus.on('turn:starting', () => liveEvents++);

    const clone = cloneRunForRollout(live, 42);
    clone.bus.emit('battle:ended', DRAW_CHIP); // advances the clone a full turn
    expect(liveEvents).toBe(0);
  });
});
