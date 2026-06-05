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
 * (path → archetype → diversity → level → stats → total → passBias) so the
 * sample sequence is reproducible given `(samplerSeed, box, vector index)`.
 * `temperature` is left at its inert default (not sampled this cycle).
 */
export function sampleWeights(box: SearchBox, rng: RNG): ScoredWeights {
  const { min, max } = box.range;
  const draw = (): number => min + rng.next() * (max - min);
  const record = <K extends string>(keys: readonly K[]): Record<K, number> =>
    Object.fromEntries(keys.map((k) => [k, draw()])) as Record<K, number>;

  const path = record(PATH_KINDS);
  const archetype = record(ALL_ARCHETYPES);
  const diversity = draw();
  const level = draw();
  const stats = record(STAT_KEYS);
  const total = draw();
  const passBias = draw();
  return { path, archetype, diversity, level, stats, total, passBias };
}

// ---- train / test seed split ----------------------------------------------

/** Test seeds start far above any realistic train count, so the two sets are
 *  disjoint by construction. */
export const TEST_SEED_OFFSET = 1_000_000;

export function splitSeeds(
  trainCount: number,
  testCount: number,
): { trainSeeds: number[]; testSeeds: number[] } {
  const span = (start: number, count: number): number[] =>
    Array.from({ length: count }, (_v, i) => start + i);
  return { trainSeeds: span(1, trainCount), testSeeds: span(TEST_SEED_OFFSET, testCount) };
}

// ---- presets --------------------------------------------------------------

export interface SearchPreset {
  readonly vectors: number;
  readonly trainSeeds: number;
  readonly testSeeds: number;
  /** Short-run floor count for cheap evals; omit for full-length runs. */
  readonly floorCount?: number;
}

export const PRESETS: Record<'quick' | 'overnight', SearchPreset> = {
  // "Did my change move balance?" — well under a minute (short runs).
  quick: { vectors: 50, trainSeeds: 8, testSeeds: 4, floorCount: 4 },
  // The real sweep — full-length runs, hours single-core (runs are independent
  // so cores divide wall time linearly).
  overnight: { vectors: 500, trainSeeds: 200, testSeeds: 50 },
};

export function presetHarnessOptions(preset: SearchPreset): HarnessOptions {
  return preset.floorCount !== undefined ? { runConfig: { floorCount: preset.floorCount } } : {};
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

function harnessEvaluate(
  weights: ScoredWeights,
  seeds: readonly number[],
  options: HarnessOptions,
): number {
  return aggregate(runMany(seeds, scoredStrategy('search-candidate', weights), options)).winRate;
}

export function runSearch(config: SearchConfig): SearchResult {
  const { vectors, trainSeeds, testSeeds, samplerSeed, box } = config;
  if (vectors < 1) throw new Error('runSearch: vectors must be >= 1');
  const options = config.harnessOptions ?? {};
  const evaluate = config.evaluate ?? ((w, seeds) => harnessEvaluate(w, seeds, options));
  const topK = config.topK ?? 1;

  const rng = new RNG(samplerSeed);
  const candidates: Array<{ weights: ScoredWeights; trainWinRate: number; index: number }> = [];
  for (let i = 0; i < vectors; i++) {
    const weights = sampleWeights(box, rng); // propose
    const trainWinRate = evaluate(weights, trainSeeds); // evaluate
    candidates.push({ weights, trainWinRate, index: i });
  }

  // keep-best: rank by train fitness desc; lowest index breaks ties (earliest
  // proposal wins), so the result is deterministic.
  const ranked = [...candidates].sort(
    (a, b) => b.trainWinRate - a.trainWinRate || a.index - b.index,
  );
  const winners: ScoredCandidate[] = ranked.slice(0, topK).map((c) => ({
    weights: c.weights,
    trainWinRate: c.trainWinRate,
    testWinRate: evaluate(c.weights, testSeeds), // held-out
  }));

  return {
    best: winners[0]!,
    ranked: winners,
    samplerSeed,
    vectors,
    trainSeeds,
    testSeeds,
    trainWinRates: candidates.map((c) => c.trainWinRate),
  };
}
