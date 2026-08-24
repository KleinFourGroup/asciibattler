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
  /** 84c — `Run.hopsRemaining` at decide time (the §84 per-remaining-hop
   *  normalization reads it). Written on EVERY record by the driver — live
   *  and shadow alike; optional on the type only so hand-built fixtures and
   *  pre-84 sidecars still type and parse. */
  readonly hopsRemaining?: number;
  /** 85-pre F5 — the λ_bits the record's scores were computed under (the
   *  swept exchange rate; 0 = the doctrine default). Rides decisions.csv as
   *  the `lambda` column so a λ≠0 arm's scores stay reconstructible from
   *  the sidecar's components (the independent-recompute lint — WORKLOG
   *  §85-pre finding 15). Optional for fixtures/pre-85 sidecars. */
  readonly bitsLambda?: number;
  /** 85c — the λ_prior the record's scores were computed under (the fold's
   *  board arm; 0 = fold off). ALWAYS 0 on a long-horizon record: shadow
   *  walks score raw so the table never eats its own prior (12c — the
   *  de-fold step by construction). Rides decisions.csv as `priorLambda`;
   *  optional for fixtures/pre-85c sidecars. */
  readonly priorLambda?: number;
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
  /** 84c — the pair stream for SHADOW-ONLY sites (`shadowDecide`): a site
   *  with no primary decision has no pairs to borrow, and drawing them off
   *  the driver's own stream would shift every live decision after it. A
   *  separate seeded stream keeps the live sequence byte-identical.
   *  Required only when a shadow-only site is wired (the arbitrated
   *  strategy seeds it off the run seed + its own offset). */
  readonly siteRng?: RNG;
  /** 84d — the sites the shadow runs on (live decisions AND shadow-only
   *  sites alike); absent = every site. The spec's contract is the
   *  ACQUISITION sites only — grants, fires and node picks are inside the
   *  decision horizon already, and at ~90 decisions/run × K × a
   *  run-remainder each they are the whole cost (the 84d probe: 31 empower
   *  decisions × 7 candidates on one seed). The arbitrated strategy passes
   *  `SHADOW_SITES`; the driver stays generic. */
  readonly sites?: readonly string[];
  // (84f1's shadow-only `walkStrategy` overlay RETIRED at 85b: walk
  // policies now ride EVERY rollout via `RunRolloutSpec.walkPolicies` —
  // config-level for the arm, per-call gated where a site's coherence
  // window demands suppression. The evaluator owns the compose.)
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

    const ctx = this.contextOf(site, live, labels);
    this.decisions.push({
      ...ctx,
      results,
      chosenIndex: wins ? bestIdx + 1 : 0,
      marginVsNull: bestScore - nullResult.score,
      epsilon,
      bitsLambda: spec.bitsLambda ?? 0,
      priorLambda: spec.priorLambda ?? 0,
      ...(shadowChosenIndex !== undefined ? { shadowChosenIndex } : {}),
    });

    // 84a — the long-horizon shadow: a SEPARATE record appended after the
    // live one (never a field on it — the live record must stay
    // byte-identical shadow on/off). Same pairs, same per-call rollout
    // overrides (the grant site's policies-off, the event site's
    // nominee-pinning strategy), only the horizon differs; evaluations
    // consume no driver RNG, so the sample gate below is the only other
    // branch and it reads a value already drawn.
    if (this.shadowHorizon !== undefined && this.shadowSite(site) && this.shadowSampled(pairs)) {
      this.decisions.push(this.judgeLong(ctx, live, null, challengers, spec, epsilon));
    }
    return wins ? challengers[bestIdx]! : null;
  }

  /** 84d — the site allowlist gate (absent = every site). */
  private shadowSite(site: string): boolean {
    const sites = this.shadowHorizon?.sites;
    return sites === undefined || sites.includes(site);
  }

  /**
   * 84c — a SHADOW-ONLY site: no live arbitration (the caller's own policy
   * decides live and dispatches), only the long-horizon record — the
   * recruit site's shape, where a live one-battle arbitration would be a
   * doctrine change at the wrong horizon (the recruit-censoring lesson).
   * `nullApply` is the site's EXPLICIT baseline (e.g. passRecruit): an
   * empty apply would leave the clone at the decision phase for the
   * rollout walker's own policy to act on, which is not a null arm. Pairs
   * come off `shadowHorizon.siteRng`, never the driver's stream — drawn
   * BEFORE the sample gate so the site stream advances identically
   * whether or not this decision is sampled. Logs nothing when the shadow
   * is off or the candidate set is empty.
   */
  shadowDecide(
    site: string,
    live: Run,
    nullApply: CandidateApply,
    challengers: readonly RunDecisionCandidate[],
    opts: {
      readonly epsilon?: number;
      readonly rollout?: RunArbitrationConfig['rollout'];
    } = {},
  ): void {
    if (this.shadowHorizon === undefined || challengers.length === 0) return;
    if (!this.shadowSite(site)) return;
    const siteRng = this.shadowHorizon.siteRng;
    if (siteRng === undefined) {
      throw new Error(
        `RunArbitrationDriver.shadowDecide('${site}'): shadowHorizon.siteRng is required for a shadow-only site`,
      );
    }
    const pairs: RunRolloutPair[] = [];
    for (let k = 0; k < this.k; k++) {
      pairs.push({
        cloneSeed: siteRng.fork().toJSON().state,
        policySeed: siteRng.fork().toJSON().state,
      });
    }
    if (!this.shadowSampled(pairs)) return;
    const rollout = { ...this.rollout, ...opts.rollout };
    const spec: RunRolloutSpec = {
      horizonBattles: rollout.horizonBattles ?? 1,
      ...rollout,
      pairs,
    };
    const labels = ['null', ...challengers.map((c) => c.label)];
    this.decisions.push(
      this.judgeLong(
        this.contextOf(site, live, labels),
        live,
        nullApply,
        challengers,
        spec,
        opts.epsilon ?? this.epsilon,
      ),
    );
  }

  /** The record's context columns, read off the live run once per decide
   *  (the pre-root hop guard — gotcha #110; `hopsRemaining` is pre-root
   *  safe by construction). */
  private contextOf(
    site: string,
    live: Run,
    labels: readonly string[],
  ): Pick<RunDecisionRecord, 'site' | 'sectorId' | 'hop' | 'hopsRemaining' | 'labels'> {
    return {
      site,
      sectorId: live.currentSectorId,
      hop: live.currentNodeId === PRE_ROOT_NODE_ID ? 0 : live.currentHop,
      hopsRemaining: live.hopsRemaining,
      labels,
    };
  }

  /** The long-horizon judgment shared by the shadow of a live decision
   *  (84a — `nullApply` null, the primary's pairs) and a shadow-only site
   *  (84c — an explicit baseline, the site stream's pairs): every
   *  candidate walked to the shadow horizon, argmax + the same ε rule. */
  private judgeLong(
    ctx: Pick<RunDecisionRecord, 'site' | 'sectorId' | 'hop' | 'hopsRemaining' | 'labels'>,
    live: Run,
    nullApply: CandidateApply | null,
    challengers: readonly RunDecisionCandidate[],
    spec: RunRolloutSpec,
    epsilon: number,
  ): RunDecisionRecord {
    const { horizonBattles } = this.shadowHorizon!;
    // 85c (12c) — the STRUCTURAL de-fold: a long-horizon record is the
    // prior table's input, so its scores are always RAW (λ_prior stripped
    // whatever the live arm runs) — a table rebuild can never eat its own
    // prior. Residual fold feedback is behavioral only (a λ>0 arm walks
    // different runs), which the table's provenance head pins.
    const { priorLambda: _priorLambda, priorTable: _priorTable, ...rawSpec } = spec;
    const longSpec: RunRolloutSpec = {
      ...rawSpec,
      horizonBattles: horizonBattles === 'run' ? Number.POSITIVE_INFINITY : horizonBattles,
      // 85-pre F1 — a run-length walk must never trip the walker's default
      // 50-hop bound (a 'stuck' terminal scores as a healthy truncation —
      // finding 3): give the long walk the live run's remaining hops with
      // generous slack for non-battle nodes. A site's explicit maxHops wins.
      ...(spec.maxHops === undefined
        ? { maxHops: Math.max(50, (ctx.hopsRemaining ?? 0) * 3 + 10) }
        : {}),
      // (84f1's compose retired at 85b — `spec.walkPolicies` already rides
      // in from the merged rollout config, per-call gating included, and
      // the evaluator owns the compose.)
    };
    const longNull = this.evaluate(live, nullApply, longSpec);
    const results: RunCandidateResult[] = [longNull];
    let bestIdx = -1;
    let bestScore = -Infinity;
    challengers.forEach((c, i) => {
      const r = this.evaluate(live, c.apply, longSpec);
      results.push(r);
      if (r.score > bestScore) {
        bestScore = r.score;
        bestIdx = i;
      }
    });
    const wins = bestIdx >= 0 && bestScore > longNull.score + epsilon;
    return {
      ...ctx,
      results,
      chosenIndex: wins ? bestIdx + 1 : 0,
      marginVsNull: bestScore - longNull.score,
      epsilon,
      horizon: horizonBattles,
      bitsLambda: longSpec.bitsLambda ?? 0,
      priorLambda: 0, // 12c — always raw on a long record (stripped above)
    };
  }

  /** 84a — the 1-in-m sample gate, keyed off the decision's first pair
   *  (already drawn — no RNG consumed). `sample` 1 (the default) shadows
   *  every decision. */
  private shadowSampled(pairs: readonly RunRolloutPair[]): boolean {
    const m = this.shadowHorizon?.sample ?? 1;
    return pairs[0]!.cloneSeed % m === 0;
  }
}
