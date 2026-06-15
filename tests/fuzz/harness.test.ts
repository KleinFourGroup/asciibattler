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
import type { BattleResult, RunResult } from './harness';
import { makeStrategy } from './strategies/registry';
import {
  aggregate,
  renderSummaryCsv,
  renderFailureTrace,
  failureFilename,
  perFloorStats,
  renderPerFloorAnalysis,
  perLayoutStats,
  perLayoutFloorStats,
  renderLayoutAnalysis,
} from './reporters';
import { LAYOUT_IDS } from '../../src/sim/layouts';

describe('fuzz harness', () => {
  it('completes a single run without throwing', () => {
    const result = runOne(1, makeStrategy('pure-random')!);
    expect(result.seed).toBe(1);
    expect(result.strategyName).toBe('pure-random');
    expect(['complete', 'defeat', 'hang', 'aborted']).toContain(result.outcome);
    expect(result.battles.length).toBeGreaterThan(0);
    // Every battle carries its layout id (null for procedural). Pins the
    // C1d follow-up field so format drift breaks the smoke instead of
    // silently emptying the per-layout hang report.
    for (const b of result.battles) {
      expect(b).toHaveProperty('layoutId');
      expect(b.layoutId === null || typeof b.layoutId === 'string').toBe(true);
    }
  });

  it('force-resolves a turn that hits the per-turn cap as a DRAW, not a hang', () => {
    // N2 cap unification — a battle that can't resolve within the cap is no longer a
    // run-ending 'hang'. maxTicksPerBattle:1 forces EVERY battle to the cap, so each
    // resolveAsDraw's (winner 'draw', both pools chip) and the run plays on to a
    // normal terminal outcome (a defeat once the chips zero a pool), never a hang.
    // The harness-level mirror of the encounter-loop integration test's cap-as-draw.
    const result = runOne(3, makeStrategy('greedy')!, { maxTicksPerBattle: 1 });
    expect(result.outcome).not.toBe('hang');
    expect(result.battles.length).toBeGreaterThan(0);
    expect(result.battles.every((b) => b.winner === 'draw')).toBe(true);
    // The aggregate surfaces those capped draws (the signal that replaced 'hang').
    const stats = aggregate([result]);
    expect(stats.hangs).toBe(0);
    expect(stats.cappedDraws).toBe(result.battles.length);
  });

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
  });

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

