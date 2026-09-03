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
import type { PortStock, RunSnapshot } from '../../../src/run/Run';
import { packetById, type UseContext } from '../../../src/config/packets';
import { DECK } from '../../../src/config/deck';
import { HEALTH } from '../../../src/config/health';
import { RNG } from '../../../src/core/RNG';
import type { RewardPortion } from '../../../src/run/rewards';
import type { EventDef } from '../../../src/config/events';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { runOne } from '../harness';
import { walkToHorizon } from './walker';
import type { CandidateApply, RunCandidateResult, RunRolloutSpec } from './evaluator';
import type { FuzzStrategy, GrantAction, PortBuy } from '../Strategy';
import { makeBestScore, maxPowerIndex, minPowerIndex, scoredStrategy } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS, type ScoredWeights } from '../strategies/scoredWeights';
import { selectRedrawPositions } from '../redrawPolicy';
import { selectEmpowerPosition } from '../empowerPolicy';
import {
  makeArbitratedStrategy,
  PORT_BUY_EPSILON,
  FIRE_PRETURN_EPSILON,
  FIRE_OUTOFBATTLE_EPSILON,
  REWARD_DAEMON_EPSILON,
  GRANT_EPSILON,
  NODE_CHOICE_EPSILON,
  EVENT_CHOICE_EPSILON,
  DP_TAIL_SCALE,
  CAMP_RAID_EPSILON,
  walkPolicyOverlay,
  walkPortBuy,
  pinnedEventPick,
  eventPriorItemKeys,
} from './arbitratedStrategy';
import { campRaidEligible } from '../campRaid';

const SEED = 20260730;

/** Walk a fresh run to its first port dock WITH FUNDS (deterministic
 *  seed scan — the readEpsilonAA prep, duplicated: that file is a script
 *  that runs at import). 77d3 hardened the condition from dock to
 *  dock-with-affordable-slot: the keyed-derivation remap surfaced a walk
 *  that docked broke, which every mechanism pin below starves on —
 *  affordability was always the real requirement (self-healing, no
 *  pinned literal to re-scan at the next stream break). */
function dockSnapshot(): RunSnapshot {
  for (let s = SEED; s < SEED + 20; s++) {
    const state = cloneRunForRollout(new Run(s, new EventBus<GameEvents>()), s + 1);
    walkToHorizon(state, {
      horizonBattles: 9999,
      policySeed: s + 4,
      maxHops: 80,
      stopAtPhase: 'port',
    });
    if (state.run.phase === 'port' && expectedLabels(state.run).length > 0) {
      return state.run.toJSON();
    }
  }
  throw new Error(`no seed in [${SEED}, ${SEED + 20}) docked at a port with an affordable slot`);
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
    // 70e — node choice is arbitrated now, but the base stays the
    // NOMINATOR; a singleton frontier short-circuits to its pick with no
    // rollouts (not a decision).
    expect(arm.pickNextNode([3], run, null as never)).toBe(3);
    expect(base.pickNextNode).toHaveBeenCalledOnce();
    expect(arm.driver.decisions).toHaveLength(0);
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
  /** A grants-stocked run (68b — free items at construction, zero draws).
   *  74i-c: catalog-suppressed — the turn-intro park enters the root, which
   *  opens the shipped starting event otherwise (empty = degrade to fight). */
  function grantedRun(grants: readonly string[]): Run {
    return new Run(SEED, new EventBus<GameEvents>(), { grants, eventCatalog: [] });
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

describe('the pickReward chokepoint (70c) — harness contracts', () => {
  const scored = () => scoredStrategy('reward-pin', DEFAULT_SCORED_WEIGHTS);
  const SHORT = { runConfig: { hopCount: 3 } };

  it('ABSENT vs a hardwired-mirror pickReward ⇒ byte-identical RunResult (and the seam IS consulted)', () => {
    const withoutSeam = runOne(41, scored(), SHORT);
    const mirror = vi.fn(
      (p: RewardPortion, run: Run) => !(p.kind === 'packet' && !run.cacheHasRoom),
    );
    const withSeam = runOne(41, { ...scored(), pickReward: mirror }, SHORT);
    expect(mirror).toHaveBeenCalled(); // every battle victory offers at least bits
    expect(withSeam).toEqual(withoutSeam);
  }, 120_000);
});

describe('arbitrated daemon rewards — mechanism pins (injected evaluator)', () => {
  /** A real reward-gate state with a daemon portion spliced in at the
   *  head (snapshot surgery — daemon drops are elite/boss-gated at 35%,
   *  too rare to hunt; rollRewards' own header blesses synthetic
   *  inputs). 'portunus' is port-lane-only, so the run never owns it. */
  function rewardStateWithDaemonHead(): Run {
    const clone = cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), SEED + 9);
    walkToHorizon(clone, {
      horizonBattles: 9999,
      policySeed: SEED + 10,
      maxHops: 80,
      stopAtPhase: 'reward',
    });
    if (clone.run.phase !== 'reward') {
      throw new Error(`fixture: expected reward, got ${clone.run.phase}`);
    }
    const snap = clone.run.toJSON();
    snap.pendingRewards = [
      { kind: 'daemon', daemonId: 'portunus' },
      ...(snap.pendingRewards ?? []),
    ];
    return Run.fromJSON(snap, new EventBus<GameEvents>());
  }

  it('a daemon head portion arbitrates: polarity flipped (null=accept, challenger=decline), site + ε pinned', () => {
    const run = rewardStateWithDaemonHead();
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator([0, 0]) });
    // Tie → the null arm (ACCEPT) stands.
    expect(arm.pickReward!(run.pendingRewards![0]!, run, null as never)).toBe(true);
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('rewardDaemon');
    expect(rec.labels).toEqual(['null', 'decline daemon:portunus']);
    expect(rec.epsilon).toBe(REWARD_DAEMON_EPSILON);
  });

  it('a decline that clears ε wins → the portion is refused', () => {
    const run = rewardStateWithDaemonHead();
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator([0, 1000]) });
    expect(arm.pickReward!(run.pendingRewards![0]!, run, null as never)).toBe(false);
    expect(arm.driver.decisions[0]!.chosenIndex).toBe(1);
  });

  it('85g1 — the decision carries its candidate-delta key set: the pending daemon alone', () => {
    const run = rewardStateWithDaemonHead();
    const specs: RunRolloutSpec[] = [];
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: (_live: Run, _apply: CandidateApply | null, spec: RunRolloutSpec) => {
        specs.push(spec);
        return { score: 0, perSeed: [] };
      },
    });
    arm.pickReward!(run.pendingRewards![0]!, run, null as never);
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) expect(spec.priorItemKeys).toEqual(['daemon:portunus']);
  });

  it('non-daemon portions mirror the hardwired policy with NO arbitration', () => {
    const run = rewardStateWithDaemonHead();
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator([]) });
    expect(arm.pickReward!({ kind: 'bits', base: 10 }, run, null as never)).toBe(true);
    expect(arm.pickReward!({ kind: 'packet', packetId: 'patch' }, run, null as never)).toBe(true);
    // A full cache (size 6 today — derived, not assumed: fill to capacity)
    const full = new Run(SEED, new EventBus<GameEvents>(), {
      grants: Array(new Run(SEED, new EventBus<GameEvents>()).effectiveCacheSize).fill('patch'),
    });
    expect(full.cacheHasRoom).toBe(false);
    expect(arm.pickReward!({ kind: 'packet', packetId: 'patch' }, full, null as never)).toBe(false);
    expect(arm.driver.decisions).toHaveLength(0); // none of the above logged
  });
});

