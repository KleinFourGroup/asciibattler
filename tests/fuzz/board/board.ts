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
import { atOrBeyondWalkPos } from '../walkDepth';
import { armSignatureOf, type BatchManifest } from '../manifest';

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
  /** The 30–35 wall target — RE-SIGNED at 72b for the deep-end terminal
   *  (the §68g crisis was gotcha #120 contamination). */
  readonly deepEndWallTarget: SheetBand;
  /** Act-1 continuity drift references (68d observed; ±8pt paired noise).
   *  85g5 (2026-08-26): the `deploy` posture replaces `pre55` — the frozen
   *  55pre anchor retired with its `pre55ReachRef` workaround when the
   *  re-derived vector deployed (`85g5-finalist-56.json`); the deploy
   *  refs carry the last 55pre-anchor values PENDING RE-PIN at the
   *  re-anchor board run. */
  readonly act1WinRefs: Readonly<
    Record<'soldier' | 'priest' | 'gambler', { readonly regen: number; readonly deploy: number }>
  >;
  readonly gamblerNote: string;
  readonly bankRefs: { readonly firer: number; readonly shopper: number };
  readonly firerFiresPerRun: number;
  /** 85g6d — the fold re-activates the port economy (tx ≈0 → real
   *  shopping); both tx refs re-pin at the fold baseline. */
  readonly firerTransactionRate: number;
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
 *  the 72f direct test). 85g6d (user-signed 2026-08-27): `--prior-lambda=0.5`
 *  joins — the fold default, signed on the one-use SIGN bank (paired Δwin
 *  +0.092, z=2.04, the pre-specified Δ>0 criterion; the three-cohort chain
 *  in BALANCE 2026-08-27). CONTROL_ARM is the pre-flip heuristic arm the
 *  five doctrine control rows still run (ceiling deltas + the fire
 *  channel). */
const ARM = ['--searcher', '--audition', '--redraw=level:2', '--empower=level:hi', '--arbitrate', '--prior-lambda=0.5'];
const CONTROL_ARM = ['--searcher', '--audition', '--redraw=level:2', '--empower=level:hi'];
const ACT1 = ['--count=40', '--hops=11']; // the §60e continuity shape
const WALK = ['--count=40']; // the canonical two-act walk (no hop dial)
const REGEN = '--strategy=tests/fuzz/fixtures/59-regen-vector.json';
/** 85g5 (2026-08-26) — the DEPLOYED searched vector twin: the frozen
 *  55pre anchor is retired; a future re-derive swaps this path only
 *  (ids stay `deploy`). */
