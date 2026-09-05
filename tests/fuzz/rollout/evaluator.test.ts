/**
 * 69d — the terminal score + evaluator contracts:
 *
 * 1. THE SCORING RULE (pure, no battles driven): pool-damage sign
 *    (heals score positive), DEATH DOMINANCE (dying with an untouched
 *    pool scores worse than surviving max pool damage — derived from
 *    HEALTH.playerHealthMax, never hardcoded), completion dominance,
 *    λ=0 ignores bits while the telemetry columns still report them,
 *    λ>0 prices them in.
 * 2. CRN DETERMINISM — same pairs + same candidate ⇒ identical result.
 * 3. THE A/A FOUNDATION — a byte-inert apply (no-op closure) scores
 *    IDENTICALLY to the null arm under the same pairs: paired margins
 *    of inert candidates are EXACTLY zero, which is what makes the 69f
 *    noise-floor derivation a measurement of CRN pairing residue, not
 *    of evaluator slop.
 * 4. WIRING — a real candidate (an enterNode dispatch) evaluates
 *    finitely with per-pair breakdowns; gates-before-apply keeps the
 *    battle from starting before the walker attaches.
 */

import { describe, expect, it } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { HEALTH } from '../../../src/config/health';
import { Run } from '../../../src/run/Run';
import {
  evaluateRunCandidate,
  priorBonusOf,
  scoreTerminal,
  PRIOR_BONUS_CAP,
  RUN_DEATH_PENALTY,
  RUN_COMPLETION_BONUS,
  type RunHoldingsPrior,
  type RunMetrics,
  type RunRolloutSpec,
} from './evaluator';

const BASE: RunMetrics = {
  playerHealth: HEALTH.playerHealthMax,
  bits: 10,
  rosterSize: 5,
  phase: 'map',
  daemonIds: [],
  cachePacketIds: [],
  teamArchetypes: ['soldier', 'archer'],
};

function after(over: Partial<RunMetrics>): RunMetrics {
  return { ...BASE, ...over };
}

describe('scoreTerminal (69d — the resolution-4 lock, pure)', () => {
  it('scores pool damage negatively and heals positively (signed on purpose)', () => {
    const hurt = scoreTerminal(BASE, after({ playerHealth: BASE.playerHealth - 7 }), 0);
    expect(hurt.poolDamageTaken).toBe(7);
    expect(hurt.score).toBe(-7);
    // A pool already below max that heals inside the horizon scores > 0.
    const low = after({ playerHealth: 3 });
    const healed = scoreTerminal(low, after({ playerHealth: 8 }), 0);
    expect(healed.poolDamageTaken).toBe(-5);
    expect(healed.score).toBe(5);
  });

  it('DEATH DOMINANCE: dying untouched scores worse than surviving max pool damage', () => {
    // Derived from config: the worst survivable outcome is losing the
    // whole pool; death must out-rank it from ANY damage level.
    const deadUntouched = scoreTerminal(BASE, after({ phase: 'defeat' }), 0);
    const aliveMaxDamage = scoreTerminal(BASE, after({ playerHealth: 0 }), 0);
    expect(deadUntouched.died).toBe(true);
    expect(deadUntouched.score).toBeLessThan(aliveMaxDamage.score);
    expect(RUN_DEATH_PENALTY).toBeGreaterThan(HEALTH.playerHealthMax);
  });

  it('COMPLETION DOMINANCE: completing hurt scores better than surviving untouched', () => {
    const completedHurt = scoreTerminal(
      BASE,
      after({ phase: 'complete', playerHealth: 1 }),
      0,
    );
    const aliveUntouched = scoreTerminal(BASE, after({}), 0);
    expect(completedHurt.completed).toBe(true);
    expect(completedHurt.score).toBeGreaterThan(aliveUntouched.score);
    expect(RUN_COMPLETION_BONUS).toBeGreaterThan(HEALTH.playerHealthMax);
  });

  it('λ=0 ignores bits in the score but the telemetry columns still report them', () => {
    const spent = scoreTerminal(BASE, after({ bits: 0, rosterSize: 7 }), 0);
    const banked = scoreTerminal(BASE, after({ bits: 60, rosterSize: 7 }), 0);
    expect(spent.score).toBe(banked.score); // λ=0: bits are score-invisible
    expect(spent.bitsDelta).toBe(-10); // ...but never telemetry-invisible
    expect(banked.bitsDelta).toBe(50);
    expect(spent.rosterDelta).toBe(2);
  });

  it('λ>0 prices bits into the score at exactly λ per bit', () => {
    const lambda = 0.05;
    const spent = scoreTerminal(BASE, after({ bits: 0 }), lambda);
    const banked = scoreTerminal(BASE, after({ bits: 60 }), lambda);
    expect(banked.score - spent.score).toBeCloseTo(lambda * 60, 10);
  });
});

