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
import { atOrBeyondWalkPos } from './walkDepth';

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
  // 72b-pre — same append-last rule; the pool-trajectory columns. Seam =
  // pool at the FIRST sector:cleared (empty when the run never cleared one);
  // finalPool = the run-end pool (winners' headroom / 0-ish on pool deaths).
  'poolAtSectorEnd',
  'finalPool',
  // §83e — same append-last rule; the camps forced-engagement probe's
  // conditioning (campsSpawned > 0 = a camp-bearing run) + non-vacuous
  // counters (player-killed camps realize rewards; enemy kills deny them).
  'campsSpawned',
  'campKillsPlayer',
  'campKillsEnemy',
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
        r.poolAtSectorClears[0] ?? '',
        r.finalPool,
        r.battles.reduce((acc, b) => acc + b.campsSpawned, 0),
        r.battles.reduce((acc, b) => acc + b.campKillsPlayer, 0),
        r.battles.reduce((acc, b) => acc + b.campKillsEnemy, 0),
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
  // 84c — append-last (the §84 instrument): the long-horizon shadow's marker
  // ('' on a live record; 'run' or a battle count on a shadow record — the
  // aggregate keys the horizons apart on it) + Run.hopsRemaining at decide
  // time (the per-remaining-hop normalization; '' on a pre-84 record).
  'horizon',
  'hopsRemaining',
  // 85-pre F1/F5 — same append-last rule: the fraction of the candidate's
  // pairs whose walk tripped a safety bound ('' when the breakdowns carry no
  // walk outcome — a pre-85 sidecar or a fake-evaluate fixture), + the
  // λ_bits the scores were computed under ('' on a pre-85 record) so a λ≠0
  // arm's score column stays reconstructible from its components.
  'stuckFrac',
  'lambda',
  // 85c — same append-last rule: the λ_prior the scores were computed
  // under ('' pre-85c; ALWAYS 0 on a long-horizon record — 12c, the
  // shadow scores raw), + the candidate's mean prior term ('' when no
  // breakdown carries one, i.e. every λ=0 record) so a λ_prior≠0 arm's
  // score column stays reconstructible from its components.
  'priorLambda',
  'priorBonus',
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
        const outcomesPresent = per.some((p) => p.walkOutcome !== undefined);
        const priorPresent = per.some((p) => p.priorBonus !== undefined);
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
            d.horizon === undefined ? '' : String(d.horizon),
            d.hopsRemaining === undefined ? '' : String(d.hopsRemaining),
            outcomesPresent
              ? mean(per.map((p) => (p.walkOutcome === 'stuck' ? 1 : 0))).toFixed(2)
              : '',
            d.bitsLambda === undefined ? '' : String(d.bitsLambda),
            d.priorLambda === undefined ? '' : String(d.priorLambda),
            priorPresent ? mean(per.map((p) => p.priorBonus ?? 0)).toFixed(3) : '',
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
  /** 84c — '' on a live record; 'run' / a battle count on a long-horizon
   *  shadow record. Part of the per-item grouping key. */
  horizon: string;
  /** 84c — `Run.hopsRemaining` at decide time; null on a pre-84 sidecar. */
  hopsRemaining: number | null;
  /** 85-pre F1 — the fraction of this candidate's pairs whose walk tripped a
   *  safety bound; null when unknown (pre-85 sidecar / fake-evaluate rows). */
  stuckFrac: number | null;
  /** 85-pre F5 — the λ_bits the scores were computed under; null pre-85. */
  lambda: number | null;
  /** 85c — the λ_prior the scores were computed under; null pre-85c.
   *  Always 0 on a long-horizon record (12c — the shadow scores raw). */
  priorLambda: number | null;
  /** 85c — the candidate's mean prior term; null when no breakdown
   *  carried one (every λ_prior=0 record, and all pre-85c rows). */
  priorBonus: number | null;
}

