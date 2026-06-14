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

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessOptions } from '../harness';
import { serializeWeights } from '../strategies/scoredWeights';
import {
  runSearch,
  generateVectors,
  assembleSearchResult,
  harnessEvaluate,
  splitSeeds,
  PRESETS,
  DEFAULT_BOX,
  type SearchResult,
} from '../search';
import { evaluateVectorsSharded } from '../searchShard';
import { proclivityLabel } from '../objectiveStrategy';
import { redrawPolicyLabel } from '../redrawPolicy';
import { empowerPolicyLabel } from '../empowerPolicy';
import { daemonLabel } from '../daemonSelection';
import { parseRunConfig } from '../../../src/run/RunConfig';
import {
  bail,
  daemonFromArgs,
  empowerFromArgs,
  layoutFromArgs,
  objectiveFromArgs,
  redrawFromArgs,
  type CliArgs,
} from './args';

export type SearchModeArgs = Pick<
  CliArgs,
  | 'preset'
  | 'vectors'
  | 'seeds'
  | 'samplerSeed'
  | 'jobs'
  | 'floors'
  | 'roster'
  | 'layout'
  | 'objective'
  | 'redraw'
  | 'empower'
  | 'daemon'
  | 'outDir'
>;

export async function runSearchCli(args: SearchModeArgs): Promise<void> {
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
  // M6/N2 — force one layout (or `procedural`) across the searched runs, so the
  // overnight verify (stage 5) can hold out on the procedural maps too. Validated
  // loudly by layoutFromArgs (parseRunConfig would silently drop a typo'd id).
  const forcedLayoutId = layoutFromArgs(args);
  if (forcedLayoutId !== undefined) searchParams.set('layout', forcedLayoutId);
  const runConfig = parseRunConfig(searchParams);
  const objective = objectiveFromArgs(args);
  const redraw = redrawFromArgs(args);
  const empower = empowerFromArgs(args);
  const daemon = daemonFromArgs(args);
  let harnessOptions: HarnessOptions = Object.keys(runConfig).length > 0 ? { runConfig } : {};
  if (objective) harnessOptions = { ...harnessOptions, objective };
  if (redraw) harnessOptions = { ...harnessOptions, redraw };
  if (empower) harnessOptions = { ...harnessOptions, empower };
  if (daemon) harnessOptions = { ...harnessOptions, daemon };

  const floorNote = floorCount !== undefined ? ` floors=${floorCount}` : ' floors=full';
  const rosterNote = runConfig.startingRoster
    ? ` roster=[${runConfig.startingRoster.map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype)).join(',')}]`
    : '';
  const jobsNote = jobs > 1 ? ` jobs=${jobs}` : '';
  const layoutNote = forcedLayoutId ? ` layout=${forcedLayoutId}` : '';
  const objectiveNote = objective ? ` objective=${proclivityLabel(objective)}` : '';
  const redrawNote = redraw ? ` redraw=${redrawPolicyLabel(redraw)}` : '';
  const empowerNote = empower ? ` empower=${empowerPolicyLabel(empower)}` : '';
  const daemonNote = daemon ? ` daemon=${daemonLabel(daemon)}` : '';
  process.stdout.write(
    `Search: preset=${presetName} vectors=${vectors}${floorNote}${rosterNote}${layoutNote}${objectiveNote}${redrawNote}${empowerNote}${daemonNote}${jobsNote} ` +
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
      forcedLayoutId: runConfig.forcedLayoutId,
      objective,
      redraw,
      empower,
      daemon,
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