describe('arbitrated daemon rewards — integration (real evaluator)', () => {
  it('SITE DETERMINISM: same runSeed + same reward state ⇒ same verdict + deep-equal log', () => {
    const decide = () => {
      const clone = cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), SEED + 9);
      walkToHorizon(clone, {
        horizonBattles: 9999,
        policySeed: SEED + 10,
        maxHops: 80,
        stopAtPhase: 'reward',
      });
      const snap = clone.run.toJSON();
      snap.pendingRewards = [
        { kind: 'daemon', daemonId: 'portunus' },
        ...(snap.pendingRewards ?? []),
      ];
      const run = Run.fromJSON(snap, new EventBus<GameEvents>());
      const arm = makeArbitratedStrategy(SEED, { k: 1 });
      const verdict = arm.pickReward!(run.pendingRewards![0]!, run, null as never);
      return { verdict, record: arm.driver.decisions[0]! };
    };
    const a = decide();
    const b = decide();
    expect(a.verdict).toBe(b.verdict);
    expect(a.record).toEqual(b.record);
  }, 120_000);
});

describe('the pickGrantAction chokepoint (70d) — harness contracts', () => {
  it('a hook MIRRORING level:2/hi ≡ the --redraw/--empower policy path, byte for byte', () => {
    const GRANTED = { runConfig: { hopCount: 3, grants: ['janus', 'mars'] } };
    const viaPolicies = runOne(43, scoredStrategy('grant-pin', DEFAULT_SCORED_WEIGHTS), {
      ...GRANTED,
      redraw: { kind: 'level', cards: 2 },
      empower: { kind: 'level', dir: 'hi' },
    });
    const mirror = vi.fn((grantIndex: number, run: Run, rng: RNG): GrantAction | null => {
      const grant = run.grantViews()[grantIndex]!;
      if (grant.remaining <= 0) return null;
      const hand = run.hand.map((i) => run.team[i]!);
      if (grant.effect.kind === 'redraw') {
        const pool = [...run.drawPile, ...run.discardPile].map((i) => run.team[i]!);
        const positions = selectRedrawPositions(
          hand,
          pool,
          { redrawsRemaining: grant.remaining, cardsRemaining: grant.effect.maxCards },
          { kind: 'level', cards: 2 },
          rng,
        );
        return positions.length === 0 ? null : { kind: 'redraw', handIndices: positions };
      }
      if (grant.effect.kind === 'empower') {
        const pos = selectEmpowerPosition(
          hand,
          { empowersRemaining: grant.remaining },
          { kind: 'level', dir: 'hi' },
          rng,
        );
        return pos === null ? null : { kind: 'empower', handIndex: pos };
      }
      return null;
    });
    const viaHook = runOne(
      43,
      { ...scoredStrategy('grant-pin', DEFAULT_SCORED_WEIGHTS), pickGrantAction: mirror },
      GRANTED,
    );
    expect(mirror).toHaveBeenCalled();
    expect(viaHook).toEqual(viaPolicies);
  }, 120_000);
});

