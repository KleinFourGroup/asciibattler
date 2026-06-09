/**
 * `npm run fuzz` entry point. Runs all registered strategies across a
 * seed range, prints an aggregate summary to stdout, and writes:
 *
 *   tests/fuzz/output/summary.csv            — one row per run
 *   tests/fuzz/output/failures/<name>.md     — markdown trace per failure
 *
 * Usage:
 *   npm run fuzz                  # 20 seeds × the default (baseline) strategies
 *   npm run fuzz -- --count=50    # 50 seeds
 *   npm run fuzz -- --seed=42     # single seed (and only that one)
 *   npm run fuzz -- --strategy=greedy        # one named strategy
 *   npm run fuzz -- --strategy=stat:constitution   # any G5 menu entry
 *   npm run fuzz -- --strategy=all           # the whole G5 menu
 *   npm run fuzz -- --strategy=scored        # the H7a linear scored strategy (default weights)
 *   npm run fuzz -- --strategy=config/fuzz-strategies.json   # a scored-strategy vector from a file
 *   npm run fuzz -- --per-floor   # + per-floor team analysis (stdout + per-floor.csv)
 *   npm run fuzz -- --per-layout  # + per-layout & layout×floor win/death breakdown (+ CSVs)
 *   npm run fuzz -- --layout=junctionAmbush --per-floor   # force ONE layout (clean full sample)
 *
 *   # H7b — random-search the scored-strategy weights for the best win rate:
 *   npm run fuzz -- --search                       # quick preset (short runs, < ~1 min)
 *   npm run fuzz -- --search --preset=overnight    # the real sweep (full runs, hours)
 *   npm run fuzz -- --search --vectors=200 --seeds=40 --sampler-seed=7
 *   # → writes output/best-strategy.json (re-runnable via --strategy=…json) + search-results.csv
 *
 *   # H7c — balance-sweep a config knob (or a 2-knob grid): best-achievable win
 *   # rate + skill gradient + per-archetype telemetry at each grid point:
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.25:1.5:6 \
 *     --knob2=difficulty.swarmMaxMultiplier --range2=1.0:3.0:5 --tier=quick
 *   npm run fuzz -- --balance-sweep --knob=health.enemyHealthMax --range=8:16:5 --dry-run
 *   # → writes output/balance-sweep.csv (+ .report.txt); --dry-run times point 1, no write
 *   # --floors=N overrides the tier's run length (cheap FULL-length reads):
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.625:0.625:1 \
 *     --tier=quick --floors=11
 *   # --roster forces the starting roster (evaluate an archetype the search won't
 *   # recruit — read its per-deployment telemetry):
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.625:0.625:1 \
 *     --tier=quick --floors=11 --roster=mercenary,mercenary,ranged,mage,mage
 *   # --jobs=N fans each grid point's vector search across N child processes
 *   # (results are byte-identical to single-process — only wall-clock changes):
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.625:0.75:2 \
 *     --knob2=difficulty.swarmMaxMultiplier --range2=1.75:2.0:2 --tier=heavy --jobs=8
 *
 *   # H7c — re-render a past sweep's CSV as a readable per-point report:
 *   npm run fuzz -- --report                          # output/balance-sweep.csv
 *   npm run fuzz -- --report=output/balance-sweep.csv # any CSV → prints + writes .report.txt
 *
 * Strategies come from the shared registry (tests/fuzz/strategies/registry.ts);
 * the default sweep is just the two baselines so a no-flag run stays fast — the
 * full parameterized menu is opt-in via `--strategy=NAME` or `--strategy=all`.
 *
 * Argument parsing is intentionally minimal — this is a dev-only tool,
 * not a published CLI.
 */

import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOne, runMany } from './harness';
import type { FuzzStrategy } from './Strategy';
import type { RunResult, HarnessOptions } from './harness';
import {
  makeStrategy,
  makeDefaultStrategies,
  makeAllStrategies,
  STRATEGY_NAMES,
} from './strategies/registry';
import { scoredStrategy } from './strategies/scored';
import { loadWeightsFile, serializeWeights, parseWeights } from './strategies/scoredWeights';
import {
  runSearch,
  generateVectors,
  assembleSearchResult,
  harnessEvaluate,
  splitSeeds,
  PRESETS,
  DEFAULT_BOX,
  type SearchResult,
} from './search';
import {
  runBalanceSweep,
  parseRange,
  resolveKnob,
  renderSweepCsv,
  renderSweepTable,
  type SweepKnob,
} from './balanceSweep';
import { evaluateVectorsSharded, type ShardJob } from './searchShard';
import { reportFromCsv } from './sweepReport';
import { parseRunConfig, type RosterEntry } from '../../src/run/RunConfig';
import { LAYOUT_IDS } from '../../src/sim/layouts';
import {
  aggregate,
  renderSummaryCsv,
  renderFailureTrace,
  failureFilename,
  renderPerFloorAnalysis,
  perFloorStats,
  perLayoutStats,
  perLayoutFloorStats,
  renderLayoutAnalysis,
  renderLayoutCsv,
  renderLayoutFloorCsv,
} from './reporters';

