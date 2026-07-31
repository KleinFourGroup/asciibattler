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
  // 50g — appended LAST (after the sometimes-empty hangLayout) so every
  // pre-existing column keeps its position for positional consumers.
  'portPurchases',
  'finalBits',
  // 59a — same append-last rule; the fire seam's non-vacuous proof.
  'packetsFired',
  // 68e — same append-last rule; the finalHop-gap fix. `finalHop` above stays
  // PER-SECTOR — a walk read splits acts on (sectorsCleared, finalHop).
  'sectorsCleared',
].join(',');

export function renderSummaryCsv(results: readonly RunResult[]): string {
  const lines: string[] = [CSV_HEADER];
  for (const r of results) {
    const playerDeaths = r.battles.reduce((acc, b) => acc + b.playerDeaths, 0);
    const enemyDeaths = r.battles.reduce((acc, b) => acc + b.enemyDeaths, 0);
    const meleeRecruits = r.recruits.filter((x) => x.archetype === 'mercenary').length;
    const rangedRecruits = r.recruits.filter((x) => x.archetype === 'archer').length;
    // The hung battle (if any) is always the last entry — harness aborts
    // the run on hang. Empty string for non-hung runs so CSV consumers
    // can spreadsheet-filter on layout without nulls.
    const hangBattle = r.outcome === 'hang' ? r.battles[r.battles.length - 1] : undefined;
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
        r.portPurchases,
        r.finalBits,
        r.packetsFired,
        r.sectorsCleared,
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}

// ── The decisions.csv sidecar (71a) ──────────────────────────────────────────

/** RFC4180-style quoting, applied only when the field needs it (comma or
 *  quote) — redraw labels carry commas (`redraw level:2 [0,2]`), and minimal
 *  quoting keeps every other column byte-identical to a naive join. */
function csvField(s: string): string {
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const DECISIONS_CSV_HEADER = [
  'seed',
  'strategy',
  // 0-based decide order within the run (the driver log is append-only).
  'decision',
  'site',
  'sector',
  'hop',
  // Index into the decision's candidate set; 0 is ALWAYS the null arm.
  'candidate',
  'label',
  // 1 on exactly one row per decision (the chosen candidate; 0 = null stood).
  'chosen',
  // Mean over the CRN pairs — what the driver compared.
  'score',
  // Mean breakdown components over the pairs (the resolution-4 columns).
  'poolDmgTaken',
  'deathFrac',
  'completeFrac',
  'bitsDelta',
  'rosterDelta',
  // Blank unless the site carried a tailScore (node choice, searched vectors).
  'tailBonus',
  // Decision-level (repeated on each of the decision's rows): best challenger
  // mean − null mean, and the ε it was judged against.
  'marginVsNull',
  'epsilon',
].join(',');

/**
 * 71a — the decision-grade sidecar: LONG format, one row per
 * (seed, decision, candidate) including the null arm at candidate 0, so a
 * spreadsheet filter on any column slices the batch without reshaping.
 * Means only — the full per-pair breakdowns stay reachable via
 * `--emit-results` results.json (the shape-lock call). Results without a
 * decision log (non-arbitrated arms) contribute no rows, so the writer can
 * run over a mixed batch unconditionally.
 */
export function renderDecisionsCsv(results: readonly RunResult[]): string {
  const lines: string[] = [DECISIONS_CSV_HEADER];
  for (const r of results) {
    if (!r.decisions) continue;
    r.decisions.forEach((d, decisionIndex) => {
      d.results.forEach((res, candidate) => {
        const per = res.perSeed;
        const tailPresent = per.some((p) => p.tailBonus !== undefined);
        lines.push(
          [
            r.seed,
            csvField(r.strategyName),
            decisionIndex,
            d.site,
            d.sectorId,
            d.hop,
            candidate,
            csvField(d.labels[candidate]!),
            candidate === d.chosenIndex ? 1 : 0,
            res.score.toFixed(3),
            mean(per.map((p) => p.poolDamageTaken)).toFixed(3),
            mean(per.map((p) => (p.died ? 1 : 0))).toFixed(2),
            mean(per.map((p) => (p.completed ? 1 : 0))).toFixed(2),
            mean(per.map((p) => p.bitsDelta)).toFixed(2),
            mean(per.map((p) => p.rosterDelta)).toFixed(2),
            tailPresent ? mean(per.map((p) => p.tailBonus ?? 0)).toFixed(3) : '',
            d.marginVsNull.toFixed(3),
            d.epsilon.toFixed(3),
          ].join(','),
        );
      });
    });
  }
  return lines.join('\n') + '\n';
}

// ── Per-item decision-grade analysis (71b) ───────────────────────────────────

/** One parsed sidecar row — the aggregate-relevant column subset, shared by
 *  both entry paths (in-memory RunResults vs a read-back decisions.csv, e.g.
 *  a box batch or a board instrument dir). NB the csv path carries 3-decimal
 *  rounded scores; per-item means from the two paths can differ in the 4th
 *  decimal — irrelevant at the pool-HP scale the read operates on. */
export interface DecisionRow {
  seed: number;
  strategy: string;
  /** 0-based decide order within the run — with seed+strategy, the decision
   *  identity (the join key to the decision's null-arm row). */
  decision: number;
  site: string;
  sector: string;
  hop: number;
  /** Index within the decision's candidate set; 0 = the null arm. */
  candidate: number;
  label: string;
  chosen: boolean;
  score: number;
  marginVsNull: number;
  epsilon: number;
}

/** Flatten in-memory results into rows (the serial CLI's entry path). */
export function decisionRowsOf(results: readonly RunResult[]): DecisionRow[] {
  const rows: DecisionRow[] = [];
  for (const r of results) {
    if (!r.decisions) continue;
    r.decisions.forEach((d, decision) => {
      d.results.forEach((res, candidate) => {
        rows.push({
          seed: r.seed,
          strategy: r.strategyName,
          decision,
          site: d.site,
          sector: d.sectorId,
          hop: d.hop,
          candidate,
          label: d.labels[candidate]!,
          chosen: candidate === d.chosenIndex,
          score: res.score,
          marginVsNull: d.marginVsNull,
          epsilon: d.epsilon,
        });
      });
    });
  }
  return rows;
}

/** Quote-aware split of one csv line (the labels are RFC4180-quoted when
 *  comma-bearing — see csvField above; no other column ever quotes). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** Parse a decisions.csv back into rows (the read-back entry path: board
 *  instrument dirs, fetched box batches). Columns are resolved by header
 *  name, so append-last extensions never break old readers. */
export function parseDecisionsCsv(csv: string): DecisionRow[] {
  const lines = csv.split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]!);
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`decisions.csv: missing column '${name}'`);
    return i;
  };
  const c = {
    seed: col('seed'),
    strategy: col('strategy'),
    decision: col('decision'),
    site: col('site'),
    sector: col('sector'),
    hop: col('hop'),
    candidate: col('candidate'),
    label: col('label'),
    chosen: col('chosen'),
    score: col('score'),
    marginVsNull: col('marginVsNull'),
    epsilon: col('epsilon'),
  };
  return lines.slice(1).map((line) => {
    const f = splitCsvLine(line);
    return {
      seed: Number(f[c.seed]),
      strategy: f[c.strategy]!,
      decision: Number(f[c.decision]),
      site: f[c.site]!,
      sector: f[c.sector]!,
      hop: Number(f[c.hop]),
      candidate: Number(f[c.candidate]),
      label: f[c.label]!,
      chosen: f[c.chosen] === '1',
      score: Number(f[c.score]),
      marginVsNull: Number(f[c.marginVsNull]),
      epsilon: Number(f[c.epsilon]),
    };
  });
}

