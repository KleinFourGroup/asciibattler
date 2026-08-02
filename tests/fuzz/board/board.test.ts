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
  'seed,strategy,daemon,outcome,finalHop,totalTicks,finalTeamSize,battlesPlayed,totalPlayerDeaths,totalEnemyDeaths,recruitedMelee,recruitedRanged,hangLayout,portPurchases,finalBits,packetsFired,sectorsCleared',
  '1,scored:59-regen-vector,mars,complete,11,5000,9,11,3,40,2,1,,0,70,2,0',
  '2,scored:59-regen-vector,mars,defeat,11,4000,7,11,5,30,1,1,,0,80,1,0',
  '3,scored:59-regen-vector,mars,defeat,6,2500,5,6,6,15,1,0,,1,20,3,0',
  '4,scored:59-regen-vector,mars,complete,11,5200,10,11,2,45,2,2,,0,90,2,0',
  '5,other-strategy,mars,complete,11,5000,9,11,3,40,2,1,,0,999,0,0',
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

  it('72b — the wall is SECTOR-AWARE: a late act-1 death is NOT a terminal arrival (gotcha #120)', () => {
    // finalHop resets per sector, so winners at (sc=1, hop=10) define the
    // terminal position; a defeat at (sc=0, hop=11) has a BIGGER bare hop but
    // is an act-1 death — the pre-72b bare-hop filter counted it and read the
    // deep-end wall at ~2× its true value (the §68g false alarm).
    const walkCsv = [
      'seed,strategy,daemon,outcome,finalHop,portPurchases,finalBits,packetsFired,sectorsCleared',
      '1,s,mars,complete,10,0,0,0,1', // winner: terminal = (1, 10)
      '2,s,mars,defeat,10,0,0,0,1', //   true terminal death → arrival
      '3,s,mars,defeat,11,0,0,0,0', //   ACT-1 death at hop 11 → NOT an arrival
      '4,s,mars,defeat,3,0,0,0,1', //    mid-act-2 death → not an arrival
    ].join('\n');
    const m = computeMetrics(parseSummaryCsv(walkCsv));
    expect(m.bossWall).toBeCloseTo(1 / 2); // arrivals = seeds 1+2 only
  });
});

describe('evaluateBoard', () => {
  const board = buildBoard();
  const sheet = loadSignedSheet();

  const metricsAt = (winRate: number): InstrumentMetrics => ({
    runs: 40,
    winRate,
    bossWall: 0.32,
    transactionRate: 0.02,
    terminalBank: 70,
    firesPerRun: 2.9,
  });

  it('an at-reference regen read PASSes every check', () => {
    // Balance-proof: the at-reference value comes FROM the sheet, so a
    // legitimate re-sign moves this test with it (the 68f re-sign lesson).
    const report = evaluateBoard(board, new Map([['regen', metricsAt(sheet.act1WinRefs.soldier.regen)]]));
    const regen = report.rows.filter((r) => r.instrument === 'regen');
    expect(regen.length).toBeGreaterThan(0);
    expect(regen.every((r) => r.status === 'PASS')).toBe(true);
    expect(report.fails).toBe(0);
  });

  it('grade semantics: signed FAILs outside its band, reference only WARNs', () => {
    // The REAL board is all-reference until the two-act target signs
    // (the 68d design) — pin the FAIL path on a synthetic signed check.
    const synthetic = {
      ...board,
      instruments: [
        {
          id: 'synth',
          title: 'synthetic signed check',
          args: [],
          strategyRow: 'x',
          checks: [
            { metric: 'winRate' as const, grade: 'signed' as const, min: 0.5, max: 0.6, source: 's' },
            { metric: 'transactionRate' as const, grade: 'reference' as const, min: 0, max: 0.1, source: 'r' },
          ],
        },
      ],
      deltas: [],
    };
    const report = evaluateBoard(synthetic, new Map([['synth', { ...metricsAt(0.9), transactionRate: 0.5 }]]));
    const byMetric = new Map(report.rows.map((r) => [r.metric, r.status]));
    expect(byMetric.get('winRate')).toBe('FAIL');
    expect(byMetric.get('transactionRate')).toBe('WARN');
    expect(report.fails).toBe(1);
    expect(report.warns).toBe(1);
  });

  it('post-68d the real board carries NO signed-grade checks (all drift refs until the two-act signing)', () => {
    const signed = board.instruments.flatMap((i) => i.checks).filter((c) => c.grade === 'signed');
    expect(signed).toEqual([]);
  });

  it('the fire-channel delta reads regen − ablated and a missing side is N/A', () => {
    // Balance-proof: the ablated side sits exactly one signed delta below
    // regen, so a re-signed fireChannelDelta moves this test with the sheet.
    const withBoth = evaluateBoard(
      board,
      new Map([
        ['regen', metricsAt(0.85)],
        ['fire-ablated', metricsAt(0.85 - sheet.fireChannelDelta)],
      ]),
    );
    const delta = withBoth.rows.find((r) => r.instrument === 'fire-channel');
    expect(delta?.value).toBeCloseTo(sheet.fireChannelDelta);
    expect(delta?.status).toBe('PASS');

    const missingSide = evaluateBoard(board, new Map([['regen', metricsAt(0.85)]]));
    expect(missingSide.rows.find((r) => r.instrument === 'fire-channel')?.status).toBe('N/A');
    expect(missingSide.missing).toContain('fire-ablated');
  });

  it('a null wall (no wins) is N/A, not a verdict — pinned on the walk row that carries the wall check', () => {
    const noWins = { ...metricsAt(0.6), bossWall: null };
    const report = evaluateBoard(board, new Map([['walk-regen', noWins]]));
    const wall = report.rows.find((r) => r.instrument === 'walk-regen' && r.metric === 'bossWall');
    expect(wall?.status).toBe('N/A');
  });
});

