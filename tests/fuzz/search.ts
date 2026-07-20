/**
 * H7b — the random-search driver over the H7a scored-strategy weight space.
 *
 * Structure is **propose → evaluate → keep-best**, factored so the *proposer* is
 * the only swappable part: random search v1 is `propose = () => sampleWeights(box,
 * rng)` (ignores history); a later hill-climb (`propose = (best) => perturb(best,
 * step)` + greedy accept) is a small add reusing the same `evaluate`, fitness,
 * train/test split, and reporting. The `evaluate` is injectable too (the tests
 * stub it) but defaults to the real win-rate-over-seeds harness evaluator.
 *
 * Fitness = win rate (the foregone-conclusion axis). The search/select runs on a
 * TRAIN seed set; only the winner (+ optional top-K) is then scored on a DISJOINT
 * TEST set — without that split the "best" vector memorizes seed luck and the
 * balance signal inflates. A seeded sampler (`samplerSeed`) makes the whole
 * experiment reproducible. The winning vector is emitted in the same
 * single-vector JSON format `--strategy=<file>.json` reads back.
 *
 * Box + presets live here (not in `config/`) — these are experiment knobs, not
 * balance knobs, so the only config surface H7 adds is H7a's weight vector. The
 * box is a single uniform `[min,max]` over every weight for v1; per-axis ranges
 * are an easy later extension if path/pass turn out under-powered at this scale.
 */

import { RNG } from '../../src/core/RNG';
import { runMany } from './harness';
import type { HarnessOptions } from './harness';
import { aggregate } from './reporters';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import { ENCOUNTER_KINDS } from '../../src/config/encounters';
import { STAT_KEYS, PATH_KINDS } from './strategies/policies';
import { scoredStrategy } from './strategies/scored';
import type { ScoredWeights } from './strategies/scoredWeights';

// ---- the sampling box -----------------------------------------------------

export interface Range {
  readonly min: number;
  readonly max: number;
}

export interface SearchBox {
  /** Uniform sampling range applied to every weight (v1). */
  readonly range: Range;
}

export const DEFAULT_BOX: SearchBox = { range: { min: -1, max: 1 } };

/**
 * Draw one full `ScoredWeights` from the box. Weights are drawn in a FIXED order
 * (path → archetype → composition → compWeight → level → stats → total →
 * passBias → port[daemonValue → packetValue → priceSensitivity → bankReserve →
 * unitBias] → fire[bias.normal → bias.elite → bias.boss → cachePressure]) so
 * the sample sequence is reproducible given `(samplerSeed, box, vector
 * index)`. `temperature` is left at its inert default (not sampled this
 * cycle). 59b/59c — the port + fire groups are ALWAYS sampled (every
 * candidate is a port-scoring, fire-capable strategy; the fixed policies
 * stay reachable inside the space: an all-zero port group replicates 50g
 * exactly and an all-zero fire group never fires, see scored.ts). Appending
 * new draws LAST keeps each earlier prefix of the sequence identical for a
 * given samplerSeed.
 */
export function sampleWeights(box: SearchBox, rng: RNG): ScoredWeights {
  const { min, max } = box.range;
  const draw = (): number => min + rng.next() * (max - min);
  const record = <K extends string>(keys: readonly K[]): Record<K, number> =>
    Object.fromEntries(keys.map((k) => [k, draw()])) as Record<K, number>;

  const path = record(PATH_KINDS);
  const archetype = record(ALL_ARCHETYPES);
  const composition = record(ALL_ARCHETYPES);
  const compWeight = draw();
  const level = draw();
  const stats = record(STAT_KEYS);
  const total = draw();
  const passBias = draw();
  const port = {
    daemonValue: draw(),
    packetValue: draw(),
    priceSensitivity: draw(),
    bankReserve: draw(),
    unitBias: draw(),
  };
  const fire = {
    bias: record(ENCOUNTER_KINDS),
    cachePressure: draw(),
  };
  return { path, archetype, composition, compWeight, level, stats, total, passBias, port, fire };
}