describe('arbitrated grants — mechanism pins (injected evaluator)', () => {
  function grantedTurnIntro(): Run {
    // 74i-c — catalog-suppressed (see grantedRun's note).
    const run = new Run(SEED, new EventBus<GameEvents>(), { grants: ['janus', 'mars'], eventCatalog: [] });
    run.pauseAtTurnGates = true;
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    if (run.phase !== 'turn-intro') {
      throw new Error(`grantedTurnIntro: expected turn-intro, got ${run.phase}`);
    }
    return run;
  }
  const grantIndexOf = (run: Run, kind: string): number => {
    const i = run.grantViews().findIndex((g) => g.effect.kind === kind && g.remaining > 0);
    if (i < 0) throw new Error(`no live '${kind}' grant in the fixture`);
    return i;
  };

  it('redraw: level:1/level:2 nominator candidates (deduped), null = pass; site + ε pinned', () => {
    const run = grantedTurnIntro();
    const gi = grantIndexOf(run, 'redraw');
    const grant = run.grantViews()[gi]!;
    const hand = run.hand.map((i) => run.team[i]!);
    const pool = [...run.drawPile, ...run.discardPile].map((i) => run.team[i]!);
    const expected: string[] = [];
    const seen = new Set<string>();
    for (const cards of [1, 2]) {
      if (grant.effect.kind !== 'redraw') throw new Error('unreachable');
      const positions = selectRedrawPositions(
        hand,
        pool,
        { redrawsRemaining: grant.remaining, cardsRemaining: grant.effect.maxCards },
        { kind: 'level', cards },
        null as never,
      );
      if (positions.length === 0 || seen.has(positions.join(','))) continue;
      seen.add(positions.join(','));
      expected.push(`redraw level:${cards} [${positions.join(',')}]`);
    }
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator(Array(expected.length + 1).fill(0)),
    });
    expect(arm.pickGrantAction!(gi, run, null as never)).toBeNull(); // all-tie → pass
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('grant:redraw');
    expect(rec.labels).toEqual(['null', ...expected]);
    expect(rec.epsilon).toBe(GRANT_EPSILON);
  });

  it('empower: one candidate per hand position; the winner maps back', () => {
    const run = grantedTurnIntro();
    const gi = grantIndexOf(run, 'empower');
    const handLen = run.hand.length;
    expect(handLen).toBeGreaterThan(1);
    // Make hand:1 win by a floor-clearing margin (scores: null, hand:0, hand:1, …).
    const scores = Array(handLen + 1).fill(0);
    scores[2] = 1000;
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator(scores) });
    const action = arm.pickGrantAction!(gi, run, null as never)!;
    expect(action).toEqual({ kind: 'empower', handIndex: 1 });
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('grant:empower');
    expect(rec.labels).toEqual(['null', ...Array.from({ length: handLen }, (_v, i) => `empower hand:${i}`)]);
  });

  it('grant-site rollouts force the walker grant policies OFF; other sites do not', () => {
    const specs: RunRolloutSpec[] = [];
    const capture = (_live: Run, _apply: CandidateApply | null, spec: RunRolloutSpec) => {
      specs.push(spec);
      return { score: 0, perSeed: [] };
    };
    const run = grantedTurnIntro();
    const arm = makeArbitratedStrategy(SEED, { evaluate: capture });
    arm.pickGrantAction!(grantIndexOf(run, 'redraw'), run, null as never);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs[0]!.redraw).toEqual({ kind: 'none' });
    expect(specs[0]!.empower).toEqual({ kind: 'none' });
    specs.length = 0;
    arm.pickReward!({ kind: 'daemon', daemonId: 'portunus' }, run, null as never);
    expect(specs[0]!.redraw).toBeUndefined();
    expect(specs[0]!.empower).toBeUndefined();
  });
});

describe('arbitrated grants — integration (real evaluator)', () => {
  it('SITE DETERMINISM: same runSeed + same granted turn-intro ⇒ same action + deep-equal log', () => {
    const decide = () => {
      const run = new Run(SEED, new EventBus<GameEvents>(), { grants: ['janus', 'mars'] });
      run.pauseAtTurnGates = true;
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      const arm = makeArbitratedStrategy(SEED, { k: 1 });
      const gi = run.grantViews().findIndex((g) => g.effect.kind === 'redraw' && g.remaining > 0);
      const action = arm.pickGrantAction!(gi, run, null as never);
      return { action, record: arm.driver.decisions[0]! };
    };
    const a = decide();
    const b = decide();
    expect(a.action).toEqual(b.action);
    expect(a.record).toEqual(b.record);
  }, 120_000);
});

