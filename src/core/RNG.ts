/**
 * Seeded PRNG using mulberry32 — small, fast, plenty good enough for an
 * autobattler. The whole simulation's determinism rests on every consumer
 * taking one of these as an argument; never reach for `Math.random()` in
 * `src/sim` or `src/run` (ESLint enforces this).
 *
 * Two derivation mechanisms, with different contracts (77d1):
 *
 *  - **`deriveSeed`/`deriveRng` — the KEYED door.** Child seed =
 *    `hash(root, streamKey, ...indices)`, a pure function of stable
 *    identifiers. Order-free: no parent stream advances, so adding a new
 *    stream (or a new draw inside one occurrence) can never remap another.
 *    This is the sanctioned mechanism for every cross-seam stream (the Run
 *    ladder, battle setup, bot clones — the 77d2/77d3 conversions). Keys
 *    come from the closed registry in [rngStreams.ts](rngStreams.ts);
 *    ad-hoc `new RNG(someHash)` construction is a review offense.
 *
 *  - **`fork()` — the POSITIONAL door.** One draw off the parent seeds the
 *    child, so the child depends on the parent's current position. Kept
 *    for LOCAL, self-contained uses (a tool or test forking off a fresh
 *    parent it owns end to end); retired from the cross-seam ladders.
 *
 * ⚠️ THE HASH IS FROZEN. `deriveSeed`'s mixing (below) and the registry's
 * key strings are both under the keys-are-permanent rule: changing either
 * is a global stream break (fuzz + board re-baseline). The pinned vectors
 * in rngStreams.test.ts enforce this.
 *
 * `toJSON()` / `fromJSON()` expose the single uint32 of internal state so
 * `World` and `Run` snapshots can resume the stream exactly mid-flight.
 */

import type { RngStreamKey } from './rngStreams';
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
    // Normalize to uint32 — internal step uses `| 0` (signed cast), but the
    // constructor and fromJSON both normalize with `>>> 0`. Without this,
    // snapshotting a fresh RNG and a round-tripped RNG at the same logical
    // step can return `state` values that differ by 2^32 (same bit pattern,
    // different sign interpretation) and break strict equality in tests.
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

/** One xor-multiply mixing round (the battleSetup `mixSeeds` shape,
 *  generalized here at 77d1 — that local one-off folds into this door at
 *  77d3). FROZEN: see the header. */
function mix(a: number, b: number): number {
  return (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35)) >>> 0;
}

/** FNV-1a over the key string, to a uint32 (the configHash shape, numeric
 *  variant). FROZEN: see the header. */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 77d1 — keyed child-seed derivation: `hash(root, stream, ...indices)`.
 * Pure and order-free (no stream position anywhere in the inputs). The
 * stream key is registry-typed so unregistered names fail to compile; the
 * trailing indices are the occurrence's STABLE ids (nodeId, sectorIndex,
 * turnIndex, unit level…) per the registry's per-key signature — never a
 * "how many times have we drawn" position.
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

/** Convenience: a fresh RNG on the derived stream. */
export function deriveRng(
  root: number,
  stream: RngStreamKey,
  ...indices: readonly number[]
): RNG {
  return new RNG(deriveSeed(root, stream, ...indices));
}