/**
 * The per-item grouping key: strip INSTANCE noise (prices, target/position
 *  indices, node ids) from a candidate label so decisions about the same
 *  ITEM pool — that's what "per-item realized value at decision grade"
 *  aggregates over. Unknown sites/label shapes fall back to the raw label
 *  (graceful degradation: a future site aggregates per-label until it earns
 *  a key rule here).
 */
export function itemKeyOf(site: string, label: string): string {
  let m: RegExpExecArray | null;
  if (site === 'portBuy' && (m = /^buy (.+) @\d+$/.exec(label))) return m[1]!;
  if (site.startsWith('packetFire:') && (m = /^fire ([^@]+)/.exec(label))) return m[1]!;
  if (site === 'rewardDaemon' && (m = /^decline (.+)$/.exec(label))) return m[1]!;
  if (site === 'grant:redraw' && (m = /^redraw (level:\d+)/.exec(label))) return m[1]!;
  if (site === 'grant:empower' && label.startsWith('empower hand:')) return 'empower';
  if (site === 'nodeChoice' && (m = /^enterNode:\d+ \((.+)\)$/.exec(label))) return m[1]!;
  return label;
}

export interface ItemDecisionStats {
  site: string;
  item: string;
  /** Candidate INSTANCES pooled (the sample size — the n=80 floor applies
   *  to any signed read off this row). For single-instance sites — port
   *  slots, daemons, packets, node kinds — this equals decisions; a
   *  multi-instance site pools every instance (all of a decision's `empower
   *  hand:K` candidates land in the one 'empower' item), so its n runs
   *  ahead of its decision count and its pickRate is per-instance. */
  n: number;
  /** Instances that WON the ε gate (≤1 per decision — the driver picks one). */
  picked: number;
  pickRate: number;
  /** Mean of (candidate score − the SAME decision's null-arm score) — the
   *  paired-luck per-item margin, pool-HP units. NOT `marginVsNull` (that's
   *  the decision's best-challenger margin, repeated on every row). */
  meanDelta: number;
  /** The margin conditioned on winning — the realized value of the picks. */
  meanDeltaPicked: number;
}