describe('the board definition itself', () => {
  const board = buildBoard();
  const sheet = loadSignedSheet();

  it('every instrument runs the extended arm with an explicit character (the batch names its arm)', () => {
    for (const inst of board.instruments) {
      expect(inst.args).toContain('--searcher');
      expect(inst.args).toContain('--audition');
      expect(inst.args.some((a) => a.startsWith('--character='))).toBe(true);
    }
  });

  it('the per-character drift refs derive from signed-sheet.json (balance-proof — never hardcoded)', () => {
    const winRefOf = (id: string): { min: number; max: number } | undefined =>
      board.instruments.find((i) => i.id === id)?.checks.find((c) => c.metric === 'winRate');
    expect(winRefOf('regen')?.min).toBeCloseTo(sheet.act1WinRefs.soldier.regen - 0.08);
    expect(winRefOf('priest-55pre')?.max).toBeCloseTo(sheet.act1WinRefs.priest.pre55 + 0.08);
    expect(winRefOf('gambler-regen')?.min).toBeCloseTo(sheet.act1WinRefs.gambler.regen - 0.08);
  });

  it("the gambler rows carry the sheet's parity annotation (balance-proof: whatever gamblerNote says)", () => {
    for (const id of ['gambler-regen', 'gambler-55pre']) {
      const win = board.instruments.find((i) => i.id === id)?.checks.find((c) => c.metric === 'winRate');
      expect(win?.source).toContain(sheet.gamblerNote);
    }
  });

  it('the walk rows carry the declared two-act target + the migrated deep-end wall band', () => {
    for (const id of ['walk-regen', 'walk-55pre']) {
      const inst = board.instruments.find((i) => i.id === id)!;
      expect(inst.args).not.toContain('--hops=11');
      const win = inst.checks.find((c) => c.metric === 'winRate')!;
      expect(win.min).toBe(sheet.twoActTargetWinRate.min);
      expect(win.max).toBe(sheet.twoActTargetWinRate.max);
      const wall = inst.checks.find((c) => c.metric === 'bossWall')!;
      expect(wall.min).toBe(sheet.deepEndWallTarget.min);
    }
  });

  it('every delta references real instrument ids', () => {
    const ids = new Set(board.instruments.map((i) => i.id));
    for (const d of board.deltas) {
      expect(ids.has(d.a)).toBe(true);
      expect(ids.has(d.b)).toBe(true);
    }
  });

  // 72a — the run-alongside twins (spec resolution 6, shape-locked
  // 2026-08-01): every doctrine instrument gets an arbitrated twin and a
  // paired ceiling-move delta row; twins are measurement rows (no checks
  // until the 72f signing session).
  describe('the arbitrated twins (72a)', () => {
    const doctrine = board.instruments.filter((i) => !i.id.startsWith('arb-'));
    const twins = board.instruments.filter((i) => i.id.startsWith('arb-'));

    it('every doctrine instrument has exactly one twin: same args + bare --arbitrate, prefixed strategyRow, NO checks', () => {
      expect(twins.length).toBe(doctrine.length);
      for (const inst of doctrine) {
        const twin = board.instruments.find((i) => i.id === `arb-${inst.id}`)!;
        expect(twin.args).toEqual([...inst.args, '--arbitrate']);
        expect(twin.strategyRow).toBe(`arbitrated:${inst.strategyRow}`);
        expect(twin.checks).toEqual([]);
      }
    });

    it('a paired ceiling-move delta rides every pair: arb − doctrine winRate at the ±8pt paired-noise band, reference grade', () => {
      for (const inst of doctrine) {
        const delta = board.deltas.find((d) => d.id === `ceiling-${inst.id}`)!;
        expect(delta.a).toBe(`arb-${inst.id}`);
        expect(delta.b).toBe(inst.id);
        expect(delta.metric).toBe('winRate');
        expect(delta.grade).toBe('reference');
        expect(delta.min).toBeCloseTo(-0.08);
        expect(delta.max).toBeCloseTo(0.08);
      }
    });

    it('the arb fire-channel verification delta derives from the sheet like the doctrine row (balance-proof)', () => {
      const arb = board.deltas.find((d) => d.id === 'arb-fire-channel')!;
      expect(arb.a).toBe('arb-regen');
      expect(arb.b).toBe('arb-fire-ablated');
      expect(arb.grade).toBe('reference');
      expect(arb.min).toBeCloseTo(sheet.fireChannelDelta - 0.05);
      expect(arb.max).toBeCloseTo(sheet.fireChannelDelta + 0.05);
    });
  });
});