// ---- train / test seed split ----------------------------------------------

/** Test seeds start far above any realistic train count, so the two sets are
 *  disjoint by construction. */
export const TEST_SEED_OFFSET = 1_000_000;

/**
 * Build the train + test seed ranges. `seedOffset` (X2 — `--seed-offset=N`) shifts
 * BOTH bases up by `N`, so the X3-verify (step 5) can run on a held-out seed range
 * that the tuning passes (`seedOffset 0`) never touched — the config→seeds
 * overfitting holdout (the long-missing H7d prereq). A large enough `N` (past the
 * tuned train count) makes the verify seeds disjoint from every tuned seed; the
 * train/test split stays internally disjoint at any offset (TEST_SEED_OFFSET ≫
 * any realistic train count + offset).
 */
export function splitSeeds(
  trainCount: number,
  testCount: number,
  seedOffset = 0,
): { trainSeeds: number[]; testSeeds: number[] } {
  const span = (start: number, count: number): number[] =>
    Array.from({ length: count }, (_v, i) => start + i);
  return {
    trainSeeds: span(1 + seedOffset, trainCount),
    testSeeds: span(TEST_SEED_OFFSET + seedOffset, testCount),
  };
}

// ---- presets --------------------------------------------------------------

export interface SearchPreset {
  readonly vectors: number;
  readonly trainSeeds: number;
  readonly testSeeds: number;
  /** Short-run hop count for cheap evals; omit for full-length runs. */
  readonly hopCount?: number;
}

export const PRESETS: Record<'quick' | 'medium' | 'heavy' | 'overnight', SearchPreset> = {
  // "Did my change move balance?" — well under a minute (short runs).
  quick: { vectors: 50, trainSeeds: 8, testSeeds: 4, hopCount: 4 },
  // H7c stage 2 — a narrowed grid homing to the target band. Still short-ish
  // runs (6 hops) but a wider vector pool + more train seeds than quick, so a
  // single-config best-achievable read is tighter (~1–2 min/point).
  medium: { vectors: 60, trainSeeds: 16, testSeeds: 4, hopCount: 6 },
  // H7c stage 3 — the few finalists, scored at FULL run length (hopCount
  // omitted) so the short-run inflation quick/medium carry is gone. The
  // expensive, decision-grade read (~5–10 min/point single-core).
  heavy: { vectors: 120, trainSeeds: 30, testSeeds: 10 },
  // The real sweep — full-length runs, hours single-core (runs are independent
  // so cores divide wall time linearly).
  overnight: { vectors: 500, trainSeeds: 200, testSeeds: 50 },
};

export function presetHarnessOptions(preset: SearchPreset): HarnessOptions {
  return preset.hopCount !== undefined ? { runConfig: { hopCount: preset.hopCount } } : {};
}

// ---- the search -----------------------------------------------------------

export interface SearchConfig {
  readonly vectors: number;
  readonly trainSeeds: readonly number[];
  readonly testSeeds: readonly number[];
  readonly samplerSeed: number;
  readonly box: SearchBox;
  readonly harnessOptions?: HarnessOptions;
  /** Report the top-K train-fitness vectors (each scored on the test set too).
   *  Default 1 (the winner only). */
  readonly topK?: number;
  /** Injectable evaluator (tests stub it). Defaults to the real win-rate over
   *  the supplied seeds via the headless harness. */
  readonly evaluate?: (weights: ScoredWeights, seeds: readonly number[]) => number;
}

export interface ScoredCandidate {
  readonly weights: ScoredWeights;
  readonly trainWinRate: number;
  readonly testWinRate: number;
}

