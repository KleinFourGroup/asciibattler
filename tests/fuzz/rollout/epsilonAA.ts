/**
 * 69f — the empirical ε derivation (kickoff resolution 5, AMENDED by the
 * 69d finding — the methodology write-up is WORKLOG §69):
 *
 * ε's job at the run layer is purely don't-act-on-noise (one-shot
 * decisions — no thrash to damp). The noise it must guard is the
 * PAIRING-BROKEN case: a real candidate CHANGES the clone's state, the
 * shared CRN seeds then walk a diverged trajectory, and the paired
 * margin carries resample noise of order the outcome variance — the
 * worst case being pairing FULLY broken (two equal-value arms sampling
 * independent futures).
 *
 * The spec's original sketch (inert grants as the A/A probe) measures
 * ZERO by construction: 69d pinned that a byte-inert candidate scores
 * IDENTICALLY to the null arm under shared pairs — perfect pairing,
 * margin exactly 0, which would derive ε = 0 and guard nothing. That
 * exact-zero read survives here as the CONTROL: it proves the pipeline
 * (clone → walk → score) contributes no estimator slop of its own, so
 * whatever σ the floor read reports is genuine luck-resample noise.
 *
 * THE FLOOR READ: evaluate the null arm N times under DISJOINT fresh
 * CRN pair sets (equal true value, pairing fully broken), pair the
 * evaluations off two-by-two, and take the margins' spread:
 *
 *     margins m_j = score(pairs_2j) − score(pairs_2j+1)
 *     ε ≈ 2σ(margins)
 *
 * A real candidate's margin noise sits BETWEEN the control's 0 and this
 * floor (partial pairing: trajectories share a prefix until the state
 * divergence bites), so 2σ of the fully-broken case is a conservative
 * don't-act-on-noise gate. Per-site ε values land with their sites in
 * §70 by running THIS function on each site's real context (contexts
 * differ in horizon class and outcome variance — the per-site rationale
 * from the kickoff).
 */

import type { RNG } from '../../../src/core/RNG';
import type { Run } from '../../../src/run/Run';
import {
  evaluateRunCandidate,
  type RunRolloutPair,
  type RunRolloutSpec,
} from './evaluator';

export interface EpsilonAAOptions {
  /** Null-arm evaluations for the floor read (⌊N/2⌋ margins). */
  readonly evaluations: number;
  /** CRN pairs per evaluation (K). Default 2 — the locked starting point. */
  readonly k?: number;
  /** Byte-inert control comparisons (default 3; each must margin EXACTLY 0). */
  readonly controls?: number;
  /** Evaluator/walker passthrough (horizon, tier, λ, policies). */
  readonly rollout?: Omit<RunRolloutSpec, 'pairs' | 'horizonBattles'> & {
    readonly horizonBattles?: number;
  };
}

export interface EpsilonAAResult {
  /** Disjoint-pair-set A/A margins — the noise distribution itself. */
  readonly margins: readonly number[];
  /** Population σ of the margins. */
  readonly sigma: number;
  /** The derived hysteresis floor: 2σ. */
  readonly epsilon: number;
  /** Max |margin| across the byte-inert control comparisons — MUST be 0
   *  (the 69d pin, re-asserted through the full pipeline). */
  readonly controlMaxAbs: number;
}

export function deriveEpsilonAA(
  live: Run,
  rng: RNG,
  options: EpsilonAAOptions,
): EpsilonAAResult {
  if (options.evaluations < 2) {
    throw new Error('deriveEpsilonAA: need at least 2 evaluations for one margin');
  }
  const k = options.k ?? 2;
  const controls = options.controls ?? 3;
  const specFor = (pairs: readonly RunRolloutPair[]): RunRolloutSpec => ({
    horizonBattles: options.rollout?.horizonBattles ?? 1,
    ...options.rollout,
    pairs,
  });
  const freshPairs = (): RunRolloutPair[] => {
    const pairs: RunRolloutPair[] = [];
    for (let i = 0; i < k; i++) {
      pairs.push({
        cloneSeed: rng.fork().toJSON().state,
        policySeed: rng.fork().toJSON().state,
      });
    }
    return pairs;
  };

  // The CONTROL: byte-inert vs null under SHARED pairs — exact zero, or
  // the pipeline itself is contaminating the floor read.
  let controlMaxAbs = 0;
  for (let c = 0; c < controls; c++) {
    const pairs = freshPairs();
    const nullScore = evaluateRunCandidate(live, null, specFor(pairs)).score;
    const inertScore = evaluateRunCandidate(live, () => {}, specFor(pairs)).score;
    controlMaxAbs = Math.max(controlMaxAbs, Math.abs(inertScore - nullScore));
  }

  // The FLOOR: null-arm scores under disjoint fresh pair sets, paired
  // off two-by-two into honest A/A margins.
  const scores: number[] = [];
  for (let i = 0; i < options.evaluations; i++) {
    scores.push(evaluateRunCandidate(live, null, specFor(freshPairs())).score);
  }
  const margins: number[] = [];
  for (let j = 0; j + 1 < scores.length; j += 2) {
    margins.push(scores[j]! - scores[j + 1]!);
  }
  const mean = margins.reduce((a, b) => a + b, 0) / margins.length;
  const variance = margins.reduce((a, b) => a + (b - mean) ** 2, 0) / margins.length;
  const sigma = Math.sqrt(variance);
  return { margins, sigma, epsilon: 2 * sigma, controlMaxAbs };
}
