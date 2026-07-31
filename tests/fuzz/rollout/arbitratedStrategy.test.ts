/**
 * 70a — the arbitrated arm's port-buy site + scaffold contracts:
 *
 * MECHANISM PINS (injected evaluator — no battles driven):
 * 1. Candidate enumeration: affordable unsold slots only, in the scored
 *    policy's lane order (daemons → units → packets, slot order), null
 *    always first in the log — derived from the LIVE dock state, never
 *    hardcoded.
 * 2. The winner maps back to the correct PortBuy (kind + index).
 * 3. Every challenger losing ⇒ null (stop buying) and the site's default
 *    ε (the pinned floor) is what the decision was judged against.
 * 4. Sold-out / drained-bits slots drop out of the next ask's candidate
 *    set (the ask-until-null loop's re-enumeration contract).
 * 5. Un-landed sites DELEGATE to the base; pickPacketFire presence
 *    mirrors the base's (presence flips the harness turn gates — 59a).
 *
 * INTEGRATION (real evaluator):
 * 6. SITE DETERMINISM (the phase exit criterion, per site): same runSeed
 *    + same docked state ⇒ the same buy and a deep-equal decision log,
 *    across two independently constructed strategies.
 *
 * The docked fixture rides the 70a walker `stopAtPhase` hook (also
 * pinned here by the fixture's own phase assertion) and is re-materialized
 * per test via a plain `Run.fromJSON` round-trip — byte-identical live
 * states, no cross-test mutation.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { Run } from '../../../src/run/Run';
import type { RunSnapshot } from '../../../src/run/Run';
import { packetById, type UseContext } from '../../../src/config/packets';
import { DECK } from '../../../src/config/deck';
import { HEALTH } from '../../../src/config/health';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { walkToHorizon } from './walker';
import type { CandidateApply, RunCandidateResult, RunRolloutSpec } from './evaluator';
import type { FuzzStrategy, PortBuy } from '../Strategy';
import { maxPowerIndex, minPowerIndex } from '../strategies/scored';
import {
  makeArbitratedStrategy,
  PORT_BUY_EPSILON,
  FIRE_PRETURN_EPSILON,
  FIRE_OUTOFBATTLE_EPSILON,
} from './arbitratedStrategy';

const SEED = 20260730;

/** Walk a fresh run to its first port dock (deterministic seed scan —
 *  the readEpsilonAA prep, duplicated: that file is a script that runs
 *  at import). */
function dockSnapshot(): RunSnapshot {
  for (let s = SEED; s < SEED + 20; s++) {
    const state = cloneRunForRollout(new Run(s, new EventBus<GameEvents>()), s + 1);
    walkToHorizon(state, {
      horizonBattles: 9999,
      policySeed: s + 4,
      maxHops: 80,
      stopAtPhase: 'port',
    });
    if (state.run.phase === 'port') return state.run.toJSON();
  }
  throw new Error(`no seed in [${SEED}, ${SEED + 20}) docked at a port`);
}

let snap: RunSnapshot;
// The dock walk drives ~6 real battles (fresh-run battles are the heavy
// end — 69c) — well past the default hook timeout.
beforeAll(() => {
  snap = dockSnapshot();
}, 120_000);

/** A byte-identical live dock (plain round-trip — streams preserved). */
function docked(): Run {
  return Run.fromJSON(snap, new EventBus<GameEvents>());
}

/** Injected evaluator scoring by CALL ORDER (null is always evaluated
 *  first, then challengers in enumeration order — the driver contract). */
function sequenceEvaluator(scores: readonly number[]) {
  let i = 0;
  return (_live: Run, _apply: CandidateApply | null, _spec: RunRolloutSpec): RunCandidateResult => {
    const score = scores[i++];
    if (score === undefined) throw new Error(`sequenceEvaluator: ran past ${scores.length} scores`);
    return { score, perSeed: [] };
  };
}

/** The test's independent restatement of the enumeration spec: expected
 *  labels for one ask, derived from the live dock state. */
function expectedLabels(run: Run): string[] {
  const stock = run.portStock!;
  const labels: string[] = [];
  stock.daemons.forEach((s) => {
    if (!s.sold && run.bits >= s.price) labels.push(`buy daemon:${s.daemonId} @${s.price}`);
  });
  stock.units.forEach((s) => {
    if (!s.sold && run.bits >= s.price)
      labels.push(`buy unit:${s.template.archetype}:L${s.template.level} @${s.price}`);
  });
  stock.packets.forEach((s) => {
    if (!s.sold && run.bits >= s.price && run.cacheHasRoom)
      labels.push(`buy packet:${s.packetId} @${s.price}`);
  });
  return labels;
}

