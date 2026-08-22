/**
 * 69e — the run-layer arbitration driver: the 57f decide loop one layer
 * up, site-agnostic. A caller (the §70 site wiring) hands it the live
 * Run and an enumerated candidate set; the driver derives K CRN pairs
 * off its OWN stream, evaluates every candidate plus the implicit null
 * arm under identical luck (69d), and commits the winner ONLY if it
 * strictly beats the null arm by ε — ties→NULL and hysteresis in one
 * rule, verbatim from the battle searcher.
 *
 * THE DECISION LOG IS BUILT IN FROM DAY ONE (the spec's co-equal goal
 * 2): every evaluated decision appends a full RunDecisionRecord —
 * site, (sectorId, hop), candidate labels, per-candidate results
 * (means + per-seed breakdowns, so §71's csv reporter needs no
 * re-computation), the chosen index, the margin vs null, and the ε it
 * was judged against. In-memory, opt-in-read — the H7c accumulator
 * pattern; the csv sidecar is §71's business.
 *
 * Determinism (the phase exit criterion, pinned by test): the driver
 * owns a dedicated RNG consumed ONLY for CRN pair derivation (two
 * forks per rollout k — cloneSeed then policySeed, the walker's
 * independence contract), so the whole decide sequence is a
 * deterministic function of (driver seed, config, live state,
 * candidate set).
 *
 * The driver NEVER dispatches against the live run — it returns the
 * winning candidate (or null) and the caller applies it through the
 * site's own chokepoint. `Math.random` stays ESLint-banned upstream;
 * everything here rides the injected RNG.
 *
 * Per-site ε floors land with their sites in §70 (the 69f A/A
 * methodology derives them); until then `epsilon` defaults to 0 and a
 * per-call override exists for the wiring.
 */

import type { RNG } from '../../../src/core/RNG';
import type { Run } from '../../../src/run/Run';
import { PRE_ROOT_NODE_ID } from '../../../src/run/NodeMap';
import {
  evaluateRunCandidate,
  type CandidateApply,
  type RunCandidateResult,
  type RunRolloutPair,
  type RunRolloutSpec,
} from './evaluator';
import type { InnerTier } from './walker';

/** One enumerated candidate: a stable label (the log's vocabulary — e.g.
 *  'buy daemon:portunus', 'fire patch@roster:2') + the apply closure. */
export interface RunDecisionCandidate {
  readonly label: string;
  readonly apply: CandidateApply;
}

/** The per-decision log record — everything §71's reporter needs. Index
 *  0 in `labels`/`results` is ALWAYS the null arm. */
export interface RunDecisionRecord {
  readonly site: string;
  readonly sectorId: string;
  /** 0 at the pre-root sentinel (currentHop throws there — gotcha #110). */
  readonly hop: number;
  readonly labels: readonly string[];
  readonly results: readonly RunCandidateResult[];
  /** Index into labels/results; 0 = the null arm won (or stood via ε). */
  readonly chosenIndex: number;
  /** Best challenger mean − null mean (negative: every challenger lost). */
  readonly marginVsNull: number;
  readonly epsilon: number;
  /** 71c — the SHADOW tier's decision for the same candidate set under the
   *  same CRN pairs and ε rule. Present ONLY when the flip-rate instrument
   *  ran (`shadowTier` set); a value ≠ `chosenIndex` is a tier flip.
   *  Telemetry-only: the live decision is always `chosenIndex`. Not a
   *  decisions.csv column — tier-flips.csv carries the per-site counts, and
   *  the full field stays reachable via `--emit-results`. */
  readonly shadowChosenIndex?: number;
  /** 84a — present ONLY on a long-horizon shadow record (the §84
   *  instrument): the horizon this record's results were walked to
   *  (`'run'` = to run end). A long-horizon record is a SEPARATE log
   *  entry appended right after the live decision it shadows — same
   *  site/context/labels, results from the long walk, `chosenIndex` =
   *  what THIS horizon would have chosen under the same ε rule — so the
   *  live record stays byte-identical shadow on or off, and the per-item
   *  aggregate keys the two horizons apart on this marker. */
  readonly horizon?: number | 'run';
}

