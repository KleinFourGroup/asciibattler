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
  /** 72b (user-signed) — mean pool HP at the act-1→act-2 seam, signed at
   *  measured reality: enter act 2 at ~two-thirds health. */
  readonly seamPoolBand: SheetBand;
  /** 72b (user-signed) — the fraction of runs that reach the terminal
   *  (sector-aware arrivals ÷ runs). THE load-bearing target: it sets
   *  72c's mid-act-2 ambition; signed 40–50 (human overperformance
   *  argues the conservative side). Win rate DERIVES from this × wall —
   *  it is never independently signed (the unified band architecture;
   *  the one-act-era 55–70 band is RETIRED). */
  readonly terminalReachTarget: SheetBand;
  /** 83f (user-signed 2026-08-21) — the 55pre twin's reach REFERENCE,
   *  re-pinned at its measured n=120 level (0.542): three boards of
   *  identical overperformance on the frozen anchor = measured ceiling
   *  drift, closed as the §46b ACCEPT+RE-BASELINE shape. The signed target
   *  above stays the regen twin's band; the vector re-derive is a post-fold
   *  interstitial rider (META-ROADMAP). */
  readonly pre55ReachRef: number;
  /** The 30–35 wall target — RE-SIGNED at 72b for the deep-end terminal
   *  (the §68g crisis was gotcha #120 contamination). */
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
  | 'terminalReach'
  | 'seamPool'
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

/** The extended realistic arm — 72f (user-signed): `--arbitrate` joins the
 *  doctrine flags (the run-layer arbitrated default; cheap tier locked by
 *  the 72f direct test). CONTROL_ARM is the pre-flip heuristic arm the five
 *  doctrine control rows still run (ceiling deltas + the fire channel). */
const ARM = ['--searcher', '--audition', '--redraw=level:2', '--empower=level:hi', '--arbitrate'];
const CONTROL_ARM = ['--searcher', '--audition', '--redraw=level:2', '--empower=level:hi'];
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

/** One act-1 posture PRIMARY for a character (the arb drift-detector rows —
 *  72f: refs re-pinned at the 72f-cycle arb values). The §60e posture-split
 *  checks are RETIRED: the arbitrated arm dissolves postures at the sites it
 *  owns (every row fires ~2, shops ~never), so the soldier rows carry plain
 *  economy refs instead. */
function act1Posture(
  character: 'soldier' | 'priest' | 'gambler',
  posture: 'regen' | 'pre55',
  sheet: SignedSheet,
): BoardInstrument {
  const vector = posture === 'regen' ? REGEN : PRE55;
  const strategyRow =
    posture === 'regen' ? 'arbitrated:scored:59-regen-vector' : 'arbitrated:scored:55pre-vector';
  const provisional = character === 'gambler' ? ` [${sheet.gamblerNote}]` : '';
  const winSource = `83f drift ref (act-1 arb, n=120 pooled, ±8)${provisional}`;
  const checks: BoardCheck[] = [
    ref('winRate', sheet.act1WinRefs[character][posture], WIN_TOL, winSource),
  ];
  // Plain economy refs ride the SOLDIER rows only (one instrument-pair of
  // numbers, not six): bank/fires at observed, tx ≈0 — the posture
  // dissolution is the arm's structure, not a drift to chase.
  if (character === 'soldier' && posture === 'regen') {
    checks.push(
      ref('terminalBank', sheet.bankRefs.firer, BANK_TOL, '83f re-pin: the arb firer banks ~111 (the §82 economy, the 83e ACCEPT; was ~60 at 72f)'),
      ref('firesPerRun', sheet.firerFiresPerRun, 1.0, '83f re-pin: ~1.7 arbitrated fires/run at n=120 (was ~2.15 at 72f)'),
      ref('transactionRate', 0, 0.1, '72f posture dissolution: the arb arm shops ≈never'),
    );
  }
  if (character === 'soldier' && posture === 'pre55') {
    checks.push(
      ref('terminalBank', sheet.bankRefs.shopper, BANK_TOL, '83f re-pin: the arb shopper-vector row banks ~90 (the §82 economy; was ~63 at 72f)'),
      ref('transactionRate', sheet.shopperTransactionRate, 0.1, '72f posture dissolution: the arb arm shops ≈never (the vector still moves in-battle play)'),
      ref('firesPerRun', 2.0, 1.0, '72f: ~2.0 arbitrated fires/run'),
    );
  }
  const base = character === 'soldier' ? posture.replace('pre55', '55pre') : `${character}-${posture.replace('pre55', '55pre')}`;
  return {
    id: `arb-${base}`,
    title: `${character} ${posture === 'regen' ? 'regen' : '55pre'} vector (arb act-1 drift ref)`,
    args: [...ACT1, `--character=${character}`, vector, ...ARM],
    strategyRow,
    checks,
  };
}

