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
 *   DESIGN band lives on the walk's shape — declared 55–70 at 68d, to
 *   be SIGNED (flipped to `signed` grade) at the post-tuning verify once
 *   §68e/f land. The §60e 60–67 act-1 band is retired with its world.
 *
 * - **Instrument shapes are part of the label** (Protocol v2): the act-1
 *   rows are `--hops=11` (the §60e continuity shape, a bounded
 *   single-sector probe); the `walk-*` rows are the full walk of every
 *   act — the canonical game since 67. In-sample seeds 1..40, the extended
 *   realistic arm, one forced character per instrument. Character parity
 *   is a signed design principle (DESIGN.md §Run structure): the
 *   per-character rows exist to catch parity drift, and the Gambler rows
 *   are PROVISIONAL pending the §68f ronin/reaver buff.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atOrBeyondWalkPos, compareWalkPos, runWalkPos, type WalkPos } from '../walkDepth';
import { armSignatureOf, type BatchManifest } from '../manifest';
import { parsePacingCsv } from '../reporters';
import { HEALTH } from '../../../src/config/health';
import { getSector } from '../../../src/config/sectors';
import { SECTOR_MAP } from '../../../src/config/sectorMap';
import { sectorPositions } from '../roster/rosterTable';

// ---- the signed sheet (the user-signed artifact, 68d re-signs) ------------

export interface SheetBand {
  readonly min: number;
  readonly max: number;
}

export interface SignedSheet {
  /** The sheet's history: one entry per signing or amendment, each opening
   *  with its title up to the first ': ', joined by ' ⭑ '. A report prints
   *  `sheetProvenance` of it, not the whole. */
  readonly signedAt: string;
  /** The 68d-signed design principle the per-character rows enforce. */
  readonly characterParity: string;
  /** The last boss's pair, whichever act ends the walk (the sheet is keyed by
   *  act number since 143d; the terminal is named by its role, so a new act
   *  in front moves nothing here).
   *  - `reach` (72b, user-signed): the fraction of runs that reach the
   *    terminal (sector-aware arrivals ÷ runs). THE load-bearing target;
   *    signed 40–50 (human overperformance argues the conservative side).
   *    Win rate DERIVES from it × the wall and is never independently
   *    signed (the one-act-era 55–70 band is RETIRED).
   *  - `wall`: the 30–35 target, RE-SIGNED at 72b for the deep-end terminal
   *    (the §68g crisis was gotcha #120 contamination). */
  readonly terminal: { readonly reach: SheetBand; readonly wall: SheetBand };
  /** A band per seam, keyed by the act the seam ends. Each is a FRACTION of
   *  `HEALTH.playerHealthMax` (94h-pre: the 15–18 pool-HP band was written
   *  at max 20 and stranded when 92d doubled it; the board derives the
   *  pool-HP band at verdict time, so the next pool-max move cannot strand
   *  it again). Seam 1's is signed at measured reality, one band over both
   *  walk rows. */
  readonly seams: Readonly<Record<string, SheetBand>>;
  /** The mid-walk boss walls, keyed by act, each one band over both walk
   *  rows; act 1's signed at 146g. */
  readonly walls: Readonly<Record<string, SheetBand>>;
  /** 94h-pre (user-signed at the §94 shape-lock) — the kind pacing targets as
   *  a DRIFT read on the walk rows: turns per WON instance off the pooled
   *  `pacing.csv` (the walk rows run `--per-encounter`; `--merge-stages`
   *  pools the file), over the whole walk. Normal 2.5–3.25 · elite 4–5 ·
   *  boss 5–6.5. */
  readonly pacingBands: Readonly<Record<'normal' | 'elite' | 'boss', SheetBand>>;
  /** The act-alone rows' refs, keyed by act; act 1's only, the act a fresh
   *  roster meets. */
  readonly acts: Readonly<Record<string, ActRefs>>;
  readonly gamblerNote: string;
  /** The forced-boss rows' win refs (the doctrine arm, regen vector), keyed by
   *  encounter id; each row runs at the act whose sector's boss pool holds
   *  its boss (`homeActOf`). */
  readonly forcedBossWinRefs: Readonly<Record<string, number>>;
}