describe('arbitrated node choice (70e) — mechanism pins (injected evaluator)', () => {
  /** A TRUE map state with a multi-node frontier (two-stage prep; depth
   *  hunted deterministically — some hops have a single child). */
  function frontierOf(run: Run): number[] {
    return run.nodeMap.edges.filter((e) => e.from === run.currentNodeId).map((e) => e.to);
  }
  let memo: Run | null = null;
  function mapStateWithChoice(): Run {
    if (memo) return Run.fromJSON(memo.toJSON(), new EventBus<GameEvents>());
    // Scan-over-pin (the harness.test.ts:195 precedent): hunt depth × walk
    // trials rather than pinning a known-good depth. The trial axis matters
    // since 77e1 — braid maps only branch at split nodes (out-degree 1
    // between splits), so a single walk line can legitimately stop on
    // choiceless nodes at every depth; varying the policy seed re-routes
    // the walk until a stop lands on a split. (Trials 4→8 at §81a: themed
    // procedural battles re-routed every walk trajectory and the old bound
    // happened to stop choiceless every time — same scan, wider net.)
    for (let trial = 0; trial < 8; trial++) {
      const t = trial * 1000;
      for (let battles = 1; battles <= 6; battles++) {
        const s = cloneRunForRollout(
          new Run(SEED, new EventBus<GameEvents>()),
          SEED + 30 + battles + t,
        );
        walkToHorizon(s, { horizonBattles: battles, policySeed: SEED + 40 + battles + t, maxHops: 80 });
        const m = cloneRunForRollout(s.run, SEED + 50 + battles + t);
        walkToHorizon(m, {
          horizonBattles: 9999,
          policySeed: SEED + 60 + battles + t,
          maxHops: 80,
          stopAtPhase: 'map',
        });
        if (m.run.phase === 'map' && frontierOf(m.run).length > 1) {
          memo = m.run;
          return Run.fromJSON(memo.toJSON(), new EventBus<GameEvents>());
        }
      }
    }
    throw new Error('no multi-node frontier found in 6 depths x 8 trials');
  }

  it('challengers = the frontier minus the nominee (sorted, kinds labeled); tie → the nominee', () => {
    const run = mapStateWithChoice();
    const frontier = frontierOf(run);
    const nominee = scoredStrategy('nominee', DEFAULT_SCORED_WEIGHTS).pickNextNode(
      frontier,
      run,
      null as never,
    );
    const kindOf = new Map(run.nodeMap.nodes.map((n) => [n.id, n.kind]));
    const expected = [...frontier]
      .sort((a, b) => a - b)
      .filter((id) => id !== nominee)
      .map((id) => `enterNode:${id} (${kindOf.get(id)})`);
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator(Array(expected.length + 1).fill(0)),
    });
    expect(arm.pickNextNode(frontier, run, null as never)).toBe(nominee);
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('nodeChoice');
    expect(rec.labels).toEqual(['null', ...expected]);
    expect(rec.epsilon).toBe(NODE_CHOICE_EPSILON);
  });

  it('a challenger that clears ε wins → its node id is returned', () => {
    const run = mapStateWithChoice();
    const frontier = frontierOf(run);
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator([0, 1000, ...Array(frontier.length).fill(0)]),
    });
    const picked = arm.pickNextNode(frontier, run, null as never);
    const rec = arm.driver.decisions[0]!;
    expect(rec.chosenIndex).toBe(1);
    expect(rec.labels[1]).toContain(`enterNode:${picked}`);
  });

  it('the rollout override carries the tail + pins the null pick to the base nominator', () => {
    const specs: RunRolloutSpec[] = [];
    const capture = (_live: Run, _apply: CandidateApply | null, spec: RunRolloutSpec) => {
      specs.push(spec);
      return { score: 0, perSeed: [] };
    };
    const run = mapStateWithChoice();
    const frontier = frontierOf(run);
    // Non-zero path weights so the tail has something to price.
    const weights: ScoredWeights = {
      ...DEFAULT_SCORED_WEIGHTS,
      path: { ...DEFAULT_SCORED_WEIGHTS.path, rest: 1 },
    };
    const arm = makeArbitratedStrategy(SEED, { evaluate: capture, weights });
    arm.pickNextNode(frontier, run, null as never);
    const spec = specs[0]!;
    expect(spec.strategy?.name).toBe('rollout-node');
    expect(spec.tailScore).toBeDefined();
    // The tail = DP_TAIL_SCALE × max over ONWARD children of bestScore —
    // recomputed independently at the live node (self-weight excluded).
    const best = makeBestScore(run.nodeMap, weights);
    const onward = frontierOf(run).map((id) => best(id));
    expect(spec.tailScore!(run)).toBe(DP_TAIL_SCALE * Math.max(...onward));
    // Other sites carry NO tail (the override never leaks).
    specs.length = 0;
    arm.pickReward!({ kind: 'daemon', daemonId: 'portunus' }, run, null as never);
    expect(specs[0]!.tailScore).toBeUndefined();
  });

  it('§90 — DP_TAIL_SCALE is the rest heal in pool HP: restHealFraction × max, and the ARM exchange rate held at 5', () => {
    // The definition (config-derived) …
    expect(DP_TAIL_SCALE).toBe(HEALTH.restHealFraction * HEALTH.playerHealthMax);
    // … AND the exact pin: the §85g6d-signed ARM priced one path-weight
    // point at 5 pool HP under the absolute `restHealAmount`; the §90
    // fraction re-expression must be byte-identical for the arm. A pool-max
    // or fraction move that changes this is a DELIBERATE arm change — re-pin
    // it with the re-search (§92), never silently.
    expect(DP_TAIL_SCALE).toBe(5);
  });
});

