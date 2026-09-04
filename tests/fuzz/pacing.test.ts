/**
 * 92a — the pacing reader (`pacingStats` / `renderPacing` / `renderPacingCsv`).
 * Synthetic results with hand-built chip trajectories: every expected number is
 * derived by hand from the fixture (turns, booked charges, the won rule, the cap
 * share), never from the reader. Encounter KINDS are config-derived (the catalog
 * is consulted for the ids, the test asserts the kinds it relies on).
 */
import { describe, expect, it } from 'vitest';
import { pacingStats, renderPacing, renderPacingCsv } from './reporters';
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
