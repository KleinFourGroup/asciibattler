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
 * Strategies come from the shared registry (tests/fuzz/strategies/registry.ts);
 * the default sweep is just the two baselines so a no-flag run stays fast — the
 * full parameterized menu is opt-in via `--strategy=NAME` or `--strategy=all`.
 *
 * Argument parsing is intentionally minimal — this is a dev-only tool,
 * not a published CLI.
 */

import { parseArgs } from './commands/args';
import { runRunCli } from './commands/run';
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
  runRunCli(args);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