interface CliArgs {
  count: number;
  seed?: number;
  strategy?: string;
  outDir: string;
  perFloor: boolean;
  // Per-layout difficulty breakdown (`--per-layout`) + force one layout across
  // every battle (`--layout=<id>`) for a clean full-sample isolate.
  perLayout: boolean;
  layout?: string;
  // H7b — random-search mode (`--search`).
  search: boolean;
  preset?: string;
  vectors?: number;
  seeds?: number;
  samplerSeed?: number;
  // H7c — balance-sweep mode (`--balance-sweep`).
  balanceSweep: boolean;
  knob?: string;
  range?: string;
  knob2?: string;
  range2?: string;
  tier?: string;
  floors?: number;
  roster?: string;
  dryRun: boolean;
  // H7c parallelism — fan the per-point vector search across N child processes.
  jobs?: number;
  // H7c parallelism — internal `--eval-shard` worker mode (a child of a `--jobs`
  // sweep): evaluate the vectors in `--job=<file>`, write win rates to `--out-file`.
  evalShard: boolean;
  job?: string;
  outFile?: string;
  // H7c — re-render an existing balance-sweep CSV as a readable report.
  report?: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    count: 20,
    outDir: defaultOutDir(),
    perFloor: false,
    perLayout: false,
    search: false,
    balanceSweep: false,
    dryRun: false,
    evalShard: false,
  };
  for (const raw of argv) {
    const [k, v] = splitFlag(raw);
    switch (k) {
      case '--count':
        args.count = Number(v);
        break;
      case '--seed':
        args.seed = Number(v);
        break;
      case '--strategy':
        args.strategy = v;
        break;
      case '--out':
        args.outDir = v ?? args.outDir;
        break;
      case '--per-floor':
        args.perFloor = true;
        break;
      case '--per-layout':
        args.perLayout = true;
        break;
      case '--layout':
        args.layout = v;
        break;
      case '--search':
        args.search = true;
        break;
      case '--preset':
        args.preset = v;
        break;
      case '--vectors':
        args.vectors = Number(v);
        break;
      case '--seeds':
        args.seeds = Number(v);
        break;
      case '--sampler-seed':
        args.samplerSeed = Number(v);
        break;
      case '--balance-sweep':
        args.balanceSweep = true;
        break;
      case '--knob':
        args.knob = v;
        break;
      case '--range':
        args.range = v;
        break;
      case '--knob2':
        args.knob2 = v;
        break;
      case '--range2':
        args.range2 = v;
        break;
      case '--tier':
        args.tier = v;
        break;
      case '--floors':
        args.floors = Number(v);
        break;
      case '--roster':
        args.roster = v;
        break;
      case '--jobs':
        args.jobs = Number(v);
        break;
      case '--eval-shard':
        args.evalShard = true;
        break;
      case '--job':
        args.job = v;
        break;
      case '--out-file':
        args.outFile = v;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--report':
        // Empty = default to the sweep's own output dir (resolved in runReportCli).
        args.report = v ?? '';
        break;
      default:
        if (raw.startsWith('--')) {
          throw new Error(`Unknown flag: ${raw}`);
        }
    }
  }
  return args;
}

function splitFlag(arg: string): [string, string | undefined] {
  const eq = arg.indexOf('=');
  if (eq < 0) return [arg, undefined];
  return [arg.slice(0, eq), arg.slice(eq + 1)];
}

