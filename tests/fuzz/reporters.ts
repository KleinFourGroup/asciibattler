/**
 * Reporters consume `RunResult[]` from the harness and emit two
 * artifacts:
 *
 *   1. **CSV summary** — one row per run. Cheap to grep, easy to drop
 *      into a spreadsheet for visual sanity checks.
 *   2. **Markdown trace per failure** — one document per loss or hang,
 *      with the recruit history and per-floor battle outcomes. Designed
 *      to be the first thing you read when investigating why fuzz
 *      caught a regression.
 *
 * Both are pure functions returning strings; the CLI writes them to
 * disk. Keeping the IO out of here means tests can assert against the
 * string output without touching the filesystem.
 */

import type { BattleResult, RunResult } from './harness';

const CSV_HEADER = [
  'seed',
  'strategy',
  'outcome',
  'finalFloor',
  'totalTicks',
  'finalTeamSize',
  'battlesPlayed',
  'totalPlayerDeaths',
  'totalEnemyDeaths',
  'recruitedMelee',
  'recruitedRanged',
  'hangLayout',
].join(',');

export function renderSummaryCsv(results: readonly RunResult[]): string {
  const lines: string[] = [CSV_HEADER];
  for (const r of results) {
    const playerDeaths = r.battles.reduce((acc, b) => acc + b.playerDeaths, 0);
    const enemyDeaths = r.battles.reduce((acc, b) => acc + b.enemyDeaths, 0);
    const meleeRecruits = r.recruits.filter((x) => x.archetype === 'mercenary').length;
    const rangedRecruits = r.recruits.filter((x) => x.archetype === 'ranged').length;
    // The hung battle (if any) is always the last entry — harness aborts
    // the run on hang. Empty string for non-hung runs so CSV consumers
    // can spreadsheet-filter on layout without nulls.
    const hangBattle =
      r.outcome === 'hang' ? r.battles[r.battles.length - 1] : undefined;
    const hangLayout = hangBattle ? (hangBattle.layoutId ?? 'procedural') : '';
    lines.push(
      [
        r.seed,
        r.strategyName,
        r.outcome,
        r.finalFloorReached,
        r.totalTicks,
        r.finalTeamSize,
        r.battles.length,
        playerDeaths,
        enemyDeaths,
        meleeRecruits,
        rangedRecruits,
        hangLayout,
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}

export interface AggregateStats {
  totalRuns: number;
  byOutcome: Record<string, number>;
  winRate: number;
  averageFloorReached: number;
  averageTicks: number;
  hangs: number;
  /**
   * Per-layout hang counts — keyed by `layoutId`, with `'procedural'` for
   * the null path. Only populated when the strategy actually hung
   * somewhere; empty `{}` when `hangs === 0`. Lets you tell at a glance
   * whether a hang cluster lives in one specific layout (the C1d
   * Labyrinth signature) or is spread across the library.
   */
  hangsByLayout: Record<string, number>;
}

/**
 * Aggregate quick-glance stats. Win rate counts only `outcome ==
 * 'complete'` (a defeat at floor 4 is still a loss, not a "partial
 * win"). Average floor and ticks include all runs regardless of outcome,
 * because a defeat-at-floor-3 is still informative depth data.
 */
export function aggregate(results: readonly RunResult[]): AggregateStats {
  const byOutcome: Record<string, number> = {};
  const hangsByLayout: Record<string, number> = {};
  let floorSum = 0;
  let tickSum = 0;
  let wins = 0;
  let hangs = 0;
  for (const r of results) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    floorSum += r.finalFloorReached;
    tickSum += r.totalTicks;
    if (r.outcome === 'complete') wins++;
    if (r.outcome === 'hang') {
      hangs++;
      const hangBattle = r.battles[r.battles.length - 1];
      const key = hangBattle ? (hangBattle.layoutId ?? 'procedural') : 'unknown';
      hangsByLayout[key] = (hangsByLayout[key] ?? 0) + 1;
    }
  }
  const n = results.length;
  return {
    totalRuns: n,
    byOutcome,
    winRate: n === 0 ? 0 : wins / n,
    averageFloorReached: n === 0 ? 0 : floorSum / n,
    averageTicks: n === 0 ? 0 : tickSum / n,
    hangs,
    hangsByLayout,
  };
}

/**
 * One markdown document per failure (defeat / hang / aborted). The
 * trace doesn't include a verbose per-tick log — that would balloon
 * fast and isn't read often. Instead it gives the team progression and
 * per-floor outcome, which is enough to start diagnosing without re-
 * running.
 */
export function renderFailureTrace(result: RunResult): string {
  const lines: string[] = [];
  lines.push(`# Fuzz failure — seed ${result.seed} (${result.strategyName})`);
  lines.push('');
  lines.push(`- **Outcome:** ${result.outcome}`);
  lines.push(`- **Final floor reached:** ${result.finalFloorReached}`);
  lines.push(`- **Total ticks:** ${result.totalTicks}`);
  lines.push(`- **Final team size:** ${result.finalTeamSize}`);
  lines.push('');
  lines.push('## Battles');
  lines.push('');
  lines.push('| Floor | Layout | Winner | Ticks | Player deaths | Enemy deaths | Player size | Enemy size |');
  lines.push('|------:|:-------|:-------|------:|--------------:|-------------:|------------:|-----------:|');
  for (const b of result.battles) {
    const layout = b.layoutId ?? 'procedural';
    lines.push(
      `| ${b.floor} | ${layout} | ${b.winner} | ${b.ticks} | ${b.playerDeaths} | ${b.enemyDeaths} | ${b.playerTeamSize} | ${b.enemyTeamSize} |`,
    );
  }
  lines.push('');
  lines.push('## Recruits');
  lines.push('');
  if (result.recruits.length === 0) {
    lines.push('_(no recruits — defeat before first victory)_');
  } else {
    lines.push('| After floor | Archetype | Team size after |');
    lines.push('|------------:|:----------|----------------:|');
    for (const r of result.recruits) {
      lines.push(`| ${r.floor} | ${r.archetype} | ${r.teamSizeAfter} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** Slugify a result for use in a filename. Stable across reruns. */
export function failureFilename(result: RunResult): string {
  return `${result.strategyName}-seed${result.seed}-${result.outcome}.md`;
}

// ── Per-floor team analysis (G4 balance telemetry) ───────────────────────────

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

/** Population standard deviation — the "how spread out are these" number. */
function stddev(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export interface FloorStats {
  floor: number;
  /** RUNS that reached this floor (`finalFloorReached >= floor`) — the survival
   *  funnel denominator. (NOT battle count — floors have multiple waves under the
   *  H4/H5 pool+deck system, so battles ≠ runs.) */
  runsReached: number;
  /** RUNS that ENDED on this floor (`outcome !== 'complete' && finalFloorReached
   *  === floor`) — the true loss-floor histogram. Σ over floors = total non-wins.
   *  This is run-level (a lost wave only chips the pool); use it, not wave losses,
   *  to answer "where do runs die." */
  runsDied: number;
  /** `runsDied / runsReached` — the conditional run-death rate GIVEN you reached
   *  this floor. A high floor-1 value vs later floors = a front-loaded "floor-1
   *  wall," not a smooth ramp. */
  deathRate: number;
  /** Battles (waves) fought on this floor across all runs — multiple per floor. */
  battles: number;
  /** Mean player-unit deaths per WAVE on this floor — the per-battle attrition
   *  (distinct from run-death: heavy early attrition the pool can still absorb). */
  avgPlayerDeaths: number;
  playerSize: number;
  playerAvgLevel: number;
  playerMedianLevel: number;
  /** Mean WITHIN-team level stddev — how much unit levels vary inside a team. */
  playerLevelSpread: number;
  enemySize: number;
  enemyAvgLevel: number;
  enemyMedianLevel: number;
  enemyLevelSpread: number;
}

/**
 * Pool every battle by floor (across all runs/strategies in `results`) and
 * compute per-floor team composition: mean/median unit level, within-team
 * level spread, and mean team size — for both sides. Levels are sampled at
 * battle START (pre-deaths), so this reflects the army that walks onto each
 * floor, not the survivors. Deeper floors are sparse (bots die first) — the
 * `battles` column is the sample size; weight your read by it.
 */
export function perFloorStats(results: readonly RunResult[]): FloorStats[] {
  const byFloor = new Map<number, BattleResult[]>();
  for (const r of results) {
    for (const b of r.battles) {
      const arr = byFloor.get(b.floor);
      if (arr) arr.push(b);
      else byFloor.set(b.floor, [b]);
    }
  }
  return [...byFloor.keys()]
    .sort((a, b) => a - b)
    .map((floor) => {
      const bs = byFloor.get(floor)!;
      const runsReached = results.filter((r) => r.finalFloorReached >= floor).length;
      const runsDied = results.filter(
        (r) => r.outcome !== 'complete' && r.finalFloorReached === floor,
      ).length;
      return {
        floor,
        runsReached,
        runsDied,
        deathRate: runsReached === 0 ? 0 : runsDied / runsReached,
        battles: bs.length,
        avgPlayerDeaths: mean(bs.map((b) => b.playerDeaths)),
        playerSize: mean(bs.map((b) => b.playerTeamSize)),
        playerAvgLevel: mean(bs.flatMap((b) => b.playerLevels)),
        playerMedianLevel: median(bs.flatMap((b) => b.playerLevels)),
        playerLevelSpread: mean(bs.map((b) => stddev(b.playerLevels))),
        enemySize: mean(bs.map((b) => b.enemyTeamSize)),
        enemyAvgLevel: mean(bs.flatMap((b) => b.enemyLevels)),
        enemyMedianLevel: median(bs.flatMap((b) => b.enemyLevels)),
        enemyLevelSpread: mean(bs.map((b) => stddev(b.enemyLevels))),
      };
    });
}

/** Render `perFloorStats` as a fixed-width terminal table. */
export function renderPerFloorAnalysis(results: readonly RunResult[]): string {
  const rows = perFloorStats(results);
  const totalBattles = results.reduce((acc, r) => acc + r.battles.length, 0);
  const header = [
    'Floor',
    'Runs',
    'Died',
    'Died%',
    'Waves',
    'Dths/wv',
    'P.size',
    'P.avgLv',
    'P.medLv',
    'P.spread',
    'E.size',
    'E.avgLv',
    'E.medLv',
    'E.spread',
  ];
  const cell = (rs: FloorStats): string[] => [
    String(rs.floor),
    String(rs.runsReached),
    String(rs.runsDied),
    (rs.deathRate * 100).toFixed(0),
    String(rs.battles),
    rs.avgPlayerDeaths.toFixed(1),
    rs.playerSize.toFixed(1),
    rs.playerAvgLevel.toFixed(2),
    rs.playerMedianLevel.toFixed(1),
    rs.playerLevelSpread.toFixed(2),
    rs.enemySize.toFixed(1),
    rs.enemyAvgLevel.toFixed(2),
    rs.enemyMedianLevel.toFixed(1),
    rs.enemyLevelSpread.toFixed(2),
  ];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => cell(r)[i]!.length)),
  );
  const fmt = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i]!)).join('  ');
  const lines: string[] = [];
  lines.push(`### Per-floor team analysis (${totalBattles} battles across ${results.length} runs)`);
  lines.push('Runs = runs that REACHED this floor · Died = runs that ENDED here (run-level)');
  lines.push('Died% = Died/Runs (this floor’s conditional run-death rate — the funnel)');
  lines.push('Waves = battles fought here (multiple/floor) · Dths/wv = mean player deaths per wave');
  lines.push('P = player, E = enemy · avgLv/medLv = mean/median unit level (pooled)');
  lines.push('spread = mean within-team level stddev · size = mean team size');
  lines.push('');
  lines.push(fmt(header));
  for (const r of rows) lines.push(fmt(cell(r)));
  return lines.join('\n') + '\n';
}

// ── Per-layout difficulty analysis ───────────────────────────────────────────

export interface LayoutStats {
  /** `layoutId`, or `'procedural'` for the null (generated-terrain) path. */
  layout: string;
  /** Waves (battles) fought on this layout across all runs — the SAMPLE SIZE.
   *  A hand-authored layout is only ~12% of natural battles (~75% library ÷ 6),
   *  so weight a read by this; force the layout (`--layout`) for a clean sample. */
  battles: number;
  /** Fraction of those waves the PLAYER won tactically (`winner === 'player'`).
   *  The brutality headline. WAVE-level: a lost wave chips the pool but doesn't
   *  end the run (use the per-floor run-death rate for that). */
  playerWinRate: number;
  /** Fraction the ENEMY won (`winner === 'enemy'`); the remainder up to 1 is
   *  draws (tick-cap) + hangs. */
  enemyWinRate: number;
  /** Mean player-unit deaths per wave on this layout — the attrition cost. */
  avgPlayerDeaths: number;
  avgEnemyDeaths: number;
  /** Mean team sizes at wave START. `enemySize` ≫ `playerSize` flags an
   *  outnumbered "ambush" layout (the spawn disadvantage, before any deaths). */
  playerSize: number;
  enemySize: number;
}

export interface LayoutFloorStats extends LayoutStats {
  floor: number;
}

function layoutKey(b: BattleResult): string {
  return b.layoutId ?? 'procedural';
}

/** Shared per-layout reduction over a battle bucket (used by both the
 *  layout-only and the layout×floor groupings). */
function layoutCore(layout: string, bs: readonly BattleResult[]): LayoutStats {
  const n = bs.length;
  const frac = (pred: (b: BattleResult) => boolean) =>
    n === 0 ? 0 : bs.filter(pred).length / n;
  return {
    layout,
    battles: n,
    playerWinRate: frac((b) => b.winner === 'player'),
    enemyWinRate: frac((b) => b.winner === 'enemy'),
    avgPlayerDeaths: mean(bs.map((b) => b.playerDeaths)),
    avgEnemyDeaths: mean(bs.map((b) => b.enemyDeaths)),
    playerSize: mean(bs.map((b) => b.playerTeamSize)),
    enemySize: mean(bs.map((b) => b.enemyTeamSize)),
  };
}

/**
 * Pool every battle by layout (across all runs/strategies). Sorted
 * most-brutal-first (lowest player wave-win rate), ties to the bigger sample
 * then layout name. Answers "which layouts are disproportionately hard."
 */
export function perLayoutStats(results: readonly RunResult[]): LayoutStats[] {
  const byLayout = new Map<string, BattleResult[]>();
  for (const r of results) {
    for (const b of r.battles) {
      const k = layoutKey(b);
      const arr = byLayout.get(k);
      if (arr) arr.push(b);
      else byLayout.set(k, [b]);
    }
  }
  return [...byLayout.entries()]
    .map(([layout, bs]) => layoutCore(layout, bs))
    .sort(
      (a, b) =>
        a.playerWinRate - b.playerWinRate ||
        b.battles - a.battles ||
        a.layout.localeCompare(b.layout),
    );
}

/**
 * Pool by layout × floor — disentangles "this layout is hard" from "it shows up
 * early with a weak roster." Sorted by layout, then floor.
 */
export function perLayoutFloorStats(results: readonly RunResult[]): LayoutFloorStats[] {
  const byKey = new Map<string, { layout: string; floor: number; bs: BattleResult[] }>();
  for (const r of results) {
    for (const b of r.battles) {
      const layout = layoutKey(b);
      const k = `${layout} ${b.floor}`;
      const entry = byKey.get(k);
      if (entry) entry.bs.push(b);
      else byKey.set(k, { layout, floor: b.floor, bs: [b] });
    }
  }
  return [...byKey.values()]
    .map(({ layout, floor, bs }) => ({ ...layoutCore(layout, bs), floor }))
    .sort((a, b) => a.layout.localeCompare(b.layout) || a.floor - b.floor);
}

/** Fixed-width table: left-align column 0 (labels), right-align the rest. */
function renderTable(header: readonly string[], rows: readonly string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const fmt = (cells: readonly string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  return [fmt(header), ...rows.map(fmt)].join('\n');
}

/** Render the per-layout + per-layout×floor difficulty tables. */
export function renderLayoutAnalysis(results: readonly RunResult[]): string {
  const totalBattles = results.reduce((acc, r) => acc + r.battles.length, 0);
  const lines: string[] = [];
  lines.push(`### Per-layout difficulty (${totalBattles} waves across ${results.length} runs)`);
  lines.push('Waves = battles on this layout (SAMPLE SIZE — a layout is only ~12% of natural battles;');
  lines.push('  force one with --layout=<id> for a full sample). PWin%/EWin% = player/enemy WAVE win');
  lines.push('  rate (remainder = draws + hangs) · Dth/wv = mean deaths per wave.');
  lines.push('E.size ≫ P.size ⇒ outnumbered ("ambush"). Sorted most-brutal-first (lowest PWin%).');
  lines.push('');
  lines.push(
    renderTable(
      ['Layout', 'Waves', 'PWin%', 'EWin%', 'PDth/wv', 'EDth/wv', 'P.size', 'E.size'],
      perLayoutStats(results).map((s) => [
        s.layout,
        String(s.battles),
        (s.playerWinRate * 100).toFixed(0),
        (s.enemyWinRate * 100).toFixed(0),
        s.avgPlayerDeaths.toFixed(1),
        s.avgEnemyDeaths.toFixed(1),
        s.playerSize.toFixed(1),
        s.enemySize.toFixed(1),
      ]),
    ),
  );
  lines.push('');
  lines.push('### Per-layout × floor (disentangles layout difficulty from roster strength by depth)');
  lines.push('');
  lines.push(
    renderTable(
      ['Layout', 'Floor', 'Waves', 'PWin%', 'PDth/wv', 'P.size', 'E.size'],
      perLayoutFloorStats(results).map((s) => [
        s.layout,
        String(s.floor),
        String(s.battles),
        (s.playerWinRate * 100).toFixed(0),
        s.avgPlayerDeaths.toFixed(1),
        s.playerSize.toFixed(1),
        s.enemySize.toFixed(1),
      ]),
    ),
  );
  return lines.join('\n') + '\n';
}

/** CSV of `perLayoutStats` (one row per layout) for spreadsheet filtering. */
export function renderLayoutCsv(stats: readonly LayoutStats[]): string {
  const header = 'layout,waves,playerWinRate,enemyWinRate,avgPlayerDeaths,avgEnemyDeaths,playerSize,enemySize';
  const rows = stats.map((s) =>
    [
      s.layout,
      s.battles,
      s.playerWinRate.toFixed(4),
      s.enemyWinRate.toFixed(4),
      s.avgPlayerDeaths.toFixed(3),
      s.avgEnemyDeaths.toFixed(3),
      s.playerSize.toFixed(3),
      s.enemySize.toFixed(3),
    ].join(','),
  );
  return [header, ...rows].join('\n') + '\n';
}

/** CSV of `perLayoutFloorStats` (one row per layout×floor). */
export function renderLayoutFloorCsv(stats: readonly LayoutFloorStats[]): string {
  const header =
    'layout,floor,waves,playerWinRate,enemyWinRate,avgPlayerDeaths,avgEnemyDeaths,playerSize,enemySize';
  const rows = stats.map((s) =>
    [
      s.layout,
      s.floor,
      s.battles,
      s.playerWinRate.toFixed(4),
      s.enemyWinRate.toFixed(4),
      s.avgPlayerDeaths.toFixed(3),
      s.avgEnemyDeaths.toFixed(3),
      s.playerSize.toFixed(3),
      s.enemySize.toFixed(3),
    ].join(','),
  );
  return [header, ...rows].join('\n') + '\n';
}