describe('arbitrated port buys — mechanism pins (injected evaluator)', () => {
  it('the fixture actually docked (the stopAtPhase hook works)', () => {
    const run = docked();
    expect(run.phase).toBe('port');
    expect(run.portStock).not.toBeNull();
    expect(expectedLabels(run).length).toBeGreaterThan(0);
  });

  it('enumerates affordable unsold slots in lane order, null first in the log', () => {
    const run = docked();
    const expected = expectedLabels(run);
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator(Array(expected.length + 1).fill(0)),
    });
    expect(arm.pickPortBuy!(run.portStock!, run, null as never)).toBeNull(); // all-tie → null
    expect(arm.driver.decisions).toHaveLength(1);
    expect(arm.driver.decisions[0]!.labels).toEqual(['null', ...expected]);
    expect(arm.driver.decisions[0]!.site).toBe('portBuy');
  });

  it('the winner maps back to the matching PortBuy; the default ε is the pinned floor', () => {
    const run = docked();
    const expected = expectedLabels(run);
    // Make the LAST challenger win by a margin clearing the pinned floor.
    const scores = [0, ...expected.map((_l, i) => (i === expected.length - 1 ? 1000 : 1))];
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator(scores) });
    const buy = arm.pickPortBuy!(run.portStock!, run, null as never) as PortBuy;
    expect(buy).not.toBeNull();
    const winnerLabel = expected[expected.length - 1]!;
    expect(winnerLabel.startsWith(`buy ${buy.kind}:`)).toBe(true);
    const lane =
      buy.kind === 'daemon'
        ? run.portStock!.daemons
        : buy.kind === 'unit'
          ? run.portStock!.units
          : run.portStock!.packets;
    expect(lane[buy.index]!.sold).toBe(false);
    expect(arm.driver.decisions[0]!.epsilon).toBe(PORT_BUY_EPSILON);
    expect(arm.driver.decisions[0]!.chosenIndex).toBe(expected.length); // null-offset
  });

  it('a bought slot drops out of the next ask (re-enumeration against mutated stock)', () => {
    const run = docked();
    const before = expectedLabels(run);
    // Win the FIRST challenger, dispatch it live (the harness's job), ask again.
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator([
        ...[0, 1000, ...Array(before.length - 1).fill(0)],
        ...Array(before.length + 1).fill(0), // the second ask: all-tie → null
      ]),
    });
    const buy = arm.pickPortBuy!(run.portStock!, run, null as never) as PortBuy;
    run.dispatch(
      buy.kind === 'daemon'
        ? { kind: 'buyPortDaemon', index: buy.index }
        : buy.kind === 'unit'
          ? { kind: 'buyPortUnit', index: buy.index }
          : { kind: 'buyPortPacket', index: buy.index },
    );
    expect(arm.pickPortBuy!(run.portStock!, run, null as never)).toBeNull();
    const remaining = expectedLabels(run);
    // The bought slot is sold (and bits only shrank), so the set strictly
    // contracts — possibly all the way to empty, in which case the second
    // ask logs nothing (an empty candidate set is not a decision).
    expect(remaining.length).toBeLessThan(before.length);
    if (arm.driver.decisions.length > 1) {
      expect(arm.driver.decisions[1]!.labels).toEqual(['null', ...remaining]);
    } else {
      expect(remaining).toHaveLength(0);
    }
  });

  it('un-landed sites delegate to the base; landed sites never consult it', () => {
    const run = docked();
    const base: FuzzStrategy = {
      name: 'fake-base',
      pickNextNode: vi.fn((frontier: readonly number[]) => frontier[0]!),
      pickRecruit: vi.fn(() => null),
      pickPacketFire: vi.fn(() => null),
    };
    const arm = makeArbitratedStrategy(SEED, { base, evaluate: sequenceEvaluator([]) });
    expect(arm.name).toBe('arbitrated:fake-base');
    expect(arm.pickNextNode([3, 4], run, null as never)).toBe(3);
    expect(base.pickNextNode).toHaveBeenCalledOnce();
    expect(arm.pickRecruit([], run, null as never)).toBeNull();
    expect(base.pickRecruit).toHaveBeenCalledOnce();
    // 70b — the fire site is LANDED: always defined (gates always on for
    // the arm), arbitrated, and the base's own method is never consulted.
    expect(arm.pickPacketFire).toBeDefined();
    const bare = new Run(SEED, new EventBus<GameEvents>()); // empty cache
    expect(arm.pickPacketFire!('outOfBattle', bare, null as never)).toBeNull();
    expect(arm.driver.decisions).toHaveLength(0); // no candidates → not a decision
    expect(base.pickPacketFire).not.toHaveBeenCalled();
  });
});

