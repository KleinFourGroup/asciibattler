/**
 * Seeded PRNG using mulberry32 — small, fast, plenty good enough for an
 * autobattler. The whole simulation's determinism rests on every consumer
 * taking one of these as an argument; never reach for `Math.random()` in
 * `src/sim` or `src/run` (ESLint enforces this).
 *
 * `fork()` is the load-bearing method: each battle/encounter takes a forked
 * RNG so its randomness can't perturb the run-level stream. See
 * ARCHITECTURE.md and TESTING.md for the full contract.
 *
 * `toJSON()` / `fromJSON()` expose the single uint32 of internal state so
 * `World` and `Run` snapshots can resume the stream exactly mid-flight.
 */
export interface RNGSnapshot {
  readonly state: number;
}

export class RNG {
  private state: number;

  constructor(seed: number) {
    // Normalize to uint32. Accepts negative or fractional seeds without
    // surprising the caller.
    this.state = seed >>> 0;
  }

  toJSON(): RNGSnapshot {
    return { state: this.state };
  }

  static fromJSON(snap: RNGSnapshot): RNG {
    const rng = new RNG(0);
    rng.state = snap.state >>> 0;
    return rng;
  }

  /** Returns a number in `[0, 1)`. */
  next(): number {
    return this.nextU32() / 0x1_0000_0000;
  }

  /** Returns an integer in `[min, max]` (inclusive). Trusts `min <= max`. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Returns a random element of `arr`. Throws on empty arrays. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error('RNG.pick: cannot pick from an empty array');
    }
    return arr[this.int(0, arr.length - 1)]!;
  }

  /**
   * Returns a new RNG seeded deterministically from one uint32 drawn out of
   * this stream. The parent's stream advances by exactly one step; the child
   * is then completely independent.
   */
  fork(): RNG {
    return new RNG(this.nextU32());
  }

  /**
   * Mulberry32 step. Kept private so callers go through `next()` (for `[0,1)`)
   * or `fork()` (for re-seeding) — the raw uint32 form is an implementation
   * detail, not part of the contract.
   */
  private nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
}