describe('arbitrated node choice (70e) — the elite-detour case (real evaluator)', () => {
  it('an elite/non-elite frontier arbitrates deterministically (the 68e case, exercised)', () => {
    // Hunt a map state whose frontier holds an elite AND a non-elite
    // (W2 guarantees every elite a non-elite sibling somewhere; find one
    // on the frontier). Deterministic scan over seeds × depths.
    function eliteChoiceState(): Run {
      for (let seed = SEED; seed < SEED + 6; seed++) {
        for (let battles = 1; battles <= 5; battles++) {
          const s = cloneRunForRollout(new Run(seed, new EventBus<GameEvents>()), seed + battles);
          const w = walkToHorizon(s, {
            horizonBattles: battles,
            policySeed: seed + battles + 100,
            maxHops: 80,
          });
          if (w.outcome !== 'horizon') break;
          const m = cloneRunForRollout(s.run, seed + battles + 200);
          walkToHorizon(m, {
            horizonBattles: 9999,
            policySeed: seed + battles + 300,
            maxHops: 80,
            stopAtPhase: 'map',
          });
          if (m.run.phase !== 'map') continue;
          const kindOf = new Map(m.run.nodeMap.nodes.map((n) => [n.id, n.kind]));
          const kinds = m.run.nodeMap.edges
            .filter((e) => e.from === m.run.currentNodeId)
            .map((e) => kindOf.get(e.to));
          if (kinds.includes('elite') && kinds.some((k) => k !== 'elite')) return m.run;
        }
      }
      throw new Error('no elite/non-elite frontier found in the scan');
    }
    const state = eliteChoiceState();
    const snap = state.toJSON();
    const decide = () => {
      const run = Run.fromJSON(snap, new EventBus<GameEvents>());
      const frontier = run.nodeMap.edges
        .filter((e) => e.from === run.currentNodeId)
        .map((e) => e.to);
      const arm = makeArbitratedStrategy(SEED, { k: 1 });
      const picked = arm.pickNextNode(frontier, run, null as never);
      return { picked, record: arm.driver.decisions[0]! };
    };
    const a = decide();
    const b = decide();
    expect(a.picked).toBe(b.picked);
    expect(a.record).toEqual(b.record);
    expect(a.record.site).toBe('nodeChoice');
  }, 240_000);
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

describe('arbitrated event choices (74g) — mechanism pins (injected evaluator)', () => {
  /** A SHIPPED-catalog event state (the shrine, forced at the root) —
   *  integration rollouts wire-round-trip the run, and bespoke defs
   *  hard-reject on decode (the 74b pin), so shipped content is the
   *  fixture. Entry combat-resolves ~25% of the time; hunt the seed
   *  deterministically. startingBits dials the offering choice's
   *  bitsAtLeast-10 condition on/off. */
  function shrineEventRun(startingBits: number): Run {
    for (let seed = SEED; seed < SEED + 40; seed++) {
      const run = new Run(seed, new EventBus<GameEvents>(), {
        firstNodeKind: 'event',
        forcedEventId: 'corrupted-shrine',
        startingBits,
      });
      run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
      if (run.phase === 'event') return run;
    }
    throw new Error('no seed in 40 opened the shrine (25% resolve tail)');
  }

  it('nominee = the doctrine draw; challengers = the other enabled choices with authored labels; tie → nominee', () => {
    const run = shrineEventRun(100); // 10+ bits: all 3 shrine choices enabled
    const enabled = run.enabledEventChoices();
    expect(enabled.length).toBeGreaterThan(1);
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator(Array(enabled.length).fill(0)), // null + (enabled-1)
    });
    const pick = arm.pickEventChoice!(run, new RNG(7));
    expect(enabled).toContain(pick); // the nominee stands on an all-tie
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('eventChoice');
    expect(rec.epsilon).toBe(EVENT_CHOICE_EPSILON);
    const page = run.currentEventPage()!;
    const expected = enabled
      .filter((i) => i !== pick)
      .map((i) => `choice:${i} "${page.choices[i]!.label}"`);
    expect(rec.labels).toEqual(['null', ...expected]);
    expect(rec.chosenIndex).toBe(0);
  });

  it('a disabled choice never enumerates (the shown-disabled UI row is not a candidate)', () => {
    const run = shrineEventRun(0); // <10 bits: the offering (index 1) is disabled
    const enabled = run.enabledEventChoices();
    expect(enabled).not.toContain(1);
    expect(enabled.length).toBeGreaterThan(1); // scoop + pass-by, both unconditioned
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator(Array(enabled.length).fill(0)),
    });
    arm.pickEventChoice!(run, new RNG(7));
    for (const label of arm.driver.decisions[0]!.labels) {
      expect(label).not.toContain('choice:1 ');
    }
  });

  it('a challenger that clears ε wins → its choice index is returned', () => {
    const run = shrineEventRun(100);
    const enabled = run.enabledEventChoices();
    const scores = Array(enabled.length).fill(0);
    scores[1] = 1000; // the FIRST challenger clears any floor
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator(scores) });
    const pick = arm.pickEventChoice!(run, new RNG(7));
    const rec = arm.driver.decisions[0]!;
    expect(rec.chosenIndex).toBe(1);
    expect(rec.labels[1]!.startsWith(`choice:${pick} `)).toBe(true);
  });

  it('a single enabled choice is not a decision: no draw, no rollouts, no log', () => {
    // Bespoke catalog is FINE here — the mechanism path never clones (the
    // injected evaluator would throw if consulted, and rng=null throws if
    // drawn: both zero-cost claims are load-bearing in this pin).
    const SINGLETON: EventDef[] = [
      {
        id: 'test-singleton',
        name: 'The Singleton',
        entry: 'start',
        pages: {
          start: {
            text: 'one true exit',
            choices: [
              { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
              {
                label: 'Sealed door',
                condition: { kind: 'bitsAtLeast', amount: 999999 },
                outcomes: [{ next: { kind: 'return-to-map' } }],
              },
            ],
          },
        },
      },
    ];
    let run: Run | null = null;
    for (let seed = SEED; seed < SEED + 40 && run === null; seed++) {
      const candidate = new Run(seed, new EventBus<GameEvents>(), {
        firstNodeKind: 'event',
        forcedEventId: 'test-singleton',
        eventCatalog: SINGLETON,
      });
      candidate.dispatch({ kind: 'enterNode', nodeId: candidate.nodeMap.rootId });
      if (candidate.phase === 'event') run = candidate;
    }
    expect(run).not.toBeNull();
    expect(run!.enabledEventChoices()).toEqual([0]);
    const arm = makeArbitratedStrategy(SEED, { evaluate: sequenceEvaluator([]) });
    expect(arm.pickEventChoice!(run!, null as never)).toBe(0);
    expect(arm.driver.decisions).toHaveLength(0);
  });

  it('the rollout override pins the nominee at the decision page; other sites carry no override', () => {
    const specs: RunRolloutSpec[] = [];
    const capture = (_live: Run, _apply: CandidateApply | null, spec: RunRolloutSpec) => {
      specs.push(spec);
      return { score: 0, perSeed: [] };
    };
    const run = shrineEventRun(100);
    const arm = makeArbitratedStrategy(SEED, { evaluate: capture });
    const nominee = arm.pickEventChoice!(run, new RNG(7)); // all-tie → nominee
    const spec = specs[0]!;
    expect(spec.strategy?.name).toBe('rollout-event');
    // The pin branch: at the decision's (eventId, pageId) the override
    // returns the nominee WITHOUT touching the rollout's rng.
    expect(spec.strategy!.pickEventChoice!(run, null as never)).toBe(nominee);
    // No leak: a rewardDaemon decide carries no strategy override.
    specs.length = 0;
    arm.pickReward!({ kind: 'daemon', daemonId: 'portunus' }, run, null as never);
    expect(specs[0]!.strategy).toBeUndefined();
  });
});