/** One act's act-alone refs. */
export interface ActRefs {
  /** Continuity drift references (68d observed; ±8pt paired noise). 85g5
   *  (2026-08-26): the `deploy` posture replaces `pre55` — the frozen 55pre
   *  anchor retired with its `pre55ReachRef` workaround when the re-derived
   *  vector deployed. */
  readonly winRefs: Readonly<
    Record<'soldier' | 'priest' | 'gambler', { readonly regen: number; readonly deploy: number }>
  >;
  readonly bankRefs: { readonly firer: number; readonly shopper: number };
  readonly firerFiresPerRun: number;
  /** 85g6d — the fold re-activates the port economy (tx ≈0 → real
   *  shopping); both tx refs re-pin at the fold baseline. */
  readonly firerTransactionRate: number;
  readonly shopperTransactionRate: number;
  readonly fireChannelDelta: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadSignedSheet(path = join(HERE, 'signed-sheet.json')): SignedSheet {
  return JSON.parse(readFileSync(path, 'utf8')) as SignedSheet;
}

/** The line a report prints for the sheet's history: the count of entries in
 *  `signedAt` and the first and last entries' titles. The history itself is
 *  over 10,000 characters and stays in the sheet. */
export function sheetProvenance(signedAt: string): string {
  const entries = signedAt.split(' ⭑ ');
  const title = (entry: string): string => {
    const end = entry.indexOf(': ');
    return end >= 0 ? entry.slice(0, end) : entry.length > 100 ? `${entry.slice(0, 100)}…` : entry;
  };
  const first = title(entries[0]!);
  return entries.length === 1
    ? `1 entry: ${first}`
    : `${entries.length} entries, the first ${first}, the last ${title(entries[entries.length - 1]!)}; the history is the sheet's signedAt`;
}

// ---- the board definition -------------------------------------------------

/** The metrics that are one number per instrument. */
export type ScalarMetricKey =
  | 'winRate'
  | 'bossWall'
  | 'terminalReach'
  | 'seamPool'
  | 'transactionRate'
  | 'terminalBank'
  | 'firesPerRun'
  | 'pacingNormal'
  | 'pacingElite'
  | 'pacingBoss';

/** 143d — `seam` and `actWall` read one act's entry, the check's `act`. */
export type MetricKey = ScalarMetricKey | 'seam' | 'actWall';

export interface BoardCheck {
  readonly metric: MetricKey;
  /** The act a `seam` or `actWall` check reads (the seam that ends it, or
   *  its boss's wall); absent on the scalar metrics. */
  readonly act?: number;
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

/** A cross-instrument delta check (channel ablations): metric(a) − metric(b),
 *  each row's whole batch, or with `paired` the win rates on the seeds both
 *  rows ran. */
export interface BoardDelta {
  readonly id: string;
  readonly title: string;
  readonly metric: ScalarMetricKey;
  readonly a: string;
  readonly b: string;
  /** 150b — read on the seeds both rows ran (`winRate` only): a row run at
   *  more seeds than the other drops its extra seeds from this delta. */
  readonly paired?: true;
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
const WALK = ['--count=40']; // the canonical walk of every act (no hop dial)
const REGEN = '--strategy=tests/fuzz/fixtures/59-regen-vector.json';
/** 85g5 (2026-08-26) — the DEPLOYED searched vector twin: the frozen
 *  55pre anchor is retired; a future re-derive swaps this path only
 *  (ids stay `deploy`). 92c2 (2026-09-05) — swapped: the vector RE-SEARCHED
 *  under the casualty rule (the 92c1 derive's refined winner, the argmax of
 *  the K=4 arbitrated selection 13/30 — WORKLOG §92c2; the 85g5 finalist-56
 *  fixture stays on disk as the survivors-era comparator). The deploy act-1
 *  refs + the shopper economy refs on the sheet are PENDING RE-PIN at the
 *  §92 board (a DRAFT lineage — §93 decides). */
const DEPLOY = '--strategy=tests/fuzz/fixtures/92c2-winner.json';
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
  refs: ActRefs,
  sheet: SignedSheet,
): BoardInstrument {
  const vector = posture === 'regen' ? REGEN : DEPLOY;
  const strategyRow =
    posture === 'regen'
      ? 'arbitrated:scored:59-regen-vector'
      : 'arbitrated:scored:92c2-winner';
  const provisional = character === 'gambler' ? ` [${sheet.gamblerNote}]` : '';
  const winSource = `150h re-pin at the 150h board (act 1, The Periphery, arb λ=0.5, doctrine's pick the null, n=120 pooled, ±8)${provisional}`;
  const checks: BoardCheck[] = [
    ref('winRate', refs.winRefs[character][posture], WIN_TOL, winSource),
  ];
  // Plain economy refs ride the SOLDIER rows only (one instrument-pair of
  // numbers, not six): bank/fires at observed, tx ≈0 — the posture
  // dissolution is the arm's structure, not a drift to chase.
  if (character === 'soldier' && posture === 'regen') {
    checks.push(
      ref('terminalBank', refs.bankRefs.firer, BANK_TOL, '150h re-pin at the 150h board: the firer banks ~130 after act 1 (115 at 146f, under the pass null)'),
      ref('firesPerRun', refs.firerFiresPerRun, 1.0, '150h re-pin at the 150h board: ~4.7 arbitrated fires a run (2.5 at 146f, under the pass null)'),
      ref('transactionRate', refs.firerTransactionRate, 0.1, '150h re-pin at the 150h board: the firer shops in ~29% of runs (the port economy re-activated by the fold at 85g6d)'),
    );
  }
  if (character === 'soldier' && posture === 'deploy') {
    checks.push(
      ref('terminalBank', refs.bankRefs.shopper, BANK_TOL, '150h re-pin at the 150h board: the deploy row banks ~83 after act 1 (80 at 146f)'),
      ref('transactionRate', refs.shopperTransactionRate, 0.1, '150h re-pin at the 150h board: the deploy vector shops in ~90% of runs'),
      ref('firesPerRun', 5.44, 1.0, '150h re-pin at the 150h board: ~5.4 arbitrated fires a run (2.0 from 72f to 146f, under the pass null)'),
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

/** One walk PRIMARY — the 72b unified-architecture rows on the
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
  const reachBand = { min: sheet.terminal.reach.min, max: sheet.terminal.reach.max };
  // Balance-proof: the derived band moves with the sheet's pair.
  const winDerived = {
    min: reachBand.min * (1 - sheet.terminal.wall.max),
    max: reachBand.max * (1 - sheet.terminal.wall.min),
  };
  // 143d — a check per signed seam and per signed mid-walk wall, in act
  // order; an act with no band prints in the PER ACT table unchecked.
  const byAct = (bands: Readonly<Record<string, SheetBand>>): [number, SheetBand][] =>
    Object.entries(bands)
      .map(([act, band]): [number, SheetBand] => [Number(act), band])
      .sort(([a], [b]) => a - b);
  const reachSource =
    posture === 'deploy'
      ? '72b SIGNED 40–50 — ⚠ the 85g6d fold baseline reads 0.567 ABOVE band: the NAMED overperformance watch (a design-target question, user-signed 2026-08-28; deliberately NOT a per-twin ref — that pattern died with pre55ReachRef)'
      : '72b SIGNED 40–50, HELD through the 85g6d fold baseline (0.467)';
  return {
    id: `arb-walk-${posture}`,
    title: `walk ${posture} vector (the design-target shape, arbitrated)`,
    // 94h-pre — the walk rows run --per-encounter so the batch carries
    // pacing.csv (the sheet's pacing DRIFT read; a merged dir pools it).
    args: [...WALK, '--character=soldier', vector, ...ARM, '--per-encounter'],
    strategyRow:
      posture === 'regen'
        ? 'arbitrated:scored:59-regen-vector'
        : 'arbitrated:scored:92c2-winner',
    checks: [
      ...byAct(sheet.seams).map(([act, band]): BoardCheck => ({
        metric: 'seam',
        act,
        grade: 'reference',
        // 94h-pre — a FRACTION of the pool max, derived at verdict time
        // (balance-proof: a pool-max move moves the band with it).
        min: band.min * HEALTH.playerHealthMax,
        max: band.max * HEALTH.playerHealthMax,
        source:
          act === 1
            ? '146g SIGNED as a fraction of max at the 146f board, one band over both walk rows (19.9 and 21.0 of 40); a fraction since 94h-pre, so a pool-max move moves the band'
            : `the sheet's seam ${act}, a fraction of max`,
      })),
      ...(['normal', 'elite', 'boss'] as const).map((kind): BoardCheck => ({
        metric: `pacing${kind[0]!.toUpperCase()}${kind.slice(1)}` as MetricKey,
        grade: 'reference',
        min: sheet.pacingBands[kind].min,
        max: sheet.pacingBands[kind].max,
        source: `94h-pre SIGNED (the §94 shape-lock): the user's ${kind} turn target, turns per WON instance off the pooled pacing.csv`,
      })),
      ...byAct(sheet.walls).map(([act, band]): BoardCheck => ({
        metric: 'actWall',
        act,
        grade: 'reference',
        min: band.min,
        max: band.max,
        source:
          act === 1
            ? '146g SIGNED at the 146f board, one band over both walk rows (0.337 regen, 0.188 deploy)'
            : `the sheet's act-${act} boss wall`,
      })),
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
        min: sheet.terminal.wall.min,
        max: sheet.terminal.wall.max,
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

/** 143d — act 1's refs. Only act 1 has act-alone rows (a fresh roster meets
 *  no other act), so a sheet with refs for another act is refused until its
 *  rows are cut. */
function actOneRefs(sheet: SignedSheet): ActRefs {
  const others = Object.keys(sheet.acts).filter((act) => act !== '1');
  const refs = sheet.acts['1'];
  if (refs === undefined || others.length > 0) {
    throw new Error(
      `signed sheet: the board builds act-alone rows for act 1 only, and the sheet holds acts ${JSON.stringify(Object.keys(sheet.acts))}`,
    );
  }
  return refs;
}

/** 143d — the act whose sector's boss pool holds `encounterId`, by the walk's
 *  sector ids in order (`sectorPositions`). No sector, or more than one, is a
 *  board the walk cannot place, and throws. */
export function homeActOf(encounterId: string, walk: readonly string[]): number {
  const acts = walk.flatMap((sectorId, i) =>
    (getSector(sectorId)?.encounters.boss ?? []).some((e) => e.encounterId === encounterId) ? [i + 1] : [],
  );
  if (acts.length !== 1) {
    throw new Error(
      `board: boss '${encounterId}' is in the boss pool of ${acts.length} sectors of the walk ${JSON.stringify(walk)} (acts ${JSON.stringify(acts)})`,
    );
  }
  return acts[0]!;
}

/** The starting act's flag, written only past act 1, so a row at act 1 keeps
 *  the argv every stored cohort's manifest certifies (`armSignatureOf`). */
function actArgs(act: number): string[] {
  return act > 1 ? [`--act=${act}`] : [];
}

/** A forced-boss row: the boss fought at every combat node of its own act,
 *  that act alone, on the doctrine arm. */
function forcedBoss(
  id: string,
  title: string,
  encounterId: string,
  sheet: SignedSheet,
  walk: readonly string[],
  source: string,
): BoardInstrument {
  const value = sheet.forcedBossWinRefs[encounterId];
  if (value === undefined) throw new Error(`signed sheet: no forcedBossWinRefs entry for '${encounterId}'`);
  return {
    id,
    title,
    args: [...ACT1, ...actArgs(homeActOf(encounterId, walk)), '--character=soldier', `--encounter=${encounterId}`, REGEN, ...CONTROL_ARM],
    strategyRow: 'scored:59-regen-vector',
    checks: [ref('winRate', value, 0.1, source)],
  };
}

/** The board on `walk`, the sector ids a full walk enters in order (the live
 *  map's by default; tests pass a planted one). */
export function buildBoard(
  sheet: SignedSheet = loadSignedSheet(),
  walk: readonly string[] = sectorPositions(SECTOR_MAP),
): Board {
  // 72f (user-signed) — THE ARBITRATED DEFAULT: the arb primaries carry the
  // checks; 5 doctrine controls ride checkless for the paired ceiling
  // deltas + the fire channel. 85-pre F3A: the two wall rows moved to the
  // doctrine (non-arb) arm — 8 arb primaries + 2 checked wall rows since.
  // arb-fire-ablated is DROPPED: on the arb arm
  // fires are rollout-owned, so the ablated vector plays identically to
  // regen (metric-identical at 72f — the +17.5 "substitution" ceiling
  // explained structurally; BALANCE §72f). The full 11-row doctrine set
  // re-enters at the cluster-5 stress test.
  const act1 = actOneRefs(sheet);
  const primaries: BoardInstrument[] = [
    act1Posture('soldier', 'regen', act1, sheet),
    act1Posture('soldier', 'deploy', act1, sheet),
    // 85-pre F3A (user-signed 2026-08-23) — the wall rows run the DOCTRINE
    // (non-arbitrated) arm: --encounter + --arbitrate is refused since F3
    // (rollout clones drop the forced-encounter dial — every arb decision
    // on these rows was judged against pool-rolled futures; WORKLOG
    // §85-pre finding 4). 143d: each runs at its boss's act in the walk.
    forcedBoss(
      'wall-king',
      'forced Bandit King (regen vector, doctrine arm)',
      'bandit-king',
      sheet,
      walk,
      '146g re-pin at the 146f board: the doctrine arm at n=120, the King at act 1',
    ),
    forcedBoss(
      'wall-queen',
      'forced Bandit Queen (regen vector, doctrine arm)',
      'banditQueen',
      sheet,
      walk,
      '146g re-pin at the 146f board: the doctrine arm at n=120, the Queen at act 3; the King>Queen order is the durable check',
    ),
    act1Posture('priest', 'regen', act1, sheet),
    act1Posture('priest', 'deploy', act1, sheet),
    act1Posture('gambler', 'regen', act1, sheet),
    act1Posture('gambler', 'deploy', act1, sheet),
    walkPosture('regen', sheet),
    walkPosture('deploy', sheet),
  ];
  const controls: BoardInstrument[] = [
    control('regen', 'soldier regen vector', [...ACT1, '--character=soldier', REGEN, ...CONTROL_ARM], 'scored:59-regen-vector'),
    control('deploy', 'soldier deploy vector', [...ACT1, '--character=soldier', DEPLOY, ...CONTROL_ARM], 'scored:92c2-winner'),
    control('fire-ablated', 'the fire-channel ablation', [...ACT1, '--character=soldier', ABLATED, ...CONTROL_ARM], 'scored:60-fire-ablated-vector'),
    control('walk-regen', 'walk regen vector', [...WALK, '--character=soldier', REGEN, ...CONTROL_ARM, '--per-encounter'], 'scored:59-regen-vector'),
    control('walk-deploy', 'walk deploy vector', [...WALK, '--character=soldier', DEPLOY, ...CONTROL_ARM, '--per-encounter'], 'scored:92c2-winner'),
  ];
  // 86e3 (decision C, user-signed) — the skill-gradient anchors: the
  // registry's two bare baselines on the act-1 shape (SAME shape as the arb
  // soldier rows — probe-shape win rates are shape artifacts, so the
  // gradient only reads on shape-matched legs). Checkless: their value is
  // the HEALTH gradient (random < greedy < ARM), not a band. Cheap by
  // construction — no searcher, no arm flags; the guileless floor. The
  // searched-UPPER leg is the standing arb soldier rows (the deployed
  // vector + the full ARM); at amendment/re-pin boards the protocol
  // additionally requires a FRESH `--search` derive as the ceiling read
  // (the 85g5 lineage — a frozen vector's ceiling drifts, pre55ReachRef).
  const anchors: BoardInstrument[] = [
    {
      id: 'anchor-random',
      title: 'pure-random floor (skill-gradient anchor)',
      args: [...ACT1, '--character=soldier', '--strategy=pure-random'],
      strategyRow: 'pure-random',
      checks: [],
    },
    {
      id: 'anchor-greedy',
      title: 'greedy baseline (skill-gradient anchor)',
      args: [...ACT1, '--character=soldier', '--strategy=greedy'],
      strategyRow: 'greedy',
      checks: [],
    },
  ];
  // The 4 ceiling deltas (arb − doctrine on the seeds both rows ran): the
  // cheapest standing read on what arbitration is worth; a WARN = a real
  // move. The ARM rows extend to 120 seeds and the doctrine controls stay
  // at the board's floor of 40, so the delta reads the seeds they share;
  // the whole rows would mix in seeds doctrine never ran (150b).
  const ceilingDeltas: BoardDelta[] = (
    [
      ['regen', 'arb-regen'],
      ['deploy', 'arb-deploy'],
      ['walk-regen', 'arb-walk-regen'],
      ['walk-deploy', 'arb-walk-deploy'],
    ] as const
  ).map(([ctrl, arb]) => ({
    id: `ceiling-${ctrl}`,
    title: `ceiling move (arb − doctrine win rate on the shared seeds, ${ctrl})`,
    metric: 'winRate',
    a: arb,
    b: ctrl,
    paired: true,
    grade: 'reference',
    min: -WIN_TOL,
    max: WIN_TOL,
    source: '72f standing control: arb−doctrine on the seeds both rows ran (150b); WARN = a real ceiling move',
  }));
  const deltas: BoardDelta[] = [
    {
      id: 'fire-channel',
      title: 'fire channel (regen − ablated win rate, doctrine controls)',
      metric: 'winRate',
      a: 'regen',
      b: 'fire-ablated',
      grade: 'reference',
      min: act1.fireChannelDelta - 0.05,
      max: act1.fireChannelDelta + 0.05,
      source: '72f re-sign (user, 2026-08-04): +0.10 — the 72c value buffs REPAIRED the channel (was ≈0 at 68f); doctrine-pair definition, the arb arm reads ≈0 by substitution (structural)',
    },
    ...ceilingDeltas,
  ];
  return { instruments: [...primaries, ...controls, ...anchors], deltas, sheet };
}

// ---- 86e3: the skill-gradient health check --------------------------------

export interface GradientRow {
  readonly label: string;
  readonly status: 'ok' | 'WARN' | 'N/A';
  readonly detail: string;
}

/** 150c — P(X ≥ k) for X ~ Binomial(n, ½): the one-sided exact sign test
 *  on n discordant seeds, k of them won by the side under test. */
export function signTestUpper(k: number, n: number): number {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 0 || k < 0 || k > n) {
    throw new Error(`signTestUpper: needs integers 0 ≤ k ≤ n (k ${k}, n ${n})`);
  }
  let pmf = Math.pow(0.5, n); // P(X = 0)
  let tail = 0;
  for (let i = 0; i <= n; i++) {
    if (i >= k) tail += pmf;
    pmf = (pmf * (n - i)) / (i + 1);
  }
  return Math.min(1, tail);
}

/** The level below which the random < greedy leg reads random as beating
 *  greedy (one-sided). */
export const GRADIENT_FLOOR_P = 0.05;

/** The monotone skill gradient on the act-1 shape: pure-random < greedy <
 *  the ARM (the searched vector + the full doctrine arm). An INVERSION means
 *  the instrument is broken, not the balance: a bot that plays worse with
 *  more machinery is not a balance finding. HEALTH semantics: WARN, never a
 *  gate. The random < greedy leg is narrow at the anchors' 40 seeds, so it
 *  reads against its noise: on the seeds both anchors ran, an exact sign
 *  test on the seeds one won and the other lost, WARN only when random wins
 *  more of them at one-sided p < GRADIENT_FLOOR_P; a tie or a flip inside
 *  the noise reads ok. The ARM legs are the load-bearing ones. */
export function evaluateSkillGradient(
  metricsById: ReadonlyMap<string, InstrumentMetrics>,
): readonly GradientRow[] {
  const win = (id: string): number | undefined => metricsById.get(id)?.winRate;
  const floor = win('anchor-random');
  const mid = win('anchor-greedy');
  // The upper leg: the best standing act-1 ARM row (same shape as the
  // anchors). max() because the gradient claims the ARM beats the bare
  // baselines, not that every vector does.
  const armLegs = ['arb-regen', 'arb-deploy']
    .map((id) => ({ id, w: win(id) }))
    .filter((l): l is { id: string; w: number } => l.w !== undefined);
  const upper = armLegs.length === 0 ? undefined : armLegs.reduce((a, b) => (b.w > a.w ? b : a));
  const rows: GradientRow[] = [];
  const fmt = (v: number | undefined): string => (v === undefined ? '—' : v.toFixed(3));
  if (floor === undefined || mid === undefined) {
    rows.push({
      label: 'gradient',
      status: 'N/A',
      detail: `anchor rows absent (random ${fmt(floor)}, greedy ${fmt(mid)}) — the anchors ride every full board (86e3)`,
    });
    return rows;
  }
  rows.push(floorLeg(metricsById.get('anchor-random')?.winsBySeed, metricsById.get('anchor-greedy')?.winsBySeed, floor, mid));
  if (upper === undefined) {
    rows.push({
      label: 'greedy<ARM',
      status: 'N/A',
      detail: 'no act-1 ARM row present (partial board?) — the searched-upper leg is required at signing boards',
    });
  } else {
    rows.push(
      mid < upper.w
        ? { label: 'greedy<ARM', status: 'ok', detail: `${fmt(mid)} < ${fmt(upper.w)} (${upper.id})` }
        : {
            label: 'greedy<ARM',
            status: 'WARN',
            detail: `INVERTED: greedy ${fmt(mid)} ≥ the ARM ${fmt(upper.w)} (${upper.id}) — the searcher arm is buying nothing on this board`,
          },
    );
  }
  return rows;
}

/** 150c — the random < greedy leg on the anchors' shared seeds. */
function floorLeg(
  randomWins: ReadonlyMap<number, boolean> | undefined,
  greedyWins: ReadonlyMap<number, boolean> | undefined,
  floor: number,
  mid: number,
): GradientRow {
  const rates = `random ${floor.toFixed(3)}, greedy ${mid.toFixed(3)}`;
  if (randomWins === undefined || greedyWins === undefined) {
    return { label: 'random<greedy', status: 'N/A', detail: `${rates}; no per-seed outcomes to pair` };
  }
  let shared = 0;
  let randomOnly = 0;
  let greedyOnly = 0;
  for (const [seed, r] of randomWins) {
    const g = greedyWins.get(seed);
    if (g === undefined) continue;
    shared++;
    if (r && !g) randomOnly++;
    if (g && !r) greedyOnly++;
  }
  if (shared === 0) {
    return { label: 'random<greedy', status: 'N/A', detail: `${rates}; the anchors share no seed` };
  }
  const p = signTestUpper(randomOnly, randomOnly + greedyOnly);
  const split = `won by random alone ${randomOnly}, by greedy alone ${greedyOnly}, of ${shared} shared seeds; one-sided sign test p ${p.toFixed(3)}`;
  return randomOnly > greedyOnly && p < GRADIENT_FLOOR_P
    ? {
        label: 'random<greedy',
        status: 'WARN',
        detail: `INVERTED past the noise: ${rates}; ${split} — the instrument is broken, not the balance`,
      }
    : { label: 'random<greedy', status: 'ok', detail: `${rates}; ${split} (a tie or a flip inside the noise is fine)` };
}

export function renderSkillGradient(rows: readonly GradientRow[]): string {
  const lines: string[] = ['### the skill gradient (86e3 — anchors vs the ARM, act-1 shape)', ''];
  for (const r of rows) {
    lines.push(`  ${r.label.padEnd(16)}${r.status.padEnd(6)}${r.detail}`);
  }
  return lines.join('\n') + '\n';
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
  /** 94h-pre — turns per WON instance by kind, from the batch dir's pooled
   *  `pacing.csv` (`pacingMetricsOf`); null when the batch carries no
   *  pacing file or the kind saw no won instance — a CHECKED null fails the
   *  verdict closed (the walk rows must run `--per-encounter`). */
  readonly pacingNormal: number | null;
  readonly pacingElite: number | null;
  readonly pacingBoss: number | null;
  /** 143b — each seam, named by the act it ends (a full walk's numbering, so
   *  a run started at act 2 crosses act 2's seam first): the mean pre-floor
   *  pool over the runs that crossed it. A batch before the columns reads
   *  its first seam off `poolAtSectorEnd`. */
  readonly seams: readonly SeamMetric[];
  /** 143b — each act the batch entered: reach (runs at or past its boss ÷
   *  runs) and the wall (the runs that died at its boss ÷ those arrivals).
   *  The boss's hop comes from `sectorBossHops`; a batch before the column
   *  reads the winners' act alone, at the winners' terminal. The last act's
   *  pair is `terminalReach` and `bossWall` wherever a run won. */
  readonly acts: readonly ActMetric[];
  /** 150b — whether each seed's run won, keyed by seed: a paired delta
   *  reads two rows on the seeds both ran. `computeMetrics` always fills
   *  it; a metrics object built without it reads a paired delta as
   *  unmeasurable. */
  readonly winsBySeed?: ReadonlyMap<number, boolean>;
}

export interface SeamMetric {
  readonly act: number;
  readonly crossed: number;
  readonly pool: number;
}

export interface ActMetric {
  readonly act: number;
  /** null when the runs disagree on the act's boss hop (a mixed batch). */
  readonly bossHop: number | null;
  readonly arrivals: number;
  readonly reach: number | null;
  readonly wall: number | null;
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
  /** 143b — the act the run started at, the frame of `sectorsCleared`; 1 on
   *  batches before the column. */
  readonly startAct: number;
  /** 143b — every seam's pre-floor pool and every entered sector's boss
   *  hop, in walk order; null on batches before the columns. */
  readonly poolAtSectorClears: readonly number[] | null;
  readonly sectorBossHops: readonly number[] | null;
}

/** A `|`-joined list cell: '' is the empty list. */
function listCell(cell: string): number[] {
  return cell === '' ? [] : cell.split('|').map(Number);
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
  // 143b — optional likewise: batches before 143b carry none of the three.
  const startAct = header.indexOf('startAct');
  const clears = header.indexOf('poolAtSectorClears');
  const bossHops = header.indexOf('sectorBossHops');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const seamCell = seam < 0 ? '' : (cells[seam] ?? '');
    const cellAt = (i: number): string | null => (i < 0 ? null : (cells[i] ?? ''));
    const clearsCell = cellAt(clears);
    const bossHopsCell = cellAt(bossHops);
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
      startAct: startAct < 0 ? 1 : Number(cells[startAct]),
      poolAtSectorClears: clearsCell === null ? null : listCell(clearsCell),
      sectorBossHops: bossHopsCell === null ? null : listCell(bossHopsCell),
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
      pacingNormal: null,
      pacingElite: null,
      pacingBoss: null,
      seams: [],
      acts: [],
      winsBySeed: new Map(),
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
    // 94h-pre — pacing comes from pacing.csv, merged in by the CLI (`pacingMetricsOf`).
    pacingNormal: null,
    pacingElite: null,
    pacingBoss: null,
    seams: seamsOf(rows),
    acts: actsOf(rows, wins),
    winsBySeed: new Map(rows.map((r) => [r.seed, r.outcome === 'complete'])),
  };
}

/** 143b — a summary row's end position in a full walk's frame (`runWalkPos`,
 *  gotcha #127): a run started at act N counts its sectors from N − 1. */
function rowWalkPos(r: SummaryRow): WalkPos {
  return runWalkPos({ startAct: r.startAct, sectorsCleared: r.sectorsCleared, finalHopReached: r.finalHop });
}

/** 143b — the mean pre-floor pool at each seam, keyed by the act it ends. */
function seamsOf(rows: readonly SummaryRow[]): SeamMetric[] {
  const byAct = new Map<number, { sum: number; crossed: number }>();
  const add = (act: number, pool: number): void => {
    const acc = byAct.get(act) ?? { sum: 0, crossed: 0 };
    byAct.set(act, { sum: acc.sum + pool, crossed: acc.crossed + 1 });
  };
  for (const r of rows) {
    if (r.poolAtSectorClears !== null) {
      r.poolAtSectorClears.forEach((pool, j) => add(r.startAct + j, pool));
    } else if (r.poolAtSectorEnd !== null) {
      add(r.startAct, r.poolAtSectorEnd);
    }
  }
  return [...byAct.entries()]
    .sort(([a], [b]) => a - b)
    .map(([act, { sum, crossed }]) => ({ act, crossed, pool: sum / crossed }));
}

/** 143b — reach and the wall at each entered act's boss. Arrivals are the
 *  rows at or past the boss's (sector, hop); deaths are the defeats at it.
 *  A batch without `sectorBossHops` knows one boss, the winners' terminal. */
function actsOf(rows: readonly SummaryRow[], wins: readonly SummaryRow[]): ActMetric[] {
  const bossHop = new Map<number, number | null>();
  for (const r of rows) {
    r.sectorBossHops?.forEach((hop, j) => {
      const sector = r.startAct - 1 + j;
      const seen = bossHop.get(sector);
      if (seen === undefined) bossHop.set(sector, hop);
      else if (seen !== hop) bossHop.set(sector, null);
    });
  }
  if (bossHop.size === 0 && wins.length > 0) {
    const ends = wins.map(rowWalkPos);
    const deepest = ends.reduce((a, b) => (compareWalkPos(b, a) > 0 ? b : a));
    bossHop.set(deepest.sector, deepest.hop);
  }
  return [...bossHop.entries()]
    .sort(([a], [b]) => a - b)
    .map(([sector, hop]): ActMetric => {
      if (hop === null) return { act: sector + 1, bossHop: null, arrivals: 0, reach: null, wall: null };
      const boss = { sector, hop };
      const arrivals = rows.filter((r) => atOrBeyondWalkPos(rowWalkPos(r), boss));
      const deaths = arrivals.filter(
        (r) => r.outcome === 'defeat' && compareWalkPos(rowWalkPos(r), boss) === 0,
      ).length;
      return {
        act: sector + 1,
        bossHop: hop,
        arrivals: arrivals.length,
        reach: arrivals.length / rows.length,
        wall: arrivals.length === 0 ? null : deaths / arrivals.length,
      };
    });
}

/**
 * 94h-pre — the pacing DRIFT metrics off a batch dir's `pacing.csv` (the
 * 92a reader's kind rows): turns per WON instance for normal / elite /
 * boss; null for a kind with no won instance. The CLI spreads this over
 * `computeMetrics` when the file exists (the walk rows run `--per-encounter`
 * so it does; a merged n=120 dir carries the POOLED file).
 */
export function pacingMetricsOf(
  pacingCsv: string,
): Pick<InstrumentMetrics, 'pacingNormal' | 'pacingElite' | 'pacingBoss'> {
  const rows = parsePacingCsv(pacingCsv);
  const tpw = (kind: string): number | null => {
    const r = rows.find((x) => x.key === kind && x.kind === kind);
    return r === undefined || r.wonInstances === 0 ? null : r.turnsPerWonInstance;
  };
  return { pacingNormal: tpw('normal'), pacingElite: tpw('elite'), pacingBoss: tpw('boss') };
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

/** 143d — a check's value: a scalar metric by its key, a seam or an act's
 *  wall at the check's act (null where the batch has no such entry). */
export function checkValue(m: InstrumentMetrics, check: Pick<BoardCheck, 'metric' | 'act'>): number | null {
  switch (check.metric) {
    case 'seam':
      return m.seams.find((s) => s.act === check.act)?.pool ?? null;
    case 'actWall':
      return m.acts.find((a) => a.act === check.act)?.wall ?? null;
    default:
      return m[check.metric];
  }
}

/** The report's name for a check's metric. */
export function checkLabel(check: Pick<BoardCheck, 'metric' | 'act'>): string {
  if (check.metric === 'seam') return `seam (act ${String(check.act)})`;
  if (check.metric === 'actWall') return `wall (act ${String(check.act)})`;
  return check.metric;
}

/** 150b — a delta's value. Unpaired: metric(a) − metric(b), null when
 *  either side is. Paired: the mean over the seeds both rows ran of
 *  won(a) − won(b), which is each row's win rate on those seeds alone;
 *  null when the rows share no seed or either lacks `winsBySeed`. */
export function deltaValue(
  d: BoardDelta,
  metricsById: ReadonlyMap<string, InstrumentMetrics>,
): { readonly value: number | null; readonly shared: number | null } {
  const ma = metricsById.get(d.a);
  const mb = metricsById.get(d.b);
  if (d.paired !== true) {
    const a = ma?.[d.metric];
    const b = mb?.[d.metric];
    return { value: a === undefined || b === undefined || a === null || b === null ? null : a - b, shared: null };
  }
  if (d.metric !== 'winRate') throw new Error(`delta '${d.id}': a paired delta reads winRate, not '${d.metric}'`);
  const wa = ma?.winsBySeed;
  const wb = mb?.winsBySeed;
  if (wa === undefined || wb === undefined) return { value: null, shared: 0 };
  let shared = 0;
  let sum = 0;
  for (const [seed, aWon] of wa) {
    const bWon = wb.get(seed);
    if (bWon === undefined) continue;
    shared++;
    sum += (aWon ? 1 : 0) - (bWon ? 1 : 0);
  }
  return { value: shared === 0 ? null : sum / shared, shared };
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
      const value = checkValue(m, check);
      rows.push({
        instrument: inst.id,
        metric: checkLabel(check),
        value,
        band: `[${check.min.toFixed(2)}, ${check.max.toFixed(2)}]`,
        grade: check.grade,
        status: statusFor(value, check),
        source: check.source,
      });
    }
  }
  for (const d of board.deltas) {
    const { value, shared } = deltaValue(d, metricsById);
    rows.push({
      instrument: d.id,
      metric:
        shared === null
          ? `Δ ${d.metric} (${d.a}−${d.b})`
          : `Δ ${d.metric} (${d.a}−${d.b}, ${shared} shared seeds)`,
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
      // 88d — a merge-stages manifest certifies its arm via armArgv (its
      // raw argv is the merge invocation); one without armArgv merged
      // unmanifested stages and cannot certify — fail closed.
      const want = armSignatureOf(inst.args);
      if (a.manifest.kind === 'merge-stages') {
        if (a.manifest.armArgv === undefined) {
          fail(inst.id, 'arm', 'merge-stages manifest carries no armArgv — a stage ran unmanifested; re-merge from manifested stages');
        } else {
          const got = armSignatureOf(a.manifest.armArgv);
          if (got !== want) {
            fail(inst.id, 'arm', `merged armArgv is not this instrument's arm (want '${want}', got '${got}')`);
          }
        }
      } else {
        const got = armSignatureOf(a.manifest.argv);
        if (got !== want) {
          fail(inst.id, 'arm', `manifest argv is not this instrument's arm (want '${want}', got '${got}')`);
        }
      }
    }
    // A checked metric that reads N/A: the instrument could not measure what
    // the board checks — fail-closed, never a silent dash in the drift table.
    const m = metricsById.get(inst.id);
    for (const check of inst.checks) {
      if (m !== undefined && checkValue(m, check) === null) {
        fail(inst.id, 'n/a', `checked metric '${checkLabel(check)}' is unmeasurable on this batch (N/A)`);
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
  // 150b: so does a paired delta whose two found rows share no seed.
  for (const d of board.deltas) {
    if (d.paired === true) {
      const found = (id: string): boolean => auditsById.get(id)?.summaryFound === true;
      if (found(d.a) && found(d.b) && deltaValue(d, metricsById).value === null) {
        fail(d.id, 'n/a', `paired delta: ${d.a} and ${d.b} share no seed with a recorded outcome`);
      }
      continue;
    }
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
  lines.push(`## DRIFT — reference bands vs the signed sheet (${sheetProvenance(board.sheet.signedAt)})`);
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

/** 143b — every instrument's seams, reach and walls by act. No check reads
 *  them yet: the sheet's per-act shape is decided before any band does. */
export function renderActs(board: Board, metricsById: ReadonlyMap<string, InstrumentMetrics>): string {
  const lines: string[] = ['## PER ACT — seams, reach and walls (unchecked: no band reads them yet)', ''];
  const pad = (s: string, w: number): string => s.padEnd(w);
  const fmt = (v: number | null | undefined, digits: number): string =>
    v === null || v === undefined ? '—' : v.toFixed(digits);
  lines.push(
    `${pad('instrument', 20)}${pad('act', 5)}${pad('boss hop', 10)}${pad('arrivals', 10)}${pad('reach', 8)}${pad('wall', 8)}seam pool (crossed)`,
  );
  for (const inst of board.instruments) {
    const m = metricsById.get(inst.id);
    if (m === undefined) continue;
    const acts = new Set([...m.acts.map((a) => a.act), ...m.seams.map((s) => s.act)]);
    for (const act of [...acts].sort((a, b) => a - b)) {
      const a = m.acts.find((x) => x.act === act);
      const s = m.seams.find((x) => x.act === act);
      lines.push(
        `${pad(inst.id, 20)}${pad(String(act), 5)}${pad(a?.bossHop == null ? '—' : String(a.bossHop), 10)}` +
          `${pad(a === undefined ? '—' : String(a.arrivals), 10)}${pad(fmt(a?.reach, 3), 8)}${pad(fmt(a?.wall, 3), 8)}` +
          (s === undefined ? '—' : `${s.pool.toFixed(2)} (${s.crossed})`),
      );
    }
  }
  return lines.join('\n') + '\n';
}