/** A doctrine CONTROL row (72f): the pre-flip heuristic arm, no per-row
 *  checks — its value is the paired ceiling deltas + the fire channel. The
 *  full 11-row doctrine set re-enters at the cluster-5 stress test. */
function control(
  id: string,
  title: string,
  args: readonly string[],
  strategyRow: string,
): BoardInstrument {
  return { id, title: `${title} (doctrine control)`, args, strategyRow, checks: [] };
}

/** One two-act walk PRIMARY — the 72b unified-architecture rows on the
 *  arbitrated default (72f signing): seam re-signed 15–18 at arb reality;
 *  reach + wall held; win DERIVES from reach × (1−wall), never
 *  independently signed. Checks stay REFERENCE grade by the 68d design —
 *  the SIGNATURE lives on the sheet; at n=40 a signed-FAIL grade would
 *  trip on ±8pt paired noise (the 72f dose pair measured reach at exactly
 *  the band edge). */
function walkPosture(posture: 'regen' | 'pre55', sheet: SignedSheet): BoardInstrument {
  const vector = posture === 'regen' ? REGEN : PRE55;
  // 83f (user-signed 2026-08-21) — the 55pre twin's reach is RE-PINNED at
  // its measured level as a reference band ±WIN_TOL (see SignedSheet
  // .pre55ReachRef); the regen twin stays on the signed 40–50 target.
  const reachBand =
    posture === 'pre55'
      ? { min: sheet.pre55ReachRef - WIN_TOL, max: sheet.pre55ReachRef + WIN_TOL }
      : { min: sheet.terminalReachTarget.min, max: sheet.terminalReachTarget.max };
  // Balance-proof: the derived band moves with the sheet's pair (the 55pre
  // twin derives from its re-pinned reach band).
  const winDerived = {
    min: reachBand.min * (1 - sheet.deepEndWallTarget.max),
    max: reachBand.max * (1 - sheet.deepEndWallTarget.min),
  };
  const reachSource =
    posture === 'pre55'
      ? `83f RE-PINNED at the measured n=120 reach ${sheet.pre55ReachRef} ±${WIN_TOL} — the 72f/83d/83f overperformance watch CLOSED as ceiling drift on the frozen anchor; the vector re-derive = a post-fold interstitial rider`
      : '72b SIGNED 40–50, HELD at 72f + 83f';
  return {
    id: `arb-walk-${posture.replace('pre55', '55pre')}`,
    title: `two-act ${posture} vector (the design-target shape, arbitrated)`,
    args: [...WALK, '--character=soldier', vector, ...ARM],
    strategyRow:
      posture === 'regen' ? 'arbitrated:scored:59-regen-vector' : 'arbitrated:scored:55pre-vector',
    checks: [
      {
        metric: 'seamPool',
        grade: 'reference',
        min: sheet.seamPoolBand.min,
        max: sheet.seamPoolBand.max,
        source: '72f RE-SIGNED 15–18 at arb reality (patch fires offset drain; the doctrine-arm 13–15 retired with its arm)',
      },
      {
        metric: 'terminalReach',
        grade: 'reference',
        min: reachBand.min,
        max: reachBand.max,
        source: reachSource,
      },
      {
        metric: 'bossWall',
        grade: 'reference',
        min: sheet.deepEndWallTarget.min,
        max: sheet.deepEndWallTarget.max,
        source: '72b SIGNED 30–35, HELD at 72f + 83f (floor-hugging 0.265/0.292 at n=120 ACCEPTED at the held band — the 83d call, carried as the watch)',
      },
      {
        metric: 'winRate',
        grade: 'reference',
        min: winDerived.min,
        max: winDerived.max,
        source: '72b DERIVED reach×(1−wall) — win is never independently signed; 55–70 RETIRED (one-act era)',
      },
    ],
  };
}

