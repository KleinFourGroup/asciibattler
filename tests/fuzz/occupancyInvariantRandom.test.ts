/**
 * §35d — the occupancy invariant, pure-random half. Split out of
 * `occupancyInvariant.test.ts` at 73b: each corpus sweep is ~60s+ of real sim
 * on its own, and the two together pinned one file at ~126s — the suite's
 * tail. Same test, byte-identical assertions; only the file boundary moved.
 * The rationale for the corpus (and for the greedy/pure-random breadth pair)
 * lives in the sibling file's header.
 */

import { describe, it, expect } from 'vitest';
import { runMany } from './harness';
import { makeStrategy } from './strategies/registry';

describe('§35d — occupancy invariant (pure-random corpus)', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => i + 1);

  // 180s budget — the timeout history is in the sibling file's header.
  it('holds across a pure-random corpus', () => {
    expect(() =>
      runMany(seeds, makeStrategy('pure-random')!, { assertOccupancy: true }),
    ).not.toThrow();
  }, 180000);
});
