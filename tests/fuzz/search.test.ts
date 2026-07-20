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
    // 59b/59c — the optional economy groups (always present on SAMPLED
    // vectors; guarded so hand-built old-shape vectors still walk).
    ...(w.port !== undefined ? Object.values(w.port) : []),
    ...(w.fire !== undefined ? [...Object.values(w.fire.bias), w.fire.cachePressure] : []),
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

  it('seedOffset (X2) shifts both bases → a holdout disjoint from the tuned range', () => {
    const tuned = splitSeeds(8, 4); // offset 0 (the tuning pass)
    const verify = splitSeeds(8, 4, 1000); // offset 1000 (the X3 verify)
    // Train shifts by the offset; test by the same offset off TEST_SEED_OFFSET.
    expect(verify.trainSeeds[0]).toBe(1001);
    expect(verify.testSeeds[0]).toBe(TEST_SEED_OFFSET + 1000);
    // The verify train seeds never overlap the tuned train OR test seeds.
    const tunedAll = new Set([...tuned.trainSeeds, ...tuned.testSeeds]);
    expect(verify.trainSeeds.some((s) => tunedAll.has(s))).toBe(false);
    // The split stays internally disjoint at the offset.
    expect(verify.trainSeeds.filter((s) => verify.testSeeds.includes(s))).toEqual([]);
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

// ---- refinement stage (59d) -------------------------------------------------

import { perturbWeights, refineSearch, DEFAULT_REFINE } from './search';

describe('perturbWeights (59d)', () => {
  it('every perturbed weight stays inside the box (clamped), radius 0 is the identity', () => {
    const box = { range: { min: -1, max: 1 } };
    const base = generateVectors(box, 42, 1)[0]!;
    const rng = new RNG(7);
    for (let n = 0; n < 20; n++) {
      for (const v of allWeights(perturbWeights(base, box, 1.0, rng))) {
        expect(v).toBeGreaterThanOrEqual(box.range.min);
        expect(v).toBeLessThanOrEqual(box.range.max);
      }
    }
    expect(perturbWeights(base, box, 0, new RNG(1))).toEqual(base);
  });

  it('is reproducible at a fixed rng state and preserves optional-group absence', () => {
    const base = generateVectors(DEFAULT_BOX, 42, 1)[0]!;
    expect(perturbWeights(base, DEFAULT_BOX, 0.15, new RNG(3))).toEqual(
      perturbWeights(base, DEFAULT_BOX, 0.15, new RNG(3)),
    );
    // An old-shape vector (no port/fire) never grows the groups under perturb.
    const { port: _p, fire: _f, ...oldShape } = base;
    const perturbed = perturbWeights(oldShape as ScoredWeights, DEFAULT_BOX, 0.15, new RNG(3));
    expect(perturbed.port).toBeUndefined();
    expect(perturbed.fire).toBeUndefined();
  });
});

describe('refineSearch (59d)', () => {
  const trainSeeds = [1, 2, 3];
  const testSeeds = [9, 10];

  /** A 3-finalist base result via the shared keep-best, stub-scored. */
  function makeBase(finalistRates: number[]) {
    const vectors = generateVectors(DEFAULT_BOX, 5, finalistRates.length);
    return assembleSearchResult(vectors, finalistRates, () => 0.11, {
      samplerSeed: 5,
      trainSeeds,
      testSeeds,
      topK: finalistRates.length,
    });
  }

  it('greedy accept: a strictly better perturb replaces its finalist; the winner is re-scored held-out', async () => {
    const base = makeBase([0.5, 0.4, 0.3]);
    const finalists = new Set(base.ranked.map((c) => JSON.stringify(c.weights)));
    const evaluate = (w: ScoredWeights, seeds: readonly number[]): number => {
      if (seeds === testSeeds) return 0.42;
      return finalists.has(JSON.stringify(w)) ? 0.5 : 0.9; // every perturb beats every finalist
    };
    const r = await refineSearch(base, {
      box: DEFAULT_BOX,
      refine: DEFAULT_REFINE,
      trainSeeds,
      testSeeds,
      evaluate,
    });
    expect(r.trainEvals).toBe(DEFAULT_REFINE.topK * DEFAULT_REFINE.perturbs);
    expect(r.best.trainWinRate).toBe(0.9);
    expect(r.best.testWinRate).toBe(0.42); // held-out re-score, not the train rate
    expect(r.refined.every((f) => f.improved)).toBe(true);
    expect(finalists.has(JSON.stringify(r.best.weights))).toBe(false); // a perturb won
  });

  it('worse-or-equal perturbs keep the incumbent (ties never churn the vector)', async () => {
    // ALL finalists at 0.5 so a 0.5-scoring perturb is a TIE everywhere —
    // rates like [0.5, 0.4, 0.3] would make 0.5 a strict improvement for
    // the lower finalists (the first draft's mistake).
    const base = makeBase([0.5, 0.5, 0.5]);
    const evaluate = (_w: ScoredWeights, seeds: readonly number[]): number =>
      seeds === testSeeds ? 0.42 : 0.5; // every perturb TIES the best finalist
    const r = await refineSearch(base, {
      box: DEFAULT_BOX,
      refine: DEFAULT_REFINE,
      trainSeeds,
      testSeeds,
      evaluate,
    });
    expect(r.refined.every((f) => !f.improved)).toBe(true);
    expect(r.best.weights).toEqual(base.best.weights); // incumbent holds
    // Unimproved non-winners carry the base held-out score (no re-eval).
    expect(r.refined[1]!.testWinRate).toBe(base.ranked[1]!.testWinRate);
  });

  it('is deterministic: same base + same stub → identical result objects', async () => {
    const base = makeBase([0.6, 0.2, 0.1]);
    const evaluate = (w: ScoredWeights, seeds: readonly number[]): number =>
      seeds === testSeeds ? 0.3 : JSON.stringify(w).length % 7 === 0 ? 0.95 : 0.1;
    const opts = { box: DEFAULT_BOX, refine: DEFAULT_REFINE, trainSeeds, testSeeds, evaluate };
    expect(await refineSearch(base, opts)).toEqual(await refineSearch(base, opts));
  });

  it('59f-pre: a batch evaluator is byte-equivalent to the serial scalar path', async () => {
    // The perturbs are independent (best-of-family is a max), so batching
    // must change NOTHING: same variants (same rng order), same winners.
    const base = makeBase([0.6, 0.2, 0.1]);
    const score = (w: ScoredWeights): number => (JSON.stringify(w).length % 5) / 10;
    const evaluate = (w: ScoredWeights, seeds: readonly number[]): number =>
      seeds === testSeeds ? 0.33 : score(w);
    const opts = { box: DEFAULT_BOX, refine: DEFAULT_REFINE, trainSeeds, testSeeds, evaluate };
    const serial = await refineSearch(base, opts);
    let batchCalls = 0;
    const batched = await refineSearch(base, {
      ...opts,
      batchEvaluate: (vectors, _seeds) => {
        batchCalls++;
        return Promise.resolve(vectors.map(score));
      },
    });
    expect(batchCalls).toBe(1); // ONE sharded round-trip, not one per eval
    expect(batched).toEqual(serial);
  });

  it('59f-pre: a misaligned batchEvaluate throws loudly', async () => {
    const base = makeBase([0.5]);
    await expect(
      refineSearch(base, {
        box: DEFAULT_BOX,
        refine: { topK: 1, perturbs: 4, radius: 0.15 },
        trainSeeds,
        testSeeds,
        evaluate: () => 0,
        batchEvaluate: () => Promise.resolve([0]),
      }),
    ).rejects.toThrow(/returned 1 rates for 4 vectors/);
  });
});
