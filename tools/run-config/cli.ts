/**
 * `npm run run-config` — G1 dev CLI.
 *
 * Maps run-config flags to a `RunConfig`, prints a browser launch URL that
 * describes the same run, and (unless `--no-run`) drives a headless run to
 * completion for a quick sanity pass. Dev-only: lives under `tools/`, served
 * by nothing, never bundled into `dist/`.
 *
 * Usage:
 *   npm run run-config -- --floors=2 --seed=42 --roster=rogue:3,healer:2 --layout=endlessCorridors
 *   npm run run-config -- --floors=1 --no-run        # just print the launch URL
 *   npm run run-config -- --seed=42 --strategy=greedy # headless drive strategy
 *
 * The run-config flags (--seed / --floors / --roster / --layout / --width)
 * reuse the URL param names AND `parseRunConfig`'s validation, so the CLI and
 * the browser describe runs identically — one source of truth. Invalid values
 * are dropped exactly as the browser drops them. Argument parsing is minimal;
 * this is a dev tool, not a published CLI.
 */

import { runOne } from '../../tests/fuzz/harness';
import { makeStrategy, STRATEGY_NAMES } from '../../tests/fuzz/strategies/registry';
import {
  parseRunConfig,
  runConfigToQueryString,
  RUN_CONFIG_PARAMS,
  type RunConfig,
} from '../../src/run/RunConfig';

const BASE_URL = 'http://localhost:5173/';
const RUN_CONFIG_KEYS = new Set<string>(Object.values(RUN_CONFIG_PARAMS));

interface CliArgs {
  config: RunConfig;
  strategy: string;
  run: boolean;
}

function splitFlag(arg: string): [string, string | undefined] {
  const eq = arg.indexOf('=');
  if (eq < 0) return [arg, undefined];
  return [arg.slice(0, eq), arg.slice(eq + 1)];
}

function parseArgs(argv: readonly string[]): CliArgs {
  // Run-config flags reuse the URL param names so one validator
  // (parseRunConfig) serves both the browser and this CLI.
  const params = new URLSearchParams();
  let strategy = 'pure-random';
  let run = true;
  for (const raw of argv) {
    const [flag, value] = splitFlag(raw);
    if (!flag.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const key = flag.slice(2);
    if (RUN_CONFIG_KEYS.has(key)) {
      if (value === undefined) throw new Error(`Flag --${key} needs a value (use --${key}=...)`);
      params.set(key, value);
    } else if (key === 'strategy') {
      if (value !== undefined) strategy = value;
    } else if (key === 'no-run') {
      run = false;
    } else if (key === 'help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${flag}`);
    }
  }
  return { config: parseRunConfig(params), strategy, run };
}

function printHelp(): void {
  process.stdout.write(
    [
      'run-config — build a RunConfig launch URL and drive a quick headless run.',
      '',
      'Flags:',
      '  --seed=N         run seed (default: Date.now())',
      '  --floors=N       total floors incl. root + terminal (>=2 to be playable; 2 = one battle)',
      '  --roster=LIST    archetype[:level],...  e.g. rogue:3,healer:2,melee',
      '  --layout=ID      force every battle onto a named layout',
      '  --width=N        middle-floor max width',
      '  --strategy=NAME  headless drive strategy from the G5 menu (default: pure-random);',
      '                   e.g. greedy | recruit:mage | stat:constitution | path:rest',
      '  --no-run         print the launch URL only; skip the headless run',
      '  --help           show this help',
      '',
    ].join('\n'),
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const strategy = makeStrategy(args.strategy);
  if (!strategy) {
    process.stderr.write(
      `Unknown strategy: ${args.strategy} (choices: ${STRATEGY_NAMES.join(', ')})\n`,
    );
    process.exit(1);
  }

  // Resolve the seed up front so the printed URL + headless run describe the
  // SAME run and a pinned --seed reproduces it exactly across invocations.
  const seed = args.config.seed ?? Date.now();
  const config: RunConfig = { ...args.config, seed };

  if (config.floorCount !== undefined && config.floorCount < 2) {
    process.stderr.write(
      `warning: --floors=${config.floorCount} has no battle (a playable run needs >= 2 floors)\n`,
    );
  }

  const query = runConfigToQueryString(config);
  process.stdout.write(`Launch URL:  ${BASE_URL}${query ? `?${query}` : ''}\n`);

  if (!args.run) return;

  const result = runOne(seed, strategy, { runConfig: config });
  process.stdout.write('\nHeadless run:\n');
  process.stdout.write(`  strategy:   ${result.strategyName}\n`);
  process.stdout.write(`  outcome:    ${result.outcome}\n`);
  process.stdout.write(`  floor:      ${result.finalFloorReached}\n`);
  process.stdout.write(`  ticks:      ${result.totalTicks}\n`);
  process.stdout.write(`  team size:  ${result.finalTeamSize}\n`);
  process.stdout.write(`  battles:    ${result.battles.length}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`run-config: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
