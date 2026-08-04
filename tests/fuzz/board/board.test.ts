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

  it('72b — terminalReach + seamPool: sector-aware arrivals ÷ runs; mean seam pool with pre-72b-pre graceful null', () => {
    const walkCsv = [
      'seed,strategy,daemon,outcome,finalHop,portPurchases,finalBits,packetsFired,sectorsCleared,poolAtSectorEnd',
      '1,s,mars,complete,10,0,0,0,1,16',
      '2,s,mars,defeat,10,0,0,0,1,12',
      '3,s,mars,defeat,11,0,0,0,0,', // never crossed: blank seam, act-1 death
      '4,s,mars,defeat,3,0,0,0,1,14',
    ].join('\n');
    const m = computeMetrics(parseSummaryCsv(walkCsv));
    expect(m.terminalReach).toBeCloseTo(2 / 4); // arrivals (sc-aware) ÷ ALL runs
    expect(m.seamPool).toBeCloseTo((16 + 12 + 14) / 3); // entrants only
    // A pre-72b-pre CSV (no pool column) degrades to null, never throws.
    const legacy = computeMetrics(parseSummaryCsv(CSV).filter((r) => r.strategy === 'scored:59-regen-vector'));
    expect(legacy.seamPool).toBeNull();
    expect(legacy.terminalReach).toBeCloseTo(3 / 4); // sc≡0 single-sector arithmetic
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
    terminalReach: 0.45,
    seamPool: 14,
    transactionRate: 0.02,
    terminalBank: 70,
    firesPerRun: 2.9,
  });

  it('an at-reference arb-regen read PASSes every check', () => {
    // Balance-proof: the at-reference value comes FROM the sheet, so a
    // legitimate re-sign moves this test with it (the 68f re-sign lesson).
    const report = evaluateBoard(board, new Map([['arb-regen', metricsAt(sheet.act1WinRefs.soldier.regen)]]));
    const regen = report.rows.filter((r) => r.instrument === 'arb-regen');
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

  it('the real board carries NO signed-grade checks (the 68d design, held at 72f: signatures live on the sheet; n=40 noise makes FAIL-grade checks trigger-happy)', () => {
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
    const report = evaluateBoard(board, new Map([['arb-walk-regen', noWins]]));
    const wall = report.rows.find((r) => r.instrument === 'arb-walk-regen' && r.metric === 'bossWall');
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
    expect(winRefOf('arb-regen')?.min).toBeCloseTo(sheet.act1WinRefs.soldier.regen - 0.08);
    expect(winRefOf('arb-priest-55pre')?.max).toBeCloseTo(sheet.act1WinRefs.priest.pre55 + 0.08);
    expect(winRefOf('arb-gambler-regen')?.min).toBeCloseTo(sheet.act1WinRefs.gambler.regen - 0.08);
  });

  it("the gambler rows carry the sheet's parity annotation (balance-proof: whatever gamblerNote says)", () => {
    for (const id of ['arb-gambler-regen', 'arb-gambler-55pre']) {
      const win = board.instruments.find((i) => i.id === id)?.checks.find((c) => c.metric === 'winRate');
      expect(win?.source).toContain(sheet.gamblerNote);
    }
  });

  it('72b/72f — the walk primaries carry the unified architecture: seam + reach + wall from the sheet, win DERIVED (balance-proof)', () => {
    for (const id of ['arb-walk-regen', 'arb-walk-55pre']) {
      const inst = board.instruments.find((i) => i.id === id)!;
      expect(inst.args).not.toContain('--hops=11');
      const seam = inst.checks.find((c) => c.metric === 'seamPool')!;
      expect(seam.min).toBe(sheet.seamPoolBand.min);
      expect(seam.max).toBe(sheet.seamPoolBand.max);
      const reach = inst.checks.find((c) => c.metric === 'terminalReach')!;
      expect(reach.min).toBe(sheet.terminalReachTarget.min);
      expect(reach.max).toBe(sheet.terminalReachTarget.max);
      const wall = inst.checks.find((c) => c.metric === 'bossWall')!;
      expect(wall.min).toBe(sheet.deepEndWallTarget.min);
      // The win band is DERIVED from the signed pair — a re-signed reach or
      // wall moves it with the sheet; it is never independently authored.
      const win = inst.checks.find((c) => c.metric === 'winRate')!;
      expect(win.min).toBeCloseTo(
        sheet.terminalReachTarget.min * (1 - sheet.deepEndWallTarget.max),
      );
      expect(win.max).toBeCloseTo(
        sheet.terminalReachTarget.max * (1 - sheet.deepEndWallTarget.min),
      );
    }
  });

  it('every delta references real instrument ids', () => {
    const ids = new Set(board.instruments.map((i) => i.id));
    for (const d of board.deltas) {
      expect(ids.has(d.a)).toBe(true);
      expect(ids.has(d.b)).toBe(true);
    }
  });

  // 72f (user-signed) — THE ARBITRATED DEFAULT: 10 arb primaries carry
  // every check; 5 checkless doctrine controls ride for the 4 paired
  // ceiling deltas + the fire channel. arb-fire-ablated is DROPPED
  // (rollout-owned fires make the ablated vector play identically to
  // regen — metric-identical at 72f; BALANCE §72f).
  describe('the primary/control structure (72f)', () => {
    const primaries = board.instruments.filter((i) => i.id.startsWith('arb-'));
    const controls = board.instruments.filter((i) => !i.id.startsWith('arb-'));

    it('10 arb primaries (every check lives here) + 5 checkless doctrine controls', () => {
      expect(primaries).toHaveLength(10);
      expect(controls.map((c) => c.id).sort()).toEqual([
        '55pre',
        'fire-ablated',
        'regen',
        'walk-55pre',
        'walk-regen',
      ]);
      for (const c of controls) expect(c.checks).toEqual([]);
      expect(primaries.some((p) => p.checks.length > 0)).toBe(true);
      expect(board.instruments.find((i) => i.id === 'arb-fire-ablated')).toBeUndefined();
    });

    it('primaries run the arbitrated arm (arbitrated: strategyRow); controls run the heuristic arm (no --arbitrate)', () => {
      for (const p of primaries) {
        expect(p.args).toContain('--arbitrate');
        expect(p.strategyRow.startsWith('arbitrated:')).toBe(true);
      }
      for (const c of controls) {
        expect(c.args).not.toContain('--arbitrate');
        expect(c.strategyRow.startsWith('arbitrated:')).toBe(false);
      }
    });

    it('the 4 ceiling deltas pair each control with its primary (paired seeds, ±8pt reference)', () => {
      const pairs = [
        ['ceiling-regen', 'arb-regen', 'regen'],
        ['ceiling-55pre', 'arb-55pre', '55pre'],
        ['ceiling-walk-regen', 'arb-walk-regen', 'walk-regen'],
        ['ceiling-walk-55pre', 'arb-walk-55pre', 'walk-55pre'],
      ] as const;
      for (const [id, a, b] of pairs) {
        const delta = board.deltas.find((d) => d.id === id)!;
        expect(delta.a).toBe(a);
        expect(delta.b).toBe(b);
        expect(delta.metric).toBe('winRate');
        expect(delta.grade).toBe('reference');
        expect(delta.min).toBeCloseTo(-0.08);
        expect(delta.max).toBeCloseTo(0.08);
      }
      expect(board.deltas).toHaveLength(pairs.length + 1); // + the fire channel
      expect(board.deltas.find((d) => d.id === 'arb-fire-channel')).toBeUndefined();
    });

    it('a primary and its control share shape: same args minus the arm flag (the paired-seed contract)', () => {
      for (const [ctrl, arb] of [
        ['regen', 'arb-regen'],
        ['55pre', 'arb-55pre'],
        ['walk-regen', 'arb-walk-regen'],
        ['walk-55pre', 'arb-walk-55pre'],
      ] as const) {
        const c = board.instruments.find((i) => i.id === ctrl)!;
        const p = board.instruments.find((i) => i.id === arb)!;
        expect(p.args.filter((a) => a !== '--arbitrate')).toEqual([...c.args]);
      }
    });
  });
});
