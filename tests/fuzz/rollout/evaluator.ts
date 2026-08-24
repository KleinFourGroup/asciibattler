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
/** 85c (shape-lock 12a) — the fold's HARD dominance guard: |priorBonus|
 *  clamps here, half the death ordinal, so no holdings delta can ever
 *  out-vote dying (the audit quantified the breach the linear shape
 *  allowed: one top item × h≈20 ≈ 116 at λ=1). A clamp that ENGAGES is
 *  flagged on the breakdown (`priorClamped`) — visible, never silent. */
export const PRIOR_BONUS_CAP = 0.5 * RUN_DEATH_PENALTY;

/** The terminal reads a score is computed from — taken once on the live
 *  run (before) and once per walked clone (after). 85c widens it with
 *  the HOLDINGS read (the fold's input): daemons/packets/units as item
 *  keys matching the prior table's vocabulary. */
export interface RunMetrics {
  readonly playerHealth: number;
  readonly bits: number;
  readonly rosterSize: number;
  readonly phase: string;
  /** 85c — held daemon ids, cache packet ids (acquisition order), and
   *  roster archetypes (level = instance noise, stripped — the table's
   *  rule). Multisets: two mercenaries count twice. */
  readonly daemonIds: readonly string[];
  readonly cachePacketIds: readonly string[];
  readonly teamArchetypes: readonly string[];
}

export function readRunMetrics(run: Run): RunMetrics {
  return {
    playerHealth: run.playerHealth,
    bits: run.bits,
    rosterSize: run.team.length,
    phase: run.phase,
    daemonIds: run.daemons.map((d) => d.id),
    cachePacketIds: [...run.cache],
    teamArchetypes: run.team.map((u) => u.archetype),
  };
}

/**
 * 85c — the FOLD (round-6-spec §"The fold", as re-shaped by the
 * 2026-08-24 shape-lock): `priorBonus = λ_prior × Σ_items
 * table[item] × Δcount(item)` over the holdings delta (terminal clone −
 * live run), where table[item] is the v1 prior table's **meanDelta** —
 * the raw measured long-horizon holding margin, UNSCALED (the spec's
 * linear × hopsRemaining is superseded: hops-linearity NO,
 * twice-measured, and the linear shape breaches the death ordinal).
 * Items held on both sides cancel; an item with no table row
 * contributes 0. Directional (under-floor) rows participate by design —
 * the n=80 floor governs signing claims, not the instrument's internal
 * prior; λ is the safety dial and a BOARD ARM, never a trusted
 * constant.
 *
 * 12b — fired counts as HELD: `firedPacketIds` (packets the BRANCH
 * fired, candidate-apply and walk alike, tallied off the clone bus's
 * `run:packetUsed`) are unioned into the terminal packet holdings, so
 * firing realizes value instead of being charged −table[p] — without
 * this, the delta re-creates packets-inert with inverted sign.
 */
export interface RunHoldingsPrior {
  /** λ_prior. 0 never reaches scoreTerminal — the evaluator disengages
   *  the whole fold path at 0 (the byte-identity contract). */
  readonly lambda: number;
  /** item key (`daemon:<id>` | `packet:<id>` | `unit:<archetype>`) →
   *  meanDelta, pool HP (the committed table via `priorFoldValues`). */
  readonly table: Readonly<Record<string, number>>;
  /** Packets the branch fired (12b). */
  readonly firedPacketIds?: readonly string[];
}

/** The signed, clamped prior term + whether the cap engaged. Exported
 *  seam so the dominance/cancellation contracts pin without a walk. */