/** Flatten in-memory results into rows (the serial CLI's entry path). */
export function decisionRowsOf(results: readonly RunResult[]): DecisionRow[] {
  const rows: DecisionRow[] = [];
  for (const r of results) {
    if (!r.decisions) continue;
    r.decisions.forEach((d, decision) => {
      d.results.forEach((res, candidate) => {
        const outcomes = res.perSeed.filter((p) => p.walkOutcome !== undefined);
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
          horizon: d.horizon === undefined ? '' : String(d.horizon),
          hopsRemaining: d.hopsRemaining ?? null,
          stuckFrac:
            outcomes.length === 0
              ? null
              : mean(outcomes.map((p) => (p.walkOutcome === 'stuck' ? 1 : 0))),
          lambda: d.bitsLambda ?? null,
          priorLambda: d.priorLambda ?? null,
          priorBonus: (() => {
            const withPrior = res.perSeed.filter((p) => p.priorBonus !== undefined);
            return withPrior.length === 0 ? null : mean(withPrior.map((p) => p.priorBonus!));
          })(),
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
    // 84c — OPTIONAL (−1 when absent): a pre-84 sidecar (every board dir up
    // to 83f) still parses — its rows read as live-horizon, hops unknown.
    horizon: header.indexOf('horizon'),
    hopsRemaining: header.indexOf('hopsRemaining'),
    // 85-pre — OPTIONAL, same degradation rule (pre-85 sidecars → null).
    stuckFrac: header.indexOf('stuckFrac'),
    lambda: header.indexOf('lambda'),
    // 85c — OPTIONAL, same rule (pre-85c sidecars → null).
    priorLambda: header.indexOf('priorLambda'),
    priorBonus: header.indexOf('priorBonus'),
  };
  const optNum = (f: string[], i: number): number | null => {
    if (i < 0) return null;
    const v = f[i] ?? '';
    return v === '' ? null : Number(v);
  };
  return lines.slice(1).map((line) => {
    const f = splitCsvLine(line);
    const hops = c.hopsRemaining < 0 ? '' : (f[c.hopsRemaining] ?? '');
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
      horizon: c.horizon < 0 ? '' : (f[c.horizon] ?? ''),
      hopsRemaining: hops === '' ? null : Number(hops),
      stuckFrac: optNum(f, c.stuckFrac),
      lambda: optNum(f, c.lambda),
      priorLambda: optNum(f, c.priorLambda),
      priorBonus: optNum(f, c.priorBonus),
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
  // 84c — the shadow-only recruit site keys the ARCHETYPE (level = instance
  // noise: the prior table and the rarity read are per archetype).
  if (site === 'recruit' && (m = /^recruit (unit:[^:]+):L\d+$/.exec(label))) return m[1]!;
  return label;
}

export interface ItemDecisionStats {
  site: string;
  /** 84c — '' for live-horizon rows, 'run' / a count for a shadow horizon.
   *  Rows never pool across horizons (the within-horizon margin and the
   *  beyond-horizon one are different quantities — round-6-spec). */
  horizon: string;
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
  /** 84c — mean of (Δ / hopsRemaining) over the instances that carry a
   *  positive hopsRemaining: the per-remaining-hop value (pool HP per hop
   *  ahead). null when no instance carries hops (a pre-84 sidecar, or
   *  every instance at the terminal). */
  meanDeltaPerHop: number | null;
  /** 85a — the SIZE of the hops>0 subset `meanDeltaPerHop` was computed
   *  over (≤ n; 0 ⇔ meanDeltaPerHop null). Any downstream merge of
   *  per-hop means must weight by THIS, never by n — weighting by n
   *  skews toward buckets with thin hop coverage (WORKLOG §85-pre
   *  finding 9, the buildPriorTable weight mismatch). */
  nPerHop: number;
}

/** Pool candidate rows by (site, horizon, item) with per-decision null-arm
 *  joins. Sorted site asc, horizon asc ('' = live first), then n desc,
 *  then item — the biggest samples first within each site × horizon. */
export function perItemDecisionStats(rows: readonly DecisionRow[]): ItemDecisionStats[] {
  const nullScores = new Map<string, number>();
  for (const r of rows) {
    if (r.candidate === 0) nullScores.set(`${r.seed}|${r.strategy}|${r.decision}`, r.score);
  }
  const buckets = new Map<
    string,
    {
      site: string;
      horizon: string;
      item: string;
      deltas: number[];
      pickedDeltas: number[];
      perHop: number[];
    }
  >();
  for (const r of rows) {
    if (r.candidate === 0) continue;
    const nullScore = nullScores.get(`${r.seed}|${r.strategy}|${r.decision}`);
    if (nullScore === undefined) continue; // orphan row — malformed input
    const item = itemKeyOf(r.site, r.label);
    const key = `${r.site}|${r.horizon}|${item}`;
    let b = buckets.get(key);
    if (!b) {
      b = { site: r.site, horizon: r.horizon, item, deltas: [], pickedDeltas: [], perHop: [] };
      buckets.set(key, b);
    }
    const delta = r.score - nullScore;
    b.deltas.push(delta);
    if (r.chosen) b.pickedDeltas.push(delta);
    if (r.hopsRemaining !== null && r.hopsRemaining > 0) b.perHop.push(delta / r.hopsRemaining);
  }
  return [...buckets.values()]
    .map((b) => ({
      site: b.site,
      horizon: b.horizon,
      item: b.item,
      n: b.deltas.length,
      picked: b.pickedDeltas.length,
      pickRate: b.deltas.length === 0 ? 0 : b.pickedDeltas.length / b.deltas.length,
      meanDelta: mean(b.deltas),
      meanDeltaPicked: mean(b.pickedDeltas),
      meanDeltaPerHop: b.perHop.length === 0 ? null : mean(b.perHop),
      nPerHop: b.perHop.length,
    }))
    .sort(
      (a, b) =>
        a.site.localeCompare(b.site) ||
        a.horizon.localeCompare(b.horizon) ||
        b.n - a.n ||
        a.item.localeCompare(b.item),
    );
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
  lines.push(
    'NB deltas at one decision share its null-arm draw (correlated, not independent samples) —',
  );
  lines.push(
    '  n overstates effective sample size on multi-candidate sites (WORKLOG §85-pre finding 10).',
  );
  lines.push('');
  lines.push(
    '  Horizon: live = the decision horizon (one battle); run / N = the 84 long-horizon shadow.',
  );
  lines.push('  Δ/hop = meanΔ per remaining hop (pool HP per hop ahead) — the §85 prior’s input.');
  lines.push('');
  lines.push(
    renderTable(
      ['Site', 'Horizon', 'Item', 'n', 'Picked', 'Pick%', 'meanΔ', 'Δ|picked', 'Δ/hop'],
      stats.map((s) => [
        s.site,
        s.horizon === '' ? 'live' : s.horizon,
        s.item,
        `${s.n}${s.n < PER_ITEM_N_FLOOR ? '·' : ''}`,
        String(s.picked),
        (s.pickRate * 100).toFixed(0),
        s.meanDelta.toFixed(2),
        s.picked === 0 ? '—' : s.meanDeltaPicked.toFixed(2),
        s.meanDeltaPerHop === null ? '—' : s.meanDeltaPerHop.toFixed(3),
      ]),
      3, // Site + Horizon + Item left-aligned (three label columns)
    ),
  );
  return lines.join('\n') + '\n';
}

// ── The inert-class tripwire (84f2) ──────────────────────────────────────────

/** The candidate CLASS a row belongs to — the acquisition taxonomy (unit /
 *  daemon / packet) read off the item key's prefix, with the fire sites
 *  class-tagged by SITE (their item keys are bare packet ids). Non-item
 *  sites (grants, node/event choices) are their own class — a fully-inert
 *  grant site is exactly as much of an instrument hole as an inert item
 *  class. */
export function candidateClassOf(site: string, item: string): string {
  if (site.startsWith('packetFire:')) return 'packet';
  const m = /^(daemon|packet|unit):/.exec(item);
  return m ? m[1]! : site;
}

export interface InertClassRow {
  site: string;
  /** Same keying rule as the per-item aggregate — never pooled across
   *  horizons: a shadow-walk fix can wake a class in the long walk while
   *  the live rollout still can't exercise it (84f1 did exactly that;
   *  the live-side fire fix is the deferred §85-amendment doctrine). */
  horizon: string;
  candidateClass: string;
  /** Candidate instances (null arm excluded). */
  n: number;
  /** Instances whose score differs from the SAME decision's null-arm
   *  score — the candidate's rollout visibly DID something. */
  live: number;
  liveRate: number;
}

/** 84f2 — the inert-class tripwire aggregate. The 84d finding-1 signature
 *  (nine packets at exactly 0.000: every candidate byte-identical to its
 *  null because no rollout ever fired the bought packet — blind since
 *  §59c/§69e) reduces to a class whose every instance ties its null.
 *  Exact-zero deltas are STRUCTURAL, not statistical: a candidate whose
 *  rollout diverges at all can't tie the null to the last bit across a
 *  whole class (the csv path's 3-decimal rounding is byte-stable for
 *  identical rollouts, so both entry paths agree). */
export function inertClassStats(rows: readonly DecisionRow[]): InertClassRow[] {
  const nullScores = new Map<string, number>();
  for (const r of rows) {
    if (r.candidate === 0) nullScores.set(`${r.seed}|${r.strategy}|${r.decision}`, r.score);
  }
  const buckets = new Map<
    string,
    { site: string; horizon: string; candidateClass: string; n: number; live: number }
  >();
  for (const r of rows) {
    if (r.candidate === 0) continue;
    const nullScore = nullScores.get(`${r.seed}|${r.strategy}|${r.decision}`);
    if (nullScore === undefined) continue; // orphan row — malformed input
    const candidateClass = candidateClassOf(r.site, itemKeyOf(r.site, r.label));
    const key = `${r.site}|${r.horizon}|${candidateClass}`;
    let b = buckets.get(key);
    if (!b) {
      b = { site: r.site, horizon: r.horizon, candidateClass, n: 0, live: 0 };
      buckets.set(key, b);
    }
    b.n++;
    if (r.score !== nullScore) b.live++;
  }
  return [...buckets.values()]
    .map((b) => ({ ...b, liveRate: b.n === 0 ? 0 : b.live / b.n }))
    .sort(
      (a, b) =>
        a.site.localeCompare(b.site) ||
        a.horizon.localeCompare(b.horizon) ||
        a.candidateClass.localeCompare(b.candidateClass),
    );
}

/** The rows the board WARNs on: a class every one of whose instances tied
 *  its null (n > 0 is implied — empty buckets never materialize). */
export function inertClasses(rows: readonly DecisionRow[]): InertClassRow[] {
  return inertClassStats(rows).filter((s) => s.live === 0);
}

/** The stdout / board-report block. WARN-grade in the board's vocabulary:
 *  an instrument-health tell, not a balance verdict. */
export function renderInertClassTripwire(rows: readonly DecisionRow[]): string {
  const stats = inertClassStats(rows);
  const inert = stats.filter((s) => s.live === 0);
  const lines: string[] = [];
  lines.push('### Inert-class tripwire (84f2)');
  lines.push('Live = instances whose rollout score differs from the SAME decision’s null arm.');
  lines.push('A class at Live 0 is INERT — its candidates change nothing any rollout can see');
  lines.push('  (the 84d packet signature: bought, cached, never fired). WARN, instrument-grade.');
  lines.push('');
  lines.push(
    renderTable(
      ['Site', 'Horizon', 'Class', 'n', 'Live', 'Live%', ''],
      stats.map((s) => [
        s.site,
        s.horizon === '' ? 'live' : s.horizon,
        s.candidateClass,
        String(s.n),
        String(s.live),
        (s.liveRate * 100).toFixed(0),
        s.live === 0 ? '⚠ INERT' : '',
      ]),
      3, // Site + Horizon + Class left-aligned
    ),
  );
  lines.push('');
  lines.push(
    inert.length === 0
      ? '  tripwire: all classes live'
      : `  ⚠ tripwire WARN: ${inert.length} inert class(es) — ` +
          inert
            .map((s) => `${s.site}/${s.horizon === '' ? 'live' : s.horizon}/${s.candidateClass}`)
            .join(', '),
  );
  return lines.join('\n') + '\n';
}

// ── The tier-flip instrument (71c) ───────────────────────────────────────────

/** Per-(seed, strategy, site) flip counts from the shadow-judged decisions.
 *  Only records carrying `shadowChosenIndex` count — a mixed batch (or a
 *  shadow-off arm) contributes nothing. */
export interface TierFlipRow {
  seed: number;
  strategy: string;
  site: string;
  /** Shadow-judged decisions at this site. */
  decisions: number;
  /** Decisions where the shadow tier chose a DIFFERENT arm. */
  flips: number;
}

export function tierFlipRows(results: readonly RunResult[]): TierFlipRow[] {
  const rows: TierFlipRow[] = [];
  for (const r of results) {
    if (!r.decisions) continue;
    const bySite = new Map<string, { decisions: number; flips: number }>();
    for (const d of r.decisions) {
      if (d.shadowChosenIndex === undefined) continue;
      let b = bySite.get(d.site);
      if (!b) {
        b = { decisions: 0, flips: 0 };
        bySite.set(d.site, b);
      }
      b.decisions++;
      if (d.shadowChosenIndex !== d.chosenIndex) b.flips++;
    }
    for (const site of [...bySite.keys()].sort()) {
      const b = bySite.get(site)!;
      rows.push({ seed: r.seed, strategy: r.strategyName, site, ...b });
    }
  }
  return rows;
}

/** The k-flips.csv shape, tier-flavored: one row per (seed, strategy, site). */
export function renderTierFlipsCsv(results: readonly RunResult[]): string {
  const lines = ['seed,strategy,site,decisions,flips'];
  for (const r of tierFlipRows(results)) {
    lines.push([r.seed, csvField(r.strategy), r.site, r.decisions, r.flips].join(','));
  }
  return lines.join('\n') + '\n';
}

/** The stdout aggregate — per-site totals + the overall line (the §57g
 *  K-prefix instrument's print shape). The verdict question this feeds:
 *  validate the cheap inner tier, or name WHERE recursion gets paid — so
 *  sites are sorted most-flippy-first. */
export function renderTierFlipAnalysis(results: readonly RunResult[]): string {
  const totals = new Map<string, { decisions: number; flips: number }>();
  let decisions = 0;
  let flips = 0;
  for (const row of tierFlipRows(results)) {
    let t = totals.get(row.site);
    if (!t) {
      t = { decisions: 0, flips: 0 };
      totals.set(row.site, t);
    }
    t.decisions += row.decisions;
    t.flips += row.flips;
    decisions += row.decisions;
    flips += row.flips;
  }
  const pct = (f: number, n: number) => (n === 0 ? '—' : `${((100 * f) / n).toFixed(1)}%`);
  const lines: string[] = [];
  lines.push('### Tier-flip instrument (primary vs shadow inner tier)');
  lines.push('Flip = the shadow tier chose a different arm for the same decision under the same');
  lines.push('  CRN pairs and ε. Sorted most-flippy-first — where recursion would get paid.');
  lines.push('');
  lines.push(
    renderTable(
      ['Site', 'Decisions', 'Flips', 'Flip%'],
      [...totals.entries()]
        .sort(
          (a, b) =>
            b[1].flips / Math.max(1, b[1].decisions) - a[1].flips / Math.max(1, a[1].decisions) ||
            b[1].decisions - a[1].decisions ||
            a[0].localeCompare(b[0]),
        )
        .map(([site, t]) => [site, String(t.decisions), String(t.flips), pct(t.flips, t.decisions)]),
    ),
  );
  lines.push('');
  lines.push(`  overall: ${flips}/${decisions} (${pct(flips, decisions)})`);
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
        `avgSc=${stats.averageSectorsCleared.toFixed(2)} avgHop=${stats.averageHopReached.toFixed(2)} hangs=${stats.hangs}`,
    );
  }
  return lines.join('\n') + '\n';
}

export interface AggregateStats {
  totalRuns: number;
  byOutcome: Record<string, number>;
  winRate: number;
  /** Mean `finalHopReached` — PER-SECTOR (gotcha #120: finalHop resets at
   *  every sector transition, so this is "hop within the final sector",
   *  NOT walk depth). Read WITH `averageSectorsCleared`: an act-2 death at
   *  hop 2 got further than any act-1 death despite the smaller hop. */
  averageHopReached: number;
  /** 72b audit (F1) — mean sector transitions; the other half of the walk
   *  position. Pre-audit the CLI printed bare "avg hop", which walks
   *  read BACKWARDS (deeper runs could lower it). */
  averageSectorsCleared: number;
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
  let scSum = 0;
  let tickSum = 0;
  let wins = 0;
  let hangs = 0;
  let cappedDraws = 0;
  for (const r of results) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    hopSum += r.finalHopReached;
    scSum += r.sectorsCleared;
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
    averageSectorsCleared: n === 0 ? 0 : scSum / n,
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
    lines.push('| Sector | After hop | Archetype | Team size after |');
    lines.push('|-------:|----------:|:----------|----------------:|');
    for (const r of result.recruits) {
      lines.push(`| ${r.sector} | ${r.hop} | ${r.archetype} | ${r.teamSizeAfter} |`);
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
      const runsReached = results.filter((r) =>
        atOrBeyondWalkPos({ sector: r.sectorsCleared, hop: r.finalHopReached }, { sector, hop }),
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
  /** 72b audit (F2) — the act ordinal. hop is PER-SECTOR (gotcha #120):
   *  without the sector key, act-1 hop-N and act-2 hop-N battles merged —
   *  exactly the roster-strength-by-depth confound this table exists to
   *  remove. */
  sector: number;
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
  const byKey = new Map<string, { layout: string; sector: number; hop: number; bs: BattleResult[] }>();
  for (const r of results) {
    for (const b of r.battles) {
      const layout = layoutKey(b);
      // 72b audit (F2) — the (sector, hop) key, the 68e shape (gotcha #120).
      const k = `${layout} ${b.sector}:${b.hop}`;
      const entry = byKey.get(k);
      if (entry) entry.bs.push(b);
      else byKey.set(k, { layout, sector: b.sector, hop: b.hop, bs: [b] });
    }
  }
  return [...byKey.values()]
    .map(({ layout, sector, hop, bs }) => ({ ...layoutCore(layout, bs), sector, hop }))
    .sort((a, b) => a.layout.localeCompare(b.layout) || a.sector - b.sector || a.hop - b.hop);
}

// ── The seam-hazard read (72b-pre) ───────────────────────────────────────────

/** The minimal per-run shape the seam read consumes — RunResult (via
 *  `seamInputsOf`) or a parsed summary.csv row both satisfy it, so the same
 *  aggregation can later read fetched box batches (the 71b two-door rule). */
export interface SeamHazardInput {
  readonly outcome: string;
  readonly sectorsCleared: number;
  /** Pool HP at the act-1→act-2 seam; null when the run never got there. */
  readonly poolAtSectorEnd: number | null;
}

export function seamInputsOf(results: readonly RunResult[]): SeamHazardInput[] {
  return results.map((r) => ({
    outcome: r.outcome,
    sectorsCleared: r.sectorsCleared,
    poolAtSectorEnd: r.poolAtSectorClears[0] ?? null,
  }));
}

export interface SeamHazardBin {
  readonly label: string;
  readonly n: number;
  readonly wins: number;
  readonly deaths: number;
  readonly meanPool: number | null;
}

/** Bin act-2 entrants by seam pool — quarters of the CONFIG max, never
 *  hardcoded (the balance-proof rule) — and read act-2 outcomes conditioned
 *  on entry state. The disentangling instrument: a steep Win% gradient
 *  down-bin says act-1 carried damage is what kills act-2 runs; a flat one
 *  says act 2 is intrinsically hard regardless of entry health. Empty bins
 *  stay in the output (stable table shape; renderers dash them). */
export function seamHazardStats(rows: readonly SeamHazardInput[]): SeamHazardBin[] {
  const max = HEALTH.playerHealthMax;
  const entrants = rows.filter((r) => r.sectorsCleared >= 1 && r.poolAtSectorEnd !== null);
  return [0, 1, 2, 3].map((q) => {
    const lo = (q / 4) * max;
    const hi = ((q + 1) / 4) * max;
    const last = q === 3;
    const inBin = entrants.filter((r) => {
      const p = r.poolAtSectorEnd!;
      return p >= lo && (last ? p <= hi : p < hi);
    });
    const n = inBin.length;
    return {
      label: `[${lo},${hi}${last ? ']' : ')'}`,
      n,
      wins: inBin.filter((r) => r.outcome === 'complete').length,
      deaths: inBin.filter((r) => r.outcome === 'defeat').length,
      meanPool: n === 0 ? null : inBin.reduce((a, r) => a + r.poolAtSectorEnd!, 0) / n,
    };
  });
}

/** The stdout table for any batch whose runs reached a sector seam. */
export function renderSeamHazard(rows: readonly SeamHazardInput[]): string {
  const entrants = rows.filter((r) => r.sectorsCleared >= 1 && r.poolAtSectorEnd !== null).length;
  const lines: string[] = [];
  lines.push(`### The act seam (${entrants}/${rows.length} runs entered act 2)`);
  lines.push(
    `Act-2 outcomes conditioned on pool HP at the sector seam (health never resets between`,
  );
  lines.push(
    `  acts). Bins = quarters of the ${HEALTH.playerHealthMax}-point pool (config-derived). Steep Win% gradient`,
  );
  lines.push(
    `  down-bin = act-1 carried damage kills act-2 runs; flat = act 2 is hard regardless.`,
  );
  lines.push(`  n < 80 (marked ·) is DIRECTIONAL — the n=80 floor.`);
  lines.push('');
  lines.push(
    renderTable(
      ['Seam pool', 'n', 'Win%', 'Death%', 'Mean pool'],
      seamHazardStats(rows).map((b) => [
        b.label,
        `${b.n}${b.n > 0 && b.n < 80 ? '·' : ''}`,
        b.n === 0 ? '—' : ((b.wins / b.n) * 100).toFixed(0),
        b.n === 0 ? '—' : ((b.deaths / b.n) * 100).toFixed(0),
        b.meanPool === null ? '—' : b.meanPool.toFixed(1),
      ]),
    ),
  );
  return lines.join('\n');
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
      ['Layout', 'Sec', 'Hop', 'Waves', 'PWin%', 'PDth/wv', 'P.size', 'E.size'],
      perLayoutHopStats(results).map((s) => [
        s.layout,
        String(s.sector),
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
    'layout,sector,hop,waves,playerWinRate,enemyWinRate,avgPlayerDeaths,avgEnemyDeaths,playerSize,enemySize';
  const rows = stats.map((s) =>
    [
      s.layout,
      s.sector,
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

// ── The alpha-strike read (89b) ───────────────────────────────────────────────

/** Nearest-rank quantile on a copy (0 for an empty set). */
function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1));
  return s[idx]!;
}

/**
 * 89b — the per-turn pool-loss shape, per sector and pooled. Every quantity
 * below reads the APPLIED player-pool loss (`playerPoolBefore − playerPoolAfter`
 * off `pools:chipped`, 89a) as a fraction of `poolMax`, so it means the same
 * thing under any chip rule; the one rule-specific column (`alphaDeathsBlow`)
 * is labeled as such. The §89 baseline for the experiment's keep criterion 1
 * (spec: "the alpha-strike share … pinned at the §89 close") and the §93
 * re-read use this SAME function — the instrument is fixed before the rule.
 */
export interface AlphaStrikeSectorStats {
  /** 0-based walk sector, or `'all'` for the pooled row (listed first). */
  sector: number | 'all';
  /** Turns with pool data (the per-turn sample size). */
  turns: number;
  /** Applied player-pool loss / poolMax per turn: median, p90, max. */
  chipFracP50: number;
  chipFracP90: number;
  chipFracMax: number;
  /** Share of turns whose applied loss was ≥ 25% / ≥ 50% of poolMax. */
  shareChipGe25: number;
  shareChipGe50: number;
  /** Runs whose LAST chip in this sector ended at player pool 0 — a pool
   *  death here (cap-losses, `outcome === 'defeat'` with pool > 0, are NOT
   *  pool deaths; see `AlphaStrikeStats.defeats`). */
  poolDeaths: number;
  /** Pool deaths whose killing turn's APPLIED loss was ≥ 50% of poolMax —
   *  i.e. the run arrived at that turn with at least half its max pool and
   *  lost all of it in one turn. The rule-agnostic alpha-strike death. */
  alphaDeathsApplied: number;
  /** Pool deaths whose killing turn's uncapped BLOW (enemy survivors ×
   *  chipMultiplier — the SURVIVORS rule's attempted charge, which the clamp
   *  at 0 hides from the applied delta) was ≥ 50% of poolMax. Rule-specific:
   *  read it only under survivors (§91 reinterprets or drops it). */
  alphaDeathsBlow: number;
  /** The pool the run ARRIVED with at its killing turn: p25 / p50 / p75. */
  arrivalP25: number;
  arrivalP50: number;
  arrivalP75: number;
  /** Share of pool deaths that arrived at the killing turn under 25% of poolMax
   *  (the "act 3 opens under ten" corner, measured). */
  shareArrivalLt25: number;
  /** 89b2 — the OVERKILL margin (pool-HP): the killing turn's uncapped blow
   *  minus the pool the run arrived with — how much MORE pool the run would
   *  have needed to survive that turn. The user's metric (2026-09-02): "even
   *  with better play (+1–3 pool) it still would have ended the run". p50
   *  over pool deaths, and the share at ≥ 3 / ≥ 5 (deaths that 3 / 5 more
   *  pool would NOT have saved). Uses the blow, so under the casualty rule
   *  it needs the pre-clamp charge recorded (§91's cut). */
  overkillP50: number;
  shareOverkillGe3: number;
  shareOverkillGe5: number;
}

export interface AlphaStrikeStats {
  poolMax: number;
  runs: number;
  /** Runs carrying pool-chip telemetry (0 → every table is empty). */
  runsWithTelemetry: number;
  /** `outcome === 'defeat'` runs — pool deaths + cap-losses. */
  defeats: number;
  /** Pooled row first, then one row per sector seen. */
  bySector: AlphaStrikeSectorStats[];
  /** The seam-hazard read: the pool at the FIRST sector clear
   *  (`poolAtSectorClears[0]`, the act-1→act-2 seam on the two-act walk). */
  seam: {
    crossings: number;
    p25: number;
    p50: number;
    p75: number;
    /** Share of crossings that entered act 2 under 50% of poolMax. */
    shareLt50: number;
  };
}

export function alphaStrikeStats(
  results: readonly RunResult[],
  poolMax: number = HEALTH.playerHealthMax,
  chipMult: number = HEALTH.chipMultiplier,
): AlphaStrikeStats {
  interface Acc {
    fracs: number[];
    killApplied: number[];
    killBlow: number[];
    arrivals: number[];
    /** blow − arrival, pool-HP (89b2). */
    overkill: number[];
  }
  const fresh = (): Acc => ({ fracs: [], killApplied: [], killBlow: [], arrivals: [], overkill: [] });
  const all = fresh();
  const bySector = new Map<number, Acc>();
  const sectorAcc = (s: number): Acc => {
    let a = bySector.get(s);
    if (!a) {
      a = fresh();
      bySector.set(s, a);
    }
    return a;
  };

  let runsWithTelemetry = 0;
  let defeats = 0;
  for (const r of results) {
    if (r.outcome === 'defeat') defeats++;
    const chips = r.telemetry?.poolChips;
    if (chips === undefined) continue;
    runsWithTelemetry++;
    for (const c of chips) {
      const frac = (c.playerPoolBefore - c.playerPoolAfter) / poolMax;
      all.fracs.push(frac);
      sectorAcc(c.sector).fracs.push(frac);
    }
    const last = chips[chips.length - 1];
    if (last !== undefined && last.playerPoolAfter === 0) {
      const applied = (last.playerPoolBefore - last.playerPoolAfter) / poolMax;
      const blow = (last.enemy * chipMult) / poolMax;
      for (const a of [all, sectorAcc(last.sector)]) {
        a.killApplied.push(applied);
        a.killBlow.push(blow);
        a.arrivals.push(last.playerPoolBefore);
        a.overkill.push(last.enemy * chipMult - last.playerPoolBefore);
      }
    }
  }

  const row = (sector: number | 'all', a: Acc): AlphaStrikeSectorStats => {
    const share = (xs: readonly number[], pred: (x: number) => boolean): number =>
      xs.length === 0 ? 0 : xs.filter(pred).length / xs.length;
    return {
      sector,
      turns: a.fracs.length,
      chipFracP50: quantile(a.fracs, 0.5),
      chipFracP90: quantile(a.fracs, 0.9),
      chipFracMax: a.fracs.length === 0 ? 0 : Math.max(...a.fracs),
      shareChipGe25: share(a.fracs, (f) => f >= 0.25),
      shareChipGe50: share(a.fracs, (f) => f >= 0.5),
      poolDeaths: a.killApplied.length,
      alphaDeathsApplied: a.killApplied.filter((f) => f >= 0.5).length,
      alphaDeathsBlow: a.killBlow.filter((f) => f >= 0.5).length,
      arrivalP25: quantile(a.arrivals, 0.25),
      arrivalP50: quantile(a.arrivals, 0.5),
      arrivalP75: quantile(a.arrivals, 0.75),
      shareArrivalLt25: share(a.arrivals, (p) => p < 0.25 * poolMax),
      overkillP50: quantile(a.overkill, 0.5),
      shareOverkillGe3: share(a.overkill, (m) => m >= 3),
      shareOverkillGe5: share(a.overkill, (m) => m >= 5),
    };
  };

  const seams = results.map((r) => r.poolAtSectorClears[0]).filter((p): p is number => p !== undefined);
  return {
    poolMax,
    runs: results.length,
    runsWithTelemetry,
    defeats,
    bySector: [
      row('all', all),
      ...[...bySector.entries()].sort((x, y) => x[0] - y[0]).map(([s, a]) => row(s, a)),
    ],
    seam: {
      crossings: seams.length,
      p25: quantile(seams, 0.25),
      p50: quantile(seams, 0.5),
      p75: quantile(seams, 0.75),
      shareLt50: seams.length === 0 ? 0 : seams.filter((p) => p < 0.5 * poolMax).length / seams.length,
    },
  };
}

/** Render the alpha-strike + seam-hazard read (the §89 baseline table). */
export function renderAlphaStrike(results: readonly RunResult[]): string {
  const s = alphaStrikeStats(results);
  const lines: string[] = [];
  lines.push(
    `### Alpha-strike read (${s.runs} runs, ${s.runsWithTelemetry} with pool telemetry, ${s.defeats} defeats; pool max ${s.poolMax})`,
  );
  lines.push(
    'Per-turn APPLIED player-pool loss as a fraction of max (rule-agnostic). PoolDeaths = runs whose last chip',
  );
  lines.push(
    '  hit 0 (cap-losses excluded). AlphaApp = killing turn lost ≥ 50% of max from the pool it ARRIVED with;',
  );
  lines.push(
    '  AlphaBlow = killing turn\'s uncapped survivors×chip ≥ 50% of max (SURVIVORS-rule-specific). Arrival = pool',
  );
  lines.push('  at the killing turn (p25/p50/p75); <25% = share that arrived under a quarter pool.');
  lines.push(
    '  Overkill = blow − arrival (pool the run would have needed on top): p50, and the share ≥ 3 / ≥ 5.',
  );
  if (s.runsWithTelemetry === 0) {
    lines.push('(no pool data — telemetry was off; --per-encounter enables it.)');
  }
  lines.push('');
  const header = [
    'Sector',
    'Turns',
    'chip p50',
    'p90',
    'max',
    '≥25%',
    '≥50%',
    'PoolDeaths',
    'AlphaApp',
    'AlphaBlow',
    'Arrival p25/p50/p75',
    '<25%',
    'Overkill p50',
    '≥3',
    '≥5',
  ];
  const pct = (x: number): string => `${(x * 100).toFixed(0)}%`;
  const cell = (r: AlphaStrikeSectorStats): string[] => [
    String(r.sector),
    String(r.turns),
    pct(r.chipFracP50),
    pct(r.chipFracP90),
    pct(r.chipFracMax),
    pct(r.shareChipGe25),
    pct(r.shareChipGe50),
    String(r.poolDeaths),
    r.poolDeaths === 0 ? '—' : `${r.alphaDeathsApplied} (${pct(r.alphaDeathsApplied / r.poolDeaths)})`,
    r.poolDeaths === 0 ? '—' : `${r.alphaDeathsBlow} (${pct(r.alphaDeathsBlow / r.poolDeaths)})`,
    r.poolDeaths === 0 ? '—' : `${r.arrivalP25}/${r.arrivalP50}/${r.arrivalP75}`,
    r.poolDeaths === 0 ? '—' : pct(r.shareArrivalLt25),
    r.poolDeaths === 0 ? '—' : String(r.overkillP50),
    r.poolDeaths === 0 ? '—' : pct(r.shareOverkillGe3),
    r.poolDeaths === 0 ? '—' : pct(r.shareOverkillGe5),
  ];
  lines.push(renderTable(header, s.bySector.map(cell)));
  lines.push('');
  lines.push(
    `Seam (pool at the first sector clear): ${s.seam.crossings} crossings · p25/p50/p75 ${s.seam.p25}/${s.seam.p50}/${s.seam.p75} · entered act 2 under 50%: ${pct(s.seam.shareLt50)}`,
  );
  return lines.join('\n') + '\n';
}

/** CSV twin of `alphaStrikeStats.bySector` (one row per sector, pooled first). */
export function renderAlphaStrikeCsv(s: AlphaStrikeStats): string {
  const header =
    'sector,turns,chipFracP50,chipFracP90,chipFracMax,shareChipGe25,shareChipGe50,poolDeaths,' +
    'alphaDeathsApplied,alphaDeathsBlow,arrivalP25,arrivalP50,arrivalP75,shareArrivalLt25,' +
    'overkillP50,shareOverkillGe3,shareOverkillGe5';
  const rows = s.bySector.map((r) =>
    [
      r.sector,
      r.turns,
      r.chipFracP50.toFixed(4),
      r.chipFracP90.toFixed(4),
      r.chipFracMax.toFixed(4),
      r.shareChipGe25.toFixed(4),
      r.shareChipGe50.toFixed(4),
      r.poolDeaths,
      r.alphaDeathsApplied,
      r.alphaDeathsBlow,
      r.arrivalP25,
      r.arrivalP50,
      r.arrivalP75,
      r.shareArrivalLt25.toFixed(4),
      r.overkillP50,
      r.shareOverkillGe3.toFixed(4),
      r.shareOverkillGe5.toFixed(4),
    ].join(','),
  );
  return [header, ...rows].join('\n') + '\n';
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
