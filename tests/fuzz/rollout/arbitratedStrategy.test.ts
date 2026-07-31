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
import type { RNG } from '../../../src/core/RNG';
import type { RewardPortion } from '../../../src/run/rewards';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import { runOne } from '../harness';
import { walkToHorizon } from './walker';
import type { CandidateApply, RunCandidateResult, RunRolloutSpec } from './evaluator';
import type { FuzzStrategy, GrantAction, PortBuy } from '../Strategy';
import { maxPowerIndex, minPowerIndex, scoredStrategy } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS } from '../strategies/scoredWeights';
import { selectRedrawPositions } from '../redrawPolicy';
import { selectEmpowerPosition } from '../empowerPolicy';
import {
  makeArbitratedStrategy,
  PORT_BUY_EPSILON,
  FIRE_PRETURN_EPSILON,
  FIRE_OUTOFBATTLE_EPSILON,
  REWARD_DAEMON_EPSILON,
  GRANT_EPSILON,
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
    const run = new Run(SEED, new EventBus<GameEvents>(), { grants: ['janus', 'mars'] });
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