export function buildBoard(sheet: SignedSheet = loadSignedSheet()): Board {
  // 72f (user-signed) — THE ARBITRATED DEFAULT: 10 arb primaries carry the
  // checks; 5 doctrine controls ride checkless for the paired ceiling
  // deltas + the fire channel. arb-fire-ablated is DROPPED: on the arb arm
  // fires are rollout-owned, so the ablated vector plays identically to
  // regen (metric-identical at 72f — the +17.5 "substitution" ceiling
  // explained structurally; BALANCE §72f). The full 11-row doctrine set
  // re-enters at the cluster-5 stress test.
  const primaries: BoardInstrument[] = [
    act1Posture('soldier', 'regen', sheet),
    act1Posture('soldier', 'pre55', sheet),
    {
      id: 'arb-wall-king',
      title: 'forced Bandit King (regen vector, arbitrated)',
      args: [...ACT1, '--character=soldier', '--encounter=bandit-king', REGEN, ...ARM],
      strategyRow: 'arbitrated:scored:59-regen-vector',
      checks: [ref('winRate', sheet.forcedKingWinRegen, 0.1, '83f re-pin: King 75.0 (arb regen, n=40; 72f 80.0 → 77f re-pin → 83f)')],
    },
    {
      id: 'arb-wall-queen',
      title: 'forced Bandit Queen (regen vector, arbitrated)',
      args: [...ACT1, '--character=soldier', '--encounter=banditQueen', REGEN, ...ARM],
      strategyRow: 'arbitrated:scored:59-regen-vector',
      checks: [
        ref('winRate', sheet.forcedQueenWinRegen, 0.1, '83f re-pin: Queen 70.0 (arb regen, n=40) — the King>Queen order holds (75.0 > 70.0)'),
      ],
    },
    act1Posture('priest', 'regen', sheet),
    act1Posture('priest', 'pre55', sheet),
    act1Posture('gambler', 'regen', sheet),
    act1Posture('gambler', 'pre55', sheet),
    walkPosture('regen', sheet),
    walkPosture('pre55', sheet),
  ];
  const controls: BoardInstrument[] = [
    control('regen', 'soldier regen vector', [...ACT1, '--character=soldier', REGEN, ...CONTROL_ARM], 'scored:59-regen-vector'),
    control('55pre', 'soldier 55pre vector', [...ACT1, '--character=soldier', PRE55, ...CONTROL_ARM], 'scored:55pre-vector'),
    control('fire-ablated', 'the fire-channel ablation', [...ACT1, '--character=soldier', ABLATED, ...CONTROL_ARM], 'scored:60-fire-ablated-vector'),
    control('walk-regen', 'two-act regen vector', [...WALK, '--character=soldier', REGEN, ...CONTROL_ARM], 'scored:59-regen-vector'),
    control('walk-55pre', 'two-act 55pre vector', [...WALK, '--character=soldier', PRE55, ...CONTROL_ARM], 'scored:55pre-vector'),
  ];
  // The 4 ceiling deltas (arb − doctrine, paired seeds): the cheapest
  // standing read on what arbitration is worth; a WARN = a real move.
  const ceilingDeltas: BoardDelta[] = (
    [
      ['regen', 'arb-regen'],
      ['55pre', 'arb-55pre'],
      ['walk-regen', 'arb-walk-regen'],
      ['walk-55pre', 'arb-walk-55pre'],
    ] as const
  ).map(([ctrl, arb]) => ({
    id: `ceiling-${ctrl}`,
    title: `ceiling move (arb − doctrine win rate, ${ctrl})`,
    metric: 'winRate',
    a: arb,
    b: ctrl,
    grade: 'reference',
    min: -WIN_TOL,
    max: WIN_TOL,
    source: '72f standing control: paired same-seed arb−doctrine; WARN = a real ceiling move',
  }));
  const deltas: BoardDelta[] = [
    {
      id: 'fire-channel',
      title: 'fire channel (regen − ablated win rate, doctrine controls)',
      metric: 'winRate',
      a: 'regen',
      b: 'fire-ablated',
      grade: 'reference',
      min: sheet.fireChannelDelta - 0.05,
      max: sheet.fireChannelDelta + 0.05,
      source: '72f re-sign (user, 2026-08-04): +0.10 — the 72c value buffs REPAIRED the channel (was ≈0 at 68f); doctrine-pair definition, the arb arm reads ≈0 by substitution (structural)',
    },
    ...ceilingDeltas,
  ];
  return { instruments: [...primaries, ...controls], deltas, sheet };
}

// ---- summary.csv → metrics ------------------------------------------------

