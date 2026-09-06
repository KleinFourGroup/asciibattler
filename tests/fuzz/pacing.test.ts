/**
 * 92a — the pacing reader (`pacingStats` / `renderPacing` / `renderPacingCsv`).
 * Synthetic results with hand-built chip trajectories: every expected number is
 * derived by hand from the fixture (turns, booked charges, the won rule, the cap
 * share), never from the reader. Encounter KINDS are config-derived (the catalog
 * is consulted for the ids, the test asserts the kinds it relies on).
 */
import { describe, expect, it } from 'vitest';
import { pacingStats, parsePacingCsv, poolPacingRows, renderPacing, renderPacingCsv, renderPacingCsvRows } from './reporters';
import { TelemetryAccumulator, type PoolChip, type RunTelemetry } from './telemetry';
import type { RunResult } from './harness';
import { HEALTH } from '../../src/config/health';
import { getEncounter } from '../../src/config/encounters';

/** Two catalog ids of different kinds — the byKind rows are config-derived. */
const NORMAL_ID = 'brigands';
const ELITE_ID = 'brigand-champions';

interface ChipSpec {
  sector: number;
  hop: number;
  enc: string;
  /** Enemy pool before → after; the booked enemy charge (uncapped). */
  enemyBefore: number;
  enemyAfter: number;
  enemyCharge: number;
  playerCharge: number;
  reason?: PoolChip['reason'];
}

function chip(s: ChipSpec): PoolChip {
  return {
    sector: s.sector,
    hop: s.hop,
    encounterId: s.enc,
    player: 0,
    enemy: 0,
    playerPoolBefore: 20,
    playerPoolAfter: 20,
    enemyPoolBefore: s.enemyBefore,
    enemyPoolAfter: s.enemyAfter,
    fallenPlayer: s.playerCharge,
    fallenEnemy: s.enemyCharge,
    playerCharge: s.playerCharge,
    enemyCharge: s.enemyCharge,
    ...(s.reason === undefined ? {} : { reason: s.reason }),
  };
}

function tel(chips: readonly PoolChip[]): RunTelemetry {
  const acc = new TelemetryAccumulator();
  for (const c of chips) acc.recordTurnChip(c);
  return acc.finish([], []);
}

function run(seed: number, chips: readonly PoolChip[] | undefined): RunResult {
  return {
    seed,
    strategyName: 'syn',
    daemonId: null,
    outcome: 'defeat',
    finalHopReached: 1,
    sectorsCleared: 0,
    totalTicks: 0,
    finalTeamSize: 5,
    portPurchases: 0,
    packetsFired: 0,
    eventsVisited: 0,
    finalBits: 0,
    poolAtSectorClears: [],
    finalPool: 20,
    battles: [],
    recruits: [],
    ...(chips === undefined ? {} : { telemetry: tel(chips) }),
  };
}

