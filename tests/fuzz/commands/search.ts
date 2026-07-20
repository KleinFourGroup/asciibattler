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
  refineSearch,
  splitSeeds,
  PRESETS,
  DEFAULT_BOX,
  DEFAULT_REFINE,
  type RefineConfig,
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
  encounterFromArgs,
  layoutFromArgs,
  objectiveFromArgs,
  redrawFromArgs,
  searcherFromArgs,
  type CliArgs,
} from './args';

export type SearchModeArgs = Pick<
  CliArgs,
  | 'preset'
  | 'vectors'
  | 'seeds'
  | 'samplerSeed'
  | 'seedOffset'
  | 'jobs'
  | 'hops'
  | 'roster'
  | 'layout'
  | 'encounter'
  | 'objective'
  | 'redraw'
  | 'empower'
  | 'daemon'
  | 'outDir'
  | 'refine'
  | 'refineK'
  | 'refinePerturbs'
  | 'refineRadius'
  | 'searcher'
  | 'searcherSpec'
  | 'audition'
  | 'k'
  | 'kTelemetry'
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
  // X2 — --seed-offset shifts the eval-seed base for the held-out X3 verify.
  const { trainSeeds, testSeeds } = splitSeeds(trainCount, testCount, args.seedOffset ?? 0);

  // H7c — --hops / --roster overrides also apply to the search (so we can
  // run a full-length or roster-SEEDED search, then replay its emitted winner
  // via --strategy). Both ride RunConfig's validated parser; the hop count
  // falls back to the preset's when --hops is absent (behaviour-preserving).
  const searchParams = new URLSearchParams();
  const hopCount = args.hops ?? preset.hopCount;
  if (hopCount !== undefined) searchParams.set('hops', String(hopCount));
  if (args.roster) searchParams.set('roster', args.roster);
  // M6/N2 — force one layout (or `procedural`) across the searched runs, so the
  // overnight verify (stage 5) can hold out on the procedural maps too. Validated
  // loudly by layoutFromArgs (parseRunConfig would silently drop a typo'd id).
  const forcedLayoutId = layoutFromArgs(args);
  if (forcedLayoutId !== undefined) searchParams.set('layout', forcedLayoutId);
  // X2 — force ONE encounter across the searched runs (the isolation sample).
  // No URL form (programmatic-only), so set it on the parsed config directly.
  const forcedEncounterId = encounterFromArgs(args);
  const parsedConfig = parseRunConfig(searchParams);
  const runConfig =
    forcedEncounterId !== undefined ? { ...parsedConfig, forcedEncounterId } : parsedConfig;
  const objective = objectiveFromArgs(args);
  const redraw = redrawFromArgs(args);
  const empower = empowerFromArgs(args);
  const daemon = daemonFromArgs(args);
  let harnessOptions: HarnessOptions = Object.keys(runConfig).length > 0 ? { runConfig } : {};
  if (objective) harnessOptions = { ...harnessOptions, objective };
  if (redraw) harnessOptions = { ...harnessOptions, redraw };
  if (empower) harnessOptions = { ...harnessOptions, empower };
  if (daemon) harnessOptions = { ...harnessOptions, daemon };
  // 59e — the audition-searcher regen path: `--searcher [--audition] [--k=n]`
  // drives every candidate evaluation (train, test, AND refinement) through
  // the rollout searcher, resolved by the shared searcherFromArgs. ⚠ cost:
  // searcher evals are ~4.1× (57f) — size real regens with a cost probe
  // and prefer the box + --jobs (the 59f protocol).
  const rolloutSearch = searcherFromArgs(args);
  if (rolloutSearch !== undefined) harnessOptions = { ...harnessOptions, rolloutSearch };

  // 59d — the refinement stage: the base search must rank K finalists for
  // refineSearch to take (topK ≥ refine.topK); without --refine the base
  // keeps its winner-only topK=1 and nothing downstream changes.
  const refine: RefineConfig | null = args.refine
    ? {
        topK: args.refineK ?? DEFAULT_REFINE.topK,
        perturbs: args.refinePerturbs ?? DEFAULT_REFINE.perturbs,
        radius: args.refineRadius ?? DEFAULT_REFINE.radius,
      }
    : null;
  const baseTopK = refine ? Math.max(1, refine.topK) : 1;

  const hopNote = hopCount !== undefined ? ` hops=${hopCount}` : ' hops=full';
  const rosterNote = runConfig.startingRoster
    ? ` roster=[${runConfig.startingRoster.map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype)).join(',')}]`
    : '';
  const jobsNote = jobs > 1 ? ` jobs=${jobs}` : '';
  const refineNote = refine ? ` refine=K${refine.topK}x${refine.perturbs}@${refine.radius}` : '';
  const searcherNote = args.searcher
    ? ` searcher=${args.audition ? 'audition' : 'trigger'}${args.searcherSpec ? `:${args.searcherSpec}` : ''}${args.k !== undefined ? ` k=${args.k}` : ''}`
    : '';
  const seedNote = args.seedOffset ? ` seedOffset=${args.seedOffset}` : '';
  const layoutNote = forcedLayoutId ? ` layout=${forcedLayoutId}` : '';
  const encounterNote = forcedEncounterId ? ` encounter=${forcedEncounterId}` : '';
  const objectiveNote = objective ? ` objective=${proclivityLabel(objective)}` : '';
  const redrawNote = redraw ? ` redraw=${redrawPolicyLabel(redraw)}` : '';
  const empowerNote = empower ? ` empower=${empowerPolicyLabel(empower)}` : '';
  const daemonNote = daemon ? ` daemon=${daemonLabel(daemon)}` : '';
  process.stdout.write(
    `Search: preset=${presetName} vectors=${vectors}${hopNote}${rosterNote}${layoutNote}${encounterNote}${objectiveNote}${redrawNote}${empowerNote}${daemonNote}${seedNote}${jobsNote}${refineNote}${searcherNote} ` +
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
      hopCount,
      roster: runConfig.startingRoster,
      forcedLayoutId: runConfig.forcedLayoutId,
      forcedEncounterId: runConfig.forcedEncounterId,
      objective,
      redraw,
      empower,
      daemon,
      searcher: args.searcher,
      searcherSpec: args.searcherSpec,
      audition: args.audition,
      k: args.k,
      jobs,
      tmpDir: join(args.outDir, 'shard-tmp'),
    });
    result = assembleSearchResult(
      sampled,
      trainWinRates,
      (w) => harnessEvaluate(w, testSeeds, harnessOptions),
      { samplerSeed, trainSeeds, testSeeds, topK: baseTopK },
    );
  } else {
    result = runSearch({
      vectors,
      trainSeeds,
      testSeeds,
      samplerSeed,
      box: DEFAULT_BOX,
      harnessOptions,
      topK: baseTopK,
    });
  }

  // 59d — the perturb-and-reselect pass. Refinement evals run in-process
  // through the same harness evaluator (K×perturbs train evals at the
  // defaults; the sharded path's children are done by now — the 59f cost
  // probe prices this stage before the box regen).
  let finalBest = result.best;
  if (refine) {
    process.stdout.write(
      `Refining top-${refine.topK} (${refine.perturbs} perturbs each, radius ${refine.radius})…\n`,
    );
    const refined = await refineSearch(result, {
      box: DEFAULT_BOX,
      refine,
      trainSeeds,
      testSeeds,
      evaluate: (w, seeds) => harnessEvaluate(w, seeds, harnessOptions),
      // 59f-pre — under --jobs the K×perturbs train evals ride the same
      // vector-sharded children as the base search (the cost probe measured
      // serial in-parent refinement at ~7h for an overnight-shaped regen —
      // the whole reason this seam exists). Serial mode keeps the default
      // map-the-scalar behavior.
      ...(jobs > 1
        ? {
            batchEvaluate: (
              vecs: readonly Parameters<typeof harnessEvaluate>[0][],
              seeds: readonly number[],
            ) =>
              evaluateVectorsSharded({
                vectors: vecs,
                seeds,
                knobs: {},
                hopCount,
                roster: runConfig.startingRoster,
                forcedLayoutId: runConfig.forcedLayoutId,
                forcedEncounterId: runConfig.forcedEncounterId,
                objective,
                redraw,
                empower,
                daemon,
                searcher: args.searcher,
                searcherSpec: args.searcherSpec,
                audition: args.audition,
                k: args.k,
                jobs,
                tmpDir: join(args.outDir, 'shard-tmp-refine'),
              }),
          }
        : {}),
    });
    const improvedCount = refined.refined.filter((r) => r.improved).length;
    process.stdout.write(
      `  ${refined.trainEvals} refine evals; ${improvedCount}/${refined.refined.length} finalists improved; ` +
        `train ${(result.best.trainWinRate * 100).toFixed(1)}% → ${(refined.best.trainWinRate * 100).toFixed(1)}%\n`,
    );
    finalBest = refined.best;
  }

  mkdirSync(args.outDir, { recursive: true });
  const bestPath = join(args.outDir, 'best-strategy.json');
  writeFileSync(bestPath, serializeWeights(finalBest.weights));
  const csv =
    ['index,trainWinRate', ...result.trainWinRates.map((w, i) => `${i},${w.toFixed(4)}`)].join(
      '\n',
    ) + '\n';
  writeFileSync(join(args.outDir, 'search-results.csv'), csv);

  process.stdout.write(`\nBest of ${vectors} vectors${refine ? ' (post-refinement)' : ''}:\n`);
  process.stdout.write(`  train win rate: ${(finalBest.trainWinRate * 100).toFixed(1)}%\n`);
  process.stdout.write(
    `  test  win rate: ${(finalBest.testWinRate * 100).toFixed(1)}%  (held-out)\n`,
  );
  process.stdout.write(`  winning vector → ${bestPath}\n`);
  process.stdout.write(`  re-run it: npm run fuzz -- --strategy=${bestPath}\n\n`);
  process.stdout.write(serializeWeights(finalBest.weights));
}
