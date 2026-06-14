import { describe, it, expect } from 'vitest';
import { RNG } from './RNG';
import { weightedPick, sampleRange, sampleIntRange } from './sampling';

describe('weightedPick', () => {
  it('is deterministic for a given seed', () => {
    const w = { a: 1, b: 2, c: 3 };
    const seq = (seed: number): string[] => {
      const rng = new RNG(seed);
      return Array.from({ length: 20 }, () => weightedPick(rng, w));
    };
    expect(seq(99)).toEqual(seq(99));
  });

  it('always returns the only positive-weight key', () => {
    const w = { a: 0, b: 1, c: 0 };
    for (let seed = 0; seed < 200; seed++) {
      expect(weightedPick(new RNG(seed), w)).toBe('b');
    }
  });

  it('selects keys roughly in proportion to their weights', () => {
    const w = { lo: 1, hi: 3 }; // expect ~25% / ~75%
    const rng = new RNG(7);
    const N = 8000;
    let hi = 0;
    for (let i = 0; i < N; i++) if (weightedPick(rng, w) === 'hi') hi++;
    expect(hi / N).toBeGreaterThan(0.7);
    expect(hi / N).toBeLessThan(0.8);
  });

  it('never selects a zero-weight key', () => {
    const w = { a: 0, b: 5, c: 0, d: 5 };
    const rng = new RNG(123);
    for (let i = 0; i < 2000; i++) {
      const k = weightedPick(rng, w);
      expect(k === 'b' || k === 'd').toBe(true);
    }
  });

  it('result is independent of JSON key order', () => {
    const forward = { '1': 0.2, '2': 0.3, '3': 0.5 };
    const reversed = { '3': 0.5, '2': 0.3, '1': 0.2 };
    for (let seed = 0; seed < 100; seed++) {
      expect(weightedPick(new RNG(seed), forward)).toBe(weightedPick(new RNG(seed), reversed));
    }
  });

  it('consumes exactly one draw', () => {
    const rng = new RNG(5);
    const probe = RNG.fromJSON(rng.toJSON());
    weightedPick(rng, { a: 1, b: 1 });
    probe.next();
    expect(rng.toJSON()).toEqual(probe.toJSON());
  });
});

describe('sampleRange', () => {
  it('stays within [min, max]', () => {
    const rng = new RNG(11);
    for (let i = 0; i < 5000; i++) {
      const v = sampleRange(rng, 2, 9, 4, 0.8);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('is uniform (mean ≈ midpoint) with no center/intensity', () => {
    const rng = new RNG(3);
    const N = 20000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += sampleRange(rng, 0, 10);
    expect(sum / N).toBeGreaterThan(4.8);
    expect(sum / N).toBeLessThan(5.2);
  });

  it('intensity 0 reproduces the uniform sample exactly', () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = sampleRange(new RNG(seed), 0, 10, 2, 0);
      const b = sampleRange(new RNG(seed), 0, 10); // bare uniform, same seed
      expect(a).toBeCloseTo(b, 10);
    }
  });

  it('biasing pulls the mean toward an off-center mode', () => {
    const rng = new RNG(42);
    const N = 20000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += sampleRange(rng, 0, 10, 2, 1); // mode at 2
    const mean = sum / N;
    expect(mean).toBeLessThan(5); // pulled below the uniform midpoint
    expect(mean).toBeGreaterThan(2); // but mode != mean, drifts toward middle
  });

  it('concentrates mass near the center as intensity rises', () => {
    const near = (intensity: number): number => {
      const rng = new RNG(8);
      const N = 20000;
      let hits = 0;
      for (let i = 0; i < N; i++) {
        const v = sampleRange(rng, 0, 10, 5, intensity);
        if (v >= 4 && v <= 6) hits++;
      }
      return hits / N;
    };
    expect(near(1)).toBeGreaterThan(near(0));
  });

  it('returns min for a degenerate range and still draws once', () => {
    const rng = new RNG(2);
    const probe = RNG.fromJSON(rng.toJSON());
    expect(sampleRange(rng, 4, 4)).toBe(4);
    probe.next();
    expect(rng.toJSON()).toEqual(probe.toJSON());
  });
});

describe('sampleIntRange', () => {
  it('returns integers within [min, max]', () => {
    const rng = new RNG(17);
    for (let i = 0; i < 5000; i++) {
      const v = sampleIntRange(rng, 1, 4, 2, 0.5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(4);
    }
  });
});
