/**
 * H7c parallelism — vector-sharding unit tests. Opt-in with the fuzz suite
 * (`npm run fuzz:smoke`).
 *
 * Only the PURE chunking is unit-tested here — the contiguous, order-preserving
 * split is what guarantees `evaluateVectorsSharded` can `flat()` the per-chunk
 * win rates back into the original vector-index order. The child-process fan-out
 * itself (spawn → eval → merge) is integration-verified by running the real
 * sweep with `--jobs=1` vs `--jobs>1` and diffing the CSV (BALANCE.md).
 */

import { describe, it, expect } from 'vitest';
import { chunkVectors, retryAsync } from './searchShard';

describe('chunkVectors', () => {
  it('splits into min(jobs, n) contiguous, even-as-possible chunks', () => {
    // 10 items / 3 jobs → sizes [4,3,3] (first n%parts chunks get the remainder).
    const chunks = chunkVectors([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 3);
    expect(chunks.map((c) => c.length)).toEqual([4, 3, 3]);
    expect(chunks).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  it('caps the chunk count at the item count (jobs > n)', () => {
    const chunks = chunkVectors([0, 1, 2, 3, 4], 8);
    expect(chunks).toHaveLength(5);
    expect(chunks.every((c) => c.length === 1)).toBe(true);
  });

  it('divides evenly when n % jobs === 0', () => {
    expect(chunkVectors([0, 1, 2, 3, 4, 5], 2)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });

  it('preserves order — flat() reconstructs the original index sequence', () => {
    const items = Array.from({ length: 23 }, (_v, i) => i);
    for (const jobs of [1, 2, 4, 7, 23, 50]) {
      expect(chunkVectors(items, jobs).flat()).toEqual(items);
    }
  });

  it('treats jobs < 1 as a single chunk', () => {
    expect(chunkVectors([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
});

describe('retryAsync — transient shard-spawn resilience', () => {
  it('returns the first success without retrying', async () => {
    let calls = 0;
    let retries = 0;
    const result = await retryAsync(
      async () => {
        calls++;
        return 'ok';
      },
      3,
      () => {
        retries++;
      },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(1);
    expect(retries).toBe(0);
  });

  it('retries a transient failure then succeeds (the 0xC0000142 flake)', async () => {
    let calls = 0;
    const retryAttempts: number[] = [];
    const result = await retryAsync(
      async (attempt) => {
        calls++;
        if (attempt < 3) throw new Error('eval-shard 0 exited with code 3221225794');
        return 42;
      },
      3,
      (attempt) => {
        retryAttempts.push(attempt);
      },
    );
    expect(result).toBe(42);
    expect(calls).toBe(3);
    expect(retryAttempts).toEqual([1, 2]); // onRetry fires AFTER attempts 1 and 2, not after the win
  });

  it('re-throws the last error after exhausting attempts (a real, deterministic failure)', async () => {
    let calls = 0;
    await expect(
      retryAsync(
        async () => {
          calls++;
          throw new Error(`boom ${calls}`);
        },
        3,
      ),
    ).rejects.toThrow('boom 3');
    expect(calls).toBe(3); // tried exactly `attempts` times
  });
});
