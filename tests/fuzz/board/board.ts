/**
 * 68c — THE EXECUTABLE BOARD: the pinned doctrine instrument set + the
 * diff-vs-signed-sheet evaluation, as data + pure functions. "Re-run the
 * full board" (the §55/§56 doctrine's amendment rule) becomes a command
 * instead of a ritual: `npm run balance:board -- --plan | --run | --report`.
 *
 * Three deliberate design points:
 *
 * - **The board runs the fuzz CLI, it doesn't reimplement it.** Each
 *   instrument is an argv; `--run` spawns the same `tests/fuzz/cli.ts`
 *   entry a hand batch uses (each into its own `--out` dir), and `--plan`
 *   prints the commands for the box path (box-batch.sh stays the only box
 *   driver — the plan is what you feed it). `--report` only READS
 *   summary.csv files, so a box batch's pulled-down output reports the
 *   same way a local run does.
 *
 * - **Check grades are honest about what's signed.** `signed` = a
 *   user-signed band (FAIL when outside); `reference` = the sheet's
 *   observed value ± a tolerance (WARN when outside — a drift tell, not a
 *   verdict). At 68c every per-instrument check except the in-sample
 *   win-rate band is reference-grade: the §60e sheet was signed on the
 *   PRE-67 single-sector world, and the whole point of the 68d re-baseline
 *   is to re-sign these numbers per character. 68d flips grades/values in
 *   signed-sheet.json — the board is the form 68d fills in.
 *
 * - **The v1 instrument shape is the §60e CONTINUITY shape**: in-sample
 *   seeds 1..40, `--hops=11` (the pre-67 full length, now the bounded
 *   single-sector probe), the extended realistic arm, explicit Soldier.
 *   The post-67 canonical "full game" (the two-act walk) gets its own
 *   instruments when 68d signs their bands — don't silently re-shape a
 *   continuity instrument.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- the signed sheet (the user-signed artifact, 68d re-signs) ------------

export interface SheetBand {
  readonly min: number;
  readonly max: number;
}

export interface SignedSheet {
  /** Provenance line printed on every report (who signed, where, when). */
  readonly signedAt: string;
  readonly winRateInSample: SheetBand;
  readonly bossWallTarget: SheetBand;
  readonly terminalBank: SheetBand;
  readonly heldOutWinRate: number;
  readonly shopperTransactionRate: number;
  readonly firerFiresPerRun: number;
  readonly fireChannelDelta: number;
  readonly forcedKingWinRegen: number;
  readonly forcedQueenWinRegen: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadSignedSheet(path = join(HERE, 'signed-sheet.json')): SignedSheet {
  return JSON.parse(readFileSync(path, 'utf8')) as SignedSheet;
}

// ---- the board definition -------------------------------------------------

export type MetricKey =
  | 'winRate'
  | 'bossWall'
  | 'transactionRate'
  | 'terminalBank'
  | 'firesPerRun';

export interface BoardCheck {
  readonly metric: MetricKey;
  /** `signed` = FAIL outside the band; `reference` = WARN outside (drift tell). */
  readonly grade: 'signed' | 'reference';
  readonly min: number;
  readonly max: number;
  /** Where the number comes from — printed on the report row. */
  readonly source: string;
}

export interface BoardInstrument {
  readonly id: string;
  readonly title: string;
  /** fuzz-CLI argv, WITHOUT `--out`/`--jobs` (the runner appends those). */
  readonly args: readonly string[];
  /** The summary.csv `strategy` column value this instrument reads. */
  readonly strategyRow: string;
  readonly checks: readonly BoardCheck[];
}

/** A cross-instrument delta check (channel ablations): metric(a) − metric(b). */
export interface BoardDelta {
  readonly id: string;
  readonly title: string;
  readonly metric: MetricKey;
  readonly a: string;
  readonly b: string;
  readonly grade: 'signed' | 'reference';
  readonly min: number;
  readonly max: number;
  readonly source: string;
}

export interface Board {
  readonly instruments: readonly BoardInstrument[];
  readonly deltas: readonly BoardDelta[];
  readonly sheet: SignedSheet;
}

/** The extended realistic arm (§60c doctrine) + the 68c continuity shape. */
const ARM = ['--searcher', '--audition', '--redraw=level:2', '--empower=level:hi'];
const SHAPE = ['--count=40', '--hops=11', '--character=soldier'];
const REGEN = '--strategy=tests/fuzz/fixtures/59-regen-vector.json';
const PRE55 = '--strategy=tests/fuzz/fixtures/55pre-vector.json';
const ABLATED = '--strategy=tests/fuzz/fixtures/60-fire-ablated-vector.json';

function ref(metric: MetricKey, value: number, tol: number, source: string): BoardCheck {
  return { metric, grade: 'reference', min: value - tol, max: value + tol, source };
}

