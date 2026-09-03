/**
 * 89b — the alpha-strike reader (`alphaStrikeStats` / `renderAlphaStrike`).
 * Synthetic results with hand-built chip trajectories, so every expected
 * number is derived by hand from the fixture — never from the reader.
 */
import { describe, expect, it } from 'vitest';
import { alphaStrikeStats, renderAlphaStrike, renderAlphaStrikeCsv } from './reporters';
import { TelemetryAccumulator, type PoolChip, type RunTelemetry } from './telemetry';
import type { RunResult } from './harness';

const POOL_MAX = 20;

/** A player-side chip: the pool goes `before → after` in `sector`; `enemy` is
 *  the survivors half (the blow); enemy pool held flat (irrelevant here). */
function chip(sector: number, before: number, after: number, enemy: number): PoolChip {
  return {
    sector,
    hop: 1,
    encounterId: 'enc',
    player: 0,
    enemy,
    playerPoolBefore: before,
    playerPoolAfter: after,
    enemyPoolBefore: 8,
    enemyPoolAfter: 8,
  };
}

function tel(chips: readonly PoolChip[]): RunTelemetry {
  const acc = new TelemetryAccumulator();
  for (const c of chips) acc.recordTurnChip(c);
  return acc.finish([], []);
}

function run(
  seed: number,
  outcome: RunResult['outcome'],
  chips: readonly PoolChip[] | undefined,
  poolAtSectorClears: number[],
): RunResult {
  return {
    seed,
    strategyName: 'syn',
    daemonId: null,
    outcome,
    finalHopReached: 1,
    sectorsCleared: poolAtSectorClears.length,
    totalTicks: 0,
    finalTeamSize: 5,
    portPurchases: 0,
    packetsFired: 0,
    eventsVisited: 0,
    finalBits: 0,
    poolAtSectorClears,
    finalPool: chips?.[chips.length - 1]?.playerPoolAfter ?? POOL_MAX,
    battles: [],
    recruits: [],
    ...(chips === undefined ? {} : { telemetry: tel(chips) }),
  };
}

