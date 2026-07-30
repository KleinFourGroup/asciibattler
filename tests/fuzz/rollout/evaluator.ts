/**
 * 69d — the run-layer terminal score + evaluator (the 57e sibling, one
 * layer up): score ONE candidate by cloning the live run once per CRN
 * pair, applying the candidate, walking each clone to the horizon (69b),
 * and averaging the terminal scores.
 *
 * The score is the kickoff resolution-4 LOCK:
 *
 *     score = −(pool damage taken over the horizon)
 *             − RUN_DEATH_PENALTY   if the run DIED inside the horizon
 *             + RUN_COMPLETION_BONUS if it COMPLETED inside the horizon
 *             + λ_bits × (bits delta)        [default λ = 0]
 *
 * The death/completion terms are DOMINANT (derived from
 * HEALTH.playerHealthMax, never hardcoded) — dying can never be
 * out-scored by a fat pool differential, the WIN_BONUS ordinal one
 * layer up. λ is a BOARD ARM, never a trusted constant (resolution 4):
 * one exchange rate bounds the hand-authoring, and bits/roster deltas
 * ALWAYS land in the per-seed breakdowns so a spend-happy distortion at
 * λ=0 is visible, not inferred.
 *
 * CRN contract: the caller (the 69e driver) passes the SAME `pairs`
 * array for every candidate in one decision — each pair carries an
 * independent cloneSeed (the 69a re-seed) AND policySeed (the walker's
 * independence contract), both drawn off the driver's own stream.
 * Byte-identical candidates therefore score IDENTICALLY (pinned by
 * test) — the property the 69f A/A noise floor is built on.
 *
 * Candidate encoding: an `apply` closure dispatched against the clone
 * (`null` = the null arm — don't buy / don't fire / let the walker
 * decide). The evaluator flips the clone's turn gates ON BEFORE apply —
 * a candidate like `enterNode` would otherwise start its battle while
 * the walker's machinery isn't attached yet (gates hold the run at
 * 'turn-intro' until walkToHorizon takes over; H4b keeps the gated
 * path RNG-aligned).
 *
 * Deliberately NOT here (the 69e driver's domain): candidate
 * generation, ties→NULL, the ε hysteresis, and the decision log.
 */

import { HEALTH } from '../../../src/config/health';
import type { Run } from '../../../src/run/Run';
import { cloneRunForRollout, type RunRolloutClone } from '../../../src/bot/runRollout';
import { walkToHorizon, type WalkOptions, type InnerTier } from './walker';
import type { FuzzStrategy } from '../Strategy';
import type { RedrawPolicy } from '../redrawPolicy';
import type { EmpowerPolicy } from '../empowerPolicy';

/** Dominant over any achievable pool swing (the pool is bounded by
 *  playerHealthMax) — derived from config, the WIN_BONUS pattern. A swept
 *  λ must stay far below PENALTY/bits-scale or it would breach the
 *  ordinal; the board sweeps λ in small steps, so this is a doc note,
 *  not a runtime guard. */
export const RUN_DEATH_PENALTY = 10 * HEALTH.playerHealthMax;
export const RUN_COMPLETION_BONUS = 10 * HEALTH.playerHealthMax;

/** The terminal reads a score is computed from — taken once on the live
 *  run (before) and once per walked clone (after). */
export interface RunMetrics {
  readonly playerHealth: number;
  readonly bits: number;
  readonly rosterSize: number;
  readonly phase: string;
}

export function readRunMetrics(run: Run): RunMetrics {
  return {
    playerHealth: run.playerHealth,
    bits: run.bits,
    rosterSize: run.team.length,
    phase: run.phase,
  };
}

/** One rollout's full breakdown — the score plus the always-on telemetry
 *  columns (resolution 4: visible, not inferred). */
export interface RunScoreBreakdown {
  readonly score: number;
  readonly poolDamageTaken: number;
  readonly died: boolean;
  readonly completed: boolean;
  readonly bitsDelta: number;
  readonly rosterDelta: number;
}