describe('pacingStats (92a)', () => {
  // Run 1: the normal encounter at (0,1) — two decisive turns, WON on the second
  //        (enemy 10→4 charge 6, player 1; then 4→0 charge 5, player 2). The elite
  //        at (0,2) — a CAP turn (8→7, charge 1, player 3) then a decisive turn that
  //        leaves the pool at 7 (charge 0, player 4): the run dies there → NOT won.
  // Run 2: the normal encounter at (0,1) — one turn, 10→0 charge 12, player 1: won.
  // Run 3: no telemetry (counts in runs only).
  const r1 = run(1, [
    chip({ sector: 0, hop: 1, enc: NORMAL_ID, enemyBefore: 10, enemyAfter: 4, enemyCharge: 6, playerCharge: 1, reason: 'decisive' }),
    chip({ sector: 0, hop: 1, enc: NORMAL_ID, enemyBefore: 4, enemyAfter: 0, enemyCharge: 5, playerCharge: 2, reason: 'decisive' }),
    chip({ sector: 0, hop: 2, enc: ELITE_ID, enemyBefore: 8, enemyAfter: 7, enemyCharge: 1, playerCharge: 3, reason: 'cap' }),
    chip({ sector: 0, hop: 2, enc: ELITE_ID, enemyBefore: 7, enemyAfter: 7, enemyCharge: 0, playerCharge: 4, reason: 'decisive' }),
  ]);
  const r2 = run(2, [
    chip({ sector: 0, hop: 1, enc: NORMAL_ID, enemyBefore: 10, enemyAfter: 0, enemyCharge: 12, playerCharge: 1, reason: 'decisive' }),
  ]);
  const r3 = run(3, undefined);
  const results = [r1, r2, r3];

  it('relies on two catalog kinds', () => {
    expect(getEncounter(NORMAL_ID)?.kind).toBe('normal');
    expect(getEncounter(ELITE_ID)?.kind).toBe('elite');
  });

  it('counts runs and telemetry coverage', () => {
    const s = pacingStats(results);
    expect(s.runs).toBe(3);
    expect(s.runsWithTelemetry).toBe(2);
  });

  it('the normal encounter: two instances, both won, 3 turns, booked charges per turn / per instance', () => {
    const s = pacingStats(results);
    const n = s.byEncounter.find((r) => r.key === NORMAL_ID)!;
    expect(n.kind).toBe('normal');
    expect(n.instances).toBe(2);
    expect(n.wonInstances).toBe(2);
    expect(n.turns).toBe(3);
    expect(n.turnsPerInstance).toBeCloseTo(3 / 2);
    expect(n.turnsPerWonInstance).toBeCloseTo(3 / 2);
    expect(n.enemyBurnPerTurn).toBeCloseTo((6 + 5 + 12) / 3);
    expect(n.playerCostPerTurn).toBeCloseTo((1 + 2 + 1) / 3);
    expect(n.playerCostPerInstance).toBeCloseTo((1 + 2 + 1) / 2);
    expect(n.capTurns).toBe(0);
    expect(n.capShare).toBe(0);
  });

  it('the elite encounter: one instance NOT won (the last chip leaves the pool at 7), a 50% cap share', () => {
    const s = pacingStats(results);
    const e = s.byEncounter.find((r) => r.key === ELITE_ID)!;
    expect(e.kind).toBe('elite');
    expect(e.instances).toBe(1);
    expect(e.wonInstances).toBe(0);
    expect(e.turns).toBe(2);
    expect(e.turnsPerInstance).toBe(2);
    expect(e.turnsPerWonInstance).toBe(0); // no won instance → 0, never NaN
    expect(e.enemyBurnPerTurn).toBeCloseTo(1 / 2);
    expect(e.playerCostPerTurn).toBeCloseTo((3 + 4) / 2);
    expect(e.playerCostPerInstance).toBeCloseTo(7);
    expect(e.capTurns).toBe(1);
    expect(e.capShare).toBeCloseTo(0.5);
  });

  it('orders encounters by kind (normal before elite) and the kind rows normal · elite · all', () => {
    const s = pacingStats(results);
    expect(s.byEncounter.map((r) => r.key)).toEqual([NORMAL_ID, ELITE_ID]);
    expect(s.byKind.map((r) => r.key)).toEqual(['normal', 'elite', 'all']);
  });

  it('the kind rows pool their encounters; `all` pools everything', () => {
    const s = pacingStats(results);
    const normal = s.byKind.find((r) => r.key === 'normal')!;
    const n = s.byEncounter.find((r) => r.key === NORMAL_ID)!;
    expect(normal).toEqual({ ...n, key: 'normal' });
    const all = s.byKind.find((r) => r.key === 'all')!;
    expect(all.kind).toBe('all');
    expect(all.instances).toBe(3);
    expect(all.wonInstances).toBe(2);
    expect(all.turns).toBe(5);
    expect(all.turnsPerInstance).toBeCloseTo(5 / 3);
    expect(all.turnsPerWonInstance).toBeCloseTo(3 / 2); // only the two won (normal) instances' turns
    expect(all.enemyBurnPerTurn).toBeCloseTo((6 + 5 + 12 + 1 + 0) / 5);
    expect(all.playerCostPerTurn).toBeCloseTo((1 + 2 + 1 + 3 + 4) / 5);
    expect(all.playerCostPerInstance).toBeCloseTo(11 / 3);
    expect(all.capShare).toBeCloseTo(1 / 5);
  });

  it('a pre-91a2 chip (no charges, no reason) books the survivors arithmetic and counts no cap', () => {
    const legacy: PoolChip = {
      sector: 0,
      hop: 1,
      encounterId: NORMAL_ID,
      player: 2,
      enemy: 3,
      playerPoolBefore: 20,
      playerPoolAfter: 17,
      enemyPoolBefore: 8,
      enemyPoolAfter: 6,
    };
    const s = pacingStats([run(9, [legacy])], HEALTH.chipMultiplier);
    const n = s.byEncounter[0]!;
    expect(n.playerCostPerTurn).toBeCloseTo(3 * HEALTH.chipMultiplier); // enemy survivors × mult
    expect(n.enemyBurnPerTurn).toBeCloseTo(2 * HEALTH.chipMultiplier); // player survivors × mult
    expect(n.capShare).toBe(0);
    expect(n.wonInstances).toBe(0);
  });

  it('with telemetry off, every row is empty and the render says so', () => {
    const s = pacingStats([r3]);
    expect(s.byEncounter).toEqual([]);
    expect(s.byKind.map((r) => r.key)).toEqual(['all']);
    expect(s.byKind[0]!.turns).toBe(0);
    expect(renderPacing([r3])).toContain('no pool data');
  });

  it('the CSV carries the encounter rows then the kind rows, one header', () => {
    const csv = renderPacingCsv(pacingStats(results));
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe(
      'key,kind,instances,wonInstances,turns,turnsPerInstance,turnsPerWonInstance,enemyBurnPerTurn,playerCostPerTurn,playerCostPerInstance,capTurns,capShare',
    );
    expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual([NORMAL_ID, ELITE_ID, 'normal', 'elite', 'all']);
    // The elite row, by hand.
    expect(lines[2]).toBe(`${ELITE_ID},elite,1,0,2,2.0000,0.0000,0.5000,3.5000,7.0000,1,0.5000`);
  });

  it('the text render names the targets and lists every row', () => {
    const text = renderPacing(results);
    expect(text).toContain('normal 2–3 / elite 4–5 / boss 6+');
    expect(text).toContain(NORMAL_ID);
    expect(text).toContain(ELITE_ID);
    expect(text).toContain('all');
  });
});