/** Pool candidate rows by (site, item) with per-decision null-arm joins.
 *  Sorted site asc, then n desc, then item — the biggest samples first
 *  within each site. */
export function perItemDecisionStats(rows: readonly DecisionRow[]): ItemDecisionStats[] {
  const nullScores = new Map<string, number>();
  for (const r of rows) {
    if (r.candidate === 0) nullScores.set(`${r.seed}|${r.strategy}|${r.decision}`, r.score);
  }
  const buckets = new Map<string, { site: string; item: string; deltas: number[]; pickedDeltas: number[] }>();
  for (const r of rows) {
    if (r.candidate === 0) continue;
    const nullScore = nullScores.get(`${r.seed}|${r.strategy}|${r.decision}`);
    if (nullScore === undefined) continue; // orphan row — malformed input
    const item = itemKeyOf(r.site, r.label);
    const key = `${r.site}|${item}`;
    let b = buckets.get(key);
    if (!b) {
      b = { site: r.site, item, deltas: [], pickedDeltas: [] };
      buckets.set(key, b);
    }
    const delta = r.score - nullScore;
    b.deltas.push(delta);
    if (r.chosen) b.pickedDeltas.push(delta);
  }
  return [...buckets.values()]
    .map((b) => ({
      site: b.site,
      item: b.item,
      n: b.deltas.length,
      picked: b.pickedDeltas.length,
      pickRate: b.deltas.length === 0 ? 0 : b.pickedDeltas.length / b.deltas.length,
      meanDelta: mean(b.deltas),
      meanDeltaPicked: mean(b.pickedDeltas),
    }))
    .sort((a, b) => a.site.localeCompare(b.site) || b.n - a.n || a.item.localeCompare(b.item));
}

/** The n=80 floor for per-item value reads (BALANCE doctrine) — rows under
 *  it are directional, not signable. */
export const PER_ITEM_N_FLOOR = 80;

/** Render the per-item decision-value table (the 71b read). */
export function renderDecisionAnalysis(rows: readonly DecisionRow[]): string {
  const stats = perItemDecisionStats(rows);
  const decisions = new Set(
    rows.filter((r) => r.candidate === 0).map((r) => `${r.seed}|${r.strategy}|${r.decision}`),
  ).size;
  const runs = new Set(rows.map((r) => `${r.seed}|${r.strategy}`)).size;
  const lines: string[] = [];
  lines.push(`### Per-item decision value (${decisions} decisions across ${runs} arbitrated runs)`);
  lines.push(
    'Δ = candidate rollout mean − the SAME decision’s null-arm mean (paired-luck margin, pool-HP',
  );
  lines.push(
    '  units) · Δ|picked = that margin over the decisions this item WON (realized value of picks).',
  );
  lines.push(
    'n = candidate INSTANCES (equals decisions except on multi-instance sites — empower pools',
  );
  lines.push(
    `  every hand position, so its Pick% is per-instance). n < ${PER_ITEM_N_FLOOR} (marked ·) is DIRECTIONAL — the n=${PER_ITEM_N_FLOOR} floor.`,
  );
  lines.push('');
  lines.push(
    renderTable(
      ['Site', 'Item', 'n', 'Picked', 'Pick%', 'meanΔ', 'Δ|picked'],
      stats.map((s) => [
        s.site,
        s.item,
        `${s.n}${s.n < PER_ITEM_N_FLOOR ? '·' : ''}`,
        String(s.picked),
        (s.pickRate * 100).toFixed(0),
        s.meanDelta.toFixed(2),
        s.picked === 0 ? '—' : s.meanDeltaPicked.toFixed(2),
      ]),
      2, // Site + Item both left-aligned (two label columns)
    ),
  );
  return lines.join('\n') + '\n';
}

