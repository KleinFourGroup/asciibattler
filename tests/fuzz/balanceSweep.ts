/**
 * H7c — the `--balance-sweep` engine. Sweeps a config knob (or a 2-knob grid)
 * and, at each grid point, measures the **best-achievable win rate** (the H7b
 * weight search) against the `pure-random` / `greedy` baselines — the **skill
 * gradient** that BALANCE.md makes the real health metric — plus the per-grid-
 * point mechanism telemetry (the OP-unit read).
 *
 * Mechanic (per BALANCE.md "Config override"): the balance configs are plain
 * mutable objects read *live* per encounter (`enemyBudget` destructures
 * `DIFFICULTY` inside each call, etc.), so the sweep mutates them in-process
 * between grid points — no JSON-edit-and-respawn — and **restores the originals
 * in a `finally`** so a sweep leaves the loaded config exactly as it found it.
 *
 * Determinism: a fixed `samplerSeed` + fixed grid + fixed tier reproduces.
 *
 * The expensive per-point work (`defaultMeasurePoint`) is injectable
 * (`config.measurePoint`) so the tests can drive the apply/restore + grid
 * orchestration with a cheap stub that captures the live config value, without
 * running thousands of battles.
 *
 * Parallelism is deferred (BALANCE.md): single-process for now; `node:child_
 * process` grid-sharding lands when the heavy/overnight tiers warrant it.
 */

import { runMany } from './harness';
import type { HarnessOptions } from './harness';
import { aggregate } from './reporters';
import { makeStrategy } from './strategies/registry';
import { scoredStrategy } from './strategies/scored';
import {
  runSearch,
  generateVectors,
  assembleSearchResult,
  harnessEvaluate,
  splitSeeds,
  DEFAULT_BOX,
  type SearchPreset,
  type SearchResult,
} from './search';
import { evaluateVectorsSharded } from './searchShard';
import { aggregateTelemetry, type AggregatedTelemetry } from './telemetry';
import type { RunTelemetry } from './telemetry';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import type { RosterEntry } from '../../src/run/RunConfig';
import { DIFFICULTY } from '../../src/config/difficulty';
import { HEALTH } from '../../src/config/health';
import { LEVELING } from '../../src/config/leveling';

// ── knob registry — the live, mutable config objects the sweep may tune ───────

/**
 * The config groups a sweep can address by `group.key`. Each value is the SAME
 * live object the production code reads, so writing `DIFFICULTY.budgetFactor`
 * here is what `enemyBudget` sees on the next encounter. Limited to the three
 * BALANCE.md names (`difficulty`/`health`/`leveling`) — the knobs that move the
 * foregone-conclusion needle; widen here if a future pass needs another.
 */
const KNOB_GROUPS: Record<string, Record<string, number>> = {
  difficulty: DIFFICULTY as unknown as Record<string, number>,
  health: HEALTH as unknown as Record<string, number>,
  leveling: LEVELING as unknown as Record<string, number>,
};

export interface ResolvedKnob {
  readonly group: string;
  readonly key: string;
  readonly obj: Record<string, number>;
}

/**
 * Resolve a `group.key` path (e.g. `difficulty.budgetFactor`) to the live object
 * + key. Throws loudly on an unknown group, an unknown key, or a non-numeric
 * target — a typo'd knob should fail the sweep, not silently no-op.
 */
export function resolveKnob(path: string): ResolvedKnob {
  const dot = path.indexOf('.');
  if (dot < 0) {
    throw new Error(`balance-sweep: knob "${path}" must be "group.key" (e.g. difficulty.budgetFactor)`);
  }
  const group = path.slice(0, dot);
  const key = path.slice(dot + 1);
  const obj = KNOB_GROUPS[group];
  if (!obj) {
    throw new Error(
      `balance-sweep: unknown knob group "${group}" (choices: ${Object.keys(KNOB_GROUPS).join(', ')})`,
    );
  }
  if (!(key in obj)) {
    throw new Error(
      `balance-sweep: unknown knob "${group}.${key}" (keys: ${Object.keys(obj).join(', ')})`,
    );
  }
  if (typeof obj[key] !== 'number') {
    throw new Error(`balance-sweep: knob "${group}.${key}" is not numeric`);
  }
  return { group, key, obj };
}

// ── grid construction ─────────────────────────────────────────────────────────

export interface AxisRange {
  readonly min: number;
  readonly max: number;
  readonly steps: number;
}

/**
 * `min:max:steps` → an `AxisRange`. `steps` is the POINT count (inclusive of
 * both ends): `0.25:1.5:6` is six points. A single-point axis (`steps:1`) pins
 * the knob at `min`.
 */
