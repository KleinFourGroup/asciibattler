/**
 * Deterministic-replay harness.
 *
 * Contract: given a fixed seed and an initial unit configuration, advancing the
 * World by N ticks must produce the *same* final state and the *same* emitted
 * event sequence, every run, forever. This is the load-bearing test for
 * "deterministic spectacle" (DESIGN.md) and ARCHITECTURE.md guiding principle 2.
 *
 * Why we care:
 *   - Replays / shareable seeds / bug repros all depend on it.
 *   - Catches accidental non-determinism that ESLint can't see: Map iteration
 *     order, Date.now()-as-randomness, Set ordering, sort stability assumptions,
 *     parallel async resolving in different orders, etc.
 *
 * The tests below are `todo` until Phase 3 lands. They document the shape so
 * future-us can fill in the body without re-deriving the contract.
 */

import { describe, it } from 'vitest';

describe('determinism: world tick replay', () => {
  it.todo('same seed + same initial team → same final unit positions after N ticks');
  it.todo('same seed + same initial team → same emitted event sequence');
  it.todo('forked RNG for a battle does not perturb the run-level RNG stream');
  it.todo('two parallel battles with the same forked seed resolve identically');
});

describe('determinism: stat rolls', () => {
  it.todo('rollUnit(archetype, rng) with the same rng state produces the same stats');
});

describe('determinism: map generation', () => {
  it.todo('NodeMap.generate(seed) produces the same DAG across runs');
});
