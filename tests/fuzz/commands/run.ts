/**
 * The default fuzz mode (no mode flag): run the selected strategies across a
 * seed range, print the per-strategy aggregate summary, and write summary.csv +
 * a markdown failure trace per non-complete run (plus the opt-in `--per-hop`
 * / `--per-layout` analyses).
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { runOne } from '../harness';
import { parseScriptsSpec } from '../scriptSubset';
import type { FuzzStrategy } from '../Strategy';
import type { RunResult, HarnessOptions } from '../harness';
import { makeArbitratedStrategy, type ArbitratedRunStrategy } from '../rollout/arbitratedStrategy';
import type { InnerTier } from '../rollout/walker';
import type { RolloutSearchConfig } from '../../../src/bot/RolloutSearchDriver';
import { loadPriorTable, priorFoldValues, priorFoldValuesBySite } from '../prior/priorTable';
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
  renderDecisionsCsv,
  decisionRowsOf,
  renderDecisionAnalysis,
  renderInertClassTripwire,
  renderTierFlipsCsv,
  renderTierFlipAnalysis,
  tierFlipRows,
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
  seamInputsOf,
  renderSeamHazard,
} from '../reporters';
import { daemonLabel } from '../daemonSelection';
import { characterLabel } from '../characterSelection';
import { resolveKnob } from '../balanceSweep';
import {
  bail,
  characterFromArgs,
  coverageFromArgs,
  daemonFromArgs,
  empowerFromArgs,
  encounterFromArgs,
  grantsFromArgs,
  layoutFromArgs,
  objectiveFromArgs,
  redrawFromArgs,
  searcherFromArgs,
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
  | 'emitResults'
  | 'layout'
  | 'encounter'
  | 'firstNode'
  | 'hops'
  | 'sectorHops'
  | 'roster'
  | 'objective'
  | 'redraw'
  | 'empower'
  | 'daemon'
  | 'character'
  | 'scripts'
  | 'scriptsSpec'
  | 'searcher'
  | 'searcherSpec'
  | 'audition'
  | 'k'
  | 'kTelemetry'
  | 'bitsMultiplier'
  | 'drawAdd'
  | 'eliteChance'
  | 'portChance'
  | 'eventChance'
  | 'grant'
  | 'arbitrate'
  | 'arbitrateTier'
  | 'flipTelemetry'
  | 'grantEpsilon'
  | 'priorLambda'
  | 'shadowHorizon'
  | 'shadowSample'
  | 'set'
>;

/**
 * 75l — `--set=group.key=value` (repeatable): write a numeric override onto
 * the live config object through the sweep's knob registry. Malformed specs
 * and unknown paths bail loud (a typo'd probe arm must never silently measure
 * the default config). Mutation-only — no restore: each CLI process owns its
 * whole lifetime, exactly like the sweep's grid-point application.
 */
function applySetOverrides(specs: readonly string[] | undefined): void {
  for (const spec of specs ?? []) {
    const eq = spec.indexOf('=');
    const value = eq > 0 ? Number(spec.slice(eq + 1)) : NaN;
    if (eq <= 0 || !Number.isFinite(value)) {
      bail(`--set needs group.key=value with a numeric value, got "${spec}"`);
    }
    const knob = resolveKnob(spec.slice(0, eq));
    knob.obj[knob.key] = value;
  }
}