export function parseRange(spec: string): AxisRange {
  const parts = spec.split(':');
  if (parts.length !== 3) {
    throw new Error(`balance-sweep: range "${spec}" must be "min:max:steps"`);
  }
  const [min, max, steps] = parts.map(Number) as [number, number, number];
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(steps)) {
    throw new Error(`balance-sweep: range "${spec}" has a non-numeric field`);
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error(`balance-sweep: range "${spec}" steps must be an integer ≥ 1`);
  }
  if (max < min) {
    throw new Error(`balance-sweep: range "${spec}" has max < min`);
  }
  return { min, max, steps };
}

/** Linearly-spaced inclusive values; rounded to 6 dp to shed float dust (so a
 *  6-step `0.25:1.5` lands on clean 0.25/0.5/…/1.5 rather than 0.30000004). A
 *  1-step axis is just `[min]`. Int knobs need integer-aligned ranges (the
 *  sweep doesn't snap to int — a fractional value goes in verbatim). */
export function linspace(range: AxisRange): number[] {
  const { min, max, steps } = range;
  if (steps === 1) return [min];
  const out: number[] = [];
  const stepSize = (max - min) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    out.push(Math.round((min + i * stepSize) * 1e6) / 1e6);
  }
  return out;
}

export interface SweepKnob {
  readonly path: string;
  readonly range: AxisRange;
}

/** A single grid point: `group.key` path → the value pinned at this point. */
export type SweepCoord = Record<string, number>;

/**
 * Cartesian product of every knob's axis values, in row-major order (the LAST
 * knob varies fastest). One knob → one axis; two → the budget×swarm grid; N is
 * supported by the engine though the CLI exposes two.
 */
export function buildGrid(knobs: readonly SweepKnob[]): SweepCoord[] {
  let grid: SweepCoord[] = [{}];
  for (const knob of knobs) {
    const values = linspace(knob.range);
    const next: SweepCoord[] = [];
    for (const partial of grid) {
      for (const v of values) next.push({ ...partial, [knob.path]: v });
    }
    grid = next;
  }
  return grid;
}

// ── per-point measurement ─────────────────────────────────────────────────────

export interface SweepPoint {
  readonly knobs: SweepCoord;
  /** Best-achievable win rate over the searched weight vectors (train seeds). */
  readonly bestTrainWin: number;
  /** The winner's held-out test win rate (config-level seed holdout guard). */
  readonly bestTestWin: number;
  readonly pureRandomWin: number;
  readonly greedyWin: number;
  /** best-achievable − max(baseline) — the skill gradient (the health metric). */
  readonly gradient: number;
  /** Mechanism breakdown from re-running the winner with telemetry on. */
  readonly telemetry: AggregatedTelemetry;
}

export interface BalanceSweepConfig {
  readonly knobs: readonly SweepKnob[];
  readonly preset: SearchPreset;
  readonly samplerSeed: number;
  /**
   * Override the tier's run length (floor count), decoupling "how many floors"
   * from "how big a search." Lets us run a CHEAP full-length read — e.g. quick
   * tier's small vector/seed budget but full 11-floor runs — to catch the
   * length-sensitive archetype effects that short runs hide (the healer
   * mid-length artifact), without paying for the whole heavy tier. Undefined =
   * use the tier's own floorCount.
   */
  readonly floorOverride?: number;
  /**
   * Force the starting roster (archetype + level per slot) for every run at every
   * grid point. The way to evaluate an archetype the optimizer rarely RECRUITS:
   * plant it on the roster so it's fielded from floor 1, then read its
   * per-deployment telemetry. Undefined = the normal rolled starting roster.
   */
  readonly rosterOverride?: readonly RosterEntry[];
  /** Stop after this many grid points (the `--dry-run` estimate runs 1). */
  readonly maxPoints?: number;
  /**
   * Parallelism for the per-point weight search: fan the vector evaluations out
   * across this many child processes (`--jobs`). Default 1 = single-process (the
   * original in-line `runSearch`, byte-identical results). >1 requires `tmpDir`.
   */
  readonly jobs?: number;
  /** Scratch dir for the `--jobs>1` shard job/result files (the CLI points this
   *  at `<outDir>/shard-tmp`). Unused when `jobs` is 1/undefined. */
  readonly tmpDir?: string;
  /** Injectable per-point measurement (tests stub it). Default = the real
   *  search + baselines + telemetry over the preset's seeds. May be async (the
   *  default is, once `jobs>1` spawns child processes). */
  readonly measurePoint?: (
    coord: SweepCoord,
    config: BalanceSweepConfig,
  ) => SweepPoint | Promise<SweepPoint>;
  /** Progress callback after each point (the CLI prints + projects total time). */
  readonly onProgress?: (index: number, total: number, point: SweepPoint, elapsedMs: number) => void;
  /** Injectable clock (defaults to `Date.now`) so timing stays out of the tests. */
  readonly now?: () => number;
}