export function priorBonusOf(
  before: RunMetrics,
  after: RunMetrics,
  prior: RunHoldingsPrior,
): { bonus: number; clamped: boolean } {
  const delta = new Map<string, number>();
  const add = (key: string, n: number): void => {
    const next = (delta.get(key) ?? 0) + n;
    if (next === 0) delta.delete(key);
    else delta.set(key, next);
  };
  for (const id of after.daemonIds) add(`daemon:${id}`, 1);
  for (const id of before.daemonIds) add(`daemon:${id}`, -1);
  for (const id of after.cachePacketIds) add(`packet:${id}`, 1);
  for (const id of prior.firedPacketIds ?? []) add(`packet:${id}`, 1);
  for (const id of before.cachePacketIds) add(`packet:${id}`, -1);
  for (const a of after.teamArchetypes) add(`unit:${a}`, 1);
  for (const a of before.teamArchetypes) add(`unit:${a}`, -1);
  let raw = 0;
  for (const [key, n] of delta) raw += n * (prior.table[key] ?? 0);
  const unclamped = prior.lambda * raw;
  const clamped = Math.abs(unclamped) > PRIOR_BONUS_CAP;
  const bonus = clamped ? Math.sign(unclamped) * PRIOR_BONUS_CAP : unclamped;
  return { bonus, clamped };
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
  /** 85c — the fold's prior term folded into `score`, present EXACTLY when
   *  a prior spec reached scoreTerminal (λ_prior ≠ 0 — the evaluator
   *  disengages at 0, so a λ=0 breakdown is byte-identical to pre-fold).
   *  Always visible when it contributed, even at 0.00 — the `tailBonus`
   *  discipline. */
  readonly priorBonus?: number;
  /** 85c (12a) — present (true) ONLY when the ±PRIOR_BONUS_CAP dominance
   *  clamp engaged: the raw λ×Σ breached half the death ordinal. A
   *  clamped read is instrument-grade WARN territory, never silent. */
  readonly priorClamped?: boolean;
}

/** The pure scoring rule — exported separately so dominance/λ contracts
 *  pin without driving a single battle. */
export function scoreTerminal(
  before: RunMetrics,
  after: RunMetrics,
  bitsLambda: number,
  prior?: RunHoldingsPrior,
): RunScoreBreakdown {
  // Signed on purpose: a rest-node heal inside the horizon is NEGATIVE
  // damage taken (a genuinely better future, and the score should say so).
  const poolDamageTaken = before.playerHealth - after.playerHealth;
  const died = after.phase === 'defeat';
  const completed = after.phase === 'complete';
  const bitsDelta = after.bits - before.bits;
  const rosterDelta = after.rosterSize - before.rosterSize;
  const base =
    -poolDamageTaken +
    (died ? -RUN_DEATH_PENALTY : 0) +
    (completed ? RUN_COMPLETION_BONUS : 0) +
    bitsLambda * bitsDelta;
  if (prior === undefined) {
    return { score: base, poolDamageTaken, died, completed, bitsDelta, rosterDelta };
  }
  const { bonus, clamped } = priorBonusOf(before, after, prior);
  return {
    score: base + bonus,
    poolDamageTaken,
    died,
    completed,
    bitsDelta,
    rosterDelta,
    priorBonus: bonus,
    ...(clamped ? { priorClamped: true } : {}),
  };
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
  /** 85c — λ_prior, the fold's board arm ({0, 0.5, 1}). 0 or absent =
   *  the fold path is never entered: no bus subscription, no holdings
   *  diff, no breakdown field — byte-identical to pre-fold (the
   *  explicit-empty pattern; the λ=0 board control rides on this). */
  readonly priorLambda?: number;
  /** 85c — item key → meanDelta (the committed table via
   *  `priorFoldValues`). Required when priorLambda ≠ 0 (throws loud —
   *  a λ arm with no table is a launch mistake, never a silent 0). */
  readonly priorTable?: Readonly<Record<string, number>>;
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
  // 85c — the fold engages ONLY at λ_prior ≠ 0 (the byte-identity
  // contract: a λ=0 arm takes the exact pre-fold path — no subscription,
  // no diff, no field).
  const priorLambda = spec.priorLambda ?? 0;
  if (priorLambda !== 0 && spec.priorTable === undefined) {
    throw new Error('evaluateRunCandidate: priorLambda ≠ 0 requires priorTable (a λ arm with no table is a launch mistake)');
  }
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
    // 85c (12b) — the fired-packet tally rides the CLONE's private bus for
    // the whole branch: candidate-apply fires and walk fires both land
    // (`run:packetUsed` is the 49e consume-on-fire event). Subscribed only
    // on the fold path; the clone is discarded after the walk, so no
    // unsubscribe is needed.
    const firedPacketIds: string[] = [];
    if (priorLambda !== 0) {
      clone.bus.on('run:packetUsed', ({ packetId }) => firedPacketIds.push(packetId));
    }
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
    const prior =
      priorLambda !== 0
        ? { lambda: priorLambda, table: spec.priorTable!, firedPacketIds }
        : undefined;
    const base = { ...scoreTerminal(before, readRunMetrics(clone.run), bitsLambda, prior), walkOutcome: walk.outcome };
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