describe('arbitrated event choices (74g) — integration (real evaluator)', () => {
  it('SITE DETERMINISM: same runSeed + same event page ⇒ same pick + deep-equal log', () => {
    const decide = () => {
      // The hunt is deterministic, so both calls park on the same state.
      for (let seed = SEED; seed < SEED + 40; seed++) {
        const run = new Run(seed, new EventBus<GameEvents>(), {
          firstNodeKind: 'event',
          forcedEventId: 'corrupted-shrine',
          startingBits: 100,
        });
        run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
        if (run.phase !== 'event') continue;
        const arm = makeArbitratedStrategy(SEED, { k: 1 });
        const pick = arm.pickEventChoice!(run, new RNG(7));
        return { pick, record: arm.driver.decisions[0]! };
      }
      throw new Error('no seed opened the shrine');
    };
    const a = decide();
    const b = decide();
    expect(a.pick).toBe(b.pick);
    expect(a.record).toEqual(b.record);
    expect(a.record.site).toBe('eventChoice');
  }, 240_000);
});

describe('the pickEventChoice chokepoint (74g) — harness contracts', () => {
  it('ABSENT vs a doctrine-mirror pickEventChoice ⇒ byte-identical RunResult (and events are visited)', () => {
    // The 74e traversal shape: eventChance=1 over a few seeds guarantees
    // opened pages, so the mirror equivalence is non-vacuous.
    const EVENTS = { runConfig: { hopCount: 6, eventChance: 1 } };
    let visited = 0;
    for (const seed of [1, 2, 3]) {
      const without = runOne(seed, scoredStrategy('event-pin', DEFAULT_SCORED_WEIGHTS), EVENTS);
      const mirror = vi.fn((run: Run, rng: RNG): number => {
        const enabled = run.enabledEventChoices();
        return enabled[rng.int(0, enabled.length - 1)]!;
      });
      const withHook = runOne(
        seed,
        { ...scoredStrategy('event-pin', DEFAULT_SCORED_WEIGHTS), pickEventChoice: mirror },
        EVENTS,
      );
      expect(withHook).toEqual(without);
      if (without.eventsVisited > 0) expect(mirror).toHaveBeenCalled();
      visited += without.eventsVisited;
    }
    expect(visited).toBeGreaterThanOrEqual(1);
  }, 240_000);
});