export function buildBoard(sheet: SignedSheet = loadSignedSheet()): Board {
  const winBand: BoardCheck = {
    metric: 'winRate',
    grade: 'signed',
    min: sheet.winRateInSample.min,
    max: sheet.winRateInSample.max,
    source: '§60e signed: in-sample 60–67',
  };
  const wallRef: BoardCheck = {
    metric: 'bossWall',
    grade: 'reference',
    min: sheet.bossWallTarget.min,
    max: sheet.bossWallTarget.max,
    source: '§60e band 30–35 (measured 26–33, accepted — reference until 68d)',
  };
  const bankRef: BoardCheck = {
    metric: 'terminalBank',
    grade: 'reference',
    min: sheet.terminalBank.min,
    max: sheet.terminalBank.max,
    source: '§60e: bank 60–85 idle-high accepted',
  };
  const instruments: BoardInstrument[] = [
    {
      id: 'regen',
      title: 'the firer posture (59-regen vector)',
      args: [...SHAPE, REGEN, ...ARM],
      strategyRow: 'scored:59-regen-vector',
      checks: [
        winBand,
        wallRef,
        bankRef,
        ref('firesPerRun', sheet.firerFiresPerRun, 1.0, '§60e: 1.93 fires/run guard-timed'),
        ref('transactionRate', 0, 0.1, '§60e: the firer buys ~never (posture split accepted)'),
      ],
    },
    {
      id: '55pre',
      title: 'the shopper posture (55pre vector)',
      args: [...SHAPE, PRE55, ...ARM],
      strategyRow: 'scored:55pre-vector',
      checks: [
        winBand,
        wallRef,
        bankRef,
        ref('transactionRate', sheet.shopperTransactionRate, 0.15, '§60e: tx ~40% at the shopper'),
        ref('firesPerRun', 0, 0.5, '§60e: the shopper fires ~never (posture split accepted)'),
      ],
    },
    {
      id: 'fire-ablated',
      title: 'the fire-channel control (60 ablated vector)',
      args: [...SHAPE, ABLATED, ...ARM],
      strategyRow: 'scored:60-fire-ablated-vector',
      checks: [],
    },
    {
      id: 'wall-king',
      title: 'forced Bandit King (regen vector)',
      args: [...SHAPE, '--encounter=bandit-king', REGEN, ...ARM],
      strategyRow: 'scored:59-regen-vector',
      checks: [
        ref('winRate', sheet.forcedKingWinRegen, 0.1, '§60e per-boss: King 65.0 (regen)'),
      ],
    },
    {
      id: 'wall-queen',
      title: 'forced Bandit Queen (regen vector)',
      args: [...SHAPE, '--encounter=banditQueen', REGEN, ...ARM],
      strategyRow: 'scored:59-regen-vector',
      checks: [
        ref('winRate', sheet.forcedQueenWinRegen, 0.1, '§60e per-boss: Queen 70.0 (regen)'),
      ],
    },
  ];
  const deltas: BoardDelta[] = [
    {
      id: 'fire-channel',
      title: 'fire channel (regen − ablated win rate)',
      metric: 'winRate',
      a: 'regen',
      b: 'fire-ablated',
      grade: 'reference',
      min: sheet.fireChannelDelta - 0.05,
      max: sheet.fireChannelDelta + 0.05,
      source: '§60e: fire ≈ +5pt guard-timed, non-stacking',
    },
  ];
  return { instruments, deltas, sheet };
}

// ---- summary.csv → metrics ------------------------------------------------

export interface InstrumentMetrics {
  readonly runs: number;
  readonly winRate: number;
  /** Defeats among terminal-hop arrivals ÷ arrivals (the §60e wall
   *  arithmetic); null when no run won (the terminal hop is unknowable). */
  readonly bossWall: number | null;
  readonly transactionRate: number;
  readonly terminalBank: number;
  readonly firesPerRun: number;
}

interface SummaryRow {
  readonly strategy: string;
  readonly outcome: string;
  readonly finalHop: number;
  readonly portPurchases: number;
  readonly finalBits: number;
  readonly packetsFired: number;
}

/** Parse summary.csv by HEADER NAME (never position — columns append). */
export function parseSummaryCsv(text: string): SummaryRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 1) return [];
  const header = lines[0]!.split(',');
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`summary.csv: missing column '${name}'`);
    return i;
  };
  const [strategy, outcome, finalHop, port, bits, fired] = [
    col('strategy'),
    col('outcome'),
    col('finalHop'),
    col('portPurchases'),
    col('finalBits'),
    col('packetsFired'),
  ];
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    return {
      strategy: cells[strategy] ?? '',
      outcome: cells[outcome] ?? '',
      finalHop: Number(cells[finalHop]),
      portPurchases: Number(cells[port]),
      finalBits: Number(cells[bits]),
      packetsFired: Number(cells[fired]),
    };
  });
}