describe('94h-pre — parsePacingCsv / poolPacingRows (the --merge-stages pool of an AGGREGATE file)', () => {
  it('a pool of ONE stage reproduces that stage (parse ↔ pool ↔ render) to the CSV 4-decimal rounding, field by field', () => {
    // A self-consistent file (tpi = turns/instances etc. at the CSV's 4 decimals);
    // the reconstruction multiplies rounded per-turn means back by turns, so the
    // pool matches to ~1e-3, never byte-for-byte — the pin says so.

    const csv =
      'key,kind,instances,wonInstances,turns,turnsPerInstance,turnsPerWonInstance,enemyBurnPerTurn,playerCostPerTurn,playerCostPerInstance,capTurns,capShare\n' +
      'x,normal,2,2,4,2.0000,2.0000,6.0000,1.0000,2.0000,0,0.0000\n' +
      'y,elite,4,3,12,3.0000,2.6667,4.0000,1.6667,5.0000,2,0.1667\n' +
      'normal,normal,2,2,4,2.0000,2.0000,6.0000,1.0000,2.0000,0,0.0000\n' +
      'elite,elite,4,3,12,3.0000,2.6667,4.0000,1.6667,5.0000,2,0.1667\n' +
      'all,all,6,5,16,2.6667,2.4000,4.5000,1.5000,4.0000,2,0.1250\n';
    const original = parsePacingCsv(csv);
    const pooled = parsePacingCsv(renderPacingCsvRows(poolPacingRows([original])));
    expect(pooled.map((r) => r.key)).toEqual(original.map((r) => r.key));
    for (let i = 0; i < original.length; i++) {
      const a = original[i]!, b = pooled[i]!;
      expect(b.kind).toBe(a.kind);
      for (const k of ['instances', 'wonInstances', 'turns', 'capTurns'] as const) expect(b[k]).toBe(a[k]);
      for (const k of ['turnsPerInstance', 'turnsPerWonInstance', 'enemyBurnPerTurn', 'playerCostPerTurn', 'playerCostPerInstance', 'capShare'] as const) {
        expect(b[k]).toBeCloseTo(a[k], 3);
      }
    }
  });

  it('two stages pool by the accumulator arithmetic: turns-per-won weighted by won, burn/cost by turns, caps summed', () => {
    const a = parsePacingCsv(
      'key,kind,instances,wonInstances,turns,turnsPerInstance,turnsPerWonInstance,enemyBurnPerTurn,playerCostPerTurn,playerCostPerInstance,capTurns,capShare\n' +
        'x,normal,2,2,4,2.0000,2.0000,6.0000,1.0000,2.0000,0,0.0000\n' +
        'normal,normal,2,2,4,2.0000,2.0000,6.0000,1.0000,2.0000,0,0.0000\n' +
        'all,all,2,2,4,2.0000,2.0000,6.0000,1.0000,2.0000,0,0.0000\n',
    );
    const b = parsePacingCsv(
      'key,kind,instances,wonInstances,turns,turnsPerInstance,turnsPerWonInstance,enemyBurnPerTurn,playerCostPerTurn,playerCostPerInstance,capTurns,capShare\n' +
        'x,normal,2,1,8,4.0000,4.0000,3.0000,2.0000,8.0000,2,0.2500\n' +
        'normal,normal,2,1,8,4.0000,4.0000,3.0000,2.0000,8.0000,2,0.2500\n' +
        'all,all,2,1,8,4.0000,4.0000,3.0000,2.0000,8.0000,2,0.2500\n',
    );
    const pooled = poolPacingRows([a, b]);
    expect(pooled.map((r) => r.key)).toEqual(['x', 'normal', 'all']);
    const x = pooled[0]!;
    expect(x.instances).toBe(4);
    expect(x.wonInstances).toBe(3);
    expect(x.turns).toBe(12);
    // turnsWon = 2×2 + 4×1 = 8 over 3 won; burn = (6×4 + 3×8)/12 = 4; cost = (1×4 + 2×8)/12 = 5/3;
    // cost/instance = 20/4 = 5; caps 0 + 2 over 12 turns.
    expect(x.turnsPerWonInstance).toBeCloseTo(8 / 3);
    expect(x.enemyBurnPerTurn).toBeCloseTo(4);
    expect(x.playerCostPerTurn).toBeCloseTo(5 / 3);
    expect(x.playerCostPerInstance).toBeCloseTo(5);
    expect(x.capTurns).toBe(2);
    expect(x.capShare).toBeCloseTo(2 / 12);
    // The kind rows pool the same way and keep their order (kind, then all).
    expect(pooled[1]!.turnsPerWonInstance).toBeCloseTo(8 / 3);
    expect(pooled[2]!.key).toBe('all');
  });
});
