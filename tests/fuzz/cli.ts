/**
 * `npm run fuzz` entry point — parses the (global) flag grammar and dispatches
 * to one mode command under `commands/`. The grammar is shared across modes
 * (commands/args.ts); each command file owns its mode's behavior and output.
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
 *   npm run fuzz -- --per-hop   # + per-hop team analysis (stdout + per-hop.csv)
 *   npm run fuzz -- --per-layout  # + per-layout & layout×hop win/death breakdown (+ CSVs)
 *   npm run fuzz -- --per-encounter  # + per-encounter pool-damage breakdown (telemetry on; + per-encounter.csv)
 *   npm run fuzz -- --encounter=brigands --per-encounter  # force ONE encounter (clean sample, X2)
 *   # X2d — --hops / --roster apply to a plain run too (boss/elite isolation: every
 *   # run is that fight). The boss fields only at its node kind, so --hops=2 puts the
 *   # terminal boss node one step in:
 *   npm run fuzz -- --encounter=bandit-king --hops=2 --roster=mercenary:6,ranged:6,mage:6 --per-encounter
 *   npm run fuzz -- --layout=junctionAmbush --per-hop   # force ONE layout (clean full sample)
 *   npm run fuzz -- --layout=procedural --per-hop       # force PROCEDURAL maps every battle (M6 isolate)
 *
 *   # H7b — random-search the scored-strategy weights for the best win rate:
 *   npm run fuzz -- --search                       # quick preset (short runs, < ~1 min)
 *   npm run fuzz -- --search --preset=overnight    # the real sweep (full runs, hours)
 *   npm run fuzz -- --search --vectors=200 --seeds=40 --sampler-seed=7
 *   # → writes output/best-strategy.json (re-runnable via --strategy=…json) + search-results.csv
 *   # X2 — --seed-offset=N bases the eval seeds past the tuned range (the
 *   # config-overfit holdout for the X3 verify; applies to run / search / sweep):
 *   npm run fuzz -- --search --preset=overnight --seed-offset=2000   # held-out verify
 *
 *   # H7c — balance-sweep a config knob (or a 2-knob grid): best-achievable win
 *   # rate + skill gradient + per-archetype telemetry at each grid point:
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.25:1.5:6 \
 *     --knob2=difficulty.swarmMaxMultiplier --range2=1.0:3.0:5 --tier=quick
 *   npm run fuzz -- --balance-sweep --knob=health.enemyHealthMax --range=8:16:5 --dry-run
 *   # → writes output/balance-sweep.csv (+ .report.txt); --dry-run times point 1, no write
 *   # X2 — the per-encounter difficulty-multiplier sweep: drive the GLOBAL lever
 *   # (waveSize × levelBudget) in ISOLATION on ONE forced encounter:
 *   npm run fuzz -- --balance-sweep --encounter=the-bandit-king \
 *     --knob=difficulty.waveSizeMultiplier --range=0.5:2.0:4 \
 *     --knob2=difficulty.levelBudgetMultiplier --range2=0.5:2.0:4 --tier=medium
 *   # --hops=N overrides the tier's run length (cheap FULL-length reads):
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.625:0.625:1 \
 *     --tier=quick --hops=11
 *   # --roster forces the starting roster (evaluate an archetype the search won't
 *   # recruit — read its per-deployment telemetry):
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.625:0.625:1 \
 *     --tier=quick --hops=11 --roster=mercenary,mercenary,ranged,mage,mage
 *   # --jobs=N fans each grid point's vector search across N child processes
 *   # (results are byte-identical to single-process — only wall-clock changes):
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.625:0.75:2 \
 *     --knob2=difficulty.swarmMaxMultiplier --range2=1.75:2.0:2 --tier=heavy --jobs=8
 *
 *   # H7c — re-render a past sweep's CSV as a readable per-point report:
 *   npm run fuzz -- --report                          # output/balance-sweep.csv
 *   npm run fuzz -- --report=output/balance-sweep.csv # any CSV → prints + writes .report.txt
 *
 *   # J4 — arena mode: tune an objective strategy in a single forced battle
 *   # (no Run wrapper). No --objective → enumerate the proclivity menu, rank by
 *   # win rate, write output/best-objective.json:
 *   npm run fuzz -- --arena --seeds=40 --roster=mercenary:5,mercenary:5,ranged:5
 *   npm run fuzz -- --arena --objective=stat:evasion:lowest --layout=junctionAmbush
 *   npm run fuzz -- --arena --objective=output/best-objective.json   # inspect one
 *
 *   # K3c3 — scored-objective vector search: --vectors=N random-searches the
 *   # linear weight space (per-stat + hp + per-archetype) instead of the menu;
 *   # winner lands in the same best-objective.json format:
 *   npm run fuzz -- --arena --vectors=200 --seeds=40 --sampler-seed=7
 *
 *   # J4 — drive a FIXED objective strategy through the full run fuzz / --search /
 *   # --balance-sweep (default none = byte-identical baselines; tune it in --arena
 *   # first, then feed the saved JSON | random | none):
 *   npm run fuzz -- --count=50 --objective=output/best-objective.json
 *   npm run fuzz -- --search --objective=random --jobs=8
 *   npm run fuzz -- --balance-sweep --knob=difficulty.budgetFactor --range=0.5:0.75:2 \
 *     --objective=output/best-objective.json --tier=medium --jobs=8
 *
 *   # §55 pre-gate — drive the §54 traffic-script bot in a plain run (the
 *   # fixed-vector probe arm; run mode ONLY — search/sweep/arena bail; mutually
 *   # exclusive with --objective per the frozen-anchor contract):
 *   npm run fuzz -- --count=120 --strategy=output/best-strategy.json --scripts
 *
 *   # 57a — a subset registry for leave-one-out / only-arm A/Bs (minus form
 *   # subtracts from the standard registry; plain ids select exactly those;
 *   # grammar + loud-bail validation in scriptSubset.ts):
 *   npm run fuzz -- --count=120 --scripts=-unjam
 *   npm run fuzz -- --count=120 --scripts=unjam
 *
 *   # §57f — the portfolio rollout searcher (Rung 2 proper): scripts NOMINATE,
 *   # rollouts arbitrate, the null arm floors (§57c v2 dials; run mode ONLY;
 *   # mutually exclusive with --objective and --scripts; optional =<spec>
 *   # selects a nominator subset, same grammar as --scripts):
 *   npm run fuzz -- --count=120 --searcher
 *   npm run fuzz -- --count=120 --searcher=-unjam
 *
 *   # 57f2 — run-mode parallelism: fan a measurement batch's seed range across
 *   # N child processes (summary.csv + failure traces byte-identical to serial —
 *   # pinned by parallelRun.test.ts; --seed and the --per-* analyses bail loudly;
 *   # sized for the box: 8 cores → --jobs=8):
 *   npm run fuzz -- --count=120 --scripts --jobs=8
 *   npm run fuzz -- --count=120 --searcher --jobs=8
 *
 *   # K3c3 — drive a FIXED redraw policy through the same three modes (default
 *   # none = turn gates stay off, byte-identical baselines). Inline forms
 *   # random:<k> / level:<k> (toss k random / k lowest-level cards per turn;
 *   # level:0 = the gates-on control), or a saved scored policy JSON:
 *   npm run fuzz -- --count=50 --redraw=level:6
 *   npm run fuzz -- --count=50 --redraw=config/redraw-level-fisher.json
 *   npm run fuzz -- --search --redraw=level:6 --jobs=8
 *
 * Strategies come from the shared registry (tests/fuzz/strategies/registry.ts);
 * the default sweep is just the two baselines so a no-flag run stays fast — the
 * full parameterized menu is opt-in via `--strategy=NAME` or `--strategy=all`.
 *
 * Argument parsing is intentionally minimal — this is a dev-only tool,
 * not a published CLI.
 */

import { parseArgs } from './commands/args';
import { runRunCli } from './commands/run';
import { runParallelRunCli } from './commands/parallel';
import { runSearchCli } from './commands/search';
import { runBalanceSweepCli } from './commands/sweep';
import { runEvalShardCli } from './commands/evalShard';
import { runReportCli } from './commands/report';
import { runArenaCli } from './commands/arena';

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
  if (args.arena) {
    runArenaCli(args);
    return;
  }
  // 57f2 — run-mode parallelism: `--jobs>1` fans the seed range across child
  // processes; file outputs are byte-identical to serial (commands/parallel.ts).
  if ((args.jobs ?? 1) > 1) {
    await runParallelRunCli(args);
    return;
  }
  runRunCli(args);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