export interface SearchResult {
  readonly best: ScoredCandidate;
  /** Top-K by train fitness, each carrying its held-out test win rate. */
  readonly ranked: readonly ScoredCandidate[];
  readonly samplerSeed: number;
  readonly vectors: number;
  readonly trainSeeds: readonly number[];
  readonly testSeeds: readonly number[];
  /** Per sample index, in proposal order — for the search-results CSV. */
  readonly trainWinRates: readonly number[];
}

export function harnessEvaluate(
  weights: ScoredWeights,
  seeds: readonly number[],
  options: HarnessOptions,
): number {
  return aggregate(runMany(seeds, scoredStrategy('search-candidate', weights), options)).winRate;
}

/**
 * The deterministic proposal step, factored out so the single-process search and
 * the `--jobs` vector-sharded path (searchShard.ts) generate the SAME vector
 * sequence from `(samplerSeed, box, count)`. A shard then evaluates a slice of
 * this list; the parent re-derives it identically, so sharded results are
 * byte-identical to single-process.
 */
export function generateVectors(
  box: SearchBox,
  samplerSeed: number,
  count: number,
): ScoredWeights[] {
  const rng = new RNG(samplerSeed);
  return Array.from({ length: count }, () => sampleWeights(box, rng));
}

/**
 * The keep-best step: rank by train fitness desc (lowest index breaks ties so
 * the result is deterministic), take the top-K, and score each winner on the
 * held-out test set via `scoreTest`. Shared by `runSearch` (in-process eval) and
 * the sharded path (children compute trainWinRates, the parent supplies a
 * `scoreTest` that runs in-process since its config is already applied).
 */
export function assembleSearchResult(
  vectors: readonly ScoredWeights[],
  trainWinRates: readonly number[],
  scoreTest: (weights: ScoredWeights) => number,
  meta: {
    samplerSeed: number;
    trainSeeds: readonly number[];
    testSeeds: readonly number[];
    topK: number;
  },
): SearchResult {
  const candidates = vectors.map((weights, index) => ({
    weights,
    trainWinRate: trainWinRates[index]!,
    index,
  }));
  const ranked = [...candidates].sort(
    (a, b) => b.trainWinRate - a.trainWinRate || a.index - b.index,
  );
  const winners: ScoredCandidate[] = ranked.slice(0, meta.topK).map((c) => ({
    weights: c.weights,
    trainWinRate: c.trainWinRate,
    testWinRate: scoreTest(c.weights),
  }));
  return {
    best: winners[0]!,
    ranked: winners,
    samplerSeed: meta.samplerSeed,
    vectors: vectors.length,
    trainSeeds: meta.trainSeeds,
    testSeeds: meta.testSeeds,
    trainWinRates: candidates.map((c) => c.trainWinRate),
  };
}

export function runSearch(config: SearchConfig): SearchResult {
  const { vectors, trainSeeds, testSeeds, samplerSeed, box } = config;
  if (vectors < 1) throw new Error('runSearch: vectors must be >= 1');
  const options = config.harnessOptions ?? {};
  const evaluate = config.evaluate ?? ((w, seeds) => harnessEvaluate(w, seeds, options));
  const topK = config.topK ?? 1;

  const sampled = generateVectors(box, samplerSeed, vectors); // propose
  const trainWinRates = sampled.map((w) => evaluate(w, trainSeeds)); // evaluate
  return assembleSearchResult(sampled, trainWinRates, (w) => evaluate(w, testSeeds), {
    samplerSeed,
    trainSeeds,
    testSeeds,
    topK,
  });
}

// ---- the top-K perturb-and-reselect refinement stage (59d) -----------------

/** 59d — refinement dials (kickoff lock: K=3 · one round · 8 perturbs per
 *  finalist · ±0.15 box-scale). Motivated by §46b's 30.8/22.5 fresh-search
 *  shortfall: pure random search under-exploits its own finalists' basins. */
