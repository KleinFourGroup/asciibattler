/**
 * 68c — the executable board's pure layer: csv → metrics → evaluation.
 * The runner shell (cli.ts) stays untested (the commands/ discipline);
 * everything decision-bearing is here.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBoard,
  computeMetrics,
  evaluateBoard,
  loadSignedSheet,
  parseSummaryCsv,
  type InstrumentMetrics,
} from './board';

// A summary.csv fixture in the REAL column order (parse is by header name,
// so a column append never breaks this — that's part of what's pinned).
const CSV = [
  'seed,strategy,daemon,outcome,finalHop,totalTicks,finalTeamSize,battlesPlayed,totalPlayerDeaths,totalEnemyDeaths,recruitedMelee,recruitedRanged,hangLayout,portPurchases,finalBits,packetsFired',
  '1,scored:59-regen-vector,mars,complete,11,5000,9,11,3,40,2,1,,0,70,2',
  '2,scored:59-regen-vector,mars,defeat,11,4000,7,11,5,30,1,1,,0,80,1',
  '3,scored:59-regen-vector,mars,defeat,6,2500,5,6,6,15,1,0,,1,20,3',
  '4,scored:59-regen-vector,mars,complete,11,5200,10,11,2,45,2,2,,0,90,2',
  '5,other-strategy,mars,complete,11,5000,9,11,3,40,2,1,,0,999,0',
].join('\n');

describe('parseSummaryCsv', () => {
  it('parses by header name and preserves per-run fields', () => {
    const rows = parseSummaryCsv(CSV);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      strategy: 'scored:59-regen-vector',
      outcome: 'complete',
      finalHop: 11,
      portPurchases: 0,
      finalBits: 70,
      packetsFired: 2,
    });
  });

  it('throws loud on a missing column', () => {
    expect(() => parseSummaryCsv('seed,strategy\n1,x')).toThrow(/missing column/);
  });
});

describe('computeMetrics', () => {
  const rows = parseSummaryCsv(CSV).filter((r) => r.strategy === 'scored:59-regen-vector');

  it('win rate, wall (the §60e arithmetic), tx, bank, fires', () => {
    const m = computeMetrics(rows);
    expect(m.runs).toBe(4);
    expect(m.winRate).toBe(0.5); // 2/4 complete
    // Terminal hop = 11 (where winners end). Arrivals = seeds 1,2,4 (hop 11);
    // one died there → wall = 1/3. Seed 3 (died hop 6) is NOT an arrival.
    expect(m.bossWall).toBeCloseTo(1 / 3);
    expect(m.transactionRate).toBe(0.25); // only seed 3 bought
    expect(m.terminalBank).toBe((70 + 80 + 20 + 90) / 4);
    expect(m.firesPerRun).toBe(2);
  });

  it('no wins → the wall is unknowable (null), never a fake 100%', () => {
    const m = computeMetrics(rows.filter((r) => r.outcome === 'defeat'));
    expect(m.bossWall).toBeNull();
    expect(m.winRate).toBe(0);
  });
});

describe('evaluateBoard', () => {
  const board = buildBoard();

  const metricsAt = (winRate: number): InstrumentMetrics => ({
    runs: 40,
    winRate,
    bossWall: 0.32,
    transactionRate: 0.02,
    terminalBank: 70,
    firesPerRun: 1.8,
  });

  it('an in-band regen read PASSes every check (signed and reference)', () => {
    const report = evaluateBoard(board, new Map([['regen', metricsAt(0.62)]]));
    const regen = report.rows.filter((r) => r.instrument === 'regen');
    expect(regen.length).toBeGreaterThan(0);
    expect(regen.every((r) => r.status === 'PASS')).toBe(true);
    expect(report.fails).toBe(0);
  });

  it('a signed-band breach FAILs; a reference drift only WARNs', () => {
    const offBand = { ...metricsAt(0.4), transactionRate: 0.5 };
    const report = evaluateBoard(board, new Map([['regen', offBand]]));
    const byMetric = new Map(
      report.rows.filter((r) => r.instrument === 'regen').map((r) => [r.metric, r.status]),
    );
    expect(byMetric.get('winRate')).toBe('FAIL'); // signed 60–67
    expect(byMetric.get('transactionRate')).toBe('WARN'); // reference ~0
    expect(report.fails).toBe(1);
  });

  it('the fire-channel delta reads regen − ablated and a missing side is N/A', () => {
    const withBoth = evaluateBoard(
      board,
      new Map([
        ['regen', metricsAt(0.62)],
        ['fire-ablated', metricsAt(0.57)],
      ]),
    );
    const delta = withBoth.rows.find((r) => r.instrument === 'fire-channel');
    expect(delta?.value).toBeCloseTo(0.05);
    expect(delta?.status).toBe('PASS');

    const missingSide = evaluateBoard(board, new Map([['regen', metricsAt(0.62)]]));
    expect(missingSide.rows.find((r) => r.instrument === 'fire-channel')?.status).toBe('N/A');
    expect(missingSide.missing).toContain('fire-ablated');
  });

  it('a null wall (no wins) is N/A, not a verdict', () => {
    const noWins = { ...metricsAt(0.62), bossWall: null };
    const report = evaluateBoard(board, new Map([['regen', noWins]]));
    const wall = report.rows.find((r) => r.instrument === 'regen' && r.metric === 'bossWall');
    expect(wall?.status).toBe('N/A');
  });
});

describe('the board definition itself', () => {
  const board = buildBoard();

  it('every instrument runs the extended arm with an explicit character (the batch names its arm)', () => {
    for (const inst of board.instruments) {
      expect(inst.args).toContain('--searcher');
      expect(inst.args).toContain('--audition');
      expect(inst.args.some((a) => a.startsWith('--character='))).toBe(true);
    }
  });

  it('signed-grade checks derive from signed-sheet.json (balance-proof — never hardcoded)', () => {
    const sheet = loadSignedSheet();
    const signed = board.instruments.flatMap((i) => i.checks).filter((c) => c.grade === 'signed');
    expect(signed.length).toBeGreaterThan(0);
    for (const c of signed) {
      expect(c.min).toBe(sheet.winRateInSample.min);
      expect(c.max).toBe(sheet.winRateInSample.max);
    }
  });

  it('every delta references real instrument ids', () => {
    const ids = new Set(board.instruments.map((i) => i.id));
    for (const d of board.deltas) {
      expect(ids.has(d.a)).toBe(true);
      expect(ids.has(d.b)).toBe(true);
    }
  });
});