describe('85d — the campRaid site (the fold rider; {null, raid})', () => {
  // A fresh Run: currentEncounter is null → the null-mapped undefined path
  // (procedural semantics) keeps the site ELIGIBLE, and decide's context
  // reads are pre-root-safe — the cheapest real-Run fixture for the
  // fake-evaluate mechanics (the harness only asks at turn-intro; the
  // site itself is phase-agnostic).
  it('raid wins past ε → true; the record carries the site vocabulary', () => {
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator([0, CAMP_RAID_EPSILON + 5]),
    });
    const run = new Run(SEED, new EventBus<GameEvents>());
    expect(arm.pickCampRaid!(run, new RNG(1))).toBe(true);
    const d = arm.driver.decisions[0]!;
    expect(d.site).toBe('campRaid');
    expect(d.labels).toEqual(['null', 'raid']);
    expect(d.epsilon).toBe(CAMP_RAID_EPSILON);
    expect(d.chosenIndex).toBe(1);
  });

  it('ties → NULL: a margin at ε stands down (the strict-> gate)', () => {
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: sequenceEvaluator([0, CAMP_RAID_EPSILON]),
    });
    expect(arm.pickCampRaid!(new Run(SEED, new EventBus<GameEvents>()), new RNG(1))).toBe(false);
    expect(arm.driver.decisions[0]!.chosenIndex).toBe(0);
  });

  it('85g6a — campRaid: false OMITS the site entirely (ABSENT = never raid; the causal-arm dial)', () => {
    const off = makeArbitratedStrategy(SEED, { campRaid: false });
    expect(off.pickCampRaid).toBeUndefined();
    // Default (absent) and explicit true both keep the site live.
    expect(makeArbitratedStrategy(SEED, {}).pickCampRaid).toBeDefined();
    expect(makeArbitratedStrategy(SEED, { campRaid: true }).pickCampRaid).toBeDefined();
  });

  it('the raid apply sets the clone flag and NOTHING else (harness-side battle-plan state)', () => {
    let capturedApply: CandidateApply | null = null;
    const capture = (_live: Run, apply: CandidateApply | null, _spec: RunRolloutSpec): RunCandidateResult => {
      if (apply !== null) capturedApply = apply;
      return { score: 0, perSeed: [] };
    };
    const arm = makeArbitratedStrategy(SEED, { evaluate: capture });
    arm.pickCampRaid!(new Run(SEED, new EventBus<GameEvents>()), new RNG(1));
    expect(capturedApply).not.toBeNull();
    const fakeClone = {} as Parameters<CandidateApply>[0];
    capturedApply!(fakeClone);
    expect(fakeClone.raidNextBattle).toBe(true);
  });

  it('the eligibility gate governs the spend: decide happens iff the REAL encounter layout can carry camps', () => {
    // A genuinely parked turn-intro (the readEpsilonAA recipe): gates on,
    // enter the root — currentEncounter is a real rolled encounter, and
    // the site reads ITS layoutId (whatever this seed rolled; the property
    // holds on either branch — the gate itself is unit-pinned in
    // campRaid.test.ts).
    const zero = (): RunCandidateResult => ({ score: 0, perSeed: [] });
    const arm = makeArbitratedStrategy(SEED, { evaluate: zero });
    // Park at a REAL turn-intro (currentEncounter lives only turn-intro →
    // battle): the readEpsilonAA parkAtTurnIntro recipe generalized
    // self-healing — map state after N battles, then scan the frontier for
    // a node that parks at the gate (the root can open the §74 boon; a
    // frontier pick can be an event/port node).
    let parked: Run | null = null;
    outer: for (let battles = 1; battles <= 4 && parked === null; battles++) {
      const s = cloneRunForRollout(new Run(SEED, new EventBus<GameEvents>()), 700 + battles);
      walkToHorizon(s, { horizonBattles: battles, policySeed: 424242 + battles, maxHops: 80 });
      const m = cloneRunForRollout(s.run, 800 + battles);
      walkToHorizon(m, {
        horizonBattles: 9999,
        policySeed: 900 + battles,
        maxHops: 80,
        stopAtPhase: 'map',
      });
      if (m.run.phase !== 'map') continue;
      for (const e of m.run.nodeMap.edges) {
        if (e.from !== m.run.currentNodeId) continue;
        const probe = cloneRunForRollout(m.run, 1000 + e.to);
        probe.run.pauseAtTurnGates = true;
        probe.run.dispatch({ kind: 'enterNode', nodeId: e.to });
        if (probe.run.phase === 'turn-intro') {
          parked = probe.run;
          break outer;
        }
      }
    }
    expect(parked).not.toBeNull();
    const run = parked!;
    expect(run.encounterMap).not.toBeNull(); // rolled at encounter start (K3.5)
    const eligible = campRaidEligible(run.encounterMap?.layoutId ?? undefined);
    expect(arm.pickCampRaid!(run, new RNG(1))).toBe(false); // zero margins never win
    expect(arm.driver.decisions).toHaveLength(eligible ? 1 : 0);
  });
});

describe('85b — walkPolicyOverlay (the all-rollouts walk-policy overlay, supersedes 84f1)', () => {
  it('always carries the dock policy; the fire policy only when the base has one (bound to the base)', () => {
    const noFire = scoredStrategy('no-fire', DEFAULT_SCORED_WEIGHTS);
    expect(noFire.pickPacketFire).toBeUndefined(); // the default vector carries no fire group
    const bare = walkPolicyOverlay(noFire);
    expect(Object.keys(bare)).toEqual(['pickPortBuy']); // dock policy is base-independent
    expect(bare.pickPacketFire).toBeUndefined(); // the finding-5 edge stays named

    const seenThis: string[] = [];
    const withFire: FuzzStrategy = {
      ...noFire,
      name: 'with-fire',
      pickPacketFire(context) {
        seenThis.push(`${this.name}:${context}`);
        return null;
      },
    };
    const overlay = walkPolicyOverlay(withFire);
    expect(Object.keys(overlay).sort()).toEqual(['pickPacketFire', 'pickPortBuy']);
    // The overlay calls the base's method WITH the base as `this`.
    const run = new Run(SEED, new EventBus<GameEvents>());
    expect(overlay.pickPacketFire!('preTurn', run, new RNG(1))).toBeNull();
    expect(seenThis).toEqual(['with-fire:preTurn']);
  });

  it('walkPortBuy mirrors the 50g fixed policy: lane order, affordability, the cache-room lock', () => {
    const stock = (over?: {
      daemons?: readonly { price: number; sold: boolean }[];
      units?: readonly { price: number; sold: boolean }[];
      packets?: readonly { price: number; sold: boolean }[];
    }): PortStock =>
      ({
        daemons: over?.daemons ?? [],
        units: over?.units ?? [],
        packets: over?.packets ?? [],
      }) as unknown as PortStock;
    const runWith = (bits: number, cacheHasRoom = true): Run =>
      ({ bits, cacheHasRoom }) as unknown as Run;

    // Lane order: an affordable daemon wins over cheaper units/packets.
    expect(
      walkPortBuy(
        stock({
          daemons: [{ price: 8, sold: false }],
          units: [{ price: 1, sold: false }],
          packets: [{ price: 1, sold: false }],
        }),
        runWith(10),
      ),
    ).toEqual({ kind: 'daemon', index: 0 });
    // Sold and unaffordable slots are skipped, within-lane slot order holds.
    expect(
      walkPortBuy(
        stock({ daemons: [{ price: 3, sold: true }, { price: 99, sold: false }, { price: 5, sold: false }] }),
        runWith(10),
      ),
    ).toEqual({ kind: 'daemon', index: 2 });
    // Falls through daemons → units → packets.
    expect(
      walkPortBuy(
        stock({ daemons: [{ price: 99, sold: false }], units: [{ price: 4, sold: false }] }),
        runWith(10),
      ),
    ).toEqual({ kind: 'unit', index: 0 });
    // The 49c cache-room lock: a full cache never proposes a packet buy
    // (the pre-dispatch guard mirrors the handler — the walk loop must
    // never wedge on a rejected dispatch).
    const packetsOnly = stock({ packets: [{ price: 2, sold: false }] });
    expect(walkPortBuy(packetsOnly, runWith(10, false))).toBeNull();
    expect(walkPortBuy(packetsOnly, runWith(10, true))).toEqual({ kind: 'packet', index: 0 });
    // Nothing affordable → null (the ask-until-null stop).
    expect(walkPortBuy(stock({ daemons: [{ price: 99, sold: false }] }), runWith(10))).toBeNull();
  });
});