export function computeMetrics(rows: readonly SummaryRow[]): InstrumentMetrics {
  const n = rows.length;
  if (n === 0) {
    return { runs: 0, winRate: 0, bossWall: null, transactionRate: 0, terminalBank: 0, firesPerRun: 0 };
  }
  const wins = rows.filter((r) => r.outcome === 'complete');
  // §60e wall arithmetic: the terminal hop is where winners end; arrivals =
  // rows that reached it; the wall = the fraction of arrivals that died there.
  let bossWall: number | null = null;
  if (wins.length > 0) {
    const terminalHop = Math.max(...wins.map((r) => r.finalHop));
    const arrivals = rows.filter((r) => r.finalHop >= terminalHop);
    const deaths = arrivals.filter((r) => r.outcome === 'defeat').length;
    bossWall = arrivals.length === 0 ? null : deaths / arrivals.length;
  }
  const mean = (f: (r: SummaryRow) => number): number => rows.reduce((a, r) => a + f(r), 0) / n;
  return {
    runs: n,
    winRate: wins.length / n,
    bossWall,
    transactionRate: rows.filter((r) => r.portPurchases > 0).length / n,
    terminalBank: mean((r) => r.finalBits),
    firesPerRun: mean((r) => r.packetsFired),
  };
}

// ---- evaluation -----------------------------------------------------------

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'N/A';

export interface ReportRow {
  readonly instrument: string;
  readonly metric: string;
  readonly value: number | null;
  readonly band: string;
  readonly grade: 'signed' | 'reference';
  readonly status: CheckStatus;
  readonly source: string;
}

export interface BoardReport {
  readonly rows: readonly ReportRow[];
  readonly missing: readonly string[]; // instruments with no summary.csv
  readonly fails: number;
  readonly warns: number;
}

function statusFor(
  value: number | null,
  check: Pick<BoardCheck, 'grade' | 'min' | 'max'>,
): CheckStatus {
  if (value === null) return 'N/A';
  if (value >= check.min && value <= check.max) return 'PASS';
  return check.grade === 'signed' ? 'FAIL' : 'WARN';
}

export function evaluateBoard(
  board: Board,
  metricsById: ReadonlyMap<string, InstrumentMetrics>,
): BoardReport {
  const rows: ReportRow[] = [];
  const missing: string[] = [];
  for (const inst of board.instruments) {
    const m = metricsById.get(inst.id);
    if (m === undefined) {
      if (inst.checks.length > 0 || board.deltas.some((d) => d.a === inst.id || d.b === inst.id)) {
        missing.push(inst.id);
      }
      continue;
    }
    for (const check of inst.checks) {
      const value = m[check.metric];
      rows.push({
        instrument: inst.id,
        metric: check.metric,
        value,
        band: `[${check.min.toFixed(2)}, ${check.max.toFixed(2)}]`,
        grade: check.grade,
        status: statusFor(value, check),
        source: check.source,
      });
    }
  }
  for (const d of board.deltas) {
    const a = metricsById.get(d.a)?.[d.metric];
    const b = metricsById.get(d.b)?.[d.metric];
    const value = a === undefined || b === undefined || a === null || b === null ? null : a - b;
    rows.push({
      instrument: d.id,
      metric: `Δ ${d.metric} (${d.a}−${d.b})`,
      value,
      band: `[${d.min.toFixed(2)}, ${d.max.toFixed(2)}]`,
      grade: d.grade,
      status: statusFor(value, d),
      source: d.source,
    });
  }
  return {
    rows,
    missing,
    fails: rows.filter((r) => r.status === 'FAIL').length,
    warns: rows.filter((r) => r.status === 'WARN').length,
  };
}

// ---- rendering ------------------------------------------------------------

export function renderReport(report: BoardReport, board: Board): string {
  const lines: string[] = [];
  lines.push(`BALANCE BOARD — vs the signed sheet (${board.sheet.signedAt})`);
  lines.push('');
  const pad = (s: string, w: number): string => s.padEnd(w);
  lines.push(
    `${pad('instrument', 14)}${pad('metric', 28)}${pad('value', 9)}${pad('band', 15)}${pad('grade', 11)}${pad('status', 8)}source`,
  );
  for (const r of report.rows) {
    const value = r.value === null ? '—' : r.value.toFixed(3);
    lines.push(
      `${pad(r.instrument, 14)}${pad(r.metric, 28)}${pad(value, 9)}${pad(r.band, 15)}${pad(r.grade, 11)}${pad(r.status, 8)}${r.source}`,
    );
  }
  if (report.missing.length > 0) {
    lines.push('');
    lines.push(`MISSING (no summary.csv found): ${report.missing.join(', ')}`);
  }
  lines.push('');
  lines.push(`${report.fails} FAIL (signed-band breaches) · ${report.warns} WARN (reference drift)`);
  return lines.join('\n') + '\n';
}
