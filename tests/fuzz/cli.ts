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
 *
 *   # H7b — random-search the scored-strategy weights for the best win rate:
 *   npm run fuzz -- --search                       # quick preset (short runs, < ~1 min)
 *   npm run fuzz -- --search --preset=overnight    # the real sweep (full runs, hours)
 *   npm run fuzz -- --search --vectors=200 --seeds=40 --sampler-seed=7
 *   # → writes output/best-strategy.json (re-runnable via --strategy=…json) + search-results.csv
 *
 * Strategies come from the shared registry (tests/fuzz/strategies/registry.ts);
 * the default sweep is just the two baselines so a no-flag run stays fast — the
 * full parameterized menu is opt-in via `--strategy=NAME` or `--strategy=all`.
 *
 * Argument parsing is intentionally minimal — this is a dev-only tool,
 * not a published CLI.
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOne } from './harness';
import type { FuzzStrategy } from './Strategy';
import type { RunResult } from './harness';
import {
  makeStrategy,
  makeDefaultStrategies,
  makeAllStrategies,
  STRATEGY_NAMES,
} from './strategies/registry';
import { scoredStrategy } from './strategies/scored';
import { loadWeightsFile, serializeWeights } from './strategies/scoredWeights';
import { runSearch, splitSeeds, presetHarnessOptions, PRESETS, DEFAULT_BOX } from './search';
import {
  aggregate,
  renderSummaryCsv,
  renderFailureTrace,
  failureFilename,
  renderPerFloorAnalysis,
  perFloorStats,
} from './reporters';

interface CliArgs {
  count: number;
  seed?: number;
  strategy?: string;
  outDir: string;
  perFloor: boolean;
  // H7b — random-search mode (`--search`).
  search: boolean;
  preset?: string;
  vectors?: number;
  seeds?: number;
  samplerSeed?: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    count: 20,
    outDir: defaultOutDir(),
    perFloor: false,
    search: false,
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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.search) {
    runSearchCli(args);
    return;
  }
  const strategies = selectStrategies(args.strategy);

  const seeds = args.seed !== undefined ? [args.seed] : range(1, args.count);

  // Fresh failures/ dir so stale traces from prior runs don't lie. Only the
  // failures subdir is wiped (not the whole output dir) so a search's
  // best-strategy.json / search-results.csv survive a subsequent sweep — in
  // particular the round-trip `--strategy=output/best-strategy.json` no longer
  // deletes the very file it just loaded. summary.csv is overwritten below.
  const failuresDir = join(args.outDir, 'failures');
  if (existsSync(failuresDir)) rmSync(failuresDir, { recursive: true, force: true });
  mkdirSync(failuresDir, { recursive: true });

  const allResults: RunResult[] = [];
  for (const strategy of strategies) {
    process.stdout.write(`Running ${seeds.length} seeds with strategy '${strategy.name}'…\n`);
    for (const s of seeds) allResults.push(runOne(s, strategy));
  }

  writeFileSync(join(args.outDir, 'summary.csv'), renderSummaryCsv(allResults));

  if (args.perFloor) {
    process.stdout.write('\n' + renderPerFloorAnalysis(allResults));
    const stats = perFloorStats(allResults);
    const header =
      'floor,battles,playerSize,playerAvgLevel,playerMedianLevel,playerLevelSpread,' +
      'enemySize,enemyAvgLevel,enemyMedianLevel,enemyLevelSpread';
    const rows = stats.map((s) =>
      [
        s.floor,
        s.battles,
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
 */
function runSearchCli(args: CliArgs): void {
  const presetName = args.preset ?? 'quick';
  const preset = PRESETS[presetName as keyof typeof PRESETS];
  if (!preset) {
    bail(`Unknown preset: ${presetName} (choices: ${Object.keys(PRESETS).join(', ')})`);
  }
  const vectors = args.vectors ?? preset.vectors;
  const samplerSeed = args.samplerSeed ?? 1;
  let trainCount = preset.trainSeeds;
  let testCount = preset.testSeeds;
  if (args.seeds !== undefined) {
    trainCount = Math.max(1, Math.round(args.seeds * 0.8));
    testCount = Math.max(1, args.seeds - trainCount);
  }
  const { trainSeeds, testSeeds } = splitSeeds(trainCount, testCount);

  process.stdout.write(
    `Search: preset=${presetName} vectors=${vectors} ` +
      `train=${trainSeeds.length} test=${testSeeds.length} samplerSeed=${samplerSeed}…\n`,
  );

  const result = runSearch({
    vectors,
    trainSeeds,
    testSeeds,
    samplerSeed,
    box: DEFAULT_BOX,
    harnessOptions: presetHarnessOptions(preset),
  });

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

main();
