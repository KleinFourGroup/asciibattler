/**
 * Reporters consume `RunResult[]` from the harness and emit two
 * artifacts:
 *
 *   1. **CSV summary** — one row per run. Cheap to grep, easy to drop
 *      into a spreadsheet for visual sanity checks.
 *   2. **Markdown trace per failure** — one document per loss or hang,
 *      with the recruit history and per-hop battle outcomes. Designed
 *      to be the first thing you read when investigating why fuzz
 *      caught a regression.
 *
 * Both are pure functions returning strings; the CLI writes them to
 * disk. Keeping the IO out of here means tests can assert against the
 * string output without touching the filesystem.
 */

import type { BattleResult, RunResult } from './harness';
import { HEALTH } from '../../src/config/health';
import { getEncounter, type EncounterKind } from '../../src/config/encounters';

const CSV_HEADER = [
  'seed',
  'strategy',
  'daemon',
  'outcome',
  'finalHop',
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
        // L1c3 — the run's rolled/forced idol; 'none' for a daemon-less run
        // (explicit rather than empty: every run HAS a daemon disposition).
        r.daemonId ?? 'none',
        r.outcome,
        r.finalHopReached,
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

/**
 * L1c3 — per-daemon aggregate buckets, keyed by the rolled/forced idol id
 * (`'none'` for daemon-less runs), sorted by key for stable output. Under
 * `--daemon=random` this is the per-idol win/hop read in ONE batch; under a
 * forced arm it degenerates to a single bucket. The future starting-profiles
 * round inherits this bucketing as-is (a profile pins the daemon).
 */
export function perDaemonStats(
  results: readonly RunResult[],
): Array<{ daemon: string; stats: AggregateStats }> {
  const buckets = new Map<string, RunResult[]>();
  for (const r of results) {
    const key = r.daemonId ?? 'none';
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  }
  return [...buckets.keys()]
    .sort()
    .map((daemon) => ({ daemon, stats: aggregate(buckets.get(daemon)!) }));
}

/** L1c3 — the compact stdout block for the per-daemon read. */
export function renderDaemonAnalysis(results: readonly RunResult[]): string {
  const rows = perDaemonStats(results);
  const lines = ['### per-daemon'];
  for (const { daemon, stats } of rows) {
    lines.push(
      `  ${daemon.padEnd(10)} runs=${String(stats.totalRuns).padEnd(5)} ` +
        `win=${(stats.winRate * 100).toFixed(1).padStart(5)}% ` +
        `avgHop=${stats.averageHopReached.toFixed(2)} hangs=${stats.hangs}`,
    );
  }
  return lines.join('\n') + '\n';
}

export interface AggregateStats {
  totalRuns: number;
  byOutcome: Record<string, number>;
  winRate: number;
  averageHopReached: number;
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
  /**
   * N2 — total battles across all runs that the per-turn cap force-resolved as a
   * DRAW (`winner === 'draw'`). This is the "indecisive/slow turn" signal that
   * replaced the old run-ending 'hang' for cap-hits: a capped draw chips both
   * pools and the run continues, so it never shows in `byOutcome`. A non-zero
   * value flags battles the optimal play couldn't decide within `maxTurnSeconds`.
   */
  cappedDraws: number;
}

/**
 * Aggregate quick-glance stats. Win rate counts only `outcome ==
 * 'complete'` (a defeat at hop 4 is still a loss, not a "partial
 * win"). Average hop and ticks include all runs regardless of outcome,
 * because a defeat-at-hop-3 is still informative depth data.
 */
export function aggregate(results: readonly RunResult[]): AggregateStats {
  const byOutcome: Record<string, number> = {};
  const hangsByLayout: Record<string, number> = {};
  let hopSum = 0;
  let tickSum = 0;
  let wins = 0;
  let hangs = 0;
  let cappedDraws = 0;
  for (const r of results) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    hopSum += r.finalHopReached;
    tickSum += r.totalTicks;
    if (r.outcome === 'complete') wins++;
    if (r.outcome === 'hang') {
      hangs++;
      const hangBattle = r.battles[r.battles.length - 1];
      const key = hangBattle ? (hangBattle.layoutId ?? 'procedural') : 'unknown';
      hangsByLayout[key] = (hangsByLayout[key] ?? 0) + 1;
    }
    // N2 — every harness draw comes from the per-turn cap (checkBattleEnd never
    // emits 'draw'), so winner === 'draw' counts the capped/indecisive battles.
    for (const b of r.battles) if (b.winner === 'draw') cappedDraws++;
  }
  const n = results.length;
  return {
    totalRuns: n,
    byOutcome,
    winRate: n === 0 ? 0 : wins / n,
    averageHopReached: n === 0 ? 0 : hopSum / n,
    averageTicks: n === 0 ? 0 : tickSum / n,
    hangs,
    hangsByLayout,
    cappedDraws,
  };
}