function defaultOutDir(): string {
  // ESM-friendly resolution: this file is at tests/fuzz/cli.ts, output
  // sits next to it as tests/fuzz/output/.
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, 'output');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.evalShard) {
    runEvalShardCli(args);
    return;
  }
  if (args.search) {
    await runSearchCli(args);
    return;
  }
  if (args.balanceSweep) {
    await runBalanceSweepCli(args);
    return;
  }
  if (args.report !== undefined) {
    runReportCli(args);
    return;
  }
  const strategies = selectStrategies(args.strategy);

  const seeds = args.seed !== undefined ? [args.seed] : range(1, args.count);

  // --layout=<id> forces a single hand-authored layout on EVERY battle — a clean
  // full-sample isolate for the per-layout / per-floor difficulty read (natural
  // runs only hit a given layout ~12% of the time). Validated against the library.
  let harnessOptions: HarnessOptions = {};
  if (args.layout !== undefined) {
    if (!LAYOUT_IDS.includes(args.layout)) {
      bail(`Unknown layout: ${args.layout} (choices: ${LAYOUT_IDS.join(', ')})`);
    }
    harnessOptions = { runConfig: { forcedLayoutId: args.layout } };
  }

  // Fresh failures/ dir so stale traces from prior runs don't lie. Only the
  // failures subdir is wiped (not the whole output dir) so a search's
  // best-strategy.json / search-results.csv survive a subsequent sweep — in
  // particular the round-trip `--strategy=output/best-strategy.json` no longer
  // deletes the very file it just loaded. summary.csv is overwritten below.
  const failuresDir = join(args.outDir, 'failures');
  if (existsSync(failuresDir)) rmSync(failuresDir, { recursive: true, force: true });
  mkdirSync(failuresDir, { recursive: true });

  const allResults: RunResult[] = [];
  const layoutNote = args.layout ? ` (layout=${args.layout})` : '';
  for (const strategy of strategies) {
    process.stdout.write(`Running ${seeds.length} seeds with strategy '${strategy.name}'${layoutNote}…\n`);
    for (const s of seeds) allResults.push(runOne(s, strategy, harnessOptions));
  }

  writeFileSync(join(args.outDir, 'summary.csv'), renderSummaryCsv(allResults));

  if (args.perFloor) {
    process.stdout.write('\n' + renderPerFloorAnalysis(allResults));
    const stats = perFloorStats(allResults);
    const header =
      'floor,runsReached,runsDied,deathRate,battles,avgPlayerDeaths,playerSize,playerAvgLevel,playerMedianLevel,playerLevelSpread,' +
      'enemySize,enemyAvgLevel,enemyMedianLevel,enemyLevelSpread';
    const rows = stats.map((s) =>
      [
        s.floor,
        s.runsReached,
        s.runsDied,
        s.deathRate.toFixed(4),
        s.battles,
        s.avgPlayerDeaths.toFixed(3),
        s.playerSize.toFixed(3),
        s.playerAvgLevel.toFixed(3),
        s.playerMedianLevel.toFixed(3),
        s.playerLevelSpread.toFixed(3),
        s.enemySize.toFixed(3),
        s.enemyAvgLevel.toFixed(3),
        s.enemyMedianLevel.toFixed(3),
        s.enemyLevelSpread.toFixed(3),
      ].join(','),
    );
    writeFileSync(join(args.outDir, 'per-floor.csv'), [header, ...rows].join('\n') + '\n');
  }

  if (args.perLayout) {
    process.stdout.write('\n' + renderLayoutAnalysis(allResults));
    writeFileSync(join(args.outDir, 'per-layout.csv'), renderLayoutCsv(perLayoutStats(allResults)));
    writeFileSync(
      join(args.outDir, 'per-layout-floor.csv'),
      renderLayoutFloorCsv(perLayoutFloorStats(allResults)),
    );
  }

  let failuresWritten = 0;
  for (const r of allResults) {
    if (r.outcome === 'complete') continue;
    writeFileSync(join(args.outDir, 'failures', failureFilename(r)), renderFailureTrace(r));
    failuresWritten++;
  }

  // Summary table per strategy.
  process.stdout.write('\n');
  for (const strategy of strategies) {
    const subset = allResults.filter((r) => r.strategyName === strategy.name);
    const stats = aggregate(subset);
    process.stdout.write(`### ${strategy.name}\n`);
    process.stdout.write(`  runs:       ${stats.totalRuns}\n`);
    process.stdout.write(`  win rate:   ${(stats.winRate * 100).toFixed(1)}%\n`);
    process.stdout.write(`  avg floor:  ${stats.averageFloorReached.toFixed(2)}\n`);
    process.stdout.write(`  avg ticks:  ${stats.averageTicks.toFixed(0)}\n`);
    process.stdout.write(`  hangs:      ${stats.hangs}\n`);
    if (stats.hangs > 0) {
      process.stdout.write(`  hangs by layout: ${JSON.stringify(stats.hangsByLayout)}\n`);
    }
    process.stdout.write(`  by outcome: ${JSON.stringify(stats.byOutcome)}\n\n`);
  }
  process.stdout.write(`Wrote summary.csv and ${failuresWritten} failure trace(s) to ${args.outDir}\n`);
}

