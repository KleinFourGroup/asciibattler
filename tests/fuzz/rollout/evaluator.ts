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
import { defaultWalkStrategy, walkToHorizon, type WalkOptions, type WalkResult, type InnerTier } from './walker';
import type { FuzzStrategy } from '../Strategy';
import type { RedrawPolicy } from '../redrawPolicy';
import type { EmpowerPolicy } from '../empowerPolicy';
import type { RolloutSearchConfig } from '../../../src/bot/RolloutSearchDriver';

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
  /** 70e — the DP-tail bonus folded into `score`, present ONLY when the
   *  spec carried a `tailScore` (the node-choice site). Always visible in
   *  the breakdown when it contributed — the resolution-4 discipline. */
  readonly tailBonus?: number;
  /** 85-pre F1 — the walk's own outcome, attached by evaluateRunCandidate
   *  (absent on hand-built fixtures / fake-evaluate seams). 'stuck' means a
   *  safety bound tripped (maxHops, empty frontier): the terminal is an
   *  INSTRUMENT failure, not a measurement — scoreTerminal cannot see it
   *  (phase is mid-run, so the walk scores as a healthy truncation; WORKLOG
   *  §85-pre finding 3). Telemetry-only this phase; the decisions.csv
   *  `stuckFrac` column makes it visible per candidate. */
  readonly walkOutcome?: WalkResult['outcome'];
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
  /** 85b — the all-rollouts walk-policy overlay (fires + the dock
   *  policy), composed OVER `strategy` (or the walker default) here in
   *  the evaluator — the ONE compose point, so a site's own rollout
   *  strategy (the node site's nominee pin, the event site's) keeps its
   *  methods and still gains the overlay. Sites suppress a policy for a
   *  coherence window by passing a gated override per call (the
   *  decision-dock / own-gate exclusions in arbitratedStrategy.ts). */
  readonly walkPolicies?: Partial<FuzzStrategy>;
  /** 85b (finding 6) — the live searcher config for 'searcher'-tier
   *  walks; absent = the driver's bare `{}` default (pre-85b behavior). */
  readonly rolloutSearch?: RolloutSearchConfig;
  readonly redraw?: RedrawPolicy;
  readonly empower?: EmpowerPolicy;
  readonly maxTicksPerBattle?: number;
  readonly maxHops?: number;
  /** 70e — the tail estimate at the truncation (kickoff resolution 1):
   *  evaluated on each WALKED clone and ADDED to its score, recorded as
   *  `tailBonus` in the breakdown. Passed per decide by the node-choice
   *  site (the 70d decide-time override seam); every other site omits
   *  it. Must be a pure function of the clone's terminal state. */
  readonly tailScore?: (run: Run) => number;
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
  // 85b — the one compose point: the overlay's policies win over the walk
  // strategy's own (a site's strategy override keeps its other methods).
  const strategy =
    spec.walkPolicies !== undefined
      ? { ...(spec.strategy ?? defaultWalkStrategy()), ...spec.walkPolicies }
      : spec.strategy;
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
      ...(strategy !== undefined ? { strategy } : {}),
      ...(spec.rolloutSearch !== undefined ? { rolloutSearch: spec.rolloutSearch } : {}),
      ...(spec.redraw !== undefined ? { redraw: spec.redraw } : {}),
      ...(spec.empower !== undefined ? { empower: spec.empower } : {}),
      ...(spec.maxTicksPerBattle !== undefined
        ? { maxTicksPerBattle: spec.maxTicksPerBattle }
        : {}),
      ...(spec.maxHops !== undefined ? { maxHops: spec.maxHops } : {}),
    };
    const walk = walkToHorizon(clone, walkOptions);
    // 85-pre F1 — carry the walk outcome into the breakdown: a 'stuck'
    // terminal is otherwise indistinguishable from a clean truncation.
    const base = { ...scoreTerminal(before, readRunMetrics(clone.run), bitsLambda), walkOutcome: walk.outcome };
    if (spec.tailScore !== undefined) {
      const tailBonus = spec.tailScore(clone.run);
      perSeed.push({ ...base, score: base.score + tailBonus, tailBonus });
    } else {
      perSeed.push(base);
    }
  }
  const score = perSeed.reduce((acc, b) => acc + b.score, 0) / perSeed.length;
  return { score, perSeed };
}
