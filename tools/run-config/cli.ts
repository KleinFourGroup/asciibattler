/**
 * `npm run run-config` — G1 dev CLI.
 *
 * Maps run-config flags to a `RunConfig`, prints a browser launch URL that
 * describes the same run, and (unless `--no-run`) drives a headless run to
 * completion for a quick sanity pass. Dev-only: lives under `tools/`, served
 * by nothing, never bundled into `dist/`.
 *
 * Usage:
 *   npm run run-config -- --hops=2 --seed=42 --roster=rogue:3,healer:2 --layout=endlessCorridors
 *   npm run run-config -- --hops=1 --no-run        # just print the launch URL
 *   npm run run-config -- --seed=42 --strategy=greedy # headless drive strategy
 *
 * The run-config flags (every URL parameter, `--help` lists them) reuse the
 * URL param names AND `parseRunConfig`'s validation, so the CLI and
 * the browser describe runs identically — one source of truth. Invalid values
 * are dropped exactly as the browser drops them. Argument parsing is minimal;
 * this is a dev tool, not a published CLI.
 */

import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import { Run } from '../../src/run/Run';
import { runOne } from '../../tests/fuzz/harness';
import { helpText, hyphenated } from './help';
import { makeStrategy, STRATEGY_NAMES } from '../../tests/fuzz/strategies/registry';
import {
  parseRunConfig,
  runConfigToQueryString,
  RUN_CONFIG_PARAMS,
  type RunConfig,
} from '../../src/run/RunConfig';

const BASE_URL = 'http://localhost:5173/';
const RUN_CONFIG_KEYS = new Set<string>(Object.values(RUN_CONFIG_PARAMS));
const BY_HYPHENATED = new Map<string, string>(Object.values(RUN_CONFIG_PARAMS).map((k) => [hyphenated(k), k]));

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
    const name = flag.slice(2);
    // A URL name, or its hyphenated spelling (`--sector-hops` for `sectorHops`).
    const key = RUN_CONFIG_KEYS.has(name) ? name : (BY_HYPHENATED.get(name) ?? name);
    if (RUN_CONFIG_KEYS.has(key)) {
      if (value === undefined) throw new Error(`Flag --${name} needs a value (use --${name}=...)`);
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
  process.stdout.write(helpText());
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

  if (config.hopCount !== undefined && config.hopCount < 2) {
    process.stderr.write(
      `warning: --hops=${config.hopCount} has no battle (a playable run needs >= 2 hops)\n`,
    );
  }

  // The script's warnings, the parse's drops and the construction's own, as
  // the browser's console has them; a refusal throws here, before any run.
  for (const line of new Run(seed, new EventBus<GameEvents>(), config).scriptWarnings) {
    process.stderr.write(`warning: ${line}\n`);
  }

  // The query as a person would type it (`script=3:rest`, not `3%3Arest`),
  // where that reads back as the same config, which the catalogs' ids allow.
  const encoded = runConfigToQueryString(config);
  const readable = decodeURIComponent(encoded);
  const same = (q: string): string => JSON.stringify(parseRunConfig(new URLSearchParams(q)));
  const query = same(readable) === same(encoded) ? readable : encoded;
  process.stdout.write(`Launch URL:  ${BASE_URL}${query ? `?${query}` : ''}\n`);

  if (!args.run) return;

  const result = runOne(seed, strategy, { runConfig: config });
  process.stdout.write('\nHeadless run:\n');
  process.stdout.write(`  strategy:   ${result.strategyName}\n`);
  process.stdout.write(`  outcome:    ${result.outcome}\n`);
  process.stdout.write(`  hop:        ${result.finalHopReached}\n`);
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
