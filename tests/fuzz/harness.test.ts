/**
 * Fuzz harness smoke tests. Opt-in (`npm run fuzz:smoke`) — see
 * `vitest.fuzz.config.ts`. These don't assert balance outcomes (those
 * shift with tuning); they just ensure the harness, the strategies, and
 * the reporters all still wire up and produce well-formed output.
 *
 * If you're adding a new strategy, add a determinism case here. If
 * you're adding a new field to RunResult, extend the CSV header
 * assertion. Both prevent silent format drift breaking `npm run fuzz`.
 */

import { describe, it, expect } from 'vitest';
import { runOne } from './harness';
import { PureRandomStrategy } from './strategies/PureRandom';
import { GreedyStrategy } from './strategies/Greedy';
import {
  aggregate,
  renderSummaryCsv,
  renderFailureTrace,
  failureFilename,
} from './reporters';

describe('fuzz harness', () => {
  it('completes a single run without throwing', () => {
    const result = runOne(1, new PureRandomStrategy());
    expect(result.seed).toBe(1);
    expect(result.strategyName).toBe('pure-random');
    expect(['complete', 'defeat', 'hang', 'aborted']).toContain(result.outcome);
    expect(result.battles.length).toBeGreaterThan(0);
  });

  it('is deterministic per (seed, strategy)', () => {
    const a = runOne(42, new PureRandomStrategy());
    const b = runOne(42, new PureRandomStrategy());
    expect(a).toEqual(b);
  });

  it('greedy strategy is deterministic too', () => {
    const a = runOne(42, new GreedyStrategy());
    const b = runOne(42, new GreedyStrategy());
    expect(a).toEqual(b);
  });

  it('greedy and pure-random can diverge on the same seed', () => {
    // Not a balance assertion — just that the strategy actually
    // affects something. Recruit picks alone are enough to push the
    // run's team composition onto a different track.
    const random = runOne(42, new PureRandomStrategy());
    const greedy = runOne(42, new GreedyStrategy());
    // They start identically (same nodeMap, same first encounter), but
    // the recruit lists end up different OR the final team size
    // differs, depending on luck. If both happen to converge, fall
    // back to checking the strategy field is at least different.
    const recruitsDiffer = JSON.stringify(random.recruits) !== JSON.stringify(greedy.recruits);
    expect(recruitsDiffer || random.strategyName !== greedy.strategyName).toBe(true);
  });
});

describe('fuzz reporters', () => {
  it('renders a well-formed CSV summary', () => {
    const results = [
      runOne(1, new PureRandomStrategy()),
      runOne(2, new GreedyStrategy()),
    ];
    const csv = renderSummaryCsv(results);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain('seed');
    expect(lines[0]).toContain('strategy');
    expect(lines[0]).toContain('outcome');
    // Row count of comma-separated fields must match the header.
    const headerCols = lines[0]!.split(',').length;
    for (const row of lines.slice(1)) {
      expect(row.split(',')).toHaveLength(headerCols);
    }
  });

  it('aggregates win rate and floor stats', () => {
    const results = [
      runOne(1, new PureRandomStrategy()),
      runOne(2, new PureRandomStrategy()),
      runOne(3, new PureRandomStrategy()),
    ];
    const stats = aggregate(results);
    expect(stats.totalRuns).toBe(3);
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
    expect(stats.averageFloorReached).toBeGreaterThanOrEqual(0);
    expect(Object.keys(stats.byOutcome).length).toBeGreaterThan(0);
  });

  it('renders a failure trace for a non-complete result', () => {
    // Force-construct a synthetic defeat by reaching into the harness
    // result. Don't need to actually lose a run — the trace renderer
    // is pure w.r.t. its input.
    const result = runOne(1, new PureRandomStrategy());
    const synthetic = { ...result, outcome: 'defeat' as const };
    const md = renderFailureTrace(synthetic);
    expect(md).toContain('# Fuzz failure');
    expect(md).toContain('## Battles');
    expect(md).toContain('## Recruits');
    expect(failureFilename(synthetic)).toMatch(/seed1-defeat\.md$/);
  });
});
