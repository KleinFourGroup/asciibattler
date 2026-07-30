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
  scoreTerminal,
  RUN_DEATH_PENALTY,
  RUN_COMPLETION_BONUS,
  type RunMetrics,
  type RunRolloutSpec,
} from './evaluator';

const BASE: RunMetrics = {
  playerHealth: HEALTH.playerHealthMax,
  bits: 10,
  rosterSize: 5,
  phase: 'map',
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
    }
    expect(JSON.stringify(live.toJSON())).toBe(before);
  });

  it('throws on an empty pair set', () => {
    const live = liveRun(7);
    expect(() =>
      evaluateRunCandidate(live, null, { horizonBattles: 1, pairs: [] }),
    ).toThrow(/pairs must be non-empty/);
  });
});
