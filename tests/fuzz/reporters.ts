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
    const meleeRecruits = r.recruits.filter((x) => x.archetype === 'melee').length;
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
  battles: number;
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
      return {
        floor,
        battles: bs.length,
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
    'Battles',
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
    String(rs.battles),
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
  lines.push('P = player, E = enemy · avgLv/medLv = mean/median unit level (pooled)');
  lines.push('spread = mean within-team level stddev · size = mean team size');
  lines.push('');
  lines.push(fmt(header));
  for (const r of rows) lines.push(fmt(cell(r)));
  return lines.join('\n') + '\n';
}
