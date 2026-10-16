/**
 * A seeded PRNG, mulberry32: small and fast, and good enough for an
 * autobattler. The sim's determinism rests on every consumer taking one of
 * these as an argument; `Math.random()` is banned in `src/sim` and
 * `src/run` by ESLint.
 *
 * A child stream comes from one of two derivations, with different
 * contracts:
 *
 *  - `deriveSeed` and `deriveRng`, keyed. The child's seed is
 *    `hash(root, streamKey, ...ids)`, a pure function of stable ids, and no
 *    parent stream advances, so adding a stream, or a draw inside one
 *    occurrence, never moves another. Every stream that crosses a seam
 *    takes this door (the run's streams, battle setup, the bot's clones).
 *    The keys come from the closed registry in [rngStreams.ts](rngStreams.ts);
 *    seeding `new RNG(someHash)` by hand instead is refused in review.
 *  - `fork()`, positional. One draw off the parent seeds the child, so the
 *    child depends on where the parent stands. It is legal only on a fresh
 *    local parent that one scope owns, such as a tool or a test.
 *
 * The hash is permanent, as the registry's key strings are (gotcha #125):
 * changing `mix`, `fnv1a32` or `deriveSeed` moves every keyed stream and
 * re-baselines the fuzz pins and the board. The vectors pinned in
 * `rngStreams.test.ts` catch it.
 *
 * `toJSON()` and `fromJSON()` expose the one uint32 of state, so a `World`
 * or `Run` snapshot resumes a stream exactly where it stood.
 */

import type { RngStreamKey } from './rngStreams';
export interface RNGSnapshot {
  readonly state: number;
}

export class RNG {
  private state: number;

  constructor(seed: number) {
    // To uint32, so a negative or fractional seed is accepted.
    this.state = seed >>> 0;
  }

  toJSON(): RNGSnapshot {
    // To uint32: the step stores a signed `| 0`, while the constructor and
    // `fromJSON` store `>>> 0`. Without this, a fresh RNG and a round-tripped
    // one at the same step can report states 2^32 apart (the same bits read
    // with a different sign) and fail a strict equality.
    return { state: this.state >>> 0 };
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

  /** Shuffles `arr` in place (Fisher–Yates, from the end down), drawing
   *  `arr.length − 1` times. */
  shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
  }

  /**
   * A new RNG seeded from one uint32 drawn off this stream: the parent
   * advances exactly one step, and the child is independent after that. The
   * header says where a fork is legal.
   */
  fork(): RNG {
    return new RNG(this.nextU32());
  }

  /**
   * The mulberry32 step. Private, so callers draw through `next()` or
   * `fork()` and the raw uint32 is not part of the contract.
   */
  private nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
}

/** One xor-multiply mixing round. Permanent: see the header. */
function mix(a: number, b: number): number {
  return (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35)) >>> 0;
}

/** FNV-1a over the key string, as a uint32 (`fnv1a.ts` renders the same
 *  hash as hex). Permanent: see the header. */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A keyed child seed, `hash(root, stream, ...indices)`: pure, with no
 * stream position among its inputs. The indices are the occurrence's
 * stable ids in the order the registry gives for the key (sectorIndex,
 * nodeId, turnIndex…), never a count of draws.
 */
export function deriveSeed(
  root: number,
  stream: RngStreamKey,
  ...indices: readonly number[]
): number {
  let h = mix(root >>> 0, fnv1a32(stream));
  for (const i of indices) h = mix(h, i >>> 0);
  return h;
}

/** A fresh RNG on the keyed stream `deriveSeed` gives. */
export function deriveRng(
  root: number,
  stream: RngStreamKey,
  ...indices: readonly number[]
): RNG {
  return new RNG(deriveSeed(root, stream, ...indices));
}