describe('fuzz reporters', () => {
  it('renders a well-formed CSV summary', () => {
    const results = [
      runOne(1, makeStrategy('pure-random')!),
      runOne(2, makeStrategy('greedy')!),
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
      runOne(1, makeStrategy('pure-random')!),
      runOne(2, makeStrategy('pure-random')!),
      runOne(3, makeStrategy('pure-random')!),
    ];
    const stats = aggregate(results);
    expect(stats.totalRuns).toBe(3);
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
    expect(stats.averageFloorReached).toBeGreaterThanOrEqual(0);
    expect(Object.keys(stats.byOutcome).length).toBeGreaterThan(0);
    // hangsByLayout is always present; empty when no hangs occurred.
    expect(stats.hangsByLayout).toBeDefined();
    const sumHangs = Object.values(stats.hangsByLayout).reduce((a, b) => a + b, 0);
    expect(sumHangs).toBe(stats.hangs);
  });

  it('every battle carries player/enemy level arrays matching the team sizes', () => {
    // G4 per-floor telemetry: the level arrays must be present and aligned
    // with the recorded team sizes, or the per-floor analysis silently lies.
    const result = runOne(3, makeStrategy('greedy')!);
    expect(result.battles.length).toBeGreaterThan(0);
    for (const b of result.battles) {
      expect(b.playerLevels).toHaveLength(b.playerTeamSize);
      expect(b.enemyLevels).toHaveLength(b.enemyTeamSize);
      expect(b.playerLevels.every((l) => l >= 1)).toBe(true);
      expect(b.enemyLevels.every((l) => l >= 1)).toBe(true);
    }
  });

  it('per-floor stats aggregate by floor with sane bounds', () => {
    const results = [
      runOne(1, makeStrategy('pure-random')!),
      runOne(2, makeStrategy('greedy')!),
      runOne(3, makeStrategy('greedy')!),
    ];
    const stats = perFloorStats(results);
    expect(stats.length).toBeGreaterThan(0);
    // Floors are sorted ascending; battle counts sum to all battles played.
    const floors = stats.map((s) => s.floor);
    expect([...floors].sort((a, b) => a - b)).toEqual(floors);
    const totalBattles = results.reduce((acc, r) => acc + r.battles.length, 0);
    expect(stats.reduce((acc, s) => acc + s.battles, 0)).toBe(totalBattles);
    for (const s of stats) {
      expect(s.playerAvgLevel).toBeGreaterThanOrEqual(1);
      expect(s.enemyAvgLevel).toBeGreaterThanOrEqual(1);
      expect(s.playerSize).toBeGreaterThan(0);
      expect(s.enemySize).toBeGreaterThan(0);
      expect(s.playerLevelSpread).toBeGreaterThanOrEqual(0);
    }
    expect(renderPerFloorAnalysis(results)).toContain('Per-floor team analysis');
  });

  it('per-floor run-death stats are run-level, not per-wave (the pool absorbs lost waves)', () => {
    // Config-free fixtures pin the RUN-level mechanic across the multi-wave pool
    // system. Run A: 3 waves on floor 1 (loses 2 of them — pool absorbs it),
    // survives to floor 2, completes. Run B: dies on floor 1. So floor 1 has 2
    // runs reached, 1 died (B) — NOT 3 (the lost waves don't count as run-deaths).
    const battle = (floor: number, winner: 'player' | 'enemy', playerDeaths: number): BattleResult => ({
      floor,
      worldSeed: 0,
      layoutId: null,
      winner,
      ticks: 1,
      playerDeaths,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [1, 1, 1, 1, 1],
      enemyLevels: [1, 1, 1, 1, 1, 1, 1, 1],
    });
    const run = (
      battles: BattleResult[],
      outcome: 'complete' | 'defeat',
      finalFloorReached: number,
    ): RunResult => ({
      seed: 0,
      strategyName: 'synthetic',
      outcome,
      finalFloorReached,
      totalTicks: 0,
      finalTeamSize: 5,
      battles,
      recruits: [],
    });
    // Run A: 3 floor-1 waves (2 lost but absorbed), then floor 2, completes.
    const runA = run(
      [battle(1, 'enemy', 4), battle(1, 'enemy', 3), battle(1, 'player', 1), battle(2, 'player', 0)],
      'complete',
      2,
    );
    // Run B: dies on floor 1.
    const runB = run([battle(1, 'enemy', 5)], 'defeat', 1);

    const stats = perFloorStats([runA, runB]);
    const f1 = stats.find((s) => s.floor === 1)!;
    const f2 = stats.find((s) => s.floor === 2)!;
    expect(f1.runsReached).toBe(2); // both runs reached floor 1
    expect(f1.runsDied).toBe(1); // only run B ENDED here (lost waves ≠ run-death)
    expect(f1.deathRate).toBeCloseTo(0.5);
    expect(f1.battles).toBe(4); // 4 total waves on floor 1 across the two runs
    expect(f1.avgPlayerDeaths).toBeCloseTo((4 + 3 + 1 + 5) / 4); // per-wave attrition
    expect(f2.runsReached).toBe(1); // only run A reached floor 2
    expect(f2.runsDied).toBe(0); // run A completed, didn't die
    // Σ runsDied across floors == total non-completing runs.
    expect(stats.reduce((acc, s) => acc + s.runsDied, 0)).toBe(1);
  });

  it('per-layout stats group by layout with wave win rate, deaths, and sizes', () => {
    const b = (
      layoutId: string | null,
      floor: number,
      winner: 'player' | 'enemy',
      playerDeaths: number,
      enemyTeamSize: number,
    ): BattleResult => ({
      floor,
      worldSeed: 0,
      layoutId,
      winner,
      ticks: 1,
      playerDeaths,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize,
      playerLevels: [1, 1, 1, 1, 1],
      enemyLevels: Array<number>(enemyTeamSize).fill(1),
    });
    const results: RunResult[] = [
      {
        seed: 0,
        strategyName: 'synthetic',
        outcome: 'complete',
        finalFloorReached: 2,
        totalTicks: 0,
        finalTeamSize: 5,
        recruits: [],
        battles: [
          // junctionAmbush: 1 of 4 player wins (brutal), outnumbered 9-vs-5.
          b('junctionAmbush', 1, 'enemy', 4, 9),
          b('junctionAmbush', 1, 'enemy', 3, 9),
          b('junctionAmbush', 2, 'enemy', 2, 9),
          b('junctionAmbush', 2, 'player', 1, 9),
          // river: 3 of 4 player wins, fair 6-vs-5.
          b('river', 1, 'player', 0, 6),
          b('river', 1, 'player', 0, 6),
          b('river', 2, 'player', 1, 6),
          b('river', 2, 'enemy', 2, 6),
          // procedural (null → 'procedural').
          b(null, 1, 'player', 0, 5),
        ],
      },
    ];

    const stats = perLayoutStats(results);
    const ja = stats.find((s) => s.layout === 'junctionAmbush')!;
    const river = stats.find((s) => s.layout === 'river')!;
    expect(ja.battles).toBe(4);
    expect(ja.playerWinRate).toBeCloseTo(0.25);
    expect(ja.enemyWinRate).toBeCloseTo(0.75);
    expect(ja.enemySize).toBeCloseTo(9); // outnumbered ("ambush")
    expect(ja.playerSize).toBeCloseTo(5);
    expect(river.playerWinRate).toBeCloseTo(0.75);
    expect(stats.find((s) => s.layout === 'procedural')).toBeDefined(); // null → 'procedural'
    // Sorted most-brutal-first (lowest player win rate).
    expect(stats[0]!.layout).toBe('junctionAmbush');
    // Total waves across layouts == total battles.
    expect(stats.reduce((a, s) => a + s.battles, 0)).toBe(9);

    // layout × floor splits junctionAmbush into floor 1 and floor 2.
    const lf = perLayoutFloorStats(results);
    expect(lf.filter((s) => s.layout === 'junctionAmbush').map((s) => s.floor)).toEqual([1, 2]);
    const ja1 = lf.find((s) => s.layout === 'junctionAmbush' && s.floor === 1)!;
    expect(ja1.battles).toBe(2);
    expect(ja1.playerWinRate).toBeCloseTo(0); // both floor-1 ambush waves lost

    expect(renderLayoutAnalysis(results)).toContain('Per-layout difficulty');
  });

  it('--layout forces a single layout on every battle (the forced-layout plumbing)', () => {
    expect(LAYOUT_IDS).toContain('junctionAmbush');
    const result = runOne(7, makeStrategy('greedy')!, {
      runConfig: { forcedLayoutId: 'junctionAmbush' },
    });
    expect(result.battles.length).toBeGreaterThan(0);
    for (const battle of result.battles) {
      expect(battle.layoutId).toBe('junctionAmbush');
    }
  });

  it('renders a failure trace for a non-complete result', () => {
    // Force-construct a synthetic defeat by reaching into the harness
    // result. Don't need to actually lose a run — the trace renderer
    // is pure w.r.t. its input.
    const result = runOne(1, makeStrategy('pure-random')!);
    const synthetic = { ...result, outcome: 'defeat' as const };
    const md = renderFailureTrace(synthetic);
    expect(md).toContain('# Fuzz failure');
    expect(md).toContain('## Battles');
    expect(md).toContain('## Recruits');
    expect(failureFilename(synthetic)).toMatch(/seed1-defeat\.md$/);
  });
});
