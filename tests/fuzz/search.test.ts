/**
 * H7b — search-driver tests. Opt-in with the fuzz suite (`npm run fuzz:smoke`).
 *
 * Three of the four use an INJECTED `evaluate` (no real runs) so they pin the
 * search LOGIC — sampler bounds, keep-best argmax, and the train/test split —
 * instantly. The reproducibility test uses the REAL harness evaluator at tiny
 * scale (short 1-battle runs) to prove the whole experiment is deterministic
 * end-to-end at a fixed sampler seed.
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../../src/core/RNG';
import {
  runSearch,
  sampleWeights,
  generateVectors,
  assembleSearchResult,
  splitSeeds,
  DEFAULT_BOX,
  TEST_SEED_OFFSET,
  type SearchConfig,
} from './search';
import type { ScoredWeights } from './strategies/scoredWeights';

function allWeights(w: ScoredWeights): number[] {
  return [
    ...Object.values(w.path),
    ...Object.values(w.archetype),
    ...Object.values(w.composition),
    w.compWeight,
    w.level,
    ...Object.values(w.stats),
    w.total,
    w.passBias,
  ];
}

describe('sampleWeights', () => {
  it('draws every weight within the box', () => {
    const box = { range: { min: -2, max: 2 } };
    const rng = new RNG(123);
    for (let n = 0; n < 50; n++) {
      for (const v of allWeights(sampleWeights(box, rng))) {
        expect(v).toBeGreaterThanOrEqual(box.range.min);
        expect(v).toBeLessThan(box.range.max); // rng.next() ∈ [0, 1)
      }
    }
  });

  it('is reproducible at a fixed seed (same sequence of vectors)', () => {
    const a = new RNG(9);
    const b = new RNG(9);
    for (let i = 0; i < 5; i++) {
      expect(sampleWeights(DEFAULT_BOX, a)).toEqual(sampleWeights(DEFAULT_BOX, b));
    }
  });
});

describe('runSearch keep-best', () => {
  it('returns the max-train-fitness vector (deterministic argmax over the sample)', () => {
    // Fitness is a pure function of the weights, so the winner is computable
    // independently by re-sampling the same vectors with the same sampler seed.
    const vectors = 25;
    const samplerSeed = 7;
    const result = runSearch({
      vectors,
      samplerSeed,
      box: DEFAULT_BOX,
      trainSeeds: [1],
      testSeeds: [2],
      evaluate: (w) => w.stats.power,
    });

    const rng = new RNG(samplerSeed);
    let bestPower = -Infinity;
    let bestVec: ScoredWeights | null = null;
    for (let i = 0; i < vectors; i++) {
      const w = sampleWeights(DEFAULT_BOX, rng);
      if (w.stats.power > bestPower) {
        bestPower = w.stats.power;
        bestVec = w;
      }
    }
    expect(result.best.weights).toEqual(bestVec);
    expect(result.best.trainWinRate).toBe(bestPower);
    expect(result.trainWinRates).toHaveLength(vectors);
  });
});

describe('generateVectors (shared deterministic proposal)', () => {
  it('matches the manual sampleWeights sequence and is reproducible', () => {
    const a = generateVectors(DEFAULT_BOX, 11, 5);
    const b = generateVectors(DEFAULT_BOX, 11, 5);
    expect(a).toHaveLength(5);
    expect(b).toEqual(a); // same (seed, box, count) → identical list

    const rng = new RNG(11);
    const manual = Array.from({ length: 5 }, () => sampleWeights(DEFAULT_BOX, rng));
    expect(a).toEqual(manual); // the parent / shard children re-derive the same vectors
  });
});

describe('assembleSearchResult (shared keep-best)', () => {
  it('picks the max-train winner (lowest-index tie), scores it on test, passes trainWinRates through', () => {
    const vectors = generateVectors(DEFAULT_BOX, 3, 3);
    const result = assembleSearchResult(vectors, [0.2, 0.9, 0.5], () => 0.42, {
      samplerSeed: 3,
      trainSeeds: [1],
      testSeeds: [2],
      topK: 1,
    });
    expect(result.best.weights).toEqual(vectors[1]); // 0.9 is the max train fitness
    expect(result.best.trainWinRate).toBe(0.9);
    expect(result.best.testWinRate).toBe(0.42); // scoreTest applied to the winner
    expect(result.trainWinRates).toEqual([0.2, 0.9, 0.5]);
    expect(result.vectors).toBe(3);
  });

  it('breaks train-fitness ties toward the lowest index', () => {
    const vectors = generateVectors(DEFAULT_BOX, 3, 3);
    const result = assembleSearchResult(vectors, [0.9, 0.9, 0.1], () => 0, {
      samplerSeed: 3,
      trainSeeds: [1],
      testSeeds: [2],
      topK: 1,
    });
    expect(result.best.weights).toEqual(vectors[0]);
  });
});

describe('runSearch train/test split', () => {
  it('splitSeeds produces disjoint train and test sets', () => {
    const { trainSeeds, testSeeds } = splitSeeds(8, 4);
    expect(trainSeeds).toHaveLength(8);
    expect(testSeeds).toHaveLength(4);
    expect(trainSeeds.filter((s) => testSeeds.includes(s))).toEqual([]);
    expect(testSeeds.every((s) => s >= TEST_SEED_OFFSET)).toBe(true);
  });

  it('evaluates the winner on the held-out test seeds, not the train seeds', () => {
    const { trainSeeds, testSeeds } = splitSeeds(8, 4);
    // evaluate returns 1 on the test set, 0 on the train set — so a winner whose
    // testWinRate reads 1 PROVES the held-out evaluation used the test seeds.
    const result = runSearch({
      vectors: 4,
      samplerSeed: 1,
      box: DEFAULT_BOX,
      trainSeeds,
      testSeeds,
      evaluate: (_w, seeds) => (seeds[0] === testSeeds[0] ? 1 : 0),
    });
    expect(result.best.trainWinRate).toBe(0);
    expect(result.best.testWinRate).toBe(1);
  });
});

describe('runSearch reproducibility (real harness, short runs)', () => {
  it('produces an identical winner from the same sampler seed', () => {
    const cfg: SearchConfig = {
      vectors: 3,
      samplerSeed: 42,
      box: DEFAULT_BOX,
      trainSeeds: [1, 2],
      testSeeds: [TEST_SEED_OFFSET],
      harnessOptions: { runConfig: { hopCount: 2 } }, // one-battle runs
    };
    const a = runSearch(cfg);
    const b = runSearch(cfg);
    expect(b.best.weights).toEqual(a.best.weights);
    expect(b.best.trainWinRate).toBe(a.best.trainWinRate);
    expect(b.best.testWinRate).toBe(a.best.testWinRate);
    expect(b.trainWinRates).toEqual(a.trainWinRates);
  });
});