/**
 * L1c3 — per-daemon aggregate buckets, keyed by the carried/forced idol id
 * (`'none'` for daemon-less runs), sorted by key for stable output. 63c —
 * the run-start roll is retired, so `--daemon=random` no longer spreads a
 * batch across idols (a default batch is all the character's daemon — one
 * bucket); a per-idol read now takes one forced `--daemon=<id>` batch per
 * idol. The 63c prediction ("the starting-profiles round inherits this
 * bucketing — a profile pins the daemon") landed as written.
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
  lines.push(
    `- **Final hop reached:** ${result.finalHopReached} (sector ${result.sectorsCleared})`,
  );
  lines.push(`- **Total ticks:** ${result.totalTicks}`);
  lines.push(`- **Final team size:** ${result.finalTeamSize}`);
  lines.push(`- **Port purchases / final bits:** ${result.portPurchases} / ${result.finalBits}`);
  lines.push(`- **Packets fired:** ${result.packetsFired}`);
  lines.push('');
  lines.push('## Battles');
  lines.push('');
  // 68e — Sec + Encounter columns: the walk-death forensics the §68e read had
  // to reconstruct from aggregates (traces predate X2's encounterId).
  lines.push(
    '| Sec | Hop | Encounter | Layout | Winner | Ticks | Player deaths | Enemy deaths | Player size | Enemy size |',
  );
  lines.push(
    '|----:|----:|:----------|:-------|:-------|------:|--------------:|-------------:|------------:|-----------:|',
  );
  for (const b of result.battles) {
    const layout = b.layoutId ?? 'procedural';
    lines.push(
      `| ${b.sector} | ${b.hop} | ${b.encounterId} | ${layout} | ${b.winner} | ${b.ticks} | ${b.playerDeaths} | ${b.enemyDeaths} | ${b.playerTeamSize} | ${b.enemyTeamSize} |`,
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

/**
 * Slugify a result for use in a filename. Stable across reruns. Characters
 * illegal in NTFS filenames are replaced with '-' — scored strategies are
 * named `scored:<weights-file>`, and on Windows the raw colon makes
 * writeFileSync silently create an alternate data stream named "scored"
 * instead of a real .md trace (observed in the §68e local dose-response
 * runs; Linux was unaffected). summary.csv keeps the unsanitized name —
 * only the filename is slugged.
 */
export function failureFilename(result: RunResult): string {
  const strategy = result.strategyName.replace(/[<>:"/\\|?*]/g, '-');
  return `${strategy}-seed${result.seed}-${result.outcome}.md`;
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
  /** 68e — the 0-based sector ordinal; the funnel row key is (sector, hop)
   *  because hop numbering resets per sector. 0 everywhere on single-sector
   *  shapes, so pre-68e reads are unchanged. */
  sector: number;
  hop: number;
  /** RUNS that reached this (sector, hop) — walk position lexicographic:
   *  cleared a later sector, or ended in this one at `finalHopReached >= hop`.
   *  The survival funnel denominator. (NOT battle count — hops have multiple
   *  waves under the H4/H5 pool+deck system, so battles ≠ runs.) */
  runsReached: number;
  /** RUNS that ENDED on this (sector, hop) (`outcome !== 'complete' &&
   *  sectorsCleared === sector && finalHopReached === hop`) — the true
   *  loss-hop histogram. Σ over rows = total non-wins. This is run-level (a
   *  lost wave only chips the pool); use it, not wave losses, to answer
   *  "where do runs die." */
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
  // 68e — rows key on (sector, hop): hop numbering resets per sector, so a
  // bare-hop funnel would merge act-1 hop N with act-2 hop N.
  const byHop = new Map<string, BattleResult[]>();
  for (const r of results) {
    for (const b of r.battles) {
      const key = `${b.sector}:${b.hop}`;
      const arr = byHop.get(key);
      if (arr) arr.push(b);
      else byHop.set(key, [b]);
    }
  }
  return [...byHop.values()]
    .map((bs) => ({ sector: bs[0]!.sector, hop: bs[0]!.hop, bs }))
    .sort((a, b) => a.sector - b.sector || a.hop - b.hop)
    .map(({ sector, hop, bs }) => {
      const runsReached = results.filter(
        (r) =>
          r.sectorsCleared > sector ||
          (r.sectorsCleared === sector && r.finalHopReached >= hop),
      ).length;
      const runsDied = results.filter(
        (r) =>
          r.outcome !== 'complete' && r.sectorsCleared === sector && r.finalHopReached === hop,
      ).length;
      return {
        sector,
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
    'Sec',
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
    String(rs.sector),
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
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => cell(r)[i]!.length)));
  const fmt = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i]!)).join('  ');
  const lines: string[] = [];
  lines.push(`### Per-hop team analysis (${totalBattles} battles across ${results.length} runs)`);
  lines.push(
    'Sec = sector ordinal (hop numbering resets per sector) · Runs = runs that REACHED this (sector, hop) · Died = runs that ENDED here (run-level)',
  );
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
  const frac = (pred: (b: BattleResult) => boolean) => (n === 0 ? 0 : bs.filter(pred).length / n);
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