export function runRunCli(args: RunModeArgs): void {
  // 75l — apply `--set=group.key=value` overrides FIRST, before any strategy /
  // harness construction reads config. Routed through the sweep's knob
  // registry (resolveKnob throws loud on typos); a --jobs child re-parses the
  // same argv (parallel.ts passthrough) and re-applies in its own process, so
  // parent and shards agree without any extra plumbing.
  applySetOverrides(args.set);
  const strategies = selectStrategies(args.strategy);

  // X2 — --seed-offset shifts the seed base past the tuned range (a held-out
  // telemetry read); an explicit --seed pins a single seed and ignores it.
  const seeds =
    args.seed !== undefined ? [args.seed] : range(1 + (args.seedOffset ?? 0), args.count);

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
    sectorHops?: number;
    startingRoster?: readonly RosterEntry[];
    forcedLayoutId?: string;
    forcedEncounterId?: string;
    firstNodeKind?: 'elite' | 'event';
    bitsMultiplier?: number;
    drawAmountAdd?: number;
    eliteChance?: number;
    portChance?: number;
    eventChance?: number;
    grants?: readonly string[];
  } = {};
  if (args.hops !== undefined) runConfig.hopCount = args.hops;
  // 67c — the shortened full-walk dial (mutually exclusive with --hops; Run
  // throws loud on both, so no silent precedence here either).
  if (args.sectorHops !== undefined) runConfig.sectorHops = args.sectorHops;
  if (roster && roster.length > 0) runConfig.startingRoster = roster;
  if (layout !== undefined) runConfig.forcedLayoutId = layout;
  if (encounter !== undefined) runConfig.forcedEncounterId = encounter;
  // 68e→74e — `--first-node=elite` (the full-pool elite isolation shape,
  // pairs with --hops=2 --encounter=<elite>) or `--first-node=event` (the
  // event-phase isolation shape, pairs with --hops=2 [+ a forced event] —
  // the 74b RunConfig widening surfaced to the CLI). Anything else is a
  // typo worth failing loudly on.
  if (args.firstNode !== undefined) {
    if (args.firstNode !== 'elite' && args.firstNode !== 'event') {
      bail(`--first-node: supported stamps are "elite" and "event" (got "${args.firstNode}")`);
    }
    runConfig.firstNodeKind = args.firstNode;
  }
  // 60c — `--bits-multiplier=<f>` rides the 48f RunConfig lever (finite,
  // > 0; anything else is a flag typo worth failing loudly on).
  if (args.bitsMultiplier !== undefined) {
    if (!Number.isFinite(args.bitsMultiplier) || args.bitsMultiplier <= 0) {
      bail(`--bits-multiplier must be a positive number (got ${args.bitsMultiplier})`);
    }
    runConfig.bitsMultiplier = args.bitsMultiplier;
  }
  // 65d — `--draw-add=<n>` rides the RunConfig drawAmountAdd lever (a
  // nonzero integer; the fold's read site clamps the RESULT ≥ 1, but a
  // non-integer or zero here is a flag typo worth failing loudly on).
  if (args.drawAdd !== undefined) {
    if (!Number.isInteger(args.drawAdd) || args.drawAdd === 0) {
      bail(`--draw-add must be a nonzero integer (got ${args.drawAdd})`);
    }
    runConfig.drawAmountAdd = args.drawAdd;
  }
  // 72e — the node-scatter probe dials ride the RunConfig overrides (a
  // probability; anything outside [0, 1] is a flag typo worth failing
  // loudly on).
  for (const [flag, key] of [
    ['--elite-chance', 'eliteChance'],
    ['--port-chance', 'portChance'],
    ['--event-chance', 'eventChance'],
  ] as const) {
    const v = args[key];
    if (v !== undefined) {
      if (!Number.isFinite(v) || v < 0 || v > 1) {
        bail(`${flag} must be a probability in [0, 1] (got ${v})`);
      }
      runConfig[key] = v;
    }
  }
  // 68b — `--grant=<id>[,<id>…]` hands the run items free at construction
  // (the paired marginal-value WITH arm; ids validated loud in grantsFromArgs).
  const grants = grantsFromArgs(args);
  if (grants !== undefined) runConfig.grants = grants;
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
  // parseArgs AND in the harness — the frozen-anchor contract). 57a — an
  // optional `=<spec>` value selects a subset registry (leave-one-out arms).
  if (args.scripts) {
    harnessOptions = {
      ...harnessOptions,
      trafficScripts: args.scriptsSpec !== undefined ? parseScriptsSpec(args.scriptsSpec) : true,
    };
  }
  // §57f/57g — `--searcher[=<spec>]` (+ `--audition`, `--k`, `--k-telemetry`)
  // drives the portfolio rollout searcher; resolution lives in
  // `searcherFromArgs` (59e — the ONE resolver shared with --search and the
  // shard children, so every mode drives the identical registry).
  const rolloutSearch = searcherFromArgs(args);
  if (rolloutSearch !== undefined) {
    harnessOptions = { ...harnessOptions, rolloutSearch };
  }
  // 85b (WORKLOG §85-pre finding 6) — the same searcher config for the
  // arb arm's 'searcher'-tier rollouts, normalized the way the harness
  // normalizes it (true → {}, a script list → {scripts});
  // `kFlipTelemetry` deliberately stripped — a rollout needs the play
  // policy, not the instrument.
  const arbRolloutSearch: RolloutSearchConfig | undefined =
    rolloutSearch === undefined
      ? undefined
      : rolloutSearch === true
        ? {}
        : Array.isArray(rolloutSearch)
          ? { scripts: rolloutSearch }
          : (({ kFlipTelemetry: _drop, ...keep }) => keep)(rolloutSearch as RolloutSearchConfig);
  // K3c3 — drive a fixed redraw policy at every pre-turn gate (default none =
  // gates off, byte-identical).
  const redraw = redrawFromArgs(args);
  if (redraw) harnessOptions = { ...harnessOptions, redraw };
  // K4c3 — and a fixed empower policy (same contract).
  const empower = empowerFromArgs(args);
  if (empower) harnessOptions = { ...harnessOptions, empower };
  // L1c3 — the daemon arm (63d relabel: default random = no override → the
  // character's daemon; none = the daemon-less control arm).
  const daemon = daemonFromArgs(args);
  if (daemon) harnessOptions = { ...harnessOptions, daemon };
  // 63d — the character arm (ALWAYS set: absent = the explicit Soldier).
  const character = characterFromArgs(args);
  harnessOptions = { ...harnessOptions, character };
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
  const characterNote = ` character=${characterLabel(character)}`;
  const scriptsNote = args.scripts ? ' scripts=ON' : '';
  // 70a — the arbitrated arm wraps the selected strategy PER SEED (the
  // arm is stateful — driver RNG + decision log — so one instance per
  // run; WORKLOG §70 finding 2). The wrapped base keeps its nominator /
  // delegate role for the sites §70b–e haven't landed yet. The effective
  // name is deterministic (`arbitrated:<base>`), so the per-strategy
  // summary below keys on `nameFor`.
  const arbitrateTier =
    args.arbitrate && args.arbitrateTier !== undefined
      ? (args.arbitrateTier as InnerTier)
      : undefined;
  // 85c — the fold arm: λ_prior ≠ 0 loads the committed prior table ONCE
  // at launch (a missing/unparsable table throws here, before any seed
  // runs — never a silent 0-prior batch). λ = 0 or absent passes nothing:
  // the evaluator's fold path never engages (the byte-identity contract;
  // the priorLambda column still records 0 via the driver default).
  const priorTable =
    args.priorLambda !== undefined && args.priorLambda !== 0 ? loadPriorTable() : undefined;
  // 85g2 — both fold views built once at launch: the pooled fallback +
  // the site-conditioned (shrunk) views the driver swaps in per site.
  const priorFold =
    priorTable !== undefined
      ? {
          priorLambda: args.priorLambda!,
          priorTable: priorFoldValues(priorTable),
          priorTableBySite: priorFoldValuesBySite(priorTable),
        }
      : undefined;
  const nameFor = (strategy: FuzzStrategy): string =>
    args.arbitrate ? `arbitrated:${strategy.name}` : strategy.name;
  const strategyFor = (seed: number, strategy: FuzzStrategy): FuzzStrategy =>
    args.arbitrate
      ? makeArbitratedStrategy(seed, {
          base: strategy,
          ...(arbitrateTier !== undefined ? { innerTier: arbitrateTier } : {}),
          // 71c — the shadow tier (validated in args.ts: a real tier ≠ primary).
          ...(args.flipTelemetry !== undefined
            ? { shadowTier: args.flipTelemetry as InnerTier }
            : {}),
          // 71d — the grant-gate ablation dial (validated in args.ts: ≥ 0).
          ...(args.grantEpsilon !== undefined ? { grantEpsilon: args.grantEpsilon } : {}),
          // 85b (finding 6) — searcher-tier rollouts play like the live arm.
          ...(arbRolloutSearch !== undefined ? { rolloutSearch: arbRolloutSearch } : {}),
          // 85c — the fold arm (absent at λ=0: the byte-identical control).
          ...(priorFold ?? {}),
          // 84c — the long-horizon shadow instrument (validated in args.ts:
          // 'run' | integer ≥ 1; refused on run-shape probes; sample ≥ 1).
          ...(args.shadowHorizon !== undefined
            ? {
                shadowHorizon: {
                  horizonBattles:
                    args.shadowHorizon === 'run' ? ('run' as const) : Number(args.shadowHorizon),
                  ...(args.shadowSample !== undefined ? { sample: args.shadowSample } : {}),
                },
              }
            : {}),
        })
      : strategy;
  const shadowNote =
    args.shadowHorizon !== undefined
      ? ` shadow=${args.shadowHorizon}${args.shadowSample !== undefined ? `/1-in-${args.shadowSample}` : ''}`
      : '';
  const priorNote = args.priorLambda !== undefined ? ` prior-lambda=${args.priorLambda}` : '';
  // 85-pre F2, generalized at 85b: the walk-policy overlay composes the
  // BASE's fire policy into EVERY rollout now (not just shadow long
  // walks) — a fire-group-less base (the default vector) composes no
  // fire policy, so every walked branch banks packets forever while the
  // live arm fires them (WORKLOG §85-pre finding 5). Dock shopping is
  // base-independent and stays armed either way. The 84f2 tripwire flags
  // it post-hoc; this warns at launch.
  if (args.arbitrate) {
    for (const s of strategies) {
      if (s.pickPacketFire === undefined) {
        process.stderr.write(
          `⚠ --arbitrate with a fire-group-less base ('${s.name}'): the 85b walk overlay carries no fire policy — rollout walks will never fire packets (expect the 84f2 tripwire to WARN on packet classes; use a --strategy vector with a fire group)\n`,
        );
      }
    }
  }

  const startedAt = Date.now();
  let done = 0;
  const totalRuns = strategies.length * seeds.length;
  for (const strategy of strategies) {
    process.stdout.write(
      `Running ${seeds.length} seeds with strategy '${nameFor(strategy)}'${layoutNote}${encounterNote}${hopsNote}${rosterNote}${daemonNote}${characterNote}${scriptsNote}${shadowNote}${priorNote}…\n`,
    );
    for (const s of seeds) {
      const seedStrategy = strategyFor(s, strategy);
      const r = runOne(s, seedStrategy, harnessOptions);
      // 71a — harvest the arm's decision log AFTER the run (the driver is
      // per-seed state, discarded with the strategy instance otherwise).
      // Attached to the RunResult so `--jobs` inherits it via the 68e
      // results.json round-trip with no extra protocol.
      if (args.arbitrate) {
        r.decisions = (seedStrategy as ArbitratedRunStrategy).driver.decisions;
      }
      allResults.push(r);
      // 57g QoL — one progress line per run, to STDERR (stdout stays the
      // parseable stats stream): a 60–90 min serial batch is observable
      // without a CPU probe, and the line lands in a remote batch.log so
      // `box-batch.sh status` tails live progress.
      done++;
      process.stderr.write(
        `  [${done}/${totalRuns}] seed ${r.seed}: ${r.outcome} (hop ${r.finalHopReached}) · ${Math.round((Date.now() - startedAt) / 1000)}s\n`,
      );
    }
  }

  writeFileSync(join(args.outDir, 'summary.csv'), renderSummaryCsv(allResults));

  // 71a — the decision-grade sidecar (additive: summary.csv columns are
  // untouched). Shared with the --jobs parent — parity by code path, 68e.
  writeDecisionsSidecar(args.outDir, allResults);
  // 71c — the tier-flip sidecar, same discipline (written iff shadow ran).
  writeTierFlips(args.outDir, allResults);

  // 68e — the shard protocol: dump the full results so a --jobs parent can
  // recompute the aggregate analyses over the merged batch (RunResult is plain
  // data end to end, so JSON round-trips it exactly — including telemetry).
  if (args.emitResults) {
    writeFileSync(join(args.outDir, 'results.json'), JSON.stringify(allResults));
  }

  // 57g.5 — the prefix instrument's outputs: an aggregate line + a SIDE CSV
  // (k-flips.csv; summary.csv's schema is untouched — no parity risk).
  if (args.kTelemetry) {
    let searches = 0;
    let flips2 = 0;
    let flips4 = 0;
    const rows: string[] = ['seed,strategy,searches,flips2,flips4'];
    for (const r of allResults) {
      let s = 0;
      let f2 = 0;
      let f4 = 0;
      for (const b of r.battles) {
        if (!b.searcherKFlips) continue;
        s += b.searcherKFlips.searches;
        f2 += b.searcherKFlips.flips2;
        f4 += b.searcherKFlips.flips4;
      }
      searches += s;
      flips2 += f2;
      flips4 += f4;
      rows.push(`${r.seed},${r.strategyName},${s},${f2},${f4}`);
    }
    writeFileSync(join(args.outDir, 'k-flips.csv'), rows.join('\n') + '\n');
    const pct = (n: number) => (searches === 0 ? '—' : `${((100 * n) / searches).toFixed(1)}%`);
    process.stdout.write(
      `\n### K-prefix instrument (full K=${args.k ?? '?'})\n` +
        `  searches: ${searches}\n` +
        `  decision flips @K=2: ${flips2} (${pct(flips2)})\n` +
        `  decision flips @K=4: ${flips4} (${pct(flips4)})\n`,
    );
  }

  writeAggregateAnalyses(args, allResults);

  let failuresWritten = 0;
  for (const r of allResults) {
    if (r.outcome === 'complete') continue;
    writeFileSync(join(args.outDir, 'failures', failureFilename(r)), renderFailureTrace(r));
    failuresWritten++;
  }

  // Summary table per strategy (keyed on the effective — possibly
  // arbitrated — name; the RunResults carry it).
  process.stdout.write('\n');
  for (const strategy of strategies) {
    const subset = allResults.filter((r) => r.strategyName === nameFor(strategy));
    const stats = aggregate(subset);
    process.stdout.write(`### ${nameFor(strategy)}\n`);
    process.stdout.write(`  runs:       ${stats.totalRuns}\n`);
    process.stdout.write(`  win rate:   ${(stats.winRate * 100).toFixed(1)}%\n`);
    // 72b audit (F1) — the walk position is (sectorsCleared, per-sector hop);
    // a bare "avg hop" reads BACKWARDS on walk shapes (gotcha #120).
    process.stdout.write(
      `  avg pos:    sc ${stats.averageSectorsCleared.toFixed(2)} · hop ${stats.averageHopReached.toFixed(2)} (per-sector)\n`,
    );
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
  // 71b — the per-item decision-grade read, printed whenever the batch carries
  // decision logs (i.e. the arbitrated arm ran). Serial-console-only, like the
  // per-strategy stats table — the file contract is decisions.csv itself, and
  // a --jobs/box batch re-derives this read from the sidecar (board --report,
  // or parseDecisionsCsv by hand).
  if (allResults.some((r) => r.decisions !== undefined)) {
    const rows = decisionRowsOf(allResults);
    process.stdout.write(renderDecisionAnalysis(rows) + '\n');
    // 84f2 — the inert-class tripwire rides the same condition: every batch
    // that logs decisions prints it (the 84d packet blindness would have
    // shown on the first §69e batch had this existed).
    process.stdout.write(renderInertClassTripwire(rows) + '\n');
  }
  // 71c — the flip-rate aggregate, printed whenever the shadow ran.
  if (tierFlipRows(allResults).length > 0) {
    process.stdout.write(renderTierFlipAnalysis(allResults) + '\n');
  }
  // 72b-pre — the seam-hazard read, printed whenever any run reached a sector
  // seam (walk shapes). Serial-console-only like the reads above — the file
  // contract is the summary.csv poolAtSectorEnd/finalPool columns, which a
  // --jobs/box batch re-derives the same table from.
  if (allResults.some((r) => r.poolAtSectorClears.length > 0)) {
    process.stdout.write('\n' + renderSeamHazard(seamInputsOf(allResults)) + '\n');
  }
  process.stdout.write(
    `Wrote summary.csv and ${failuresWritten} failure trace(s) to ${args.outDir}\n`,
  );
}