/**
 * One markdown document per failure (defeat / hang / aborted). The
 * trace doesn't include a verbose per-tick log — that would balloon
 * fast and isn't read often. Instead it gives the team progression and
 * per-hop outcome, which is enough to start diagnosing without re-
 * running.
 */
export function renderFailureTrace(result: RunResult): string {
  const lines: string[] = [];
  lines.push(`# Fuzz failure — seed ${result.seed} (${result.strategyName})`);
  lines.push('');
  lines.push(`- **Outcome:** ${result.outcome}`);
  lines.push(`- **Final hop reached:** ${result.finalHopReached}`);
  lines.push(`- **Total ticks:** ${result.totalTicks}`);
  lines.push(`- **Final team size:** ${result.finalTeamSize}`);
  lines.push('');
  lines.push('## Battles');
  lines.push('');
  lines.push('| Hop | Layout | Winner | Ticks | Player deaths | Enemy deaths | Player size | Enemy size |');
  lines.push('|----:|:-------|:-------|------:|--------------:|-------------:|------------:|-----------:|');
  for (const b of result.battles) {
    const layout = b.layoutId ?? 'procedural';
    lines.push(
      `| ${b.hop} | ${layout} | ${b.winner} | ${b.ticks} | ${b.playerDeaths} | ${b.enemyDeaths} | ${b.playerTeamSize} | ${b.enemyTeamSize} |`,
    );
  }
  lines.push('');
  lines.push('## Recruits');
  lines.push('');
  if (result.recruits.length === 0) {
    lines.push('_(no recruits — defeat before first victory)_');
  } else {
    lines.push('| After hop | Archetype | Team size after |');
    lines.push('|----------:|:----------|----------------:|');
    for (const r of result.recruits) {
      lines.push(`| ${r.hop} | ${r.archetype} | ${r.teamSizeAfter} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** Slugify a result for use in a filename. Stable across reruns. */
export function failureFilename(result: RunResult): string {
  return `${result.strategyName}-seed${result.seed}-${result.outcome}.md`;
}

// ── Per-hop team analysis (G4 balance telemetry) ─────────────────────────────

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

export interface HopStats {
  hop: number;
  /** RUNS that reached this hop (`finalHopReached >= hop`) — the survival
   *  funnel denominator. (NOT battle count — hops have multiple waves under the
   *  H4/H5 pool+deck system, so battles ≠ runs.) */
  runsReached: number;
  /** RUNS that ENDED on this hop (`outcome !== 'complete' && finalHopReached
   *  === hop`) — the true loss-hop histogram. Σ over hops = total non-wins.
   *  This is run-level (a lost wave only chips the pool); use it, not wave losses,
   *  to answer "where do runs die." */
  runsDied: number;
  /** `runsDied / runsReached` — the conditional run-death rate GIVEN you reached
   *  this hop. A high hop-1 value vs later hops = a front-loaded "hop-1
   *  wall," not a smooth ramp. */
  deathRate: number;
  /** Battles (waves) fought on this hop across all runs — multiple per hop. */
  battles: number;
  /** Mean player-unit deaths per WAVE on this hop — the per-battle attrition
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
 * Pool every battle by hop (across all runs/strategies in `results`) and
 * compute per-hop team composition: mean/median unit level, within-team
 * level spread, and mean team size — for both sides. Levels are sampled at
 * battle START (pre-deaths), so this reflects the army that walks onto each
 * hop, not the survivors. Deeper hops are sparse (bots die first) — the
 * `battles` column is the sample size; weight your read by it.
 */
export function perHopStats(results: readonly RunResult[]): HopStats[] {
  const byHop = new Map<number, BattleResult[]>();
  for (const r of results) {
    for (const b of r.battles) {
      const arr = byHop.get(b.hop);
      if (arr) arr.push(b);
      else byHop.set(b.hop, [b]);
    }
  }
  return [...byHop.keys()]
    .sort((a, b) => a - b)
    .map((hop) => {
      const bs = byHop.get(hop)!;
      const runsReached = results.filter((r) => r.finalHopReached >= hop).length;
      const runsDied = results.filter(
        (r) => r.outcome !== 'complete' && r.finalHopReached === hop,
      ).length;
      return {
        hop,
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

/** Render `perHopStats` as a fixed-width terminal table. */
export function renderPerHopAnalysis(results: readonly RunResult[]): string {
  const rows = perHopStats(results);
  const totalBattles = results.reduce((acc, r) => acc + r.battles.length, 0);
  const header = [
    'Hop',
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
  const cell = (rs: HopStats): string[] => [
    String(rs.hop),
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
  lines.push(`### Per-hop team analysis (${totalBattles} battles across ${results.length} runs)`);
  lines.push('Runs = runs that REACHED this hop · Died = runs that ENDED here (run-level)');
  lines.push('Died% = Died/Runs (this hop’s conditional run-death rate — the funnel)');
  lines.push('Waves = battles fought here (multiple/hop) · Dths/wv = mean player deaths per wave');
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
   *  end the run (use the per-hop run-death rate for that). */
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

export interface LayoutHopStats extends LayoutStats {
  hop: number;
}

function layoutKey(b: BattleResult): string {
  return b.layoutId ?? 'procedural';
}

/** Shared per-layout reduction over a battle bucket (used by both the
 *  layout-only and the layout×hop groupings). */
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
 * Pool by layout × hop — disentangles "this layout is hard" from "it shows up
 * early with a weak roster." Sorted by layout, then hop.
 */
export function perLayoutHopStats(results: readonly RunResult[]): LayoutHopStats[] {
  const byKey = new Map<string, { layout: string; hop: number; bs: BattleResult[] }>();
  for (const r of results) {
    for (const b of r.battles) {
      const layout = layoutKey(b);
      const k = `${layout} ${b.hop}`;
      const entry = byKey.get(k);
      if (entry) entry.bs.push(b);
      else byKey.set(k, { layout, hop: b.hop, bs: [b] });
    }
  }
  return [...byKey.values()]
    .map(({ layout, hop, bs }) => ({ ...layoutCore(layout, bs), hop }))
    .sort((a, b) => a.layout.localeCompare(b.layout) || a.hop - b.hop);
}

/** Fixed-width table: left-align column 0 (labels), right-align the rest. */
function renderTable(header: readonly string[], rows: readonly string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const fmt = (cells: readonly string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  return [fmt(header), ...rows.map(fmt)].join('\n');
}

/** Render the per-layout + per-layout×hop difficulty tables. */
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
  lines.push('### Per-layout × hop (disentangles layout difficulty from roster strength by depth)');
  lines.push('');
  lines.push(
    renderTable(
      ['Layout', 'Hop', 'Waves', 'PWin%', 'PDth/wv', 'P.size', 'E.size'],
      perLayoutHopStats(results).map((s) => [
        s.layout,
        String(s.hop),
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

/** CSV of `perLayoutHopStats` (one row per layout×hop). */
export function renderLayoutHopCsv(stats: readonly LayoutHopStats[]): string {
  const header =
    'layout,hop,waves,playerWinRate,enemyWinRate,avgPlayerDeaths,avgEnemyDeaths,playerSize,enemySize';
  const rows = stats.map((s) =>
    [
      s.layout,
      s.hop,
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

// ── Per-encounter difficulty analysis (X2) ────────────────────────────────────

/**
 * The X balance metric, keyed by `Encounter.id`. The TUNING signal is
 * **player pool damage TAKEN** — the HP chipped off the player's encounter
 * health pool. A turn's pool chip (`battle:ended.survivorPower`, captured in the
 * opt-in telemetry's `poolChips`) carries it as the `enemy` field: enemy
 * survivors chip the PLAYER pool (`resolveTurn` in Run.ts), scaled by
 * `HEALTH.chipMultiplier` to land in pool-HP units (comparable to `healthPool`).
 *
 * Two units, deliberately distinct (BALANCE.md): **per instance** (a whole node
 * visit — the encounter's cost, the unit the per-kind bands compare: a multi-wave
 * boss accrues across all its turns) and **per wave** (one turn — the finer read).
 * An encounter instance = one node visit; within a run a hop is visited once, so
 * a run's `poolChips` group into instances by hop.
 *
 * Pool columns need telemetry on (`--per-encounter` enables it); without it the
 * outcome columns (from `battles`, always present) still populate and the pool
 * columns read blank (`hasPoolData` false).
 */
export interface EncounterStats {
  /** `Encounter.id`. */
  encounter: string;
  /** The encounter's authored `kind` (`normal`/`elite`/`boss`) — the per-kind
   *  band axis; `'unknown'` if the id no longer resolves in the catalog. */
  kind: EncounterKind | 'unknown';
  /** Distinct encounter INSTANCES (node visits) with pool data — the per-instance
   *  denominator. 0 when telemetry is off. */
  instances: number;
  /** Turns (waves) fought for this encounter across all runs — the SAMPLE SIZE.
   *  A natural run hits a given encounter rarely (many encounters dilute it), so
   *  force one with `--encounter=<id>` for a clean sample. */
  waves: number;
  /** Fraction of waves the PLAYER won tactically (`winner === 'player'`); WAVE
   *  level (a lost wave chips the pool, doesn't end the run). */
  playerWinRate: number;
  enemyWinRate: number;
  /** Mean player/enemy deaths per wave. */
  avgPlayerDeaths: number;
  avgEnemyDeaths: number;
  playerSize: number;
  enemySize: number;
  /** Mean PLAYER pool damage TAKEN per encounter INSTANCE (HP) — the X tuning
   *  metric. 0 when `hasPoolData` is false. */
  poolDmgTaken: number;
  /** Mean player pool damage taken per WAVE (turn) — the finer read. */
  poolDmgTakenPerWave: number;
  /** Mean ENEMY pool damage DEALT per instance (HP) — the secondary read (how
   *  fast you grind the encounter down). */
  poolDmgDealt: number;
  /** Whether any pool-chip telemetry was present for this encounter. */
  hasPoolData: boolean;
}

function encounterKindOf(id: string): EncounterKind | 'unknown' {
  return getEncounter(id)?.kind ?? 'unknown';
}

interface EncounterAccum {
  battles: BattleResult[];
  /** Per-instance player pool damage taken / enemy pool damage dealt (HP). */
  instancesTaken: number[];
  instancesDealt: number[];
  /** Per-wave running sums (turns with pool data). */
  poolWaves: number;
  takenWaveSum: number;
  dealtWaveSum: number;
}

/**
 * Pool every battle + pool chip by encounter id (across all runs). Sorted
 * most-costly-first (highest per-instance pool damage taken), ties to the bigger
 * sample then id. Answers "which encounter costs the player the most pool" — the
 * step-3 off-band read.
 */
export function perEncounterStats(results: readonly RunResult[]): EncounterStats[] {
  const chipMult = HEALTH.chipMultiplier;
  const byEnc = new Map<string, EncounterAccum>();
  const ensure = (id: string): EncounterAccum => {
    let e = byEnc.get(id);
    if (!e) {
      e = { battles: [], instancesTaken: [], instancesDealt: [], poolWaves: 0, takenWaveSum: 0, dealtWaveSum: 0 };
      byEnc.set(id, e);
    }
    return e;
  };

  for (const r of results) {
    for (const b of r.battles) ensure(b.encounterId).battles.push(b);
    // Pool instances: group THIS run's chips by hop (one node visit = one hop =
    // one instance); the encounter id is constant within a hop group.
    const chips = r.telemetry?.poolChips ?? [];
    const byHop = new Map<number, { encounterId: string; taken: number; dealt: number }>();
    for (const c of chips) {
      const taken = c.enemy * chipMult; // enemy survivors chip the PLAYER pool
      const dealt = c.player * chipMult; // player survivors chip the ENEMY pool
      const g = byHop.get(c.hop);
      if (g) {
        g.taken += taken;
        g.dealt += dealt;
      } else {
        byHop.set(c.hop, { encounterId: c.encounterId, taken, dealt });
      }
      const e = ensure(c.encounterId);
      e.poolWaves += 1;
      e.takenWaveSum += taken;
      e.dealtWaveSum += dealt;
    }
    for (const g of byHop.values()) {
      const e = ensure(g.encounterId);
      e.instancesTaken.push(g.taken);
      e.instancesDealt.push(g.dealt);
    }
  }

  return [...byEnc.entries()]
    .map(([encounter, e]): EncounterStats => {
      const n = e.battles.length;
      const frac = (pred: (b: BattleResult) => boolean): number =>
        n === 0 ? 0 : e.battles.filter(pred).length / n;
      return {
        encounter,
        kind: encounterKindOf(encounter),
        instances: e.instancesTaken.length,
        waves: n,
        playerWinRate: frac((b) => b.winner === 'player'),
        enemyWinRate: frac((b) => b.winner === 'enemy'),
        avgPlayerDeaths: mean(e.battles.map((b) => b.playerDeaths)),
        avgEnemyDeaths: mean(e.battles.map((b) => b.enemyDeaths)),
        playerSize: mean(e.battles.map((b) => b.playerTeamSize)),
        enemySize: mean(e.battles.map((b) => b.enemyTeamSize)),
        poolDmgTaken: mean(e.instancesTaken),
        poolDmgTakenPerWave: e.poolWaves === 0 ? 0 : e.takenWaveSum / e.poolWaves,
        poolDmgDealt: mean(e.instancesDealt),
        hasPoolData: e.instancesTaken.length > 0,
      };
    })
    .sort(
      (a, b) =>
        b.poolDmgTaken - a.poolDmgTaken ||
        b.waves - a.waves ||
        a.encounter.localeCompare(b.encounter),
    );
}

/** Render the per-encounter difficulty table (the X step-3 read). */
export function renderEncounterAnalysis(results: readonly RunResult[]): string {
  const rows = perEncounterStats(results);
  const totalWaves = results.reduce((acc, r) => acc + r.battles.length, 0);
  const anyPool = rows.some((r) => r.hasPoolData);
  const lines: string[] = [];
  lines.push(`### Per-encounter difficulty (${totalWaves} waves across ${results.length} runs)`);
  lines.push('Inst = encounter instances (node visits w/ pool data) · Waves = turns (SAMPLE SIZE —');
  lines.push('  force one with --encounter=<id> for a full sample). PWin%/EWin% = player/enemy WAVE win.');
  lines.push('PDmgTaken = mean PLAYER pool damage TAKEN per instance (HP — the X tuning metric); /wv = per wave.');
  lines.push('EDmgDlt = mean enemy-pool damage dealt per instance. Sorted most-costly-first (PDmgTaken).');
  if (!anyPool) {
    lines.push('(no pool data — telemetry was off; --per-encounter enables it. Pool columns blank.)');
  }
  lines.push('');
  const header = [
    'Encounter',
    'Kind',
    'Inst',
    'Waves',
    'PWin%',
    'EWin%',
    'PDth/wv',
    'PDmgTaken',
    '/wv',
    'EDmgDlt',
    'P.size',
    'E.size',
  ];
  const cell = (s: EncounterStats): string[] => [
    s.encounter,
    s.kind,
    String(s.instances),
    String(s.waves),
    (s.playerWinRate * 100).toFixed(0),
    (s.enemyWinRate * 100).toFixed(0),
    s.avgPlayerDeaths.toFixed(1),
    s.hasPoolData ? s.poolDmgTaken.toFixed(1) : '—',
    s.hasPoolData ? s.poolDmgTakenPerWave.toFixed(1) : '—',
    s.hasPoolData ? s.poolDmgDealt.toFixed(1) : '—',
    s.playerSize.toFixed(1),
    s.enemySize.toFixed(1),
  ];
  lines.push(renderTable(header, rows.map(cell)));
  return lines.join('\n') + '\n';
}

/** CSV of `perEncounterStats` (one row per encounter) for spreadsheet analysis. */
export function renderEncounterCsv(stats: readonly EncounterStats[]): string {
  const header =
    'encounter,kind,instances,waves,playerWinRate,enemyWinRate,avgPlayerDeaths,avgEnemyDeaths,' +
    'playerSize,enemySize,poolDmgTaken,poolDmgTakenPerWave,poolDmgDealt';
  const rows = stats.map((s) =>
    [
      s.encounter,
      s.kind,
      s.instances,
      s.waves,
      s.playerWinRate.toFixed(4),
      s.enemyWinRate.toFixed(4),
      s.avgPlayerDeaths.toFixed(3),
      s.avgEnemyDeaths.toFixed(3),
      s.playerSize.toFixed(3),
      s.enemySize.toFixed(3),
      s.poolDmgTaken.toFixed(3),
      s.poolDmgTakenPerWave.toFixed(3),
      s.poolDmgDealt.toFixed(3),
    ].join(','),
  );
  return [header, ...rows].join('\n') + '\n';
}