describe('85c — the fold (priorBonus over the holdings delta; the 2026-08-24 shape-lock)', () => {
  const TABLE = {
    'daemon:minerva': 29.58,
    'packet:patch': 20.84,
    'packet:reroute': -7.3,
    'unit:mercenary': -1.75,
    'unit:shaman': 14.35,
  } as const;
  const prior = (over?: Partial<RunHoldingsPrior>): RunHoldingsPrior => ({
    lambda: 1,
    table: TABLE,
    ...over,
  });

  it('sums meanΔ × count over the delta; held-both-sides cancels; unknown items are 0', () => {
    const b = after({ daemonIds: ['minerva'], cachePacketIds: ['reroute'], teamArchetypes: ['soldier'] });
    const a = after({
      daemonIds: ['minerva'], // held both sides — cancels
      cachePacketIds: ['reroute', 'patch'], // +patch
      teamArchetypes: ['soldier', 'shaman', 'unknown-arch'], // +shaman, +unknown (no row → 0)
    });
    const { bonus, clamped } = priorBonusOf(b, a, prior());
    expect(bonus).toBeCloseTo(TABLE['packet:patch'] + TABLE['unit:shaman'], 10);
    expect(clamped).toBe(false);
  });

  it('multiset counts: a second copy of the same item counts again, losses charge', () => {
    const b = after({ teamArchetypes: ['mercenary'] });
    const a = after({ teamArchetypes: ['mercenary', 'mercenary', 'mercenary'] });
    expect(priorBonusOf(b, a, prior()).bonus).toBeCloseTo(2 * TABLE['unit:mercenary'], 10);
    // The reverse delta charges the loss (a sold unit, a walk casualty).
    expect(priorBonusOf(a, b, prior()).bonus).toBeCloseTo(-2 * TABLE['unit:mercenary'], 10);
  });

  it('12b — fired counts as HELD: firing never charges, acquire-and-fire still credits', () => {
    // The null-branch shape: live holds patch; the walked clone FIRED it.
    const b = after({ cachePacketIds: ['patch'] });
    const a = after({ cachePacketIds: [] });
    expect(priorBonusOf(b, a, prior()).bonus).toBeCloseTo(-TABLE['packet:patch'], 10); // without the rule: charged
    expect(priorBonusOf(b, a, prior({ firedPacketIds: ['patch'] })).bonus).toBe(0); // with it: neutral
    // The buy-branch shape: bought during the walk AND fired — still a holding.
    const bought = priorBonusOf(after({}), after({}), prior({ firedPacketIds: ['patch'] }));
    expect(bought.bonus).toBeCloseTo(TABLE['packet:patch'], 10);
  });

  it('λ scales linearly; 12a — the ±cap clamps and FLAGS', () => {
    const b = after({});
    const a = after({ daemonIds: ['minerva'], teamArchetypes: ['soldier', 'archer', 'shaman'] });
    const sum = TABLE['daemon:minerva'] + TABLE['unit:shaman'];
    expect(priorBonusOf(b, a, prior({ lambda: 0.5 })).bonus).toBeCloseTo(0.5 * sum, 10);
    // Force a breach: enough minervas to read past the cap (config-derived —
    // the cap is half the death ordinal, 10 × the pool max; 92d moved the max
    // 20 → 40 and the old literal "6 minervas = 177.5 > the 100 cap" stopped
    // breaching at 200).
    const stackSize = Math.ceil(PRIOR_BONUS_CAP / TABLE['daemon:minerva']!) + 1;
    expect(stackSize * TABLE['daemon:minerva']!).toBeGreaterThan(PRIOR_BONUS_CAP);
    const stacked = after({ daemonIds: Array(stackSize).fill('minerva') as string[] });
    const breach = priorBonusOf(b, stacked, prior());
    expect(PRIOR_BONUS_CAP).toBeCloseTo(0.5 * RUN_DEATH_PENALTY, 10);
    expect(breach.bonus).toBe(PRIOR_BONUS_CAP);
    expect(breach.clamped).toBe(true);
    const negBreach = priorBonusOf(stacked, b, prior());
    expect(negBreach.bonus).toBe(-PRIOR_BONUS_CAP);
    expect(negBreach.clamped).toBe(true);
  });

  it('the breakdown contract: absent without a prior spec; present (even 0.00) with one; clamp flag only on engage', () => {
    const plain = scoreTerminal(BASE, after({}), 0);
    expect('priorBonus' in plain).toBe(false);
    expect('priorClamped' in plain).toBe(false);
    const folded = scoreTerminal(BASE, after({}), 0, prior());
    expect(folded.priorBonus).toBe(0); // no delta — still visible (the tailBonus discipline)
    expect('priorClamped' in folded).toBe(false);
    const gained = scoreTerminal(BASE, after({ daemonIds: ['minerva'] }), 0, prior());
    expect(gained.score).toBeCloseTo(TABLE['daemon:minerva'], 10);
    expect(gained.priorBonus).toBeCloseTo(TABLE['daemon:minerva'], 10);
  });

  it("85g1 — the candidate-delta restriction: off-key deltas fold 0; 'all'/absent = unrestricted", () => {
    // The walked clone acquired the decision's daemon AND an off-key
    // packet (walk stochasticity — landmine 12c's residual, the 85e
    // σ×2.3–9.5 attribution noise the 85h protocol de-folds).
    const b = after({});
    const a = after({ daemonIds: ['minerva'], cachePacketIds: ['patch'] });
    const both = TABLE['daemon:minerva'] + TABLE['packet:patch'];
    expect(priorBonusOf(b, a, prior()).bonus).toBeCloseTo(both, 10); // absent = unrestricted (fixtures)
    expect(priorBonusOf(b, a, prior({ itemKeys: 'all' })).bonus).toBeCloseTo(both, 10); // the explicit opt-out (campRaid)
    // The decision's own key alone participates.
    expect(
      priorBonusOf(b, a, prior({ itemKeys: ['daemon:minerva'] })).bonus,
    ).toBeCloseTo(TABLE['daemon:minerva'], 10);
    // An empty key set folds 0 whatever the walk acquired (grant/node sites).
    expect(priorBonusOf(b, a, prior({ itemKeys: [] })).bonus).toBe(0);
    // Losses restrict identically (the reverse delta).
    expect(
      priorBonusOf(a, b, prior({ itemKeys: ['packet:patch'] })).bonus,
    ).toBeCloseTo(-TABLE['packet:patch'], 10);
    // 12b composes: an off-key fired packet stays excluded.
    const fired = priorBonusOf(
      b,
      after({ daemonIds: ['minerva'] }),
      prior({ itemKeys: ['daemon:minerva'], firedPacketIds: ['patch'] }),
    );
    expect(fired.bonus).toBeCloseTo(TABLE['daemon:minerva'], 10);
  });
});