/**
 * 84a — the long-horizon shadow (the §84 measured-terminal-prior
 * instrument; round-6-spec §"The measurement design"): every candidate
 * of a sampled decision is ALSO walked to `horizonBattles` (`'run'` =
 * until the clone completes or dies) under the SAME CRN pairs as the
 * primary, and the paired long-horizon margins land as a separate
 * record (`horizon` set). Telemetry-only, like the 71c tier shadow: the
 * live decision never reads it, and the driver's stream is untouched —
 * the pairs are derived once before either evaluation, so K is the
 * primary's K by construction (a different shadow K would need extra
 * pairs and would perturb the stream; deliberately not offered).
 *
 * `sample` = 1-in-m: a decision is shadowed iff its FIRST pair's
 * cloneSeed ≡ 0 (mod m) — keyed off a value already drawn, so sampling
 * consumes nothing and is deterministic per (driver seed, decision
 * order). Default 1 (every decision). The walk length is the cost dial
 * the §84d probe tunes this against.
 */
export interface RunShadowHorizonConfig {
  readonly horizonBattles: number | 'run';
  readonly sample?: number;
}

export interface RunArbitrationConfig {
  /** K — CRN pairs per candidate. Default 2 (the locked starting point). */
  readonly rolloutsPerCandidate?: number;
  /** The default hysteresis margin; per-call override at decide(). */
  readonly epsilon?: number;
  /** Passed through to the evaluator/walker (horizon, tier, λ, policies). */
  readonly rollout?: Omit<RunRolloutSpec, 'pairs' | 'horizonBattles'> & {
    readonly horizonBattles?: number;
  };
  /** Test seam (the selectByScore inert-seam precedent): inject a fake
   *  evaluator to pin the decide mechanics without driving battles. */
  readonly evaluate?: typeof evaluateRunCandidate;
  /** 71c — the flip-rate instrument: when set, every decide ALSO evaluates
   *  the full arm set under this inner tier — same CRN pairs (paired luck),
   *  same ε rule — and records the shadow decision on the log. SHADOW-ONLY
   *  (the §57g own-arm doctrine): the live decision never reads it, and the
   *  driver's RNG stream is untouched (pairs are derived once, before
   *  either tier evaluates), so a shadowed batch decides byte-identically
   *  to an unshadowed one. */
  readonly shadowTier?: InnerTier;
  /** 84a — the long-horizon shadow (see RunShadowHorizonConfig). */
  readonly shadowHorizon?: RunShadowHorizonConfig;
}

export class RunArbitrationDriver {
  private readonly rng: RNG;
  private readonly k: number;
  private readonly epsilon: number;
  private readonly rollout: RunArbitrationConfig['rollout'];
  private readonly evaluate: typeof evaluateRunCandidate;
  private readonly shadowTier: InnerTier | undefined;
  private readonly shadowHorizon: RunShadowHorizonConfig | undefined;

  /** The in-memory decision log, append-only in decide order. */
  readonly decisions: RunDecisionRecord[] = [];

  constructor(rng: RNG, config: RunArbitrationConfig = {}) {
    this.rng = rng;
    this.k = config.rolloutsPerCandidate ?? 2;
    this.epsilon = config.epsilon ?? 0;
    this.rollout = config.rollout;
    this.evaluate = config.evaluate ?? evaluateRunCandidate;
    this.shadowTier = config.shadowTier;
    if (config.shadowHorizon !== undefined) {
      const { horizonBattles, sample } = config.shadowHorizon;
      if (horizonBattles !== 'run' && !(Number.isInteger(horizonBattles) && horizonBattles >= 1)) {
        throw new Error(`RunArbitrationDriver: shadowHorizon.horizonBattles must be 'run' or an integer ≥ 1 (got ${String(horizonBattles)})`);
      }
      if (sample !== undefined && !(Number.isInteger(sample) && sample >= 1)) {
        throw new Error(`RunArbitrationDriver: shadowHorizon.sample must be an integer ≥ 1 (got ${String(sample)})`);
      }
    }
    this.shadowHorizon = config.shadowHorizon;
  }