describe('alphaStrikeStats (89b)', () => {
  // Four runs:
  //  A — completes: act-1 chips 20→18 (2), 18→18 (0); act-2 chips 15→9 (6). Seam 15.
  //  B — ALPHA death in act 2 from a full pool: seam 20; 20→0 with a blow of 25
  //      (applied 20/20 = 100%; blow 25/20 = 125%). Arrival 20.
  //  C — ATTRITION death in act 2: seam 12; 12→6 (6), 6→0 with a blow of 6
  //      (applied 6/20 = 30% < 50%; blow 6/20 = 30%). Arrival 6.
  //  D — a CAP-LOSS: outcome defeat but the last chip leaves pool 3 (no pool
  //      death). Act 1 only. Plus a run with NO telemetry (E) that counts in
  //      runs/defeats only.
  //  F — a HIDDEN alpha: act-1 death arriving at 4 (under 25%) to a blow of 14
  //      (applied 4/20 = 20% → not an applied alpha; blow 14/20 = 70% → a blow alpha).
  const A = run(1, 'complete', [chip(0, 20, 18, 2), chip(0, 18, 18, 0), chip(1, 15, 9, 6)], [15]);
  const B = run(2, 'defeat', [chip(0, 20, 20, 0), chip(1, 20, 0, 25)], [20]);
  const C = run(3, 'defeat', [chip(0, 20, 12, 8), chip(1, 12, 6, 6), chip(1, 6, 0, 6)], [12]);
  const D = run(4, 'defeat', [chip(0, 20, 3, 17)], []);
  const E = run(5, 'defeat', undefined, []);
  const F = run(6, 'defeat', [chip(0, 20, 4, 16), chip(0, 4, 0, 14)], []);
  const results = [A, B, C, D, E, F];

  it('counts runs, telemetry coverage, defeats vs pool deaths', () => {
    const s = alphaStrikeStats(results, POOL_MAX, 1);
    expect(s.runs).toBe(6);
    expect(s.runsWithTelemetry).toBe(5);
    expect(s.defeats).toBe(5); // B C D E F — D is a cap-loss, E has no telemetry
    const all = s.bySector[0]!;
    expect(all.sector).toBe('all');
    expect(all.poolDeaths).toBe(3); // B, C, F — not D (pool 3), not E (no chips)
  });

  it('reads the per-turn applied-loss shape from the pools, not the survivors', () => {
    const s = alphaStrikeStats(results, POOL_MAX, 1);
    const all = s.bySector[0]!;
    // Turns: A 3 + B 2 + C 3 + D 1 + F 2 = 11.
    expect(all.turns).toBe(11);
    // Applied fracs: A .1 0 .3 · B 0 1.0 · C .4 .3 .3 · D .85 · F .8 .2
    // sorted: 0 0 .1 .2 .3 .3 .3 .4 .8 .85 1.0 → p50 = 6th = .3, p90 = 10th = .85
    expect(all.chipFracP50).toBeCloseTo(0.3);
    expect(all.chipFracP90).toBeCloseTo(0.85);
    expect(all.chipFracMax).toBeCloseTo(1.0);
    // ≥ 25%: .3 .3 .3 .4 .8 .85 1.0 = 7/11; ≥ 50%: .8 .85 1.0 = 3/11
    expect(all.shareChipGe25).toBeCloseTo(7 / 11);
    expect(all.shareChipGe50).toBeCloseTo(3 / 11);
  });

  it('splits alpha deaths into the applied (rule-agnostic) and blow (survivors-only) definitions', () => {
    const s = alphaStrikeStats(results, POOL_MAX, 1);
    const all = s.bySector[0]!;
    // Applied ≥ 50%: B only (100%); C 30%, F 20% → 1 of 3.
    expect(all.alphaDeathsApplied).toBe(1);
    // Blow ≥ 50%: B (125%) and F (70%); C 30% → 2 of 3.
    expect(all.alphaDeathsBlow).toBe(2);
    // Arrivals: B 20, C 6, F 4 → sorted 4 6 20: p25 = 4, p50 = 6, p75 = 20.
    expect(all.arrivalP25).toBe(4);
    expect(all.arrivalP50).toBe(6);
    expect(all.arrivalP75).toBe(20);
    // Under 25% of max (< 5): F only → 1/3.
    expect(all.shareArrivalLt25).toBeCloseTo(1 / 3);
  });

  it('keys the per-sector rows on the walk sector (deaths land where they happened)', () => {
    const s = alphaStrikeStats(results, POOL_MAX, 1);
    expect(s.bySector.map((r) => r.sector)).toEqual(['all', 0, 1]);
    const act1 = s.bySector[1]!;
    const act2 = s.bySector[2]!;
    expect(act1.poolDeaths).toBe(1); // F
    expect(act1.alphaDeathsApplied).toBe(0);
    expect(act1.alphaDeathsBlow).toBe(1);
    expect(act2.poolDeaths).toBe(2); // B, C
    expect(act2.alphaDeathsApplied).toBe(1);
    expect(act2.alphaDeathsBlow).toBe(1);
    // Turns per sector: act 1 = A2 + B1 + C1 + D1 + F2 = 7; act 2 = A1 + B1 + C2 = 4.
    expect(act1.turns).toBe(7);
    expect(act2.turns).toBe(4);
  });

  it('reads the seam from poolAtSectorClears[0]', () => {
    const s = alphaStrikeStats(results, POOL_MAX, 1);
    // Crossings: A 15, B 20, C 12 → sorted 12 15 20; under 50% (< 10): none.
    expect(s.seam.crossings).toBe(3);
    expect(s.seam.p25).toBe(12);
    expect(s.seam.p50).toBe(15);
    expect(s.seam.p75).toBe(20);
    expect(s.seam.shareLt50).toBe(0);
  });

  it('the chip multiplier scales only the blow column', () => {
    const s = alphaStrikeStats(results, POOL_MAX, 0.5);
    const all = s.bySector[0]!;
    // Blows halve: B 12.5/20 = 62.5% (still ≥ 50%), F 7/20 = 35% (drops out).
    expect(all.alphaDeathsBlow).toBe(1);
    expect(all.alphaDeathsApplied).toBe(1); // unchanged — applied deltas are what they are
    // Overkill halves with the blow: B 12.5−20 = −7.5, C 3−6 = −3, F 7−4 = 3 → ≥3: F only.
    expect(all.shareOverkillGe3).toBeCloseTo(1 / 3);
    expect(all.shareOverkillGe5).toBe(0);
  });

  it('89b2 — the overkill margin is blow minus arrival, per death', () => {
    const s = alphaStrikeStats(results, POOL_MAX, 1);
    const all = s.bySector[0]!;
    // B: 25 − 20 = 5 · C: 6 − 6 = 0 · F: 14 − 4 = 10 → sorted 0 5 10: p50 = 5;
    // ≥ 3: B, F = 2/3; ≥ 5: B, F = 2/3 (B sits exactly at 5).
    expect(all.overkillP50).toBe(5);
    expect(all.shareOverkillGe3).toBeCloseTo(2 / 3);
    expect(all.shareOverkillGe5).toBeCloseTo(2 / 3);
    // Per sector: act 1 = F (10) → 100% ≥ 3; act 2 = B, C → 1/2.
    expect(s.bySector[1]!.overkillP50).toBe(10);
    expect(s.bySector[2]!.shareOverkillGe3).toBeCloseTo(1 / 2);
    // The render + CSV carry the columns.
    expect(renderAlphaStrike(results)).toContain('Overkill p50');
    expect(renderAlphaStrikeCsv(s).split('\n')[0]).toContain('overkillP50,shareOverkillGe3,shareOverkillGe5');
  });

  it('renders a table + the seam line, and says so when telemetry is off', () => {
    const text = renderAlphaStrike(results);
    expect(text).toContain('### Alpha-strike read (6 runs, 5 with pool telemetry, 5 defeats');
    expect(text).toContain('Seam (pool at the first sector clear): 3 crossings');
    const off = renderAlphaStrike([E]);
    expect(off).toContain('no pool data');
    const csv = renderAlphaStrikeCsv(alphaStrikeStats(results, POOL_MAX, 1));
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('sector,turns,chipFracP50');
    expect(lines).toHaveLength(4); // header + all + 2 sectors
    expect(lines[1]!.startsWith('all,11,')).toBe(true);
  });
});