/**
 * H7b — `--search` mode. Random-search the scored-strategy weight space, select
 * on a train seed set, report the winner's held-out test win rate, and write the
 * winning vector (re-runnable via `--strategy=<best-strategy.json>`) plus a
 * per-vector CSV. Presets `quick` (default) / `overnight`; overridable via
 * `--vectors`, `--seeds` (total, split ~80/20), `--sampler-seed`.
 *
 * `--jobs=N` (H7c parallelism) fans the train-seed evaluation across N child
 * processes, the same vector-level sharding the balance sweep uses — chosen
 * precisely so a plain `--search` (e.g. the overnight verify) parallelizes too,
 * not just `--balance-sweep`. With no config override the shard's `knobs` are
 * empty: each child loads the same committed JSON config the parent has, so
 * sharded results are byte-identical to single-process (only wall-clock changes).
 */
async function runSearchCli(args: CliArgs): Promise<void> {
  const presetName = args.preset ?? 'quick';
  const preset = PRESETS[presetName as keyof typeof PRESETS];
  if (!preset) {
    bail(`Unknown preset: ${presetName} (choices: ${Object.keys(PRESETS).join(', ')})`);
  }
  const vectors = args.vectors ?? preset.vectors;
  const samplerSeed = args.samplerSeed ?? 1;
  const jobs = args.jobs !== undefined ? Math.max(1, Math.floor(args.jobs)) : 1;
  let trainCount = preset.trainSeeds;
  let testCount = preset.testSeeds;
  if (args.seeds !== undefined) {
    trainCount = Math.max(1, Math.round(args.seeds * 0.8));
    testCount = Math.max(1, args.seeds - trainCount);
  }
  const { trainSeeds, testSeeds } = splitSeeds(trainCount, testCount);

  // H7c — --floors / --roster overrides also apply to the search (so we can
  // run a full-length or roster-SEEDED search, then replay its emitted winner
  // via --strategy). Both ride RunConfig's validated parser; the floor count
  // falls back to the preset's when --floors is absent (behaviour-preserving).
  const searchParams = new URLSearchParams();
  const floorCount = args.floors ?? preset.floorCount;
  if (floorCount !== undefined) searchParams.set('floors', String(floorCount));
  if (args.roster) searchParams.set('roster', args.roster);
  const runConfig = parseRunConfig(searchParams);
  const harnessOptions = Object.keys(runConfig).length > 0 ? { runConfig } : {};

  const floorNote = floorCount !== undefined ? ` floors=${floorCount}` : ' floors=full';
  const rosterNote = runConfig.startingRoster
    ? ` roster=[${runConfig.startingRoster.map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype)).join(',')}]`
    : '';
  const jobsNote = jobs > 1 ? ` jobs=${jobs}` : '';
  process.stdout.write(
    `Search: preset=${presetName} vectors=${vectors}${floorNote}${rosterNote}${jobsNote} ` +
      `train=${trainSeeds.length} test=${testSeeds.length} samplerSeed=${samplerSeed}…\n`,
  );

  let result: SearchResult;
  if (jobs > 1) {
    // Vector-level sharding (searchShard.ts) — identical to the balance sweep's
    // parallel path, but with empty `knobs` (no config override): the PARENT
    // generates the deterministic vector list, children evaluate slices over the
    // train seeds, and the parent scores the winner on the held-out test set
    // in-process. Byte-identical to single-process; only wall-clock changes.
    const sampled = generateVectors(DEFAULT_BOX, samplerSeed, vectors);
    const trainWinRates = await evaluateVectorsSharded({
      vectors: sampled,
      seeds: trainSeeds,
      knobs: {},
      floorCount,
      roster: runConfig.startingRoster,
      jobs,
      tmpDir: join(args.outDir, 'shard-tmp'),
    });
    result = assembleSearchResult(
      sampled,
      trainWinRates,
      (w) => harnessEvaluate(w, testSeeds, harnessOptions),
      { samplerSeed, trainSeeds, testSeeds, topK: 1 },
    );
  } else {
    result = runSearch({
      vectors,
      trainSeeds,
      testSeeds,
      samplerSeed,
      box: DEFAULT_BOX,
      harnessOptions,
    });
  }

  mkdirSync(args.outDir, { recursive: true });
  const bestPath = join(args.outDir, 'best-strategy.json');
  writeFileSync(bestPath, serializeWeights(result.best.weights));
  const csv =
    ['index,trainWinRate', ...result.trainWinRates.map((w, i) => `${i},${w.toFixed(4)}`)].join(
      '\n',
    ) + '\n';
  writeFileSync(join(args.outDir, 'search-results.csv'), csv);

  process.stdout.write(`\nBest of ${vectors} vectors:\n`);
  process.stdout.write(`  train win rate: ${(result.best.trainWinRate * 100).toFixed(1)}%\n`);
  process.stdout.write(
    `  test  win rate: ${(result.best.testWinRate * 100).toFixed(1)}%  (held-out)\n`,
  );
  process.stdout.write(`  winning vector → ${bestPath}\n`);
  process.stdout.write(`  re-run it: npm run fuzz -- --strategy=${bestPath}\n\n`);
  process.stdout.write(serializeWeights(result.best.weights));
}