/**
 * 71a — write decisions.csv iff any result carries a decision log (the
 * arbitrated arm's harvest above; a mixed or non-arbitrated batch writes
 * nothing). Exported for the --jobs parent — the same code path over the
 * merged results, byte-parity by construction (the 68e discipline).
 */
export function writeDecisionsSidecar(outDir: string, results: readonly RunResult[]): void {
  if (!results.some((r) => r.decisions !== undefined)) return;
  writeFileSync(join(outDir, 'decisions.csv'), renderDecisionsCsv(results));
}

/**
 * 71c — write tier-flips.csv iff any decision was shadow-judged (the
 * `--flip-telemetry` arm). Same shared-code-path contract as the decisions
 * sidecar: the --jobs parent calls this over its merged results.
 */
export function writeTierFlips(outDir: string, results: readonly RunResult[]): void {
  if (tierFlipRows(results).length === 0) return;
  writeFileSync(join(outDir, 'tier-flips.csv'), renderTierFlipsCsv(results));
}

/**
 * 68e — the aggregate analyses (print + CSV), factored out so the --jobs
 * parent runs the SAME code path over its merged results that a serial run
 * runs over `allResults` — parity by construction, not by mirrored rendering.
 */
export function writeAggregateAnalyses(
  args: Pick<CliArgs, 'outDir' | 'perHop' | 'perLayout' | 'perEncounter'>,
  allResults: readonly RunResult[],
): void {
  if (args.perHop) {
    process.stdout.write('\n' + renderPerHopAnalysis(allResults));
    const stats = perHopStats(allResults);
    // 68e — sector leads (the walk ordinal; hop numbering resets per sector).
    const header =
      'sector,hop,runsReached,runsDied,deathRate,battles,avgPlayerDeaths,playerSize,playerAvgLevel,playerMedianLevel,playerLevelSpread,' +
      'enemySize,enemyAvgLevel,enemyMedianLevel,enemyLevelSpread';
    const rows = stats.map((s) =>
      [
        s.sector,
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
