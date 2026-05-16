import { describe, it, expect } from 'vitest';
import { RNG } from './RNG';

describe('RNG', () => {
  describe('determinism', () => {
    it('same seed produces the same sequence', () => {
      const a = new RNG(42);
      const b = new RNG(42);
      const aSeq = Array.from({ length: 100 }, () => a.next());
      const bSeq = Array.from({ length: 100 }, () => b.next());
      expect(aSeq).toEqual(bSeq);
    });

    it('different seeds produce different first values', () => {
      const a = new RNG(1);
      const b = new RNG(2);
      expect(a.next()).not.toBe(b.next());
    });

    it('normalizes negative seeds to uint32', () => {
      // -1 >>> 0 === 0xFFFFFFFF, so RNG(-1) and RNG(0xFFFFFFFF) must agree.
      const a = new RNG(-1);
      const b = new RNG(0xffffffff);
      expect(a.next()).toBe(b.next());
    });
  });

  describe('next', () => {
    it('returns values in [0, 1)', () => {
      const r = new RNG(42);
      for (let i = 0; i < 1000; i++) {
        const v = r.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('int', () => {
    it('returns integers within the inclusive bounds', () => {
      const r = new RNG(42);
      for (let i = 0; i < 1000; i++) {
        const v = r.int(3, 7);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('returns the single value when min === max', () => {
      const r = new RNG(42);
      expect(r.int(5, 5)).toBe(5);
    });

    it('hits both endpoints across many draws', () => {
      // Sanity check that the inclusive upper bound is actually reachable.
      const r = new RNG(42);
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) seen.add(r.int(0, 3));
      expect(seen).toEqual(new Set([0, 1, 2, 3]));
    });
  });

  describe('pick', () => {
    it('returns an element of the array', () => {
      const r = new RNG(42);
      const arr = ['a', 'b', 'c', 'd'] as const;
      for (let i = 0; i < 100; i++) {
        expect(arr).toContain(r.pick(arr));
      }
    });

    it('throws on empty array', () => {
      const r = new RNG(42);
      expect(() => r.pick([])).toThrow(/empty/);
    });
  });

  describe('fork', () => {
    it('two children forked from same-seed parents at the same point are identical', () => {
      const parentA = new RNG(42);
      const parentB = new RNG(42);
      const childA = parentA.fork();
      const childB = parentB.fork();
      const aSeq = Array.from({ length: 50 }, () => childA.next());
      const bSeq = Array.from({ length: 50 }, () => childB.next());
      expect(aSeq).toEqual(bSeq);
    });

    it('consuming a child does not perturb the parent stream', () => {
      // If we fork and then exhaust the child, the parent's next draws must
      // still match a parent that forked but never touched the child.
      // This is the property that makes per-battle forking safe.
      const parentA = new RNG(42);
      const childA = parentA.fork();
      for (let i = 0; i < 1000; i++) childA.next();

      const parentB = new RNG(42);
      parentB.fork(); // advance state by the fork itself, then ignore the child

      const aSeq = Array.from({ length: 20 }, () => parentA.next());
      const bSeq = Array.from({ length: 20 }, () => parentB.next());
      expect(aSeq).toEqual(bSeq);
    });

    it('the child stream is not the parent stream', () => {
      // The two streams must diverge — a child whose first draw matched the
      // parent's next draw would be a degenerate fork.
      const r = new RNG(42);
      const child = r.fork();
      expect(child.next()).not.toBe(r.next());
    });
  });
});