/**
 * H7c — `--balance-sweep` mode. Sweep one knob (or a 2-knob grid) and report the
 * best-achievable win rate + skill gradient + per-archetype telemetry at each
 * grid point. Times the FIRST point and projects the total before committing
 * (BALANCE.md) — `--dry-run` stops after that estimate.
 *
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.25:1.5:6 \
 *     --knob2=difficulty.swarmMaxMultiplier --range2=1.0:3.0:5 --tier=quick [--dry-run]
 *
 * Writes output/balance-sweep.csv (the full per-archetype breakdown) + a compact
 * stdout table.
 */
async function runBalanceSweepCli(args: CliArgs): Promise<void> {
  if (!args.knob || !args.range) {
    bail('--balance-sweep needs --knob=group.key and --range=min:max:steps');
  }
  if ((args.knob2 && !args.range2) || (!args.knob2 && args.range2)) {
    bail('--knob2 and --range2 must be given together');
  }
  const tierName = args.tier ?? 'quick';
  const preset = PRESETS[tierName as keyof typeof PRESETS];
  if (!preset) {
    bail(`Unknown tier: ${tierName} (choices: ${Object.keys(PRESETS).join(', ')})`);
  }
  const samplerSeed = args.samplerSeed ?? 1;

  const knobs: SweepKnob[] = [{ path: args.knob, range: parseRange(args.range) }];
  if (args.knob2 && args.range2) {
    knobs.push({ path: args.knob2, range: parseRange(args.range2) });
  }

  // --roster=archetype[:level],... → a forced starting roster (reuses RunConfig's
  // validated parser: invalid tokens dropped, :level optional, clamped to cap).
  const rosterOverride = args.roster
    ? parseRunConfig(new URLSearchParams({ roster: args.roster })).startingRoster
    : undefined;

  const jobs = args.jobs !== undefined ? Math.max(1, Math.floor(args.jobs)) : 1;
  const gridSize = knobs.reduce((acc, k) => acc * k.range.steps, 1);
  const floorNote = args.floors !== undefined ? ` floors=${args.floors}` : '';
  const rosterNote = rosterOverride
    ? ` roster=[${rosterOverride.map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype)).join(',')}]`
    : '';
  const jobsNote = jobs > 1 ? ` jobs=${jobs}` : '';
  process.stdout.write(
    `Balance sweep: tier=${tierName}${floorNote}${rosterNote}${jobsNote} grid=${gridSize} point(s) ` +
      `[${knobs.map((k) => `${k.path}×${k.range.steps}`).join(', ')}] samplerSeed=${samplerSeed}…\n`,
  );

  const result = await runBalanceSweep({
    knobs,
    preset,
    samplerSeed,
    floorOverride: args.floors,
    rosterOverride,
    jobs,
    tmpDir: join(args.outDir, 'shard-tmp'),
    maxPoints: args.dryRun ? 1 : undefined,
    onProgress: (index, total, point, elapsedMs) => {
      const coord = knobs.map((k) => `${k.path}=${point.knobs[k.path]}`).join(' ');
      process.stdout.write(
        `  [${index + 1}/${total}] ${coord} → best ${(point.bestTrainWin * 100).toFixed(0)}% ` +
          `grad ${(point.gradient * 100).toFixed(0)}pt (${fmtDuration(elapsedMs)})\n`,
      );
      if (index === 0 && total > 1) {
        process.stdout.write(
          `  → projected total ≈ ${fmtDuration(elapsedMs * total)} for ${total} points\n`,
        );
      }
    },
  });

  process.stdout.write('\n' + renderSweepTable(result));

  if (args.dryRun) {
    process.stdout.write('\nDry run — estimate only, no CSV written.\n');
    return;
  }
  mkdirSync(args.outDir, { recursive: true });
  const csvPath = join(args.outDir, 'balance-sweep.csv');
  const csv = renderSweepCsv(result);
  writeFileSync(csvPath, csv);
  // The human-readable companion, generated from the just-written CSV so it can
  // never disagree with it.
  const reportPath = join(args.outDir, 'balance-sweep.report.txt');
  writeFileSync(reportPath, reportFromCsv(csv));
  process.stdout.write(`\nWrote ${result.points.length} point(s) → ${csvPath}\n`);
  process.stdout.write(`Readable report → ${reportPath}\n`);
}