/** The pure scoring rule — exported separately so dominance/λ contracts
 *  pin without driving a single battle. */
export function scoreTerminal(
  before: RunMetrics,
  after: RunMetrics,
  bitsLambda: number,
): RunScoreBreakdown {
  // Signed on purpose: a rest-node heal inside the horizon is NEGATIVE
  // damage taken (a genuinely better future, and the score should say so).
  const poolDamageTaken = before.playerHealth - after.playerHealth;
  const died = after.phase === 'defeat';
  const completed = after.phase === 'complete';
  const bitsDelta = after.bits - before.bits;
  const rosterDelta = after.rosterSize - before.rosterSize;
  const score =
    -poolDamageTaken +
    (died ? -RUN_DEATH_PENALTY : 0) +
    (completed ? RUN_COMPLETION_BONUS : 0) +
    bitsLambda * bitsDelta;
  return { score, poolDamageTaken, died, completed, bitsDelta, rosterDelta };
}

/** One CRN pair: the clone re-seed + the walker policy seed, drawn as
 *  independent forks off the DRIVER's stream (never derive one from the
 *  other — the walker's independence contract). */
export interface RunRolloutPair {
  readonly cloneSeed: number;
  readonly policySeed: number;
}

export interface RunRolloutSpec {
  readonly horizonBattles: number;
  /** The K CRN pairs. SAME array for every candidate in one decision. */
  readonly pairs: readonly RunRolloutPair[];
  /** The swept exchange rate (resolution 4). Default 0. */
  readonly bitsLambda?: number;
  readonly innerTier?: InnerTier;
  readonly strategy?: FuzzStrategy;
  readonly redraw?: RedrawPolicy;
  readonly empower?: EmpowerPolicy;
  readonly maxTicksPerBattle?: number;
  readonly maxHops?: number;
}

/** A candidate = a closure dispatched against the clone before the walk;
 *  `null` = the null arm. */
export type CandidateApply = (clone: RunRolloutClone) => void;

export interface RunCandidateResult {
  /** Mean score over the pairs — what the driver compares. */
  readonly score: number;
  /** Per-pair breakdowns, pair-ordered — the telemetry columns and the
   *  69f paired-margin substrate. */
  readonly perSeed: readonly RunScoreBreakdown[];
}

export function evaluateRunCandidate(
  live: Run,
  apply: CandidateApply | null,
  spec: RunRolloutSpec,
): RunCandidateResult {
  if (spec.pairs.length === 0) {
    throw new Error('evaluateRunCandidate: pairs must be non-empty');
  }
  const before = readRunMetrics(live);
  const bitsLambda = spec.bitsLambda ?? 0;
  const perSeed: RunScoreBreakdown[] = [];
  for (const pair of spec.pairs) {
    const clone = cloneRunForRollout(live, pair.cloneSeed);
    // Gates BEFORE apply — see the header note (walkToHorizon re-sets
    // the flag; H4b keeps the gated path RNG-aligned either way).
    clone.run.pauseAtTurnGates = true;
    if (apply) apply(clone);
    const walkOptions: WalkOptions = {
      horizonBattles: spec.horizonBattles,
      policySeed: pair.policySeed,
      ...(spec.innerTier !== undefined ? { innerTier: spec.innerTier } : {}),
      ...(spec.strategy !== undefined ? { strategy: spec.strategy } : {}),
      ...(spec.redraw !== undefined ? { redraw: spec.redraw } : {}),
      ...(spec.empower !== undefined ? { empower: spec.empower } : {}),
      ...(spec.maxTicksPerBattle !== undefined
        ? { maxTicksPerBattle: spec.maxTicksPerBattle }
        : {}),
      ...(spec.maxHops !== undefined ? { maxHops: spec.maxHops } : {}),
    };
    walkToHorizon(clone, walkOptions);
    perSeed.push(scoreTerminal(before, readRunMetrics(clone.run), bitsLambda));
  }
  const score = perSeed.reduce((acc, b) => acc + b.score, 0) / perSeed.length;
  return { score, perSeed };
}