export interface RefineConfig {
  /** Finalists taken from the base search's train ranking. */
  readonly topK: number;
  /** Perturbed variants evaluated per finalist (one round). */
  readonly perturbs: number;
  /** Perturbation radius as a fraction of the box span, clamped to the box. */
  readonly radius: number;
}

export const DEFAULT_REFINE: RefineConfig = { topK: 3, perturbs: 8, radius: 0.15 };

/** Offset added to `samplerSeed` for the refinement RNG — a DISTINCT stream
 *  from `generateVectors`' (same seed would replay the base draw sequence
 *  and correlate perturbs with the vectors they perturb). */
export const REFINE_SEED_OFFSET = 59_000_000;

/**
 * One perturbed variant: every sampled dim jittered uniformly within
 * ±radius×span, clamped to the box. Fixed draw order (the sampleWeights
 * order), so the perturb sequence is reproducible given the rng state.
 * Optional groups perturb ONLY if present — an old-shape vector refines
 * inside its own dim space and never grows a group it didn't carry;
 * `temperature` is inert and carried verbatim.
 */
export function perturbWeights(
  w: ScoredWeights,
  box: SearchBox,
  radius: number,
  rng: RNG,
): ScoredWeights {
  const { min, max } = box.range;
  const span = max - min;
  const jitter = (v: number): number =>
    Math.min(max, Math.max(min, v + (rng.next() * 2 - 1) * radius * span));
  const rec = <K extends string>(r: Record<K, number>, keys: readonly K[]): Record<K, number> =>
    Object.fromEntries(keys.map((k) => [k, jitter(r[k])])) as Record<K, number>;
  return {
    path: rec(w.path, PATH_KINDS),
    archetype: rec(w.archetype, ALL_ARCHETYPES),
    composition: rec(w.composition, ALL_ARCHETYPES),
    compWeight: jitter(w.compWeight),
    level: jitter(w.level),
    stats: rec(w.stats, STAT_KEYS),
    total: jitter(w.total),
    passBias: jitter(w.passBias),
    ...(w.port !== undefined
      ? {
          port: {
            daemonValue: jitter(w.port.daemonValue),
            packetValue: jitter(w.port.packetValue),
            priceSensitivity: jitter(w.port.priceSensitivity),
            bankReserve: jitter(w.port.bankReserve),
            unitBias: jitter(w.port.unitBias),
          },
        }
      : {}),
    ...(w.fire !== undefined
      ? {
          fire: {
            bias: rec(w.fire.bias, ENCOUNTER_KINDS),
            cachePressure: jitter(w.fire.cachePressure),
          },
        }
      : {}),
    ...(w.temperature !== undefined ? { temperature: w.temperature } : {}),
  };
}

export interface RefineResult {
  /** The post-refinement winner (train-ranked over all refined finalists),
   *  re-scored on the held-out test set. */
  readonly best: ScoredCandidate;
  /** Per finalist (base-rank order): the greedy winner of {finalist ∪ its
   *  perturbs} by train fitness. `improved` = a perturb strictly beat it. */
  readonly refined: readonly (ScoredCandidate & { readonly improved: boolean })[];
  /** Train evaluations spent (topK × perturbs). */
  readonly trainEvals: number;
}

/**
 * The refinement pass over a completed base search: take the top-K train
 * finalists, evaluate `perturbs` jittered variants each, greedily keep the
 * best-by-train of each family (STRICT improvement replaces — ties keep the
 * incumbent, so refinement never churns the vector on noise-equal scores),
 * then re-rank the K family winners and score the overall winner held-out.
 * Composes with BOTH search paths (in-process runSearch and the sharded
 * assembleSearchResult) — it only needs `base.ranked` to carry K entries,
 * i.e. the base search must have run with `topK ≥ refine.topK`.
 *
 * 59f-pre — the perturbs are INDEPENDENT (best-of-family is a max, not a
 * sequential climb), so all K×perturbs variants are generated up front (per
 * finalist, in rng order — byte-identical variants to the serial draft) and
 * evaluated in ONE `batchEvaluate` call. Under `--jobs` the CLI passes the
 * vector-sharded evaluator here, which is what makes an overnight refine
 * affordable: the 59f cost probe measured serial in-parent refinement at
 * ~7h for K3×8×26-seeds full-length audition evals (~67s/run) vs ~1.4h
 * sharded. Default `batchEvaluate` maps the scalar `evaluate` (the serial
 * behavior, byte-identical — pinned by the equivalence test). Test-set
 * re-scores stay on the scalar `evaluate` (a handful of runs).
 */