const DEPLOY = '--strategy=tests/fuzz/fixtures/85g5-finalist-56.json';
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
  posture: 'regen' | 'deploy',
  sheet: SignedSheet,
): BoardInstrument {
  const vector = posture === 'regen' ? REGEN : DEPLOY;
  const strategyRow =
    posture === 'regen'
      ? 'arbitrated:scored:59-regen-vector'
      : 'arbitrated:scored:85g5-finalist-56';
  const provisional = character === 'gambler' ? ` [${sheet.gamblerNote}]` : '';
  const winSource = `85g6d fold-baseline re-pin (act-1 arb λ=0.5, n=120 pooled, ±8)${provisional}`;
  const checks: BoardCheck[] = [
    ref('winRate', sheet.act1WinRefs[character][posture], WIN_TOL, winSource),
  ];
  // Plain economy refs ride the SOLDIER rows only (one instrument-pair of
  // numbers, not six): bank/fires at observed, tx ≈0 — the posture
  // dissolution is the arm's structure, not a drift to chase.
  if (character === 'soldier' && posture === 'regen') {
    checks.push(
      ref('terminalBank', sheet.bankRefs.firer, BANK_TOL, '85g6d re-pin: the fold SPENDS — firer banks ~102 (was ~111 at the λ=0 era)'),
      ref('firesPerRun', sheet.firerFiresPerRun, 1.0, '83f re-pin: ~1.7 arbitrated fires/run, HELD at 85g6d (1.48 in-band)'),
      ref('transactionRate', sheet.firerTransactionRate, 0.1, '85g6d re-pin: the fold RE-ACTIVATES the port economy — the firer shops ~25% (the 72f shops-≈never era closed)'),
    );
  }
  if (character === 'soldier' && posture === 'deploy') {
    checks.push(
      ref('terminalBank', sheet.bankRefs.shopper, BANK_TOL, '85g6d re-pin: the fold SPENDS — the deploy row banks ~70 (was ~90 at the λ=0 era)'),
      ref('transactionRate', sheet.shopperTransactionRate, 0.1, '85g6d re-pin: the fold shops ~78% on the deploy vector (the 72f shops-≈never era closed)'),
      ref('firesPerRun', 2.0, 1.0, '72f: ~2.0 arbitrated fires/run, HELD at 85g6d (1.77 in-band)'),
    );
  }
  const base = character === 'soldier' ? posture : `${character}-${posture}`;
  return {
    id: `arb-${base}`,
    title: `${character} ${posture} vector (arb act-1 drift ref)`,
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
function walkPosture(posture: 'regen' | 'deploy', sheet: SignedSheet): BoardInstrument {
  const vector = posture === 'regen' ? REGEN : DEPLOY;
  // 85g5 (2026-08-26) — pre55ReachRef RETIRED with the frozen anchor: the
  // deploy twin (the freshly re-derived vector) returns to the SIGNED
  // 40–50 band; a fresh derive that can't live in the signed band is a
  // finding, not a reference to chase.
  const reachBand = { min: sheet.terminalReachTarget.min, max: sheet.terminalReachTarget.max };
  // Balance-proof: the derived band moves with the sheet's pair.
  const winDerived = {
    min: reachBand.min * (1 - sheet.deepEndWallTarget.max),
    max: reachBand.max * (1 - sheet.deepEndWallTarget.min),
  };
  const reachSource =
    posture === 'deploy'
      ? '72b SIGNED 40–50 — ⚠ the 85g6d fold baseline reads 0.567 ABOVE band: the NAMED overperformance watch (a design-target question, user-signed 2026-08-28; deliberately NOT a per-twin ref — that pattern died with pre55ReachRef)'
      : '72b SIGNED 40–50, HELD through the 85g6d fold baseline (0.467)';
  return {
    id: `arb-walk-${posture}`,
    title: `two-act ${posture} vector (the design-target shape, arbitrated)`,
    args: [...WALK, '--character=soldier', vector, ...ARM],
    strategyRow:
      posture === 'regen'
        ? 'arbitrated:scored:59-regen-vector'
        : 'arbitrated:scored:85g5-finalist-56',
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
        source: '72b SIGNED 30–35 — IN BAND at the 85g6d fold baseline (0.304/0.324): the 0.438 re-read AND the floor-hugging watch both CLOSED (the §85h fold disposition vindicated)',
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
  // 72f (user-signed) — THE ARBITRATED DEFAULT: the arb primaries carry the
  // checks; 5 doctrine controls ride checkless for the paired ceiling
  // deltas + the fire channel. 85-pre F3A: the two wall rows moved to the
  // doctrine (non-arb) arm — 8 arb primaries + 2 checked wall rows since.
  // arb-fire-ablated is DROPPED: on the arb arm
  // fires are rollout-owned, so the ablated vector plays identically to
  // regen (metric-identical at 72f — the +17.5 "substitution" ceiling
  // explained structurally; BALANCE §72f). The full 11-row doctrine set
  // re-enters at the cluster-5 stress test.
  const primaries: BoardInstrument[] = [
    act1Posture('soldier', 'regen', sheet),
    act1Posture('soldier', 'deploy', sheet),
    // 85-pre F3A (user-signed 2026-08-23) — the wall rows run the DOCTRINE
    // (non-arbitrated) arm: --encounter + --arbitrate is refused since F3
    // (rollout clones drop the forced-encounter dial — every arb decision
    // on these rows was judged against pool-rolled futures; WORKLOG
    // §85-pre finding 4). The refs below are the ARB-arm 83f pins carried
    // over: PENDING RE-PIN at the next board run (expect a WARN pair until
    // then — the arm change moves winRate; boss-wall drift detection never
    // needed arbitration).
    {
      id: 'wall-king',
      title: 'forced Bandit King (regen vector, doctrine arm)',
      args: [...ACT1, '--character=soldier', '--encounter=bandit-king', REGEN, ...CONTROL_ARM],
      strategyRow: 'scored:59-regen-vector',
      checks: [ref('winRate', sheet.forcedKingWinRegen, 0.1, '85f re-pin (user-signed 2026-08-25): the DOCTRINE-arm n=120 value (King 77.5) — the F3A PENDING closed')],
    },
    {
      id: 'wall-queen',
      title: 'forced Bandit Queen (regen vector, doctrine arm)',
      args: [...ACT1, '--character=soldier', '--encounter=banditQueen', REGEN, ...CONTROL_ARM],
      strategyRow: 'scored:59-regen-vector',
      checks: [
        ref('winRate', sheet.forcedQueenWinRegen, 0.1, '85f re-pin (user-signed 2026-08-25): the DOCTRINE-arm n=120 value (Queen 67.5) — the King>Queen order is the durable check'),
      ],
    },
    act1Posture('priest', 'regen', sheet),
    act1Posture('priest', 'deploy', sheet),
    act1Posture('gambler', 'regen', sheet),
    act1Posture('gambler', 'deploy', sheet),
    walkPosture('regen', sheet),
    walkPosture('deploy', sheet),
  ];
  const controls: BoardInstrument[] = [
    control('regen', 'soldier regen vector', [...ACT1, '--character=soldier', REGEN, ...CONTROL_ARM], 'scored:59-regen-vector'),
    control('deploy', 'soldier deploy vector', [...ACT1, '--character=soldier', DEPLOY, ...CONTROL_ARM], 'scored:85g5-finalist-56'),
    control('fire-ablated', 'the fire-channel ablation', [...ACT1, '--character=soldier', ABLATED, ...CONTROL_ARM], 'scored:60-fire-ablated-vector'),
    control('walk-regen', 'two-act regen vector', [...WALK, '--character=soldier', REGEN, ...CONTROL_ARM], 'scored:59-regen-vector'),
    control('walk-deploy', 'two-act deploy vector', [...WALK, '--character=soldier', DEPLOY, ...CONTROL_ARM], 'scored:85g5-finalist-56'),
  ];
  // The 4 ceiling deltas (arb − doctrine, paired seeds): the cheapest
  // standing read on what arbitration is worth; a WARN = a real move.
  const ceilingDeltas: BoardDelta[] = (
    [
      ['regen', 'arb-regen'],
      ['deploy', 'arb-deploy'],
      ['walk-regen', 'arb-walk-regen'],
      ['walk-deploy', 'arb-walk-deploy'],
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
  /** 86e2 — the verdict layer reads seeds (dup/window checks). */
  readonly seed: number;
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
  const [seed, strategy, outcome, finalHop, sectors, port, bits, fired] = [
    col('seed'),
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
      seed: Number(cells[seed]),
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
    const terminal = { sector: termSc, hop: termHop };
    const arrivals = rows.filter((r) =>
      atOrBeyondWalkPos({ sector: r.sectorsCleared, hop: r.finalHop }, terminal),
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

// ---- 86e2: the fail-closed verdict layer ----------------------------------
//
// The board split (user-signed 2026-08-29): the report separates into three
// surfaces with distinct semantics —
//   VERDICT  — measurement INTEGRITY, fail-closed: missing / unparseable /
//              empty-arm-match / under-n / dup-seed / window-mismatch /
//              provenance (no manifest, no head, dirty tree, wrong arm,
//              cross-dir HEAD split) / an N/A on a checked row — every one
//              a FAIL and a non-zero exit. A board that can't prove what it
//              measured is VOID, never a quieter shade of green.
//   DRIFT    — the reference-band rows vs the signed sheet (WARN semantics
//              unchanged; `signed`-grade bands still FAIL there).
//   HEALTH   — instrument self-checks (the 84f2 inert-class tripwire; the
//              86e3 skill-gradient anchors). Never gates the exit code.
//
// Decision record (WORKLOG §86e): a missing manifest FAILs by default —
// `--allow-unmanifested` downgrades exactly that ONE check to WARN for
// pre-86e1 archives (corrupt manifests, dirty trees, and head splits still
// FAIL under it). Cross-dir HEAD mismatch FAILs (the n=120 SAME-HEAD
// protocol, machine-checked); measurement-HEAD vs the EVALUATING tree's
// HEAD only WARNs (docs commits legitimately land between a box fetch and
// `--report`).

/** The board's floor n — every decision-feeding instrument runs ≥ 40 seeds
 *  (the §68 protocol's in-sample shape; extensions merge to 120). */
export const BOARD_MIN_N = 40;

/** The raw facts the CLI gathers per instrument dir — the verdict layer
 *  stays pure (the 68c discipline: cli.ts is a thin shell, tests point
 *  here). */
export interface InstrumentAudit {
  readonly dir: string;
  readonly summaryFound: boolean;
  /** summary.csv existed but did not parse (readable board > a throw). */
  readonly parseError?: string;
  /** Rows in summary.csv across ALL strategies. */
  readonly totalRows: number;
  /** Rows matching the instrument's strategyRow (what metrics read). */
  readonly matchedRows: number;
  /** Seeds of the matched rows, unsorted as read. */
  readonly seeds: readonly number[];
  readonly manifest: BatchManifest | null;
  /** manifest.json existed but was corrupt (readBatchManifest threw). */
  readonly manifestError?: string;
}

export type VerdictStatus = 'PASS' | 'FAIL' | 'WARN';

export interface VerdictRow {
  readonly instrument: string;
  readonly check: string;
  readonly status: VerdictStatus;
  readonly detail: string;
}

export interface VerdictReport {
  readonly rows: readonly VerdictRow[];
  readonly fails: number;
  readonly warns: number;
  /** The one head every manifested dir agrees on; null when unknown or split. */
  readonly measurementHead: string | null;
  readonly currentHead: string | null;
  /** How many missing-manifest FAILs were downgraded by --allow-unmanifested. */
  readonly unmanifestedAllowed: number;
}

export interface VerdictOptions {
  readonly allowUnmanifested: boolean;
  /** The evaluating tree's HEAD (null = git unavailable here). */
  readonly currentHead: string | null;
}

export function evaluateVerdict(
  board: Board,
  auditsById: ReadonlyMap<string, InstrumentAudit>,
  metricsById: ReadonlyMap<string, InstrumentMetrics>,
  opts: VerdictOptions,
): VerdictReport {
  const rows: VerdictRow[] = [];
  let unmanifestedAllowed = 0;
  const fail = (instrument: string, check: string, detail: string): void => {
    rows.push({ instrument, check, status: 'FAIL', detail });
  };

  for (const inst of board.instruments) {
    const before = rows.length;
    const a = auditsById.get(inst.id);
    // Artifacts present + parseable.
    if (a === undefined || !a.summaryFound) {
      fail(inst.id, 'missing', `no summary.csv${a ? ` at ${a.dir}` : ''}`);
      continue;
    }
    if (a.parseError !== undefined) {
      fail(inst.id, 'unparseable', a.parseError);
      continue;
    }
    // The arm filter actually matched something.
    if (a.totalRows === 0) {
      fail(inst.id, 'empty', 'summary.csv has a header and no rows');
    } else if (a.matchedRows === 0) {
      fail(
        inst.id,
        'arm-match',
        `strategyRow '${inst.strategyRow}' matched 0 of ${a.totalRows} rows — wrong arm or wrong dir`,
      );
    }
    // n + seed integrity (only meaningful once rows matched).
    if (a.matchedRows > 0) {
      if (a.matchedRows < BOARD_MIN_N) {
        fail(inst.id, 'under-n', `n=${a.matchedRows} < the board floor ${BOARD_MIN_N}`);
      }
      const sorted = [...a.seeds].sort((x, y) => x - y);
      const dups = sorted.filter((s, i) => i > 0 && s === sorted[i - 1]);
      if (dups.length > 0) {
        fail(inst.id, 'dup-seed', `duplicate seeds inflate n: ${[...new Set(dups)].join(', ')}`);
      } else if (a.manifest !== null) {
        // Seeds must be EXACTLY the manifest's window (a stage dir reported
        // alongside its merged superset, or a truncated fetch, both land here).
        const w = a.manifest.seedWindow;
        const windowOk =
          sorted.length === w.count &&
          sorted[0] === w.firstSeed &&
          sorted[sorted.length - 1] === w.firstSeed + w.count - 1;
        if (!windowOk) {
          fail(
            inst.id,
            'window',
            `rows cover seeds ${sorted[0]}..${sorted[sorted.length - 1]} (n=${sorted.length}) ` +
              `but the manifest promises ${w.firstSeed}..${w.firstSeed + w.count - 1} (n=${w.count})`,
          );
        }
      }
    }
    // Provenance.
    if (a.manifestError !== undefined) {
      fail(inst.id, 'provenance', `corrupt manifest.json: ${a.manifestError}`);
    } else if (a.manifest === null) {
      if (opts.allowUnmanifested) {
        unmanifestedAllowed++;
        rows.push({
          instrument: inst.id,
          check: 'provenance',
          status: 'WARN',
          detail: 'no manifest.json — accepted under --allow-unmanifested (pre-86e1 archive)',
        });
      } else {
        fail(inst.id, 'provenance', 'no manifest.json — an unmanifested batch cannot certify (pre-86e1 archive? pass --allow-unmanifested to read it as WARN)');
      }
    } else {
      if (a.manifest.head === null) {
        fail(inst.id, 'provenance', 'the batch ran without git provenance (manifest head=null)');
      }
      if (a.manifest.dirty === true) {
        fail(inst.id, 'provenance', 'the batch ran on a DIRTY tree — the measurement HEAD is not the code that ran');
      }
      const want = armSignatureOf(inst.args);
      const got = armSignatureOf(a.manifest.argv);
      if (got !== want) {
        fail(inst.id, 'arm', `manifest argv is not this instrument's arm (want '${want}', got '${got}')`);
      }
    }
    // A checked metric that reads N/A: the instrument could not measure what
    // the board checks — fail-closed, never a silent dash in the drift table.
    const m = metricsById.get(inst.id);
    for (const check of inst.checks) {
      if (m !== undefined && m[check.metric] === null) {
        fail(inst.id, 'n/a', `checked metric '${check.metric}' is unmeasurable on this batch (N/A)`);
      }
    }
    if (rows.length === before) {
      rows.push({
        instrument: inst.id,
        check: 'integrity',
        status: 'PASS',
        detail: `n=${a.matchedRows}, seeds ${Math.min(...a.seeds)}..${Math.max(...a.seeds)}, head ${a.manifest?.head?.slice(0, 8) ?? '—'}`,
      });
    }
  }

  // Deltas: a null side that survived per-instrument checks (e.g. a delta on
  // a metric no per-row check covers) still voids the delta — fail-closed.
  for (const d of board.deltas) {
    const av = metricsById.get(d.a)?.[d.metric];
    const bv = metricsById.get(d.b)?.[d.metric];
    const missingSide = (v: number | null | undefined, id: string): boolean =>
      v === null && auditsById.get(id)?.summaryFound === true;
    if (missingSide(av, d.a) || missingSide(bv, d.b)) {
      fail(d.id, 'n/a', `delta metric '${d.metric}' is unmeasurable on ${av === null ? d.a : d.b}`);
    }
  }

  // Cross-dir HEAD consistency (the SAME-HEAD protocol): every manifested
  // dir must name the ONE head; a split board mixes two games' numbers.
  const heads = new Map<string, string[]>();
  for (const inst of board.instruments) {
    const h = auditsById.get(inst.id)?.manifest?.head;
    if (h != null) heads.set(h, [...(heads.get(h) ?? []), inst.id]);
  }
  let measurementHead: string | null = null;
  if (heads.size === 1) {
    measurementHead = [...heads.keys()][0]!;
  } else if (heads.size > 1) {
    fail(
      '(cross)',
      'head-split',
      `instrument dirs name ${heads.size} different heads: ` +
        [...heads.entries()].map(([h, ids]) => `${h.slice(0, 8)} (${ids.join(', ')})`).join(' vs '),
    );
  }
  if (
    measurementHead !== null &&
    opts.currentHead !== null &&
    measurementHead !== opts.currentHead
  ) {
    rows.push({
      instrument: '(head)',
      check: 'vs-current',
      status: 'WARN',
      detail:
        `measurement HEAD ${measurementHead.slice(0, 8)} ≠ this tree's HEAD ` +
        `${opts.currentHead.slice(0, 8)} — fine for reading a fetched batch, but any re-pin must cite the measurement HEAD`,
    });
  }

  return {
    rows,
    fails: rows.filter((r) => r.status === 'FAIL').length,
    warns: rows.filter((r) => r.status === 'WARN').length,
    measurementHead,
    currentHead: opts.currentHead,
    unmanifestedAllowed,
  };
}

// ---- rendering ------------------------------------------------------------

export function renderVerdictReport(report: VerdictReport): string {
  const lines: string[] = [];
  lines.push('## VERDICT — fail-closed measurement integrity (86e2)');
  lines.push('');
  const pad = (s: string, w: number): string => s.padEnd(w);
  lines.push(`${pad('instrument', 20)}${pad('check', 13)}${pad('status', 8)}detail`);
  for (const r of report.rows) {
    lines.push(`${pad(r.instrument, 20)}${pad(r.check, 13)}${pad(r.status, 8)}${r.detail}`);
  }
  lines.push('');
  if (report.unmanifestedAllowed > 0) {
    lines.push(
      `⚠ --allow-unmanifested in effect: ${report.unmanifestedAllowed} instrument(s) read without provenance`,
    );
  }
  if (report.measurementHead !== null) {
    const match =
      report.currentHead === null
        ? '(current HEAD unknown)'
        : report.measurementHead === report.currentHead
          ? '(matches this tree)'
          : `⚠ ≠ this tree's ${report.currentHead.slice(0, 8)}`;
    lines.push(`measurement HEAD: ${report.measurementHead} ${match}`);
  }
  lines.push(
    report.fails > 0
      ? `${report.fails} FAIL — the board is VOID: fix the measurement before reading the drift table`
      : `integrity PASS (${report.warns} WARN)`,
  );
  return lines.join('\n') + '\n';
}

export function renderReport(report: BoardReport, board: Board): string {
  const lines: string[] = [];
  lines.push(`## DRIFT — reference bands vs the signed sheet (${board.sheet.signedAt})`);
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