  /**
   * Arbitrate one decision. Returns the winning candidate, or null when
   * the null arm stands (no challengers, or none beat it by ε). An empty
   * candidate set evaluates nothing and logs nothing — not a decision.
   *
   * `opts.rollout` (70d) merges OVER the config default per call — the
   * grant site walks its rollouts with the redraw/empower policies OFF
   * (null = pass-all; the site's own candidates are the only grant
   * spends), while every other site keeps the config walk. Omitted keys
   * fall through to the config default.
   */
  decide(
    site: string,
    live: Run,
    challengers: readonly RunDecisionCandidate[],
    opts: {
      readonly epsilon?: number;
      readonly rollout?: RunArbitrationConfig['rollout'];
    } = {},
  ): RunDecisionCandidate | null {
    if (challengers.length === 0) return null;
    const epsilon = opts.epsilon ?? this.epsilon;

    // CRN: ONE pair set per decision, shared by every candidate. Two
    // forks per k — cloneSeed then policySeed, in that order (part of
    // the determinism contract).
    const pairs: RunRolloutPair[] = [];
    for (let k = 0; k < this.k; k++) {
      pairs.push({
        cloneSeed: this.rng.fork().toJSON().state,
        policySeed: this.rng.fork().toJSON().state,
      });
    }
    const rollout = { ...this.rollout, ...opts.rollout };
    const spec: RunRolloutSpec = {
      horizonBattles: rollout.horizonBattles ?? 1,
      ...rollout,
      pairs,
    };

    const nullResult = this.evaluate(live, null, spec);
    const results: RunCandidateResult[] = [nullResult];
    const labels: string[] = ['null'];
    // Argmax over challengers: strictly-greater first-wins (the 57f tie
    // rule), then the ε gate against the null arm.
    let bestIdx = -1;
    let bestScore = -Infinity;
    challengers.forEach((c, i) => {
      const r = this.evaluate(live, c.apply, spec);
      results.push(r);
      labels.push(c.label);
      if (r.score > bestScore) {
        bestScore = r.score;
        bestIdx = i;
      }
    });

    const wins = bestIdx >= 0 && bestScore > nullResult.score + epsilon;

    // 71c — the shadow pass: the SAME pairs and ε rule under the shadow
    // tier, run AFTER the primary loop (evaluations never consume driver
    // RNG — the pairs above are the whole stream draw, so a shadowed batch
    // decides byte-identically to an unshadowed one).
    let shadowChosenIndex: number | undefined;
    if (this.shadowTier !== undefined) {
      const shadowSpec: RunRolloutSpec = { ...spec, innerTier: this.shadowTier };
      const shadowNull = this.evaluate(live, null, shadowSpec);
      let sBestIdx = -1;
      let sBestScore = -Infinity;
      challengers.forEach((c, i) => {
        const r = this.evaluate(live, c.apply, shadowSpec);
        if (r.score > sBestScore) {
          sBestScore = r.score;
          sBestIdx = i;
        }
      });
      const sWins = sBestIdx >= 0 && sBestScore > shadowNull.score + epsilon;
      shadowChosenIndex = sWins ? sBestIdx + 1 : 0;
    }

    const sectorId = live.currentSectorId;
    const hop = live.currentNodeId === PRE_ROOT_NODE_ID ? 0 : live.currentHop;
    this.decisions.push({
      site,
      sectorId,
      hop,
      labels,
      results,
      chosenIndex: wins ? bestIdx + 1 : 0,
      marginVsNull: bestScore - nullResult.score,
      epsilon,
      ...(shadowChosenIndex !== undefined ? { shadowChosenIndex } : {}),
    });

    // 84a — the long-horizon shadow: a SEPARATE record appended after the
    // live one (never a field on it — the live record must stay
    // byte-identical shadow on/off). Same pairs, same per-call rollout
    // overrides (the grant site's policies-off, the event site's
    // nominee-pinning strategy), only the horizon differs; evaluations
    // consume no driver RNG, so the sample gate below is the only other
    // branch and it reads a value already drawn.
    if (this.shadowHorizon !== undefined && this.shadowSampled(pairs)) {
      const { horizonBattles } = this.shadowHorizon;
      const longSpec: RunRolloutSpec = {
        ...spec,
        horizonBattles: horizonBattles === 'run' ? Number.POSITIVE_INFINITY : horizonBattles,
      };
      const longNull = this.evaluate(live, null, longSpec);
      const longResults: RunCandidateResult[] = [longNull];
      let lBestIdx = -1;
      let lBestScore = -Infinity;
      challengers.forEach((c, i) => {
        const r = this.evaluate(live, c.apply, longSpec);
        longResults.push(r);
        if (r.score > lBestScore) {
          lBestScore = r.score;
          lBestIdx = i;
        }
      });
      const lWins = lBestIdx >= 0 && lBestScore > longNull.score + epsilon;
      this.decisions.push({
        site,
        sectorId,
        hop,
        labels,
        results: longResults,
        chosenIndex: lWins ? lBestIdx + 1 : 0,
        marginVsNull: lBestScore - longNull.score,
        epsilon,
        horizon: horizonBattles,
      });
    }
    return wins ? challengers[bestIdx]! : null;
  }

  /** 84a — the 1-in-m sample gate, keyed off the decision's first pair
   *  (already drawn — no RNG consumed). `sample` 1 (the default) shadows
   *  every decision. */
  private shadowSampled(pairs: readonly RunRolloutPair[]): boolean {
    const m = this.shadowHorizon?.sample ?? 1;
    return pairs[0]!.cloneSeed % m === 0;
  }
}
