/**
 * The default fuzz mode (no mode flag): run the selected strategies across a
 * seed range, print the per-strategy aggregate summary, and write summary.csv +
 * a markdown failure trace per non-complete run (plus the opt-in `--per-hop`
 * / `--per-layout` analyses).
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { runOne } from '../harness';
import type { FuzzStrategy } from '../Strategy';
import type { RunResult, HarnessOptions } from '../harness';
import { parseRunConfig, type RosterEntry } from '../../../src/run/RunConfig';
import {
  makeStrategy,
  makeDefaultStrategies,
  makeAllStrategies,
  STRATEGY_NAMES,
} from '../strategies/registry';
import { scoredStrategy } from '../strategies/scored';
import { loadWeightsFile } from '../strategies/scoredWeights';
import {
  aggregate,
  renderSummaryCsv,
  renderFailureTrace,
  failureFilename,
  renderPerHopAnalysis,
  renderDaemonAnalysis,
  perHopStats,
  perDaemonStats,
  perLayoutStats,
  perLayoutHopStats,
  renderLayoutAnalysis,
  renderLayoutCsv,
  renderLayoutHopCsv,
  perEncounterStats,
  renderEncounterAnalysis,
  renderEncounterCsv,
} from '../reporters';
import { daemonLabel } from '../daemonSelection';
import {
  bail,
  coverageFromArgs,
  daemonFromArgs,
  empowerFromArgs,
  encounterFromArgs,
  layoutFromArgs,
  objectiveFromArgs,
  redrawFromArgs,
  range,
  type CliArgs,
} from './args';

export type RunModeArgs = Pick<
  CliArgs,
  | 'count'
  | 'seed'
  | 'seedOffset'
  | 'strategy'
  | 'outDir'
  | 'perHop'
  | 'perLayout'
  | 'perEncounter'
  | 'layout'
  | 'encounter'
  | 'hops'
  | 'roster'
  | 'objective'
  | 'redraw'
  | 'empower'
  | 'daemon'
  | 'scripts'
>;

export function runRunCli(args: RunModeArgs): void {
  const strategies = selectStrategies(args.strategy);

  // X2 — --seed-offset shifts the seed base past the tuned range (a held-out
  // telemetry read); an explicit --seed pins a single seed and ignores it.
  const seeds = args.seed !== undefined ? [args.seed] : range(1 + (args.seedOffset ?? 0), args.count);

  // --layout=<id> forces a single hand-authored layout on EVERY battle — a clean
  // full-sample isolate for the per-layout / per-hop difficulty read (natural
  // runs only hit a given layout ~12% of the time). `--layout=procedural` forces
  // a fresh PROCEDURAL map every battle (the M6 isolate). Validated against the
  // library + the sentinel.
  // --encounter=<id> (X2) forces ONE authored encounter at every matching-kind
  // node — the clean per-encounter isolation sample. Combinable with --layout.
  // X2d — --hops / --roster also apply to a plain run (they already did for
  // --search / --balance-sweep), so a boss/elite isolation read works standalone:
  // `--encounter=<boss> --hops=2 --roster=<leveled> --per-encounter` makes every
  // run that fight (the boss only fields at its node kind, so a full-length run
  // samples it once at the terminal — the in-situ read). --roster reuses
  // RunConfig's validated parser (invalid tokens dropped, :level optional/clamped).
  let harnessOptions: HarnessOptions = {};
  const layout = layoutFromArgs(args);
  const encounter = encounterFromArgs(args);
  const roster = args.roster
    ? parseRunConfig(new URLSearchParams({ roster: args.roster })).startingRoster
    : undefined;
  const runConfig: {
    hopCount?: number;
    startingRoster?: readonly RosterEntry[];
    forcedLayoutId?: string;
    forcedEncounterId?: string;
  } = {};
  if (args.hops !== undefined) runConfig.hopCount = args.hops;
  if (roster && roster.length > 0) runConfig.startingRoster = roster;
  if (layout !== undefined) runConfig.forcedLayoutId = layout;
  if (encounter !== undefined) runConfig.forcedEncounterId = encounter;
  if (Object.keys(runConfig).length > 0) harnessOptions = { runConfig };
  // J4 — drive a fixed objective strategy in every battle (default none =
  // byte-identical to the pre-J4 fuzz path; the baselines stay put).
  const objective = objectiveFromArgs(args);
  if (objective) harnessOptions = { ...harnessOptions, objective };
  // O5 — `--objective=coverage` instead churns every objective mode on both
  // teams (debug-only termination/determinism coverage; never a balance read).
  if (coverageFromArgs(args)) harnessOptions = { ...harnessOptions, coverageObjectives: true };
  // §55 pre-gate — `--scripts` drives the §54 traffic-script bot in every
  // battle (the standard registry; exclusivity vs --objective enforced at
  // parseArgs AND in the harness — the frozen-anchor contract).
  if (args.scripts) harnessOptions = { ...harnessOptions, trafficScripts: true };
  // K3c3 — drive a fixed redraw policy at every pre-turn gate (default none =
  // gates off, byte-identical).
  const redraw = redrawFromArgs(args);
  if (redraw) harnessOptions = { ...harnessOptions, redraw };
  // K4c3 — and a fixed empower policy (same contract).
  const empower = empowerFromArgs(args);
  if (empower) harnessOptions = { ...harnessOptions, empower };
  // L1c3 — the daemon arm (default random = the Run's own roll, byte-identical
  // to the flag being absent; none = the daemon-less control arm).
  const daemon = daemonFromArgs(args);
  if (daemon) harnessOptions = { ...harnessOptions, daemon };
  // X2 — `--per-encounter` needs the opt-in mechanism telemetry on (pool chips)
  // so the per-encounter pool-damage metric is populated. Pure observation —
  // doesn't perturb determinism or the summary.csv / failure-trace output.
  if (args.perEncounter) harnessOptions = { ...harnessOptions, telemetry: true };

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
  const encounterNote = encounter ? ` (encounter=${encounter})` : '';
  const hopsNote = args.hops !== undefined ? ` (hops=${args.hops})` : '';
  const rosterNote = roster
    ? ` (roster=[${roster.map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype)).join(',')}])`
    : '';
  const daemonNote = daemon ? ` daemon=${daemonLabel(daemon)}` : '';
  const scriptsNote = args.scripts ? ' scripts=ON' : '';
  for (const strategy of strategies) {
    process.stdout.write(
      `Running ${seeds.length} seeds with strategy '${strategy.name}'${layoutNote}${encounterNote}${hopsNote}${rosterNote}${daemonNote}${scriptsNote}…\n`,
    );
    for (const s of seeds) allResults.push(runOne(s, strategy, harnessOptions));
  }

  writeFileSync(join(args.outDir, 'summary.csv'), renderSummaryCsv(allResults));

  if (args.perHop) {
    process.stdout.write('\n' + renderPerHopAnalysis(allResults));
    const stats = perHopStats(allResults);
    const header =
      'hop,runsReached,runsDied,deathRate,battles,avgPlayerDeaths,playerSize,playerAvgLevel,playerMedianLevel,playerLevelSpread,' +
      'enemySize,enemyAvgLevel,enemyMedianLevel,enemyLevelSpread';
    const rows = stats.map((s) =>
      [
        s.hop,
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
    writeFileSync(join(args.outDir, 'per-hop.csv'), [header, ...rows].join('\n') + '\n');
  }

  if (args.perLayout) {
    process.stdout.write('\n' + renderLayoutAnalysis(allResults));
    writeFileSync(join(args.outDir, 'per-layout.csv'), renderLayoutCsv(perLayoutStats(allResults)));
    writeFileSync(
      join(args.outDir, 'per-layout-hop.csv'),
      renderLayoutHopCsv(perLayoutHopStats(allResults)),
    );
  }

  if (args.perEncounter) {
    process.stdout.write('\n' + renderEncounterAnalysis(allResults));
    writeFileSync(
      join(args.outDir, 'per-encounter.csv'),
      renderEncounterCsv(perEncounterStats(allResults)),
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
    process.stdout.write(`  avg hop:    ${stats.averageHopReached.toFixed(2)}\n`);
    process.stdout.write(`  avg ticks:  ${stats.averageTicks.toFixed(0)}\n`);
    process.stdout.write(`  hangs:      ${stats.hangs}\n`);
    if (stats.hangs > 0) {
      process.stdout.write(`  hangs by layout: ${JSON.stringify(stats.hangsByLayout)}\n`);
    }
    // N2 — capped/indecisive battles (per-turn cap → draw). Printed only when
    // present so a clean sweep's summary stays terse.
    if (stats.cappedDraws > 0) {
      process.stdout.write(`  capped draws: ${stats.cappedDraws}\n`);
    }
    process.stdout.write(`  by outcome: ${JSON.stringify(stats.byOutcome)}\n\n`);
  }
  // L1c3 — the per-daemon read: printed whenever the batch spans more than one
  // daemon disposition (a `random` batch buckets per idol in one pass), or when
  // the arm was explicitly chosen (a forced arm prints its single bucket).
  if (daemon !== undefined || perDaemonStats(allResults).length > 1) {
    process.stdout.write(renderDaemonAnalysis(allResults) + '\n');
  }
  process.stdout.write(`Wrote summary.csv and ${failuresWritten} failure trace(s) to ${args.outDir}\n`);
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