describe('85f — pinnedEventPick (the enablement-guarded 74g nominee pin)', () => {
  const ref = { eventId: 'ev', pageId: 'p' };
  const cloneAt = (eventId: string, pageId: string, enabled: number[]): Run =>
    ({ activeEvent: { eventId, pageId }, enabledEventChoices: () => enabled }) as unknown as Run;

  it('returns the nominee at the decision page while it is enabled', () => {
    expect(pinnedEventPick(ref, 1, cloneAt('ev', 'p', [0, 1]), new RNG(1))).toBe(1);
  });

  it('falls back to an ENABLED choice when the nominee is disabled — the cheese-tax repeatable no-op loop (85f, seed 42)', () => {
    for (let s = 0; s < 20; s++) {
      const pick = pinnedEventPick(ref, 1, cloneAt('ev', 'p', [0, 2]), new RNG(s));
      expect([0, 2]).toContain(pick);
    }
  });

  it('plays uniform-random-among-enabled at any other page', () => {
    const pick = pinnedEventPick(ref, 1, cloneAt('other', 'p', [0, 2]), new RNG(3));
    expect([0, 2]).toContain(pick);
  });
});

describe('85g1 — per-site candidate-delta keys (the de-fold restriction)', () => {
  it('portBuy passes the union of the offered slot keys (level stripped)', () => {
    const run = docked();
    const specs: RunRolloutSpec[] = [];
    const arm = makeArbitratedStrategy(SEED, {
      evaluate: (_live: Run, _apply: CandidateApply | null, spec: RunRolloutSpec) => {
        specs.push(spec);
        return { score: 0, perSeed: [] };
      },
    });
    arm.pickPortBuy!(run.portStock!, run, null as never);
    // The independent restatement, from the STOCK (the input surface,
    // not the site's own helper — the §79e circularity rule).
    const stock = run.portStock!;
    const expected: string[] = [];
    stock.daemons.forEach((s) => {
      if (!s.sold && run.bits >= s.price) expected.push(`daemon:${s.daemonId}`);
    });
    stock.units.forEach((s) => {
      if (!s.sold && run.bits >= s.price) expected.push(`unit:${s.template.archetype}`);
    });
    stock.packets.forEach((s) => {
      if (!s.sold && run.bits >= s.price && run.cacheHasRoom)
        expected.push(`packet:${s.packetId}`);
    });
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) expect(spec.priorItemKeys).toEqual(expected);
  });
});

describe('85g1 — eventPriorItemKeys (the static over-approximation)', () => {
  it('collects holdings-touching op ids across ALL pages; removeUnit excluded; sorted; undefined → []', () => {
    const def: EventDef = {
      id: 'fixture-event',
      name: 'Fixture',
      entry: 'a',
      pages: {
        a: {
          text: '…',
          choices: [
            {
              label: 'take',
              outcomes: [
                {
                  effects: [
                    { op: 'addPacket', packetId: 'patch' },
                    { op: 'gainBits', amount: 5 }, // bits are not a holding — no key
                  ],
                  next: 'b',
                },
              ],
            },
          ],
        },
        b: {
          text: '…',
          choices: [
            {
              label: 'pay',
              outcomes: [
                {
                  effects: [
                    { op: 'removeDaemon', daemonId: 'mars' },
                    { op: 'grantUnit', archetype: 'shaman' },
                    { op: 'removeUnit', pick: 'weakest' }, // dynamic key — the documented carve-out
                  ],
                  next: { kind: 'return-to-map' },
                },
              ],
            },
          ],
        },
      },
    };
    expect(eventPriorItemKeys(def)).toEqual(['daemon:mars', 'packet:patch', 'unit:shaman']);
    expect(eventPriorItemKeys(undefined)).toEqual([]);
  });
});