export interface SweepResult {
  readonly points: SweepPoint[];
  /** Full grid size (≥ `points.length` when `maxPoints` truncated the run). */
  readonly gridSize: number;
  readonly knobPaths: readonly string[];
}

function baselineWin(name: string, seeds: readonly number[], opts: HarnessOptions): number {
  const strat = makeStrategy(name);
  if (!strat) throw new Error(`balance-sweep: missing baseline strategy "${name}"`);
  return aggregate(runMany(seeds, strat, opts)).winRate;
}

/** Tier's harness options, with optional floor-count + starting-roster overrides
 *  applied — so the search, baselines, and telemetry re-run all share one run
 *  length and roster. */
function harnessOptionsFor(
  preset: SearchPreset,
  floorOverride?: number,
  roster?: readonly RosterEntry[],
): HarnessOptions {
  const floorCount = floorOverride ?? preset.floorCount;
  const runConfig: { floorCount?: number; startingRoster?: readonly RosterEntry[] } = {};
  if (floorCount !== undefined) runConfig.floorCount = floorCount;
  if (roster && roster.length > 0) runConfig.startingRoster = roster;
  return Object.keys(runConfig).length > 0 ? { runConfig } : {};
}

/**
 * The real per-point work: run the weight search for the best-achievable win
 * rate, the two baselines for the gradient, and re-run the winning vector with
 * telemetry on for the mechanism read. All over the preset's TRAIN seeds (the
 * winner is additionally scored on the held-out TEST seeds inside `runSearch`).
 */
async function defaultMeasurePoint(
  coord: SweepCoord,
  config: BalanceSweepConfig,
): Promise<SweepPoint> {
  const { preset, samplerSeed } = config;
  const { trainSeeds, testSeeds } = splitSeeds(preset.trainSeeds, preset.testSeeds);
  const harnessOptions = harnessOptionsFor(preset, config.floorOverride, config.rosterOverride);
  const jobs = Math.max(1, Math.floor(config.jobs ?? 1));

  let search: SearchResult;
  if (jobs > 1) {
    if (!config.tmpDir) throw new Error('balance-sweep: jobs>1 requires a tmpDir for shard files');
    // The PARENT generates the vector list (identical to runSearch's proposal),
    // shards the train-seed evaluation across children, then assembles the result
    // in-process — the test-seed eval reuses the config this point already applied
    // to the live objects, so it needs no child of its own.
    const vectors = generateVectors(DEFAULT_BOX, samplerSeed, preset.vectors);
    const trainWinRates = await evaluateVectorsSharded({
      vectors,
      seeds: trainSeeds,
      knobs: coord,
      floorCount: config.floorOverride ?? preset.floorCount,
      roster: config.rosterOverride,
      jobs,
      tmpDir: config.tmpDir,
    });
    search = assembleSearchResult(
      vectors,
      trainWinRates,
      (w) => harnessEvaluate(w, testSeeds, harnessOptions),
      { samplerSeed, trainSeeds, testSeeds, topK: 1 },
    );
  } else {
    search = runSearch({
      vectors: preset.vectors,
      trainSeeds,
      testSeeds,
      samplerSeed,
      box: DEFAULT_BOX,
      harnessOptions,
    });
  }

  const pureRandomWin = baselineWin('pure-random', trainSeeds, harnessOptions);
  const greedyWin = baselineWin('greedy', trainSeeds, harnessOptions);

  // Re-run the winner over the train seeds with telemetry on — one extra eval
  // per point (cheap vs `vectors` evals) to surface the OP-unit mechanism.
  const telemetries = runMany(trainSeeds, scoredStrategy('sweep-best', search.best.weights), {
    ...harnessOptions,
    telemetry: true,
  })
    .map((r) => r.telemetry)
    .filter((t): t is RunTelemetry => t !== undefined);

  return {
    knobs: coord,
    bestTrainWin: search.best.trainWinRate,
    bestTestWin: search.best.testWinRate,
    pureRandomWin,
    greedyWin,
    gradient: search.best.trainWinRate - Math.max(pureRandomWin, greedyWin),
    telemetry: aggregateTelemetry(telemetries),
  };
}

/**
 * Run the sweep. Applies each grid point's knob values to the LIVE config
 * objects, measures, and restores the originals in a `finally` (so the loaded
 * config is untouched after the call, even on throw). `maxPoints` truncates the
 * run — the CLI uses `maxPoints:1` for the time-estimate-first dry run.
 */