export interface InstrumentMetrics {
  readonly runs: number;
  readonly winRate: number;
  /** Defeats among terminal-hop arrivals ÷ arrivals (the §60e wall
   *  arithmetic); null when no run won (the terminal hop is unknowable). */
  readonly bossWall: number | null;
  /** 72b — sector-aware terminal arrivals ÷ runs (the signed load-bearing
   *  target); null when no run won. */
  readonly terminalReach: number | null;
  /** 72b — mean poolAtSectorEnd over seam entrants; null when no run
   *  crossed a seam OR the batch predates the 72b-pre columns. */
  readonly seamPool: number | null;
  readonly transactionRate: number;
  readonly terminalBank: number;
  readonly firesPerRun: number;
}

interface SummaryRow {
  readonly strategy: string;
  readonly outcome: string;
  readonly finalHop: number;
  readonly sectorsCleared: number;
  readonly portPurchases: number;
  readonly finalBits: number;
  readonly packetsFired: number;
  /** 72b — pool at the act seam; null pre-seam AND null on batches fetched
   *  before the 72b-pre columns existed (graceful degradation: the seam
   *  metric reads N/A there instead of the parse throwing). */
  readonly poolAtSectorEnd: number | null;
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
  const [strategy, outcome, finalHop, sectors, port, bits, fired] = [
    col('strategy'),
    col('outcome'),
    col('finalHop'),
    col('sectorsCleared'),
    col('portPurchases'),
    col('finalBits'),
    col('packetsFired'),
  ];
  // 72b — optional: pre-72b-pre batches don't carry the pool columns.
  const seam = header.indexOf('poolAtSectorEnd');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const seamCell = seam < 0 ? '' : (cells[seam] ?? '');
    return {
      strategy: cells[strategy] ?? '',
      outcome: cells[outcome] ?? '',
      finalHop: Number(cells[finalHop]),
      sectorsCleared: Number(cells[sectors]),
      portPurchases: Number(cells[port]),
      finalBits: Number(cells[bits]),
      packetsFired: Number(cells[fired]),
      poolAtSectorEnd: seamCell === '' ? null : Number(seamCell),
    };
  });
}

export function computeMetrics(rows: readonly SummaryRow[]): InstrumentMetrics {
  const n = rows.length;
  if (n === 0) {
    return {
      runs: 0,
      winRate: 0,
      bossWall: null,
      terminalReach: null,
      seamPool: null,
      transactionRate: 0,
      terminalBank: 0,
      firesPerRun: 0,
    };
  }
  const wins = rows.filter((r) => r.outcome === 'complete');
  // §60e wall arithmetic, 72b-corrected: the terminal POSITION is
  // LEXICOGRAPHIC (sectorsCleared, finalHop) — finalHop resets per sector
  // (gotcha #120), so the pre-72b bare-hop filter counted late act-1 deaths
  // (hops ≥ the act-2 terminal's number) as terminal arrivals and read the
  // deep-end wall at ~2× its true value (the §68g false alarm). Arrivals =
  // rows at-or-past the winners' (sector, hop); the wall = the fraction of
  // arrivals that died there. Single-sector shapes are unchanged (sc ≡ 0).
  let bossWall: number | null = null;
  let terminalReach: number | null = null;
  if (wins.length > 0) {
    const termSc = Math.max(...wins.map((r) => r.sectorsCleared));
    const termHop = Math.max(
      ...wins.filter((r) => r.sectorsCleared === termSc).map((r) => r.finalHop),
    );
    const arrivals = rows.filter(
      (r) =>
        r.sectorsCleared > termSc ||
        (r.sectorsCleared === termSc && r.finalHop >= termHop),
    );
    const deaths = arrivals.filter((r) => r.outcome === 'defeat').length;
    bossWall = arrivals.length === 0 ? null : deaths / arrivals.length;
    // 72b — the signed load-bearing target: how many runs SEE the terminal.
    terminalReach = arrivals.length / n;
  }
  // 72b — mean seam pool over entrants (null: no seam crossed, or a
  // pre-72b-pre batch without the columns).
  const entrants = rows.filter((r) => r.poolAtSectorEnd !== null);
  const seamPool =
    entrants.length === 0
      ? null
      : entrants.reduce((a, r) => a + (r.poolAtSectorEnd ?? 0), 0) / entrants.length;
  const mean = (f: (r: SummaryRow) => number): number => rows.reduce((a, r) => a + f(r), 0) / n;
  return {
    runs: n,
    winRate: wins.length / n,
    bossWall,
    terminalReach,
    seamPool,
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
