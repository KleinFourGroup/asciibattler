/**
 * 68c — the executable board's pure layer: csv → metrics → evaluation.
 * The runner shell (cli.ts) stays untested (the commands/ discipline);
 * everything decision-bearing is here.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BOARD_MIN_N,
  buildBoard,
  computeMetrics,
  pacingMetricsOf,
  evaluateBoard,
  evaluateSkillGradient,
  evaluateVerdict,
  checkLabel,
  checkValue,
  homeActOf,
  loadSignedSheet,
  parseSummaryCsv,
  sheetProvenance,
  signTestUpper,
  type BoardInstrument,
  type InstrumentAudit,
  type InstrumentMetrics,
} from './board';
import { HEALTH } from '../../../src/config/health';
import { SECTOR_MAP } from '../../../src/config/sectorMap';
import { sectorPositions } from '../roster/rosterTable';

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
    seamPool: 0.5 * (sheet.seams['1']!.min + sheet.seams['1']!.max) * HEALTH.playerHealthMax, // 94h-pre: mid-band, a fraction of max
    // 83f — bank/fires come FROM the sheet too (the 72f fixture hardcoded 70 /
    // 2.9 inside the old bands; the §82-economy re-pin exposed it — the
    // balance-proof rule, applied to every ref the row checks). 85g6d: tx
    // joined the sheet when the fold re-activated the port economy (the
    // hardcoded 0.02 was the same class of stale fixture).
    transactionRate: sheet.acts['1']!.firerTransactionRate,
    terminalBank: sheet.acts['1']!.bankRefs.firer,
    firesPerRun: sheet.acts['1']!.firerFiresPerRun,
    pacingNormal: 0.5 * (sheet.pacingBands.normal.min + sheet.pacingBands.normal.max),
    pacingElite: 0.5 * (sheet.pacingBands.elite.min + sheet.pacingBands.elite.max),
    pacingBoss: 0.5 * (sheet.pacingBands.boss.min + sheet.pacingBands.boss.max),
    // 143d — the walk rows check seam 1 off `seams`; the same mid-band pool.
    seams: [{ act: 1, crossed: 40, pool: 0.5 * (sheet.seams['1']!.min + sheet.seams['1']!.max) * HEALTH.playerHealthMax }],
    // The walk rows check act 1's wall off `walls` since it was signed; mid-band.
    acts: [{ act: 1, bossHop: 10, arrivals: 40, reach: 1, wall: 0.5 * (sheet.walls['1']!.min + sheet.walls['1']!.max) }],
  });

  it('an at-reference arb-regen read PASSes every check', () => {
    // Balance-proof: the at-reference value comes FROM the sheet, so a
    // legitimate re-sign moves this test with it (the 68f re-sign lesson).
    const report = evaluateBoard(board, new Map([['arb-regen', metricsAt(sheet.acts['1']!.winRefs.soldier.regen)]]));
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
        ['fire-ablated', metricsAt(0.85 - sheet.acts['1']!.fireChannelDelta)],
      ]),
    );
    const delta = withBoth.rows.find((r) => r.instrument === 'fire-channel');
    expect(delta?.value).toBeCloseTo(sheet.acts['1']!.fireChannelDelta);
    expect(delta?.status).toBe('PASS');

    const missingSide = evaluateBoard(board, new Map([['regen', metricsAt(0.85)]]));
    expect(missingSide.rows.find((r) => r.instrument === 'fire-channel')?.status).toBe('N/A');
    expect(missingSide.missing).toContain('fire-ablated');
  });

  it('150b — a ceiling delta reads the seeds both rows ran, not the whole rows', () => {
    // The ARM row at 120 seeds wins 1..10 and 41..120 (90 of 120); the
    // doctrine row at 40 wins 1..20 (20 of 40). Whole rows: 0.75 − 0.5 =
    // +0.25. On seeds 1..40: 10 − 20 of 40 = −0.25. The sign flips, so the
    // old pooled arithmetic fails this pin.
    const csv = (strategy: string, seeds: number[], won: (s: number) => boolean): string =>
      [
        'seed,strategy,outcome,finalHop,sectorsCleared,portPurchases,finalBits,packetsFired',
        ...seeds.map((s) => `${s},${strategy},${won(s) ? 'complete' : 'defeat'},10,0,0,0,0`),
      ].join('\n');
    const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const arm = computeMetrics(parseSummaryCsv(csv('arm', range(1, 120), (s) => s <= 10 || s > 40)));
    const doctrine = computeMetrics(parseSummaryCsv(csv('doc', range(1, 40), (s) => s <= 20)));
    expect(arm.winRate - doctrine.winRate).toBeCloseTo(0.25); // the fixture tells the two apart
    const report = evaluateBoard(
      board,
      new Map([
        ['arb-regen', arm],
        ['regen', doctrine],
      ]),
    );
    const row = report.rows.find((r) => r.instrument === 'ceiling-regen')!;
    expect(row.value).toBeCloseTo(-0.25);
    expect(row.metric).toContain('40 shared seeds');
    expect(row.status).toBe('WARN');
    // No shared seed reads N/A, never a number.
    const apart = computeMetrics(parseSummaryCsv(csv('doc', range(121, 160), () => true)));
    const none = evaluateBoard(
      board,
      new Map([
        ['arb-regen', arm],
        ['regen', apart],
      ]),
    );
    expect(none.rows.find((r) => r.instrument === 'ceiling-regen')?.status).toBe('N/A');
  });

  it('a null wall (no wins) is N/A, not a verdict — pinned on the walk row that carries the wall check', () => {
    const noWins = { ...metricsAt(0.6), bossWall: null };
    const report = evaluateBoard(board, new Map([['arb-walk-regen', noWins]]));
    const wall = report.rows.find((r) => r.instrument === 'arb-walk-regen' && r.metric === 'bossWall');
    expect(wall?.status).toBe('N/A');
  });
});

describe('86e2 — the fail-closed verdict layer (mechanism smoke; the per-class fixture pins are 86e4)', () => {
  const board = buildBoard();
  const sheet = loadSignedSheet();
  const HEAD = 'a'.repeat(40);

  const cleanAudit = (inst: BoardInstrument, n = BOARD_MIN_N): InstrumentAudit => ({
    dir: `output/board/${inst.id}`,
    summaryFound: true,
    totalRows: n,
    matchedRows: n,
    seeds: Array.from({ length: n }, (_, i) => i + 1),
    manifest: {
      manifestVersion: 1,
      kind: 'run',
      head: HEAD,
      dirty: false,
      argv: [...inst.args, `--out=output/board/${inst.id}`, '--jobs=8'],
      seedWindow: { firstSeed: 1, count: n },
      writtenAt: '2026-08-29T00:00:00.000Z',
    },
  });
  const fullMetrics = (): InstrumentMetrics => ({
    runs: BOARD_MIN_N,
    winRate: 0.6,
    bossWall: 0.32,
    terminalReach: 0.45,
    seamPool: 0.5 * (sheet.seams['1']!.min + sheet.seams['1']!.max) * HEALTH.playerHealthMax,
    transactionRate: sheet.acts['1']!.firerTransactionRate,
    terminalBank: sheet.acts['1']!.bankRefs.firer,
    firesPerRun: sheet.acts['1']!.firerFiresPerRun,
    pacingNormal: 0.5 * (sheet.pacingBands.normal.min + sheet.pacingBands.normal.max),
    pacingElite: 0.5 * (sheet.pacingBands.elite.min + sheet.pacingBands.elite.max),
    pacingBoss: 0.5 * (sheet.pacingBands.boss.min + sheet.pacingBands.boss.max),
    seams: [{ act: 1, crossed: 40, pool: 0.5 * (sheet.seams['1']!.min + sheet.seams['1']!.max) * HEALTH.playerHealthMax }],
    acts: [{ act: 1, bossHop: 10, arrivals: 40, reach: 1, wall: 0.5 * (sheet.walls['1']!.min + sheet.walls['1']!.max) }],
    // 150b — the paired ceiling deltas read these: the same 0.6 on seeds 1..n.
    winsBySeed: new Map(Array.from({ length: BOARD_MIN_N }, (_, i) => [i + 1, i < 0.6 * BOARD_MIN_N] as const)),
  });
  const cleanBoardInputs = (): {
    audits: Map<string, InstrumentAudit>;
    metrics: Map<string, InstrumentMetrics>;
  } => {
    const audits = new Map(board.instruments.map((i) => [i.id, cleanAudit(i)]));
    const metrics = new Map(board.instruments.map((i) => [i.id, fullMetrics()]));
    return { audits, metrics };
  };
  const OPTS = { allowUnmanifested: false, currentHead: HEAD };

  it('a clean full board PASSes integrity: one PASS row per instrument, one agreed head, exit-clean', () => {
    const { audits, metrics } = cleanBoardInputs();
    const v = evaluateVerdict(board, audits, metrics, OPTS);
    expect(v.fails).toBe(0);
    expect(v.warns).toBe(0);
    expect(v.measurementHead).toBe(HEAD);
    expect(v.rows.filter((r) => r.status === 'PASS')).toHaveLength(board.instruments.length);
  });

  it('150b — a paired ceiling delta whose two found rows share no seed FAILs (fail-closed)', () => {
    const { audits, metrics } = cleanBoardInputs();
    const shifted = new Map(Array.from({ length: BOARD_MIN_N }, (_, i) => [i + 1 + BOARD_MIN_N, true] as const));
    metrics.set('arb-regen', { ...metrics.get('arb-regen')!, winsBySeed: shifted });
    const v = evaluateVerdict(board, audits, metrics, OPTS);
    const row = v.rows.find((r) => r.instrument === 'ceiling-regen');
    expect(row?.status).toBe('FAIL');
    expect(row?.check).toBe('n/a');
    // Its three siblings still pair, so they add nothing.
    expect(v.rows.filter((r) => r.instrument.startsWith('ceiling-') && r.status === 'FAIL')).toHaveLength(1);
  });

  it('a missing instrument FAILs (never a footer): the fail-closed core', () => {
    const { audits, metrics } = cleanBoardInputs();
    audits.delete('arb-regen');
    metrics.delete('arb-regen');
    const v = evaluateVerdict(board, audits, metrics, OPTS);
    const row = v.rows.find((r) => r.instrument === 'arb-regen');
    expect(row?.status).toBe('FAIL');
    expect(row?.check).toBe('missing');
    expect(v.fails).toBeGreaterThan(0);
  });

  it('decision A — a missing manifest FAILs by default, WARNs only under --allow-unmanifested', () => {
    const { audits, metrics } = cleanBoardInputs();
    audits.set('deploy', { ...audits.get('deploy')!, manifest: null });
    const strict = evaluateVerdict(board, audits, metrics, OPTS);
    expect(strict.rows.find((r) => r.instrument === 'deploy' && r.check === 'provenance')?.status).toBe('FAIL');
    const lenient = evaluateVerdict(board, audits, metrics, { ...OPTS, allowUnmanifested: true });
    expect(lenient.rows.find((r) => r.instrument === 'deploy' && r.check === 'provenance')?.status).toBe('WARN');
    expect(lenient.fails).toBe(0);
    expect(lenient.unmanifestedAllowed).toBe(1);
  });

  it('decision B — a cross-dir head split FAILs; measurement-vs-current only WARNs', () => {
    const { audits, metrics } = cleanBoardInputs();
    const other = audits.get('regen')!;
    audits.set('regen', { ...other, manifest: { ...other.manifest!, head: 'b'.repeat(40) } });
    const split = evaluateVerdict(board, audits, metrics, OPTS);
    expect(split.rows.find((r) => r.check === 'head-split')?.status).toBe('FAIL');
    expect(split.measurementHead).toBeNull();

    const clean = cleanBoardInputs();
    const vsCurrent = evaluateVerdict(board, clean.audits, clean.metrics, {
      allowUnmanifested: false,
      currentHead: 'c'.repeat(40),
    });
    expect(vsCurrent.fails).toBe(0);
    expect(vsCurrent.rows.find((r) => r.check === 'vs-current')?.status).toBe('WARN');
  });

  it('an N/A on a CHECKED row is a verdict FAIL, not a silent dash (the walk wall)', () => {
    const { audits, metrics } = cleanBoardInputs();
    metrics.set('arb-walk-regen', { ...fullMetrics(), bossWall: null });
    const v = evaluateVerdict(board, audits, metrics, OPTS);
    const row = v.rows.find((r) => r.instrument === 'arb-walk-regen' && r.check === 'n/a');
    expect(row?.status).toBe('FAIL');
    expect(row?.detail).toContain('bossWall');
  });

  it('the manifest arm must be the INSTRUMENT arm (partition flags aside)', () => {
    const { audits, metrics } = cleanBoardInputs();
    const a = audits.get('arb-deploy')!;
    // A doctrine batch dropped into an arb primary's dir: same shape flags,
    // no --arbitrate/--prior-lambda — the wrong-arm read the audit feared.
    audits.set('arb-deploy', {
      ...a,
      manifest: {
        ...a.manifest!,
        argv: a.manifest!.argv.filter((t) => t !== '--arbitrate' && t !== '--prior-lambda=0.5'),
      },
    });
    const v = evaluateVerdict(board, audits, metrics, OPTS);
    expect(v.rows.find((r) => r.instrument === 'arb-deploy' && r.check === 'arm')?.status).toBe('FAIL');
  });

  it('88d — a merge-stages manifest certifies its arm via armArgv, not the merge argv', () => {
    // The 88d maiden pooled board: the merged dir's raw argv is the
    // --merge-stages invocation; the arm check must read armArgv there.
    const { audits, metrics } = cleanBoardInputs();
    const a = audits.get('arb-regen')!;
    const mergedManifest = (armArgv: readonly string[] | undefined) => ({
      ...a.manifest!,
      kind: 'merge-stages' as const,
      argv: ['--merge-stages=output/a,output/b', '--out=output/board/arb-regen'],
      ...(armArgv !== undefined ? { armArgv } : {}),
    });
    // armArgv = the stage argv (partition flags and all) → PASS.
    audits.set('arb-regen', { ...a, manifest: mergedManifest(a.manifest!.argv) });
    expect(
      evaluateVerdict(board, audits, metrics, OPTS).rows.find(
        (r) => r.instrument === 'arb-regen' && r.check === 'arm',
      ),
    ).toBeUndefined();
    // No armArgv (a stage ran unmanifested) → FAIL, fail-closed.
    audits.set('arb-regen', { ...a, manifest: mergedManifest(undefined) });
    const noArm = evaluateVerdict(board, audits, metrics, OPTS);
    expect(
      noArm.rows.find((r) => r.instrument === 'arb-regen' && r.check === 'arm')?.status,
    ).toBe('FAIL');
    // armArgv naming the WRONG arm → FAIL.
    audits.set('arb-regen', {
      ...a,
      manifest: mergedManifest(a.manifest!.argv.filter((t) => t !== '--arbitrate')),
    });
    const wrongArm = evaluateVerdict(board, audits, metrics, OPTS);
    expect(
      wrongArm.rows.find((r) => r.instrument === 'arb-regen' && r.check === 'arm')?.status,
    ).toBe('FAIL');
  });
});

describe('86e3 — the skill-gradient health check', () => {
  // 150c — `won` lists the seeds of 1..40 the row won; the win rate follows.
  const at = (won: readonly number[] | number): InstrumentMetrics => {
    const seeds = typeof won === 'number' ? null : new Set(won);
    return {
      runs: 40,
      winRate: seeds === null ? (won as number) : seeds.size / 40,
      bossWall: 0.32,
      terminalReach: 0.45,
      seamPool: 16,
      transactionRate: 0.2,
      terminalBank: 100,
      firesPerRun: 1.7,
      pacingNormal: 2.9, // 94h-pre — the gradient check reads none of these
      pacingElite: 4.5,
      pacingBoss: 5.75,
      seams: [],
      acts: [],
      ...(seeds === null
        ? {}
        : { winsBySeed: new Map(Array.from({ length: 40 }, (_, i) => [i + 1, seeds.has(i + 1)] as const)) }),
    };
  };
  const seeds = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  it('a monotone gradient reads ok on both legs, upper = the best act-1 ARM row', () => {
    const rows = evaluateSkillGradient(
      new Map([
        ['anchor-random', at(seeds(1, 2))],
        ['anchor-greedy', at(seeds(1, 14))],
        ['arb-regen', at(0.65)],
        ['arb-deploy', at(0.75)],
      ]),
    );
    expect(rows.map((r) => r.status)).toEqual(['ok', 'ok']);
    expect(rows[1]?.detail).toContain('arb-deploy'); // max of the ARM legs
  });

  it('an inversion past the noise WARNs — the instrument is broken, not the balance', () => {
    // Random alone wins 12 seeds, greedy alone 2: P(X ≥ 12 | 14) = 106/16384.
    const inverted = evaluateSkillGradient(
      new Map([
        ['anchor-random', at(seeds(1, 12))],
        ['anchor-greedy', at(seeds(13, 14))],
        ['arb-deploy', at(0.03)],
      ]),
    );
    expect(inverted.map((r) => r.status)).toEqual(['WARN', 'WARN']);
    expect(inverted[0]?.detail).toContain('INVERTED');
    expect(inverted[0]?.detail).toContain('p 0.006');
  });

  it('150c — a tie and a flip inside the noise read ok; the leg WARNs from a 5-to-0 split', () => {
    const leg = (random: number[], greedy: number[]) =>
      evaluateSkillGradient(
        new Map([
          ['anchor-random', at(random)],
          ['anchor-greedy', at(greedy)],
        ]),
      )[0]!;
    // A tie on the same seeds: no seed told apart, p 1.
    expect(leg(seeds(1, 11), seeds(1, 11)).status).toBe('ok');
    // A tie on different seeds: 11 each, 11 to 11 of the discordant.
    expect(leg(seeds(1, 11), seeds(12, 22)).status).toBe('ok');
    // 4 to 0: P = 1/16, inside the noise; 5 to 0: P = 1/32, past it.
    expect(leg(seeds(1, 11), seeds(1, 7)).status).toBe('ok');
    expect(leg(seeds(1, 12), seeds(1, 7)).status).toBe('WARN');
  });

  it('150c — the sign test against hand-worked binomial tails', () => {
    expect(signTestUpper(8, 8)).toBeCloseTo(1 / 256, 12);
    expect(signTestUpper(7, 10)).toBeCloseTo((120 + 45 + 10 + 1) / 1024, 12);
    expect(signTestUpper(12, 14)).toBeCloseTo((91 + 14 + 1) / 16384, 12);
    expect(signTestUpper(15, 16)).toBeCloseTo(17 / 65536, 12);
    expect(signTestUpper(0, 0)).toBe(1);
    expect(signTestUpper(0, 40)).toBeCloseTo(1, 12);
    expect(() => signTestUpper(5, 4)).toThrow();
  });

  it('absent legs read N/A, never a silent pass: missing anchors / missing ARM rows / no seeds to pair', () => {
    expect(evaluateSkillGradient(new Map()).map((r) => r.status)).toEqual(['N/A']);
    const noArm = evaluateSkillGradient(
      new Map([
        ['anchor-random', at(seeds(1, 2))],
        ['anchor-greedy', at(seeds(1, 14))],
      ]),
    );
    expect(noArm.map((r) => r.status)).toEqual(['ok', 'N/A']);
    expect(noArm[1]?.detail).toContain('signing boards');
    const unpaired = evaluateSkillGradient(
      new Map([
        ['anchor-random', at(0.05)],
        ['anchor-greedy', at(0.35)],
      ]),
    );
    expect(unpaired[0]?.status).toBe('N/A');
  });
});

describe('the board definition itself', () => {
  const board = buildBoard();
  const sheet = loadSignedSheet();

  it('every non-anchor instrument runs the extended arm with an explicit character (the batch names its arm)', () => {
    for (const inst of board.instruments) {
      if (inst.id.startsWith('anchor-')) continue;
      expect(inst.args).toContain('--searcher');
      expect(inst.args).toContain('--audition');
      expect(inst.args.some((a) => a.startsWith('--character='))).toBe(true);
    }
  });

  it('86e3 — the anchors are BARE: the floor must be guileless (no searcher/redraw/empower/arbitrate)', () => {
    const anchors = board.instruments.filter((i) => i.id.startsWith('anchor-'));
    expect(anchors.map((a) => a.id).sort()).toEqual(['anchor-greedy', 'anchor-random']);
    for (const a of anchors) {
      for (const flag of ['--searcher', '--audition', '--arbitrate']) {
        expect(a.args).not.toContain(flag);
      }
      expect(a.args.some((t) => t.startsWith('--redraw') || t.startsWith('--empower') || t.startsWith('--prior-lambda'))).toBe(false);
      // Shape-matched to the act-1 arb rows (probe-shape win rates are
      // shape artifacts — the gradient only reads on matched legs).
      expect(a.args).toContain('--hops=11');
      expect(a.args).toContain('--character=soldier');
      expect(a.checks).toEqual([]); // their value is the gradient, not a band
    }
  });

  it('the per-character drift refs derive from signed-sheet.json (balance-proof — never hardcoded)', () => {
    const winRefOf = (id: string): { min: number; max: number } | undefined =>
      board.instruments.find((i) => i.id === id)?.checks.find((c) => c.metric === 'winRate');
    expect(winRefOf('arb-regen')?.min).toBeCloseTo(sheet.acts['1']!.winRefs.soldier.regen - 0.08);
    expect(winRefOf('arb-priest-deploy')?.max).toBeCloseTo(sheet.acts['1']!.winRefs.priest.deploy + 0.08);
    expect(winRefOf('arb-gambler-regen')?.min).toBeCloseTo(sheet.acts['1']!.winRefs.gambler.regen - 0.08);
  });

  it("the gambler rows carry the sheet's parity annotation (balance-proof: whatever gamblerNote says)", () => {
    for (const id of ['arb-gambler-regen', 'arb-gambler-deploy']) {
      const win = board.instruments.find((i) => i.id === id)?.checks.find((c) => c.metric === 'winRate');
      expect(win?.source).toContain(sheet.gamblerNote);
    }
  });

  it('72b/72f — the walk primaries carry the unified architecture: seam + reach + wall from the sheet, win DERIVED (balance-proof)', () => {
    for (const id of ['arb-walk-regen', 'arb-walk-deploy']) {
      const inst = board.instruments.find((i) => i.id === id)!;
      expect(inst.args).not.toContain('--hops=11');
      const seam = inst.checks.find((c) => c.metric === 'seam' && c.act === 1)!;
      // 94h-pre — a FRACTION of the pool max, derived at verdict time.
      expect(seam.min).toBeCloseTo(sheet.seams['1']!.min * HEALTH.playerHealthMax);
      expect(seam.max).toBeCloseTo(sheet.seams['1']!.max * HEALTH.playerHealthMax);
      // 94h-pre — the pacing DRIFT read: the walk rows run --per-encounter and
      // carry the three kind bands from the sheet.
      expect(inst.args).toContain('--per-encounter');
      for (const [metric, kind] of [['pacingNormal', 'normal'], ['pacingElite', 'elite'], ['pacingBoss', 'boss']] as const) {
        const c = inst.checks.find((x) => x.metric === metric)!;
        expect(c.grade).toBe('reference');
        expect(c.min).toBe(sheet.pacingBands[kind].min);
        expect(c.max).toBe(sheet.pacingBands[kind].max);
      }
      const reach = inst.checks.find((c) => c.metric === 'terminalReach')!;
      // 85g5 — pre55ReachRef retired with the frozen anchor: BOTH twins ride
      // the signed 40–50 target (the deploy twin is freshly re-derived).
      const reachBand = sheet.terminal.reach;
      expect(reach.min).toBeCloseTo(reachBand.min);
      expect(reach.max).toBeCloseTo(reachBand.max);
      const wall = inst.checks.find((c) => c.metric === 'bossWall')!;
      expect(wall.min).toBe(sheet.terminal.wall.min);
      // The win band is DERIVED from the signed pair — a re-signed reach or
      // wall moves it with the sheet; it is never independently authored.
      const win = inst.checks.find((c) => c.metric === 'winRate')!;
      expect(win.min).toBeCloseTo(reachBand.min * (1 - sheet.terminal.wall.max));
      expect(win.max).toBeCloseTo(reachBand.max * (1 - sheet.terminal.wall.min));
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
  describe('the primary/control structure (72f; wall rows de-arbitrated at 85-pre F3A)', () => {
    const primaries = board.instruments.filter((i) => i.id.startsWith('arb-'));
    // 85-pre F3A — the two wall rows are CHECKED doctrine-arm rows (a third
    // category): --encounter + --arbitrate is refused since the F3 guard.
    const wallRows = board.instruments.filter((i) => i.id.startsWith('wall-'));
    // 86e3 — the two bare anchors are a fourth category (gradient legs).
    const controls = board.instruments.filter(
      (i) => !i.id.startsWith('arb-') && !i.id.startsWith('wall-') && !i.id.startsWith('anchor-'),
    );

    it('8 arb primaries + 2 checked doctrine wall rows + 5 checkless doctrine controls', () => {
      expect(primaries).toHaveLength(8);
      expect(wallRows.map((w) => w.id).sort()).toEqual(['wall-king', 'wall-queen']);
      expect(controls.map((c) => c.id).sort()).toEqual([
        'deploy',
        'fire-ablated',
        'regen',
        'walk-deploy',
        'walk-regen',
      ]);
      for (const c of controls) expect(c.checks).toEqual([]);
      for (const w of wallRows) expect(w.checks.length).toBeGreaterThan(0);
      expect(primaries.some((p) => p.checks.length > 0)).toBe(true);
      expect(board.instruments.find((i) => i.id === 'arb-fire-ablated')).toBeUndefined();
      // The F3 guard makes the old shape unconstructible — pin the absence.
      expect(board.instruments.find((i) => i.id === 'arb-wall-king')).toBeUndefined();
      expect(board.instruments.find((i) => i.id === 'arb-wall-queen')).toBeUndefined();
    });

    it('primaries run the arbitrated arm (arbitrated: strategyRow); wall rows + controls run the heuristic arm (no --arbitrate)', () => {
      for (const p of primaries) {
        expect(p.args).toContain('--arbitrate');
        expect(p.strategyRow.startsWith('arbitrated:')).toBe(true);
      }
      for (const c of [...controls, ...wallRows]) {
        expect(c.args).not.toContain('--arbitrate');
        expect(c.strategyRow.startsWith('arbitrated:')).toBe(false);
      }
      // 85-pre F3A — the wall rows still force their elite on the doctrine arm.
      expect(wallRows.find((w) => w.id === 'wall-king')!.args).toContain('--encounter=bandit-king');
      expect(wallRows.find((w) => w.id === 'wall-queen')!.args).toContain('--encounter=banditQueen');
    });

    it('the 4 ceiling deltas pair each control with its primary (paired seeds, ±8pt reference)', () => {
      const pairs = [
        ['ceiling-regen', 'arb-regen', 'regen'],
        ['ceiling-deploy', 'arb-deploy', 'deploy'],
        ['ceiling-walk-regen', 'arb-walk-regen', 'walk-regen'],
        ['ceiling-walk-deploy', 'arb-walk-deploy', 'walk-deploy'],
      ] as const;
      for (const [id, a, b] of pairs) {
        const delta = board.deltas.find((d) => d.id === id)!;
        expect(delta.a).toBe(a);
        expect(delta.b).toBe(b);
        expect(delta.metric).toBe('winRate');
        expect(delta.paired).toBe(true); // 150b — on the seeds both rows ran
        expect(delta.grade).toBe('reference');
        expect(delta.min).toBeCloseTo(-0.08);
        expect(delta.max).toBeCloseTo(0.08);
      }
      // The fire channel's two doctrine rows run the same 40 seeds, so it
      // stays a whole-row delta.
      expect(board.deltas.find((d) => d.id === 'fire-channel')?.paired).toBeUndefined();
      expect(board.deltas).toHaveLength(pairs.length + 1); // + the fire channel
      expect(board.deltas.find((d) => d.id === 'arb-fire-channel')).toBeUndefined();
    });

    it('a primary and its control share shape: same args minus the arm flags (the paired-seed contract)', () => {
      // 85g6d — the arb arm carries BOTH arbitration flags now (--arbitrate
      // + the signed --prior-lambda=0.5); the paired contract strips the
      // pair, not just the gate.
      const armOnly = new Set(['--arbitrate', '--prior-lambda=0.5']);
      for (const [ctrl, arb] of [
        ['regen', 'arb-regen'],
        ['deploy', 'arb-deploy'],
        ['walk-regen', 'arb-walk-regen'],
        ['walk-deploy', 'arb-walk-deploy'],
      ] as const) {
        const c = board.instruments.find((i) => i.id === ctrl)!;
        const p = board.instruments.find((i) => i.id === arb)!;
        expect(p.args.filter((a) => !armOnly.has(a))).toEqual([...c.args]);
      }
    });
  });
});

describe('94h-pre — pacingMetricsOf: the pacing DRIFT metrics off pacing.csv', () => {
  const CSV =
    'key,kind,instances,wonInstances,turns,turnsPerInstance,turnsPerWonInstance,enemyBurnPerTurn,playerCostPerTurn,playerCostPerInstance,capTurns,capShare\n' +
    'brigands,normal,10,10,30,3.0000,3.0000,7.0000,2.0000,6.0000,0,0.0000\n' +
    'normal,normal,10,10,30,3.0000,2.9500,7.0000,2.0000,6.0000,0,0.0000\n' +
    'elite,elite,4,0,9,2.2500,0.0000,4.0000,6.0000,13.5000,2,0.2222\n' +
    'boss,boss,3,2,16,5.3333,5.7500,7.0000,3.0000,16.0000,0,0.0000\n' +
    'all,all,17,12,55,3.2353,3.4167,6.5455,2.9455,9.5294,2,0.0364\n';

  it('reads the KIND rows (never the encounter rows); a kind with no won instance is null (a checked null fails the verdict closed)', () => {
    expect(pacingMetricsOf(CSV)).toEqual({ pacingNormal: 2.95, pacingElite: null, pacingBoss: 5.75 });
  });

  it('a missing kind row is null; an empty file is all null', () => {
    expect(pacingMetricsOf(CSV.split('\n').filter((l) => !l.startsWith('boss,')).join('\n'))).toEqual({
      pacingNormal: 2.95,
      pacingElite: null,
      pacingBoss: null,
    });
    expect(pacingMetricsOf('')).toEqual({ pacingNormal: null, pacingElite: null, pacingBoss: null });
  });
});

describe('143b — the seams and the acts: per-act reach and walls, a seam per seam', () => {
  // The base columns the parse needs, then the 143b three. Each row:
  // outcome, finalHop, sectorsCleared, startAct, the seams, the boss hops.
  const HEAD =
    'seed,strategy,outcome,finalHop,sectorsCleared,portPurchases,finalBits,packetsFired,poolAtSectorEnd,startAct,poolAtSectorClears,sectorBossHops';
  const csvOf = (rows: readonly (readonly [string, number, number, number, string, string])[]): string =>
    [
      HEAD,
      ...rows.map(([outcome, hop, sc, act, clears, bosses], i) =>
        [i + 1, 's', outcome, hop, sc, 0, 0, 0, clears.split('|')[0] ?? '', act, clears, bosses].join(','),
      ),
    ].join('\n');
  // Three acts whose bosses stand at hops 10, 8 and 10, worked by hand:
  // act 1: 6 of 8 reach its boss, 1 dies there; act 2: 4 reach, 1 dies;
  // act 3: 2 reach, 1 dies. Row 7 dies late in act 1, at hop 9, past act
  // 2's boss hop: it is no arrival there (gotcha #120).
  const THREE_ACTS = csvOf([
    ['complete', 10, 2, 1, '20|18', '10|8|10'],
    ['defeat', 10, 2, 1, '15|12', '10|8|10'],
    ['defeat', 3, 2, 1, '16|14', '10|8|10'],
    ['defeat', 8, 1, 1, '22', '10|8'],
    ['defeat', 4, 1, 1, '10', '10|8'],
    ['defeat', 10, 0, 1, '', '10'],
    ['defeat', 9, 0, 1, '', '10'],
    ['defeat', 2, 0, 1, '', '10'],
  ]);

  it('reads every act at its own boss, and every seam', () => {
    const m = computeMetrics(parseSummaryCsv(THREE_ACTS));
    expect(m.acts).toEqual([
      { act: 1, bossHop: 10, arrivals: 6, reach: 6 / 8, wall: 1 / 6 },
      { act: 2, bossHop: 8, arrivals: 4, reach: 4 / 8, wall: 1 / 4 },
      { act: 3, bossHop: 10, arrivals: 2, reach: 2 / 8, wall: 1 / 2 },
    ]);
    expect(m.seams).toEqual([
      { act: 1, crossed: 5, pool: 83 / 5 },
      { act: 2, crossed: 3, pool: 44 / 3 },
    ]);
  });

  it("the last act's pair is the terminal's, and the first seam is seamPool", () => {
    const m = computeMetrics(parseSummaryCsv(THREE_ACTS));
    const last = m.acts[m.acts.length - 1]!;
    expect(last.reach).toBe(m.terminalReach);
    expect(last.wall).toBe(m.bossWall);
    expect(m.seams[0]!.pool).toBe(m.seamPool);
  });

  it('a run started at act 2 reads as act 2 and on, in a full walk’s numbering', () => {
    const m = computeMetrics(
      parseSummaryCsv(
        csvOf([
          ['complete', 10, 1, 2, '12', '8|10'],
          ['defeat', 8, 0, 2, '', '8'],
        ]),
      ),
    );
    expect(m.acts).toEqual([
      { act: 2, bossHop: 8, arrivals: 2, reach: 1, wall: 1 / 2 },
      { act: 3, bossHop: 10, arrivals: 1, reach: 1 / 2, wall: 0 },
    ]);
    expect(m.seams).toEqual([{ act: 2, crossed: 1, pool: 12 }]);
  });

  it('runs that disagree on a boss hop leave that act unread', () => {
    const m = computeMetrics(
      parseSummaryCsv(
        csvOf([
          ['defeat', 10, 0, 1, '', '10'],
          ['defeat', 9, 0, 1, '', '9'],
        ]),
      ),
    );
    expect(m.acts).toEqual([{ act: 1, bossHop: null, arrivals: 0, reach: null, wall: null }]);
  });

  it('a batch before the columns: act 1 from the old fields, the winners’ act alone', () => {
    // The module's CSV fixture: one sector, no 143b columns.
    const rows = parseSummaryCsv(CSV);
    expect(rows[0]!.startAct).toBe(1);
    expect(rows[0]!.poolAtSectorClears).toBeNull();
    expect(rows[0]!.sectorBossHops).toBeNull();
    const m = computeMetrics(rows.filter((r) => r.strategy === 'scored:59-regen-vector'));
    expect(m.acts).toEqual([{ act: 1, bossHop: 11, arrivals: 3, reach: m.terminalReach, wall: m.bossWall }]);
    // A two-act batch before the columns: the seam from poolAtSectorEnd.
    const oldWalk = [
      'seed,strategy,outcome,finalHop,sectorsCleared,portPurchases,finalBits,packetsFired,poolAtSectorEnd',
      '1,s,complete,10,1,0,0,0,17',
      '2,s,defeat,10,0,0,0,0,',
    ].join('\n');
    const w = computeMetrics(parseSummaryCsv(oldWalk));
    expect(w.seams).toEqual([{ act: 1, crossed: 1, pool: 17 }]);
    expect(w.acts).toEqual([{ act: 2, bossHop: 10, arrivals: 1, reach: 1 / 2, wall: 0 }]);
  });
});

describe('143d — the board per act: the sheet by act number, the forced bosses at their act', () => {
  const sheet = loadSignedSheet();
  const LIVE = sectorPositions(SECTOR_MAP);
  // A walk with a new sector in front: the shipped two move to acts 2 and 3.
  // Its id names no sector, so the front pools none of the board's bosses.
  const FRONTED = ['a-sector-in-front', ...LIVE];
  const metrics = (over: Partial<InstrumentMetrics>): InstrumentMetrics => ({
    runs: 40,
    winRate: 0.3,
    bossWall: 0.32,
    terminalReach: 0.45,
    seamPool: 17,
    transactionRate: 0,
    terminalBank: 0,
    firesPerRun: 0,
    pacingNormal: 3,
    pacingElite: 4.5,
    pacingBoss: 5.5,
    seams: [],
    acts: [],
    ...over,
  });

  it("each forced boss's act is its sector's place in the walk", () => {
    expect(LIVE).toEqual(['the-periphery', 'the-start', 'the-deep-end']);
    expect(homeActOf('bandit-king', LIVE)).toBe(1);
    expect(homeActOf('generalissimo', LIVE)).toBe(2);
    expect(homeActOf('banditQueen', LIVE)).toBe(3);
    expect(homeActOf('banditQueen', FRONTED)).toBe(4);
    expect(() => homeActOf('not-a-boss', LIVE)).toThrow(/0 sectors/);
    expect(() => homeActOf('generalissimo', ['the-start', 'the-start'])).toThrow(/2 sectors/);
  });

  it('a sector in front moves the forced-boss rows alone, by --act; act 1 keeps no flag', () => {
    const live = buildBoard(sheet, LIVE);
    const fronted = buildBoard(sheet, FRONTED);
    const actFlag = (args: readonly string[]): string | undefined => args.find((a) => a.startsWith('--act'));
    // On the live walk the King's row is in act 1, with no flag, and the
    // Queen's in act 3.
    for (const inst of live.instruments) {
      expect(actFlag(inst.args), inst.id).toBe(inst.id === 'wall-queen' ? '--act=3' : undefined);
    }
    for (const inst of fronted.instruments) {
      const was = live.instruments.find((i) => i.id === inst.id)!;
      if (inst.id === 'wall-king') {
        expect(inst.args).toEqual([...was.args.slice(0, 2), '--act=2', ...was.args.slice(2)]);
      } else if (inst.id === 'wall-queen') {
        expect(inst.args).toEqual(was.args.map((a) => (a === '--act=3' ? '--act=4' : a)));
      } else {
        expect(inst.args).toEqual(was.args);
      }
    }
  });

  it("act 1's refs alone: a sheet with another act's, or without act 1's, is refused", () => {
    const act1 = sheet.acts['1']!;
    expect(() => buildBoard({ ...sheet, acts: { 1: act1, 2: act1 } }, LIVE)).toThrow(/act 1 only/);
    expect(() => buildBoard({ ...sheet, acts: { 2: act1 } }, LIVE)).toThrow(/act 1 only/);
  });

  it("a signed wall or seam past act 1 is checked at that act's entry, and reads N/A without one", () => {
    const board = buildBoard(
      { ...sheet, seams: { ...sheet.seams, 2: { min: 0.3, max: 0.35 } }, walls: { 2: { min: 0.2, max: 0.3 } } },
      LIVE,
    );
    const walk = board.instruments.find((i) => i.id === 'arb-walk-deploy')!;
    const wall = walk.checks.find((c) => c.metric === 'actWall')!;
    const seam2 = walk.checks.find((c) => c.metric === 'seam' && c.act === 2)!;
    expect(wall.act).toBe(2);
    expect(checkLabel(wall)).toBe('wall (act 2)');
    const m = metrics({
      seams: [
        { act: 1, crossed: 30, pool: 17 },
        { act: 2, crossed: 20, pool: 0.32 * HEALTH.playerHealthMax },
      ],
      acts: [
        { act: 1, bossHop: 10, arrivals: 30, reach: 0.75, wall: 0.9 },
        { act: 2, bossHop: 10, arrivals: 20, reach: 0.5, wall: 0.25 },
      ],
    });
    expect(checkValue(m, wall)).toBe(0.25);
    expect(checkValue(m, seam2)).toBeCloseTo(0.32 * HEALTH.playerHealthMax);
    const row = evaluateBoard(board, new Map([['arb-walk-deploy', m]])).rows.find(
      (r) => r.instrument === 'arb-walk-deploy' && r.metric === 'wall (act 2)',
    );
    expect(row?.status).toBe('PASS');
    expect(checkValue(metrics({}), seam2)).toBeNull();
  });
});

describe("the report's line for the sheet's history", () => {
  // The expectation is read off the raw file, not through the loader.
  const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'signed-sheet.json'), 'utf8')) as {
    signedAt: string;
  };
  const separators = raw.signedAt.match(/ ⭑ /g)?.length ?? 0;
  const lastEntry = raw.signedAt.slice(raw.signedAt.lastIndexOf(' ⭑ ') + 3);
  const lastTitle = lastEntry.slice(0, lastEntry.indexOf(': '));
  const secondEntry = raw.signedAt.split(' ⭑ ')[1]!;

  it("names the shipped sheet's count and its last entry, and leaves the history out", () => {
    const line = sheetProvenance(raw.signedAt);
    expect(separators).toBeGreaterThan(0);
    expect(lastTitle.length).toBeGreaterThan(0);
    expect(line).toContain(`${separators + 1} entries`);
    expect(line).toContain(`the last ${lastTitle}`);
    expect(line).not.toContain(secondEntry.slice(0, secondEntry.indexOf(': ')));
    expect(line.length).toBeLessThan(400);
  });

  it('one entry, and an entry with no title', () => {
    expect(sheetProvenance('2026-01-01, §1: the first')).toBe('1 entry: 2026-01-01, §1');
    expect(sheetProvenance(`a: one ⭑ ${'x'.repeat(150)}`)).toBe(
      `2 entries, the first a, the last ${'x'.repeat(100)}…; the history is the sheet's signedAt`,
    );
  });
});