/**
 * H7c parallelism — the internal `--eval-shard` worker, spawned by a `--jobs`
 * sweep (searchShard.ts). Reads the job file (the grid point's config-knob
 * override + a slice of weight vectors + the seeds + resolved run length / forced
 * roster), RE-APPLIES the knobs to this process's live config (a child shares no
 * memory with the parent), evaluates each vector's win rate, and writes them to
 * `--out-file`. Not for direct human use.
 */
function runEvalShardCli(args: CliArgs): void {
  if (!args.job || !args.outFile) {
    bail('--eval-shard needs --job=<file> and --out-file=<file>');
  }
  const job = JSON.parse(readFileSync(args.job, 'utf8')) as ShardJob;

  for (const [path, value] of Object.entries(job.knobs)) {
    const knob = resolveKnob(path);
    knob.obj[knob.key] = value;
  }

  const runConfig: { floorCount?: number; startingRoster?: readonly RosterEntry[] } = {};
  if (job.floorCount !== undefined) runConfig.floorCount = job.floorCount;
  if (job.roster && job.roster.length > 0) runConfig.startingRoster = job.roster;
  const harnessOptions: HarnessOptions =
    Object.keys(runConfig).length > 0 ? { runConfig } : {};

  const winRates = job.vectors.map(
    (w) =>
      aggregate(runMany(job.seeds, scoredStrategy('eval-shard', parseWeights(w)), harnessOptions))
        .winRate,
  );
  writeFileSync(args.outFile, JSON.stringify({ winRates }));
}

/**
 * H7c — `--report[=<csv>]` mode. Re-render any existing balance-sweep CSV as a
 * readable per-point report (defaults to output/balance-sweep.csv). Prints it
 * and writes a `.report.txt` sibling. Lets you read a past run's results
 * (including a heavy run you don't want to recompute) without the raw 40-column
 * CSV.
 */
function runReportCli(args: CliArgs): void {
  const csvPath = args.report ? args.report : join(args.outDir, 'balance-sweep.csv');
  if (!existsSync(csvPath)) bail(`--report: no such file: ${csvPath}`);
  const csv = readFileSync(csvPath, 'utf8');
  const report = reportFromCsv(csv);
  process.stdout.write(report);
  const reportPath = csvPath.replace(/\.csv$/i, '') + '.report.txt';
  writeFileSync(reportPath, report);
  process.stdout.write(`\nWrote → ${reportPath}\n`);
}

/** Human-readable ms → "1.2s" / "3.4m". */
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

/** Resolve the `--strategy` flag: a `*.json` file path (a scored-strategy weight
 *  vector — H7a), a registered name, the `all` keyword, or (unset) the default
 *  baseline sweep. Bails loudly on an unknown name. */
function selectStrategies(name?: string): FuzzStrategy[] {
  if (name === undefined) return makeDefaultStrategies();
  if (name === 'all') return makeAllStrategies();
  if (name.endsWith('.json')) {
    return [scoredStrategy(`scored:${basename(name, '.json')}`, loadWeightsFile(name))];
  }
  return [
    makeStrategy(name) ??
      bail(`Unknown strategy: ${name} (choices: ${STRATEGY_NAMES.join(', ')}, all)`),
  ];
}

function range(start: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(start + i);
  return out;
}

function bail(message: string): never {
  process.stderr.write(message + '\n');
  process.exit(1);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
