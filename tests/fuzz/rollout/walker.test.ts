/**
 * 69b — the rollout walker's contracts (the cut's exit criterion: a
 * deterministic walk through one full battle from BOTH a preTurn and a
 * map context):
 *
 * 1. MAP CONTEXT — a clone taken at 'map' walks one full battle to the
 *    horizon (node pick + gates + battle all driven internally).
 * 2. PRETURN CONTEXT — a clone taken at 'turn-intro' (the redraw/empower/
 *    preTurn-fire decision point) walks its current battle to the horizon.
 * 3. DETERMINISM — same clone seed + same options ⇒ identical WalkResult
 *    AND a byte-identical final run snapshot (the arbitration
 *    determinism the 69e driver builds on).
 * 4. THE INNER-TIER DIAL — 'bare' and 'searcher' both complete the same
 *    walk (the dial is plumbed; which tier is RIGHT is §71's flip-rate
 *    question, not this suite's).
 * 5. SAFETY — the maxHops bound trips as 'stuck', never spins.
 *
 * Live-run purity and bus isolation are 69a's contracts (runRollout
 * .test.ts); the walker inherits them by construction (it only ever
 * touches the clone's run + bus).
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { Run } from '../../../src/run/Run';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { walkToHorizon } from './walker';

/** A live run at the 'map' decision phase (pre-root, nothing entered). */
function liveAtMap(seed: number): Run {
  return new Run(seed, new EventBus<GameEvents>());
}

/** A live run paused at 'turn-intro' — the preTurn decision context.
 *  74i-c: catalog-suppressed (the shipped root opens a starting event
 *  otherwise; empty = the root degrades to the fight, the 74b rule). */
function liveAtPreTurn(seed: number): Run {
  const run = new Run(seed, new EventBus<GameEvents>(), { eventCatalog: [] });
  run.pauseAtTurnGates = true;
  run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
  expect(run.phase).toBe('turn-intro');
  return run;
}

describe('walkToHorizon (69b — the rollout walker)', () => {
  it('map context: walks one full battle to the horizon', () => {
    const live = liveAtMap(20260730);
    const clone = cloneRunForRollout(live, 555);
    const result = walkToHorizon(clone, { horizonBattles: 1, policySeed: 91 });
    expect(result.outcome).toBe('horizon');
    expect(result.battlesEnded).toBe(1);
    expect(result.totalTicks).toBeGreaterThan(0);
  });

  it('preTurn context: walks the current battle to the horizon', () => {
    const live = liveAtPreTurn(20260730);
    const clone = cloneRunForRollout(live, 555);
    const result = walkToHorizon(clone, { horizonBattles: 1, policySeed: 91 });
    expect(result.outcome).toBe('horizon');
    expect(result.battlesEnded).toBe(1);
    expect(result.totalTicks).toBeGreaterThan(0);
  });

  it('determinism: same clone seed + options ⇒ identical result and byte-identical final state', () => {
    const live = liveAtMap(31337);
    const a = cloneRunForRollout(live, 555);
    const b = cloneRunForRollout(live, 555);
    const opts = { horizonBattles: 2, policySeed: 91 };
    const ra = walkToHorizon(a, opts);
    const rb = walkToHorizon(b, opts);
    expect(ra).toEqual(rb);
    expect(JSON.stringify(a.run.toJSON())).toBe(JSON.stringify(b.run.toJSON()));
  });

  it('different clone seeds ⇒ diverged walks (sampled futures, not one future)', () => {
    const live = liveAtMap(31337);
    const a = cloneRunForRollout(live, 555);
    const b = cloneRunForRollout(live, 556);
    const opts = { horizonBattles: 2, policySeed: 91 };
    walkToHorizon(a, opts);
    walkToHorizon(b, opts);
    expect(JSON.stringify(a.run.toJSON())).not.toBe(JSON.stringify(b.run.toJSON()));
  });

  it('the inner-tier dial: bare and searcher both complete the walk', () => {
    const live = liveAtMap(20260730);
    for (const innerTier of ['bare', 'searcher'] as const) {
      const clone = cloneRunForRollout(live, 555);
      const result = walkToHorizon(clone, { horizonBattles: 1, policySeed: 91, innerTier });
      expect(result.outcome).toBe('horizon');
      expect(result.battlesEnded).toBe(1);
    }
  });

  it('safety: the maxHops bound trips as stuck, never spins', () => {
    const live = liveAtMap(20260730);
    const clone = cloneRunForRollout(live, 555);
    const result = walkToHorizon(clone, { horizonBattles: 99, policySeed: 91, maxHops: 0 });
    expect(result.outcome).toBe('stuck');
  });
});