describe('evaluateRunCandidate (69d — the evaluator wiring)', () => {
  const SPEC: RunRolloutSpec = {
    horizonBattles: 1,
    pairs: [
      { cloneSeed: 555, policySeed: 91 },
      { cloneSeed: 556, policySeed: 92 },
    ],
  };

  function liveRun(seed: number): Run {
    return new Run(seed, new EventBus<GameEvents>());
  }

  it('CRN determinism: same pairs + same candidate ⇒ identical result', () => {
    const live = liveRun(20260730);
    const a = evaluateRunCandidate(live, null, SPEC);
    const b = evaluateRunCandidate(live, null, SPEC);
    expect(a).toEqual(b);
    expect(a.perSeed).toHaveLength(SPEC.pairs.length);
  });

  it('A/A: a byte-inert apply scores IDENTICALLY to the null arm (the 69f foundation)', () => {
    const live = liveRun(20260730);
    const nullArm = evaluateRunCandidate(live, null, SPEC);
    const inert = evaluateRunCandidate(live, () => {}, SPEC);
    expect(inert.score).toBe(nullArm.score);
    expect(inert.perSeed).toEqual(nullArm.perSeed);
  });

  it('a real candidate (enterNode) evaluates finitely; the live run is untouched', () => {
    const live = liveRun(20260730);
    const before = JSON.stringify(live.toJSON());
    const result = evaluateRunCandidate(
      live,
      (clone) => clone.run.dispatch({ kind: 'enterNode', nodeId: clone.run.nodeMap.rootId }),
      SPEC,
    );
    expect(Number.isFinite(result.score)).toBe(true);
    for (const b of result.perSeed) {
      expect(Number.isFinite(b.poolDamageTaken)).toBe(true);
      expect(Number.isFinite(b.bitsDelta)).toBe(true);
      // 85-pre F1 — every real evaluation carries its walk outcome (a
      // 'stuck' terminal is otherwise invisible; WORKLOG §85-pre finding 3).
      expect(['horizon', 'complete', 'defeat', 'stuck']).toContain(b.walkOutcome);
    }
    expect(JSON.stringify(live.toJSON())).toBe(before);
  });

  it('85-pre F1 — a maxHops-starved walk reads walkOutcome \'stuck\', not a healthy truncation', () => {
    const live = liveRun(20260730);
    // maxHops −1 trips the walker's bound at the loop top, before any battle.
    const result = evaluateRunCandidate(live, null, { ...SPEC, maxHops: -1 });
    for (const b of result.perSeed) expect(b.walkOutcome).toBe('stuck');
  });

  it('throws on an empty pair set', () => {
    const live = liveRun(7);
    expect(() =>
      evaluateRunCandidate(live, null, { horizonBattles: 1, pairs: [] }),
    ).toThrow(/pairs must be non-empty/);
  });

  it('70e — a tailScore adds exactly its value per pair (tailBonus visible; absent = no column)', () => {
    const live = liveRun(20260730);
    const plain = evaluateRunCandidate(live, null, SPEC);
    const tailed = evaluateRunCandidate(live, null, { ...SPEC, tailScore: () => 7 });
    expect(tailed.score).toBe(plain.score + 7);
    tailed.perSeed.forEach((b, i) => {
      expect(b.tailBonus).toBe(7);
      expect(b.score).toBe(plain.perSeed[i]!.score + 7);
      expect(b.poolDamageTaken).toBe(plain.perSeed[i]!.poolDamageTaken);
    });
    expect(plain.perSeed[0]!.tailBonus).toBeUndefined();
  });

  it('85c — λ_prior=0 is BYTE-IDENTICAL to no prior config at all (the board-control contract)', () => {
    const live = liveRun(20260730);
    const plain = evaluateRunCandidate(live, null, SPEC);
    const zeroed = evaluateRunCandidate(live, null, {
      ...SPEC,
      priorLambda: 0,
      priorTable: { 'daemon:minerva': 29.58 },
    });
    expect(zeroed).toEqual(plain);
    expect(plain.perSeed[0]!.priorBonus).toBeUndefined();
  });

  it('85c — λ_prior ≠ 0 without a table throws LOUD (a launch mistake, never a silent 0-prior)', () => {
    expect(() =>
      evaluateRunCandidate(liveRun(7), null, { ...SPEC, priorLambda: 0.5 }),
    ).toThrow(/priorTable/);
  });

  it('85c — λ_prior ≠ 0 folds the prior into every pair (priorBonus visible; base components untouched)', () => {
    const live = liveRun(20260730);
    const plain = evaluateRunCandidate(live, null, SPEC);
    // An empty table: the fold path runs end to end (holdings diff, fired
    // tally, breakdown field) but every value maps to 0 — so the SCORE
    // matches the plain arm exactly while the visibility contract holds.
    const folded = evaluateRunCandidate(live, null, { ...SPEC, priorLambda: 1, priorTable: {} });
    expect(folded.score).toBe(plain.score);
    folded.perSeed.forEach((b, i) => {
      expect(b.priorBonus).toBe(0);
      expect(b.poolDamageTaken).toBe(plain.perSeed[i]!.poolDamageTaken);
      expect(b.bitsDelta).toBe(plain.perSeed[i]!.bitsDelta);
    });
    // A real table: the walk's own acquisitions (recruits, buys) can move
    // the delta, and score ≡ plain + priorBonus per pair — the recompute
    // lint at the breakdown level.
    const valued = evaluateRunCandidate(live, null, {
      ...SPEC,
      priorLambda: 1,
      priorTable: { 'unit:mercenary': -1.75, 'unit:shaman': 14.35, 'packet:patch': 20.84 },
    });
    valued.perSeed.forEach((b, i) => {
      expect(b.priorBonus).not.toBeUndefined();
      expect(b.score).toBeCloseTo(plain.perSeed[i]!.score + b.priorBonus!, 10);
    });
  });

  it('85g1 — priorItemKeys threads to the fold: [] ≡ the empty-table fold; \'all\' ≡ absent', () => {
    const live = liveRun(20260730);
    const TABLE = { 'unit:mercenary': -1.75, 'unit:shaman': 14.35, 'packet:patch': 20.84 };
    const valued = evaluateRunCandidate(live, null, {
      ...SPEC,
      priorLambda: 1,
      priorTable: TABLE,
    });
    // 'all' is byte-identical to leaving the field off (the explicit opt-out).
    const all = evaluateRunCandidate(live, null, {
      ...SPEC,
      priorLambda: 1,
      priorTable: TABLE,
      priorItemKeys: 'all',
    });
    expect(all).toEqual(valued);
    // [] restricts EVERY key away — byte-identical to folding an empty
    // table (the fold path runs, every value maps to 0). If the field
    // failed to thread, this would equal the unrestricted `valued` run
    // instead whenever the walk moves the holdings delta.
    const none = evaluateRunCandidate(live, null, {
      ...SPEC,
      priorLambda: 1,
      priorTable: TABLE,
      priorItemKeys: [],
    });
    const emptyTable = evaluateRunCandidate(live, null, {
      ...SPEC,
      priorLambda: 1,
      priorTable: {},
    });
    expect(none).toEqual(emptyTable);
    none.perSeed.forEach((b) => expect(b.priorBonus).toBe(0));
  });
});
