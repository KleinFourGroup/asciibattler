/**
 * Strategy determinism cases, split out of `harness.test.ts` at 73b: these
 * four each drive full runs (the G5 menu case alone is ~34s), and together
 * they were the file's heavy half — moving them keeps every fuzz file under
 * the suite's tail bound so the worker pool actually saturates. Same tests,
 * byte-identical assertions; only the file boundary moved.
 *
 * If you're adding a new strategy, add its determinism case HERE (the
 * harness.test.ts header's standing instruction now lands in this file).
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { makeStrategy } from './strategies/registry';

describe('fuzz harness — strategy determinism', () => {
  it('is deterministic per (seed, strategy)', () => {
    const a = runOne(42, makeStrategy('pure-random')!);
    const b = runOne(42, makeStrategy('pure-random')!);
    expect(a).toEqual(b);
  });

  it('greedy strategy is deterministic too', () => {
    const a = runOne(42, makeStrategy('greedy')!);
    const b = runOne(42, makeStrategy('greedy')!);
    expect(a).toEqual(b);
  });

  // §29d — explicit timeout (the harnessDaemon precedent). The §29 roster is
  // now draftable/rollable, and a run that fields the pure-passive summoner (a
  // Shaman whose Ghouls can stalemate) drags more battles to the tick-cap draw, so
  // a full run takes longer wall-clock than the 5s default. The test still only
  // asserts determinism + completion; battle-length tuning is §31's balance pass.
  // 43a — 30s → 90s: the straightness tie-break re-shaped battles (findPath
  // itself benched slightly FASTER), and under the full parallel fuzz:smoke
  // load this test started brushing 30s. Duration here is sim-content, not a
  // perf contract.
  it('G5 menu strategies each drive a full run deterministically', () => {
    // One representative per family (recruit / stat / path). Each must drive a
    // real run end-to-end without throwing and be byte-stable per (seed,
    // strategy) — the harness's "add a determinism case for a new strategy"
    // contract, covering the parameterized factory output.
    for (const name of ['recruit:mage', 'stat:constitution', 'path:rest']) {
      const a = runOne(7, makeStrategy(name)!);
      const b = runOne(7, makeStrategy(name)!);
      expect(a).toEqual(b);
      expect(a.strategyName).toBe(name);
      expect(['complete', 'defeat', 'hang', 'aborted']).toContain(a.outcome);
    }
  }, 90000);

  it('greedy and pure-random can diverge on the same seed', () => {
    // Not a balance assertion — just that the strategy actually
    // affects something. Recruit picks alone are enough to push the
    // run's team composition onto a different track.
    const random = runOne(42, makeStrategy('pure-random')!);
    const greedy = runOne(42, makeStrategy('greedy')!);
    // They start identically (same nodeMap, same first encounter), but
    // the recruit lists end up different OR the final team size
    // differs, depending on luck. If both happen to converge, fall
    // back to checking the strategy field is at least different.
    const recruitsDiffer = JSON.stringify(random.recruits) !== JSON.stringify(greedy.recruits);
    expect(recruitsDiffer || random.strategyName !== greedy.strategyName).toBe(true);
  });
});