export async function refineSearch(
  base: SearchResult,
  opts: {
    readonly box: SearchBox;
    readonly refine: RefineConfig;
    readonly trainSeeds: readonly number[];
    readonly testSeeds: readonly number[];
    readonly evaluate: (weights: ScoredWeights, seeds: readonly number[]) => number;
    /** Optional batch evaluator for the K×perturbs train evals (the CLI's
     *  sharded path). Must return rates aligned to the input vectors.
     *  Default: map the scalar `evaluate`. */
    readonly batchEvaluate?: (
      vectors: readonly ScoredWeights[],
      seeds: readonly number[],
    ) => Promise<readonly number[]>;
  },
): Promise<RefineResult> {
  const { box, refine, trainSeeds, testSeeds, evaluate } = opts;
  const batchEvaluate =
    opts.batchEvaluate ??
    ((vectors: readonly ScoredWeights[], seeds: readonly number[]) =>
      Promise.resolve(vectors.map((w) => evaluate(w, seeds))));
  const finalists = base.ranked.slice(0, refine.topK);
  if (finalists.length === 0) throw new Error('refineSearch: base.ranked is empty');
  const rng = new RNG(base.samplerSeed + REFINE_SEED_OFFSET);

  // Generate ALL variants first, finalist-major in rng order (identical
  // draw sequence to the serial formulation), then evaluate as one batch.
  const variants: ScoredWeights[] = [];
  for (const finalist of finalists) {
    for (let p = 0; p < refine.perturbs; p++) {
      variants.push(perturbWeights(finalist.weights, box, refine.radius, rng));
    }
  }
  const rates = await batchEvaluate(variants, trainSeeds);
  if (rates.length !== variants.length) {
    throw new Error(
      `refineSearch: batchEvaluate returned ${rates.length} rates for ${variants.length} vectors`,
    );
  }
  const trainEvals = variants.length;

  const refined = finalists.map((finalist, f) => {
    let bestWeights = finalist.weights;
    let bestTrain = finalist.trainWinRate;
    let improved = false;
    for (let p = 0; p < refine.perturbs; p++) {
      const idx = f * refine.perturbs + p;
      const rate = rates[idx]!;
      if (rate > bestTrain) {
        bestTrain = rate;
        bestWeights = variants[idx]!;
        improved = true;
      }
    }
    return { weights: bestWeights, trainWinRate: bestTrain, improved };
  });

  // Re-rank the family winners; earliest base rank breaks ties (stable map
  // order → the base winner keeps the crown on equal train rates).
  let winner = 0;
  for (let i = 1; i < refined.length; i++) {
    if (refined[i]!.trainWinRate > refined[winner]!.trainWinRate) winner = i;
  }
  const withTest = refined.map((r, i) => ({
    weights: r.weights,
    trainWinRate: r.trainWinRate,
    improved: r.improved,
    // Held-out score only where it's read: the winner (each extra test eval
    // is a full seed-set run). Non-winners carry the base testWinRate when
    // unimproved (still valid — same vector), else NaN-free 0 sentinel is
    // WRONG — so re-score improved non-winners too, cheap at K=3.
    testWinRate:
      i === winner || r.improved ? evaluate(r.weights, testSeeds) : finalists[i]!.testWinRate,
  }));
  return { best: withTest[winner]!, refined: withTest, trainEvals };
}
