/**
 * `npm run fuzz` entry point. Runs all registered strategies across a
 * seed range, prints an aggregate summary to stdout, and writes:
 *
 *   tests/fuzz/output/summary.csv            — one row per run
 *   tests/fuzz/output/failures/<name>.md     — markdown trace per failure
 *
 * Usage:
 *   npm run fuzz                  # 20 seeds × all strategies
 *   npm run fuzz -- --count=50    # 50 seeds
 *   npm run fuzz -- --seed=42     # single seed (and only that one)
 *   npm run fuzz -- --strategy=greedy
 *
 * Argument parsing is intentionally minimal — this is a dev-only tool,
 * not a published CLI.
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOne } from './harness';
import type { FuzzStrategy } from './Strategy';
import type { RunResult } from './harness';
import { PureRandomStrategy } from './strategies/PureRandom';
import { GreedyStrategy } from './strategies/Greedy';
import {
  aggregate,
  renderSummaryCsv,
  renderFailureTrace,
  failureFilename,
} from './reporters';

const STRATEGIES: Record<string, () => FuzzStrategy> = {
  'pure-random': () => new PureRandomStrategy(),
  greedy: () => new GreedyStrategy(),
};

interface CliArgs {
  count: number;
  seed?: number;
  strategy?: string;
  outDir: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    count: 20,
    outDir: defaultOutDir(),
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
  const strategies = args.strategy
    ? [STRATEGIES[args.strategy]?.() ?? bail(`Unknown strategy: ${args.strategy}`)]
    : Object.values(STRATEGIES).map((f) => f());

  const seeds = args.seed !== undefined ? [args.seed] : range(1, args.count);

  // Fresh output dir so stale failure traces from prior runs don't lie.
  if (existsSync(args.outDir)) rmSync(args.outDir, { recursive: true, force: true });
  mkdirSync(join(args.outDir, 'failures'), { recursive: true });

  const allResults: RunResult[] = [];
  for (const strategy of strategies) {
    process.stdout.write(`Running ${seeds.length} seeds with strategy '${strategy.name}'…\n`);
    for (const s of seeds) allResults.push(runOne(s, strategy));
  }

  writeFileSync(join(args.outDir, 'summary.csv'), renderSummaryCsv(allResults));

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
