/**
 * 84c — the shadow-only RECRUIT site on the arbitrated arm:
 *
 * 1. The live pick is the BASE's, untouched (never arbitrated — the
 *    recruit-censoring lesson): same return, base asked exactly once, the
 *    base's rng consumption identical shadow on/off.
 * 2. Under the shadow, ONE long-horizon record per offer: site 'recruit',
 *    horizon marker, null = PASS (the explicit baseline), challengers =
 *    every offer slot in order, labeled `recruit unit:<archetype>:L<n>`,
 *    hopsRemaining read off the live run.
 * 3. Shadow off ⇒ no record at all (the arm is byte-identical to before).
 * 4. INTEGRATION: the real evaluator at a finite shadow horizon — every
 *    candidate's apply dispatches on its CLONE (pass / choose), the live
 *    run is never touched.
 *
 * The fixture rides the 84c walker `stopAtPhase: 'recruit'` extension
 * (pinned here by the fixture's own phase assertion), re-materialized per
 * test via a plain `Run.fromJSON` round-trip.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';
import type { GameEvents } from '../../../src/core/events';
import { RNG } from '../../../src/core/RNG';
import { Run, type RunSnapshot } from '../../../src/run/Run';
import { cloneRunForRollout } from '../../../src/bot/runRollout';
import type { FuzzStrategy } from '../Strategy';
import { scoredStrategy } from '../strategies/scored';
import { DEFAULT_SCORED_WEIGHTS } from '../strategies/scoredWeights';
import { walkToHorizon } from './walker';
import type { CandidateApply, RunCandidateResult, RunRolloutSpec } from './evaluator';
import { makeArbitratedStrategy, RECRUIT_EPSILON } from './arbitratedStrategy';

const SEED = 20260822;

let recruitSnapshot: RunSnapshot;

beforeAll(() => {
  for (let s = SEED; s < SEED + 40; s++) {
    const state = cloneRunForRollout(new Run(s, new EventBus<GameEvents>()), s + 1);
    walkToHorizon(state, {
      horizonBattles: 9999,
      policySeed: s + 4,
      maxHops: 80,
      stopAtPhase: 'recruit',
    });
    if (state.run.phase === 'recruit' && (state.run.currentOffer?.length ?? 0) > 1) {
      recruitSnapshot = state.run.toJSON();
      return;
    }
  }
  throw new Error('no seed in the scan reached a recruit offer with ≥2 slots');
});

function atOffer(): Run {
  return Run.fromJSON(JSON.parse(JSON.stringify(recruitSnapshot)), new EventBus<GameEvents>());
}

/** A counting fake: constant score, records how many candidates were walked. */
function countingEvaluator() {
  let calls = 0;
  const evaluate = (_live: Run, _apply: CandidateApply | null, _spec: RunRolloutSpec): RunCandidateResult => {
    calls++;
    return { score: 0, perSeed: [] };
  };
  return { evaluate, count: () => calls };
}

describe('the fixture', () => {
  it('parks at a recruit offer (the stopAtPhase recruit extension works)', () => {
    const run = atOffer();
    expect(run.phase).toBe('recruit');
    expect(run.currentOffer!.length).toBeGreaterThan(1);
  });
});

describe('the shadow-only recruit site', () => {
  it('the live pick is the base’s, asked once; shadow on/off returns the same index', () => {
    const base: FuzzStrategy = {
      ...scoredStrategy('stub', DEFAULT_SCORED_WEIGHTS),
      pickRecruit: vi.fn(() => 1),
    };
    const { evaluate } = countingEvaluator();
    const shadowed = makeArbitratedStrategy(SEED, {
      base,
      evaluate,
      shadowHorizon: { horizonBattles: 'run' },
    });
    const run = atOffer();
    expect(shadowed.pickRecruit(run.currentOffer!, run, new RNG(3))).toBe(1);
    expect(base.pickRecruit).toHaveBeenCalledOnce();

    const plain = makeArbitratedStrategy(SEED, { base, evaluate });
    expect(plain.pickRecruit(run.currentOffer!, run, new RNG(3))).toBe(1);
    expect(plain.driver.decisions).toHaveLength(0);
  });

  it('the base’s rng consumption is identical shadow on/off', () => {
    const base = scoredStrategy('real', DEFAULT_SCORED_WEIGHTS);
    const { evaluate } = countingEvaluator();
    const consumed = (shadow: boolean): number => {
      const arm = makeArbitratedStrategy(SEED, {
        base,
        evaluate,
        ...(shadow ? { shadowHorizon: { horizonBattles: 'run' as const } } : {}),
      });
      const run = atOffer();
      const rng = new RNG(3);
      arm.pickRecruit(run.currentOffer!, run, rng);
      return rng.toJSON().state;
    };
    expect(consumed(true)).toBe(consumed(false));
  });

  it('records ONE long-horizon decision: null = pass, every slot a challenger, in order', () => {
    const { evaluate, count } = countingEvaluator();
    const arm = makeArbitratedStrategy(SEED, {
      base: scoredStrategy('real', DEFAULT_SCORED_WEIGHTS),
      evaluate,
      shadowHorizon: { horizonBattles: 'run' },
    });
    const run = atOffer();
    const offer = run.currentOffer!;
    arm.pickRecruit(offer, run, new RNG(3));
    expect(arm.driver.decisions).toHaveLength(1);
    const rec = arm.driver.decisions[0]!;
    expect(rec.site).toBe('recruit');
    expect(rec.horizon).toBe('run');
    expect(rec.labels).toEqual([
      'null',
      ...offer.map((t) => `recruit unit:${t.archetype}:L${t.level}`),
    ]);
    expect(rec.epsilon).toBe(RECRUIT_EPSILON);
    expect(rec.hopsRemaining).toBe(run.hopsRemaining);
    expect(rec.hop).toBe(run.currentHop);
    expect(count()).toBe(offer.length + 1); // null + every slot, long horizon only
  });

  it('INTEGRATION: the applies dispatch on the clones; the live run is never touched', () => {
    const arm = makeArbitratedStrategy(SEED, {
      base: scoredStrategy('real', DEFAULT_SCORED_WEIGHTS),
      // A finite shadow horizon keeps the real walks cheap (one battle per
      // pair per candidate); the shape under test is the dispatch, not the
      // horizon.
      shadowHorizon: { horizonBattles: 1 },
    });
    const run = atOffer();
    const before = JSON.stringify(run.toJSON());
    const offer = run.currentOffer!;
    arm.pickRecruit(offer, run, new RNG(3));
    expect(JSON.stringify(run.toJSON())).toBe(before);
    const rec = arm.driver.decisions[0]!;
    expect(rec.horizon).toBe(1);
    expect(rec.results).toHaveLength(offer.length + 1);
    for (const r of rec.results) expect(r.perSeed).toHaveLength(2); // the primary's K
    // Determinism (the site-level exit criterion): a second arm on the same
    // seed + state logs a deep-equal record.
    const again = makeArbitratedStrategy(SEED, {
      base: scoredStrategy('real', DEFAULT_SCORED_WEIGHTS),
      shadowHorizon: { horizonBattles: 1 },
    });
    const run2 = atOffer();
    again.pickRecruit(run2.currentOffer!, run2, new RNG(3));
    expect(again.driver.decisions[0]).toEqual(rec);
  });
});