export async function runBalanceSweep(config: BalanceSweepConfig): Promise<SweepResult> {
  const knobPaths = config.knobs.map((k) => k.path);
  const grid = buildGrid(config.knobs);
  const resolved = config.knobs.map((k) => resolveKnob(k.path));
  const originals = resolved.map((r) => r.obj[r.key]);
  const measure = config.measurePoint ?? defaultMeasurePoint;
  const now = config.now ?? (() => Date.now());
  const limit = Math.min(config.maxPoints ?? grid.length, grid.length);

  const points: SweepPoint[] = [];
  try {
    for (let i = 0; i < limit; i++) {
      const coord = grid[i]!;
      for (const r of resolved) r.obj[r.key] = coord[`${r.group}.${r.key}`]!;
      const t0 = now();
      const point = await measure(coord, config);
      points.push(point);
      config.onProgress?.(i, grid.length, point, now() - t0);
    }
  } finally {
    resolved.forEach((r, i) => {
      r.obj[r.key] = originals[i]!;
    });
  }

  return { points, gridSize: grid.length, knobPaths };
}

// ── reporting ─────────────────────────────────────────────────────────────────

const pct = (x: number): string => (x * 100).toFixed(1);

/**
 * Wide CSV for spreadsheet analysis — one row per grid point. Columns: the knob
 * values, the win rates + gradient, the mean per-turn pool chips, and the full
 * per-archetype mechanism breakdown (damage / deaths-per-run / healing / XP /
 * final-count). Per-archetype columns are generated from `ALL_ARCHETYPES`, so a
 * newly-added archetype auto-extends the file.
 */
export function renderSweepCsv(result: SweepResult): string {
  const archCols = ALL_ARCHETYPES.flatMap((a) => [
    `${a}_dmg`,
    `${a}_dmgTaken`,
    `${a}_deployments`,
    `${a}_deathsPerRun`,
    `${a}_heal`,
    `${a}_xp`,
    `${a}_final`,
  ]);
  const header = [
    ...result.knobPaths,
    'bestTrainWin',
    'bestTestWin',
    'pureRandomWin',
    'greedyWin',
    'gradient',
    'meanChipPlayer',
    'meanChipEnemy',
    ...archCols,
  ].join(',');

  const rows = result.points.map((p) => {
    const archVals = ALL_ARCHETYPES.flatMap((a) => {
      const t = p.telemetry.perArchetype[a];
      return [
        t.damageDealt.toFixed(1),
        t.damageTaken.toFixed(1),
        t.deployments,
        t.deathsPerRun.toFixed(3),
        t.healingDone.toFixed(1),
        t.xpEarned.toFixed(1),
        t.finalCount,
      ];
    });
    return [
      ...result.knobPaths.map((path) => p.knobs[path]),
      p.bestTrainWin.toFixed(4),
      p.bestTestWin.toFixed(4),
      p.pureRandomWin.toFixed(4),
      p.greedyWin.toFixed(4),
      p.gradient.toFixed(4),
      p.telemetry.meanPoolChip.player.toFixed(3),
      p.telemetry.meanPoolChip.enemy.toFixed(3),
      ...archVals,
    ].join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}

/** Compact stdout table — knob values, the win-rate trio + gradient, and the
 *  single highest-damage player archetype (the at-a-glance OP hint; the full
 *  breakdown is in the CSV). */
export function renderSweepTable(result: SweepResult): string {
  const header = [
    ...result.knobPaths,
    'best%',
    'rand%',
    'greedy%',
    'grad',
    'topDmg',
  ];
  const cells = (p: SweepPoint): string[] => {
    const top = [...ALL_ARCHETYPES].sort(
      (a, b) => p.telemetry.perArchetype[b].damageDealt - p.telemetry.perArchetype[a].damageDealt,
    )[0]!;
    const topDmg = p.telemetry.perArchetype[top].damageDealt;
    return [
      ...result.knobPaths.map((path) => String(p.knobs[path])),
      pct(p.bestTrainWin),
      pct(p.pureRandomWin),
      pct(p.greedyWin),
      (p.gradient * 100).toFixed(1),
      topDmg > 0 ? `${top}(${topDmg.toFixed(0)})` : '—',
    ];
  };
  const rows = result.points.map(cells);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const fmt = (cs: string[]): string => cs.map((c, i) => c.padStart(widths[i]!)).join('  ');
  const truncated = result.points.length < result.gridSize;
  const lines = [
    `### Balance sweep — ${result.points.length}/${result.gridSize} grid point(s)`,
    'best% = best-achievable win · grad = best − max(baseline) (the skill gradient)',
    'topDmg = highest-damage player archetype (full per-archetype data in balance-sweep.csv)',
    '',
    fmt(header),
    ...rows.map(fmt),
  ];
  if (truncated) lines.push('', `(stopped after ${result.points.length} point(s) — dry-run estimate)`);
  return lines.join('\n') + '\n';
}
