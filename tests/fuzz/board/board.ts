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
 *   user-signed band (FAIL when outside); `reference` = an observed value
 *   ± a tolerance (WARN when outside — a drift tell, not a verdict).
 *   **Post-68d (user-signed 2026-07-27) the whole board is
 *   reference-grade BY DESIGN**: the act-1 rows are DRIFT DETECTORS
 *   pinned at the 68d observed values (±8pt paired noise), and the
 *   DESIGN band lives on the two-act shape — declared 55–70 at 68d, to
 *   be SIGNED (flipped to `signed` grade) at the post-tuning verify once
 *   §68e/f land. The §60e 60–67 act-1 band is retired with its world.
 *
 * - **Instrument shapes are part of the label** (Protocol v2): the act-1
 *   rows are `--hops=11` (the §60e continuity shape, a bounded
 *   single-sector probe); the `walk-*` rows are the full two-act walk —
 *   the canonical post-67 game. In-sample seeds 1..40, the extended
 *   realistic arm, one forced character per instrument. Character parity
 *   is a signed design principle (DESIGN.md §Run structure): the
 *   per-character rows exist to catch parity drift, and the Gambler rows
 *   are PROVISIONAL pending the §68f ronin/reaver buff.
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
  /** The 68d-signed design principle the per-character rows enforce. */
  readonly characterParity: string;
  /** The DESIGN target for the two-act shape — declared at 68d, flips to
   *  `signed` grade at the §68e/f post-tuning verify. */
  readonly twoActTargetWinRate: SheetBand;
  /** The migrated 30–35 wall target — now the DEEP-END terminal's. */
  readonly deepEndWallTarget: SheetBand;
  /** Act-1 continuity drift references (68d observed; ±8pt paired noise). */
  readonly act1WinRefs: Readonly<
    Record<'soldier' | 'priest' | 'gambler', { readonly regen: number; readonly pre55: number }>
  >;
  readonly gamblerNote: string;
  readonly bankRefs: { readonly firer: number; readonly shopper: number };
  readonly firerFiresPerRun: number;
  readonly shopperTransactionRate: number;
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

/** The extended realistic arm (§60c doctrine) + the instrument shapes. */
const ARM = ['--searcher', '--audition', '--redraw=level:2', '--empower=level:hi'];
const ACT1 = ['--count=40', '--hops=11']; // the §60e continuity shape
const WALK = ['--count=40']; // the canonical two-act walk (no hop dial)
const REGEN = '--strategy=tests/fuzz/fixtures/59-regen-vector.json';
const PRE55 = '--strategy=tests/fuzz/fixtures/55pre-vector.json';
const ABLATED = '--strategy=tests/fuzz/fixtures/60-fire-ablated-vector.json';
/** 68d — the paired-noise width the act-1 drift references carry. */
const WIN_TOL = 0.08;
const BANK_TOL = 15;

function ref(metric: MetricKey, value: number, tol: number, source: string): BoardCheck {
  return { metric, grade: 'reference', min: value - tol, max: value + tol, source };
}

