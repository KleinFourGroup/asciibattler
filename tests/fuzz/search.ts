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