describe('arbitrated packet fires — mechanism pins (injected evaluator)', () => {
  /** A grants-stocked run (68b — free items at construction, zero draws). */
  function grantedRun(grants: readonly string[]): Run {
    return new Run(SEED, new EventBus<GameEvents>(), { grants });
  }

  /** Park a grants-stocked fresh run at turn-intro (gates on → enter the
   *  root) — the preTurn fire context. */
  function atTurnIntro(grants: readonly string[]): Run {
    const run = grantedRun(grants);
    run.pauseAtTurnGates = true;
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    if (run.phase !== 'turn-intro') {
      throw new Error(`atTurnIntro: expected turn-intro, got ${run.phase}`);
    }
    return run;
  }

  /** The test's independent restatement of the fire-enumeration spec. */
  function expectedFireLabels(run: Run, context: UseContext): string[] {
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const id of run.cache) {
      const p = packetById(id)!;
      if (!p.usableIn.includes(context) || p.target === 'tile' || seen.has(p.id)) continue;
      if (p.effect.op === 'drawCards' && run.hand.length >= DECK.maxHandSize) continue;
      if (p.effect.op === 'discardCards' && run.hand.length <= 1) continue;
      seen.add(p.id);
      if (p.target === 'unit') {
        if (context === 'preTurn') {
          const pick = p.effect.op === 'discardCards' ? minPowerIndex : maxPowerIndex;
          const h = pick(run.hand.map((slot) => run.team[slot]!));
          if (h === null) continue;
          labels.push(`fire ${p.id}@hand:${h}`);
        } else {
          const r = maxPowerIndex(run.team);
          if (r === null) continue;
          labels.push(`fire ${p.id}@roster:${r}`);
        }
      } else {
        labels.push(`fire ${p.id}`);
      }
    }
    return labels;
  }

  it('preTurn: enumerates per-packet candidates with nominator targets; site + default ε in the record', () => {
    const run = atTurnIntro(['patch', 'hype', 'discard-one']);
    const expected = expectedFireLabels(run, 'preTurn');
    expect(expected.length).toBeGreaterThan(0);
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator(Array(expected.length + 1).fill(0)),
    });
    expect(arm.pickPacketFire!('preTurn', run, null as never)).toBeNull(); // all-tie → bank
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('packetFire:preTurn');
    expect(rec.labels).toEqual(['null', ...expected]);
    expect(rec.epsilon).toBe(FIRE_PRETURN_EPSILON);
  });

  it('the 60c heal guard is DROPPED: patch is a candidate at a FULL pool (the rollout judges it now)', () => {
    const run = atTurnIntro(['patch']);
    expect(run.playerHealth).toBe(HEALTH.playerHealthMax); // full — the cheap policy would skip
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator([0, 0]) });
    arm.pickPacketFire!('preTurn', run, null as never);
    expect(arm.driver.decisions[0]!.labels).toContain('fire patch');
  });

  it('duplicate packet ids collapse to one candidate (lowest cache index)', () => {
    const run = atTurnIntro(['patch', 'patch']);
    expect(run.cache.filter((id) => id === 'patch')).toHaveLength(2);
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator([0, 0]) });
    arm.pickPacketFire!('preTurn', run, null as never);
    expect(arm.driver.decisions[0]!.labels).toEqual(['null', 'fire patch']);
  });

  it('outOfBattle: context filtering + roster targeting; the winner maps back to the PacketFire', () => {
    const run = grantedRun(['patch', 'hype', 'overclock']); // hype is preTurn-only
    const expected = expectedFireLabels(run, 'outOfBattle');
    expect(expected).toHaveLength(2); // patch + overclock@roster
    const rosterTarget = maxPowerIndex(run.team)!;
    expect(expected).toContain(`fire overclock@roster:${rosterTarget}`);
    // Make overclock (the last challenger) win by a floor-clearing margin.
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator([0, 0, 1000]),
    });
    const fire = arm.pickPacketFire!('outOfBattle', run, null as never)!;
    expect(fire).not.toBeNull();
    expect(fire.rosterIndex).toBe(rosterTarget);
    expect(run.cache[fire.cacheIndex]).toBe('overclock');
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('packetFire:outOfBattle');
    expect(rec.epsilon).toBe(FIRE_OUTOFBATTLE_EPSILON);
    expect(rec.chosenIndex).toBe(2);
  });
});

describe('arbitrated packet fires — integration (real evaluator)', () => {
  it('SITE DETERMINISM: same runSeed + same turn-intro state ⇒ same fire + deep-equal log', () => {
    const decide = () => {
      const run = new Run(SEED, new EventBus<GameEvents>(), { grants: ['patch', 'hype'] });
      run.pauseAtTurnGates = true;
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      const arm = makeArbitratedStrategy(SEED, { k: 1 });
      const fire = arm.pickPacketFire!('preTurn', run, null as never);
      return { fire, record: arm.driver.decisions[0]! };
    };
    const a = decide();
    const b = decide();
    expect(a.fire).toEqual(b.fire);
    expect(a.record).toEqual(b.record);
  }, 120_000);
});

describe('arbitrated port buys — integration (real evaluator)', () => {
  it('SITE DETERMINISM (the exit criterion): same runSeed + same dock ⇒ same buy + deep-equal log', () => {
    const decide = () => {
      const run = docked();
      const arm = makeArbitratedStrategy(SEED, { k: 1 });
      const buy = arm.pickPortBuy!(run.portStock!, run, null as never);
      return { buy, record: arm.driver.decisions[0]! };
    };
    const a = decide();
    const b = decide();
    expect(a.buy).toEqual(b.buy);
    expect(a.record).toEqual(b.record);
  }, 120_000);
});