/** One act-1 posture instrument for a character (the drift-detector rows). */
function act1Posture(
  character: 'soldier' | 'priest' | 'gambler',
  posture: 'regen' | 'pre55',
  sheet: SignedSheet,
): BoardInstrument {
  const vector = posture === 'regen' ? REGEN : PRE55;
  const strategyRow = posture === 'regen' ? 'scored:59-regen-vector' : 'scored:55pre-vector';
  const provisional = character === 'gambler' ? ` [${sheet.gamblerNote}]` : '';
  const winSource = `68d drift ref (act-1 observed ±8)${provisional}`;
  const checks: BoardCheck[] = [
    ref('winRate', sheet.act1WinRefs[character][posture], WIN_TOL, winSource),
  ];
  // The posture-economy references ride the SOLDIER rows only — the
  // character rows are parity detectors, one number each.
  if (character === 'soldier' && posture === 'regen') {
    checks.push(
      ref('terminalBank', sheet.bankRefs.firer, BANK_TOL, '68d: the firer banks ~68'),
      ref('firesPerRun', sheet.firerFiresPerRun, 1.0, '68d: 2.98 fires/run post-68a'),
      ref('transactionRate', 0, 0.1, '§60e posture split (accepted): the firer buys ~never'),
    );
  }
  if (character === 'soldier' && posture === 'pre55') {
    checks.push(
      ref('terminalBank', sheet.bankRefs.shopper, BANK_TOL, '68d: the shopper spends down to ~50'),
      ref('transactionRate', sheet.shopperTransactionRate, 0.15, '§60e/68d: tx ~40% shopper'),
      ref('firesPerRun', 0, 0.5, '§60e posture split (accepted): the shopper fires ~never'),
    );
  }
  const id = character === 'soldier' ? posture.replace('pre55', '55pre') : `${character}-${posture.replace('pre55', '55pre')}`;
  return {
    id,
    title: `${character} ${posture === 'regen' ? 'firer' : 'shopper'} (act-1 drift ref)`,
    args: [...ACT1, `--character=${character}`, vector, ...ARM],
    strategyRow,
    checks,
  };
}

/** One two-act walk instrument — the DESIGN-target rows (target declared at
 *  68d, flips to `signed` at the §68e/f post-tuning verify). */
function walkPosture(posture: 'regen' | 'pre55', sheet: SignedSheet): BoardInstrument {
  const vector = posture === 'regen' ? REGEN : PRE55;
  return {
    id: `walk-${posture.replace('pre55', '55pre')}`,
    title: `two-act ${posture === 'regen' ? 'firer' : 'shopper'} (the design-target shape)`,
    args: [...WALK, '--character=soldier', vector, ...ARM],
    strategyRow: posture === 'regen' ? 'scored:59-regen-vector' : 'scored:55pre-vector',
    checks: [
      {
        metric: 'winRate',
        grade: 'reference',
        min: sheet.twoActTargetWinRate.min,
        max: sheet.twoActTargetWinRate.max,
        source: '68d DECLARED design target 55–70 — signs at the post-tuning verify',
      },
      {
        metric: 'bossWall',
        grade: 'reference',
        min: sheet.deepEndWallTarget.min,
        max: sheet.deepEndWallTarget.max,
        source: '68d: the 30–35 wall target migrated to the deep-end terminal',
      },
    ],
  };
}

export function buildBoard(sheet: SignedSheet = loadSignedSheet()): Board {
  const instruments: BoardInstrument[] = [
    act1Posture('soldier', 'regen', sheet),
    act1Posture('soldier', 'pre55', sheet),
    {
      id: 'fire-ablated',
      title: 'the fire-channel control (60 ablated vector)',
      args: [...ACT1, '--character=soldier', ABLATED, ...ARM],
      strategyRow: 'scored:60-fire-ablated-vector',
      checks: [],
    },
    {
      id: 'wall-king',
      title: 'forced Bandit King (regen vector)',
      args: [...ACT1, '--character=soldier', '--encounter=bandit-king', REGEN, ...ARM],
      strategyRow: 'scored:59-regen-vector',
      checks: [ref('winRate', sheet.forcedKingWinRegen, 0.1, '68d per-boss: King 72.5 (regen)')],
    },
    {
      id: 'wall-queen',
      title: 'forced Bandit Queen (regen vector)',
      args: [...ACT1, '--character=soldier', '--encounter=banditQueen', REGEN, ...ARM],
      strategyRow: 'scored:59-regen-vector',
      checks: [
        ref('winRate', sheet.forcedQueenWinRegen, 0.1, '68d per-boss: Queen 65.0 (regen) — the order FLIPPED vs §60e'),
      ],
    },
    act1Posture('priest', 'regen', sheet),
    act1Posture('priest', 'pre55', sheet),
    act1Posture('gambler', 'regen', sheet),
    act1Posture('gambler', 'pre55', sheet),
    walkPosture('regen', sheet),
    walkPosture('pre55', sheet),
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
      source: '68d: fire Δ +12.5 post-68a (was §60e +5)',
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
