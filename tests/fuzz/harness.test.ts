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
  perHopStats,
  renderPerHopAnalysis,
  perLayoutStats,
  perLayoutHopStats,
  renderLayoutAnalysis,
  perEncounterStats,
  renderEncounterAnalysis,
} from './reporters';
import { TelemetryAccumulator } from './telemetry';
import type { RunTelemetry } from './telemetry';
import { LAYOUT_IDS } from '../../src/sim/layouts';
import { HEALTH } from '../../src/config/health';
import { ENCOUNTERS, getEncounter } from '../../src/config/encounters';

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

  it('aggregates win rate and hop stats', () => {
    const results = [
      runOne(1, makeStrategy('pure-random')!),
      runOne(2, makeStrategy('pure-random')!),
      runOne(3, makeStrategy('pure-random')!),
    ];
    const stats = aggregate(results);
    expect(stats.totalRuns).toBe(3);
    expect(stats.winRate).toBeGreaterThanOrEqual(0);
    expect(stats.winRate).toBeLessThanOrEqual(1);
    expect(stats.averageHopReached).toBeGreaterThanOrEqual(0);
    expect(Object.keys(stats.byOutcome).length).toBeGreaterThan(0);
    // hangsByLayout is always present; empty when no hangs occurred.
    expect(stats.hangsByLayout).toBeDefined();
    const sumHangs = Object.values(stats.hangsByLayout).reduce((a, b) => a + b, 0);
    expect(sumHangs).toBe(stats.hangs);
  });

  it('every battle carries player/enemy level arrays matching the team sizes', () => {
    // G4 per-hop telemetry: the level arrays must be present and aligned
    // with the recorded team sizes, or the per-hop analysis silently lies.
    const result = runOne(3, makeStrategy('greedy')!);
    expect(result.battles.length).toBeGreaterThan(0);
    for (const b of result.battles) {
      expect(b.playerLevels).toHaveLength(b.playerTeamSize);
      expect(b.enemyLevels).toHaveLength(b.enemyTeamSize);
      expect(b.playerLevels.every((l) => l >= 1)).toBe(true);
      expect(b.enemyLevels.every((l) => l >= 1)).toBe(true);
    }
  });

  it('per-hop stats aggregate by hop with sane bounds', () => {
    const results = [
      runOne(1, makeStrategy('pure-random')!),
      runOne(2, makeStrategy('greedy')!),
      runOne(3, makeStrategy('greedy')!),
    ];
    const stats = perHopStats(results);
    expect(stats.length).toBeGreaterThan(0);
    // Hops are sorted ascending; battle counts sum to all battles played.
    const hops = stats.map((s) => s.hop);
    expect([...hops].sort((a, b) => a - b)).toEqual(hops);
    const totalBattles = results.reduce((acc, r) => acc + r.battles.length, 0);
    expect(stats.reduce((acc, s) => acc + s.battles, 0)).toBe(totalBattles);
    for (const s of stats) {
      expect(s.playerAvgLevel).toBeGreaterThanOrEqual(1);
      expect(s.enemyAvgLevel).toBeGreaterThanOrEqual(1);
      expect(s.playerSize).toBeGreaterThan(0);
      expect(s.enemySize).toBeGreaterThan(0);
      expect(s.playerLevelSpread).toBeGreaterThanOrEqual(0);
    }
    expect(renderPerHopAnalysis(results)).toContain('Per-hop team analysis');
  });

  it('per-hop run-death stats are run-level, not per-wave (the pool absorbs lost waves)', () => {
    // Config-free fixtures pin the RUN-level mechanic across the multi-wave pool
    // system. Run A: 3 waves on hop 1 (loses 2 of them — pool absorbs it),
    // survives to hop 2, completes. Run B: dies on hop 1. So hop 1 has 2
    // runs reached, 1 died (B) — NOT 3 (the lost waves don't count as run-deaths).
    const battle = (hop: number, winner: 'player' | 'enemy', playerDeaths: number): BattleResult => ({
      hop,
      worldSeed: 0,
      encounterId: 'fixture',
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
      finalHopReached: number,
    ): RunResult => ({
      seed: 0,
      strategyName: 'synthetic',
      daemonId: null,
      outcome,
      finalHopReached,
      totalTicks: 0,
      finalTeamSize: 5,
      battles,
      recruits: [],
    });
    // Run A: 3 hop-1 waves (2 lost but absorbed), then hop 2, completes.
    const runA = run(
      [battle(1, 'enemy', 4), battle(1, 'enemy', 3), battle(1, 'player', 1), battle(2, 'player', 0)],
      'complete',
      2,
    );
    // Run B: dies on hop 1.
    const runB = run([battle(1, 'enemy', 5)], 'defeat', 1);

    const stats = perHopStats([runA, runB]);
    const f1 = stats.find((s) => s.hop === 1)!;
    const f2 = stats.find((s) => s.hop === 2)!;
    expect(f1.runsReached).toBe(2); // both runs reached hop 1
    expect(f1.runsDied).toBe(1); // only run B ENDED here (lost waves ≠ run-death)
    expect(f1.deathRate).toBeCloseTo(0.5);
    expect(f1.battles).toBe(4); // 4 total waves on hop 1 across the two runs
    expect(f1.avgPlayerDeaths).toBeCloseTo((4 + 3 + 1 + 5) / 4); // per-wave attrition
    expect(f2.runsReached).toBe(1); // only run A reached hop 2
    expect(f2.runsDied).toBe(0); // run A completed, didn't die
    // Σ runsDied across hops == total non-completing runs.
    expect(stats.reduce((acc, s) => acc + s.runsDied, 0)).toBe(1);
  });

  it('per-layout stats group by layout with wave win rate, deaths, and sizes', () => {
    const b = (
      layoutId: string | null,
      hop: number,
      winner: 'player' | 'enemy',
      playerDeaths: number,
      enemyTeamSize: number,
    ): BattleResult => ({
      hop,
      worldSeed: 0,
      encounterId: 'fixture',
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
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 2,
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

    // layout × hop splits junctionAmbush into hop 1 and hop 2.
    const lf = perLayoutHopStats(results);
    expect(lf.filter((s) => s.layout === 'junctionAmbush').map((s) => s.hop)).toEqual([1, 2]);
    const ja1 = lf.find((s) => s.layout === 'junctionAmbush' && s.hop === 1)!;
    expect(ja1.battles).toBe(2);
    expect(ja1.playerWinRate).toBeCloseTo(0); // both hop-1 ambush waves lost

    expect(renderLayoutAnalysis(results)).toContain('Per-layout difficulty');
  });

  it('per-encounter stats key pool damage by encounter id (X2)', () => {
    // Player pool damage TAKEN = the chip's `enemy` field (enemy survivors chip
    // the player pool) × the chip multiplier; per INSTANCE (a node visit = one
    // hop within a run) and per WAVE (a turn).
    const m = HEALTH.chipMultiplier;
    const eb = (hop: number, encounterId: string, winner: 'player' | 'enemy'): BattleResult => ({
      hop,
      worldSeed: 0,
      encounterId,
      layoutId: null,
      winner,
      ticks: 1,
      playerDeaths: 0,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [],
      enemyLevels: [],
    });
    const tel = (
      chips: ReadonlyArray<{ hop: number; encounterId: string; player: number; enemy: number }>,
    ): RunTelemetry => {
      const acc = new TelemetryAccumulator();
      for (const c of chips) acc.recordTurnChip(c.hop, c.encounterId, c.player, c.enemy);
      return acc.finish([], []);
    };
    const results: RunResult[] = [
      {
        seed: 0,
        strategyName: 'syn',
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 2,
        totalTicks: 0,
        finalTeamSize: 5,
        battles: [eb(1, 'enc1', 'player'), eb(1, 'enc1', 'enemy'), eb(2, 'enc2', 'player')],
        recruits: [],
        telemetry: tel([
          { hop: 1, encounterId: 'enc1', player: 2, enemy: 3 },
          { hop: 1, encounterId: 'enc1', player: 4, enemy: 5 },
          { hop: 2, encounterId: 'enc2', player: 10, enemy: 1 },
        ]),
      },
      {
        seed: 1,
        strategyName: 'syn',
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 1,
        totalTicks: 0,
        finalTeamSize: 5,
        battles: [eb(1, 'enc1', 'player')],
        recruits: [],
        telemetry: tel([{ hop: 1, encounterId: 'enc1', player: 1, enemy: 7 }]),
      },
    ];
    const stats = perEncounterStats(results);
    const enc1 = stats.find((s) => s.encounter === 'enc1')!;
    const enc2 = stats.find((s) => s.encounter === 'enc2')!;
    // enc1: 3 waves (2 + 1 battles), 2 instances (one hop-1 group per run).
    expect(enc1.waves).toBe(3);
    expect(enc1.instances).toBe(2);
    expect(enc1.playerWinRate).toBeCloseTo(2 / 3);
    expect(enc1.enemyWinRate).toBeCloseTo(1 / 3);
    expect(enc1.kind).toBe('unknown'); // synthetic id doesn't resolve in the catalog
    // instance taken: run0 (3+5)=8m, run1 7m → mean 7.5m; per wave (3+5+7)/3 = 5m.
    expect(enc1.poolDmgTaken).toBeCloseTo(7.5 * m);
    expect(enc1.poolDmgTakenPerWave).toBeCloseTo(5 * m);
    // dealt = the `player` chip: run0 (2+4)=6m, run1 1m → mean 3.5m.
    expect(enc1.poolDmgDealt).toBeCloseTo(3.5 * m);
    expect(enc1.hasPoolData).toBe(true);
    // enc2 instance taken = 1m (low) → enc1 sorts first (most-costly-first).
    expect(enc2.poolDmgTaken).toBeCloseTo(1 * m);
    expect(stats[0]!.encounter).toBe('enc1');
    expect(renderEncounterAnalysis(results)).toContain('Per-encounter difficulty');
  });

  it('per-encounter degrades gracefully with telemetry off (outcome cols only)', () => {
    const eb = (encounterId: string): BattleResult => ({
      hop: 1,
      worldSeed: 0,
      encounterId,
      layoutId: null,
      winner: 'player',
      ticks: 1,
      playerDeaths: 0,
      enemyDeaths: 0,
      playerTeamSize: 5,
      enemyTeamSize: 8,
      playerLevels: [],
      enemyLevels: [],
    });
    const results: RunResult[] = [
      {
        seed: 0,
        strategyName: 'syn',
        daemonId: null,
        outcome: 'complete',
        finalHopReached: 1,
        totalTicks: 0,
        finalTeamSize: 5,
        battles: [eb('enc1')],
        recruits: [],
      },
    ];
    const stats = perEncounterStats(results);
    expect(stats[0]!.hasPoolData).toBe(false);
    expect(stats[0]!.instances).toBe(0);
    expect(stats[0]!.poolDmgTaken).toBe(0);
    expect(stats[0]!.waves).toBe(1); // outcome columns still populate
    expect(renderEncounterAnalysis(results)).toContain('no pool data');
  });

  it('a real run threads a resolvable encounter id into every battle (X2)', () => {
    const result = runOne(3, makeStrategy('greedy')!, { telemetry: true });
    expect(result.battles.length).toBeGreaterThan(0);
    for (const b of result.battles) expect(b.encounterId.length).toBeGreaterThan(0);
    const stats = perEncounterStats([result]);
    // Real catalog ids resolve to a real kind (never 'unknown'); pool data present.
    for (const s of stats) {
      expect(s.kind).not.toBe('unknown');
      expect(s.hasPoolData).toBe(true);
    }
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

  it('--encounter forces one encounter at every matching-kind battle (X2)', () => {
    const forced = ENCOUNTERS.find((e) => e.kind === 'normal')!.id;
    const result = runOne(7, makeStrategy('greedy')!, {
      telemetry: true,
      runConfig: { forcedEncounterId: forced },
    });
    expect(result.battles.length).toBeGreaterThan(0);
    // Per-kind aware (Wb4): every NORMAL-kind battle fields the forced encounter;
    // any non-normal battle (boss/elite, if reached) draws its own bucket.
    for (const b of result.battles) {
      if (getEncounter(b.encounterId)?.kind === 'normal') {
        expect(b.encounterId).toBe(forced);
      }
    }
    // And the forced encounter was actually fielded (a battle node is a normal
    // node by default, so a greedy run hits it immediately).
    expect(result.battles.some((b) => b.encounterId === forced)).toBe(true);
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