/** Fixed-width table: left-align the first `leftCols` columns (labels),
 *  right-align the rest (numbers). */
function renderTable(
  header: readonly string[],
  rows: readonly string[][],
  leftCols = 1,
): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const fmt = (cells: readonly string[]) =>
    cells.map((c, i) => (i < leftCols ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  return [fmt(header), ...rows.map(fmt)].join('\n');
}

/** Render the per-layout + per-layout×hop difficulty tables. */
export function renderLayoutAnalysis(results: readonly RunResult[]): string {
  const totalBattles = results.reduce((acc, r) => acc + r.battles.length, 0);
  const lines: string[] = [];
  lines.push(`### Per-layout difficulty (${totalBattles} waves across ${results.length} runs)`);
  lines.push(
    'Waves = battles on this layout (SAMPLE SIZE — a layout is only ~12% of natural battles;',
  );
  lines.push(
    '  force one with --layout=<id> for a full sample). PWin%/EWin% = player/enemy WAVE win',
  );
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
  const header =
    'layout,waves,playerWinRate,enemyWinRate,avgPlayerDeaths,avgEnemyDeaths,playerSize,enemySize';
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
      e = {
        battles: [],
        instancesTaken: [],
        instancesDealt: [],
        poolWaves: 0,
        takenWaveSum: 0,
        dealtWaveSum: 0,
      };
      byEnc.set(id, e);
    }
    return e;
  };

  for (const r of results) {
    for (const b of r.battles) ensure(b.encounterId).battles.push(b);
    // Pool instances: group THIS run's chips by (sector, hop) — one node visit
    // = one instance; the encounter id is constant within the group. 68e: the
    // key carries the sector because hop numbering RESETS per sector — bare-hop
    // keying merged act-1 hop N with act-2 hop N and mis-attributed the act-2
    // chips to the act-1 encounter (the walk-collision pin).
    const chips = r.telemetry?.poolChips ?? [];
    const byHop = new Map<string, { encounterId: string; taken: number; dealt: number }>();
    for (const c of chips) {
      const taken = c.enemy * chipMult; // enemy survivors chip the PLAYER pool
      const dealt = c.player * chipMult; // player survivors chip the ENEMY pool
      const key = `${c.sector}:${c.hop}`;
      const g = byHop.get(key);
      if (g) {
        g.taken += taken;
        g.dealt += dealt;
      } else {
        byHop.set(key, { encounterId: c.encounterId, taken, dealt });
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
  lines.push(
    'Inst = encounter instances (node visits w/ pool data) · Waves = turns (SAMPLE SIZE —',
  );
  lines.push(
    '  force one with --encounter=<id> for a full sample). PWin%/EWin% = player/enemy WAVE win.',
  );
  lines.push(
    'PDmgTaken = mean PLAYER pool damage TAKEN per instance (HP — the X tuning metric); /wv = per wave.',
  );
  lines.push(
    'EDmgDlt = mean enemy-pool damage dealt per instance. Sorted most-costly-first (PDmgTaken).',
  );
  if (!anyPool) {
    lines.push(
      '(no pool data — telemetry was off; --per-encounter enables it. Pool columns blank.)',
    );
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
