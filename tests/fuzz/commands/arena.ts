/**
 * J4 — `--arena` mode. A single forced `World` battle (no `Run` wrapper) for
 * tuning objective strategies in isolation (ROADMAP §J4). With `--objective` it
 * runs ONE named proclivity over the seeds and prints its win rate; without, it
 * enumerates the whole proclivity menu, ranks by player win rate, prints the
 * table, and writes the winner to `output/best-objective.json` — the strategy
 * the full-run fuzz then consumes via `--objective=<file>.json` (commit 2).
 *
 *   npm run fuzz -- --arena --seeds=40 --roster=mercenary:5,mercenary:5,archer:5
 *   npm run fuzz -- --arena --objective=stat:evasion:lowest --layout=junctionAmbush
 *   npm run fuzz -- --arena --objective=output/best-objective.json
 *
 * K3c3 — `--vectors=N` switches the enumeration to a random search of the
 * SCORED objective weight space (N sampled vectors, `--sampler-seed` to vary);
 * the winner lands in the same best-objective.json format:
 *
 *   npm run fuzz -- --arena --vectors=200 --seeds=40 --sampler-seed=7
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  runArena,
  runArenaSearch,
  runArenaVectorSearch,
  DEFAULT_ARENA_ROSTER,
  type ArenaSearchResult,
} from '../arena';
import {
  parseObjectiveFlag,
  objectiveMenu,
  proclivityLabel,
  serializeProclivity,
} from '../objectiveStrategy';
import { parseRunConfig } from '../../../src/run/RunConfig';
import { LAYOUT_IDS } from '../../../src/sim/layouts';
import { bail, coverageFromArgs, range, type CliArgs } from './args';

export type ArenaModeArgs = Pick<
  CliArgs,
  'seeds' | 'roster' | 'layout' | 'objective' | 'vectors' | 'samplerSeed' | 'outDir'
>;

export function runArenaCli(args: ArenaModeArgs): void {
  const seeds = range(1, args.seeds ?? 24);
  const roster =
    (args.roster
      ? parseRunConfig(new URLSearchParams({ roster: args.roster })).startingRoster
      : undefined) ?? DEFAULT_ARENA_ROSTER;
  if (args.layout !== undefined && !LAYOUT_IDS.includes(args.layout)) {
    bail(`Unknown layout: ${args.layout} (choices: ${LAYOUT_IDS.join(', ')})`);
  }
  const layoutId = args.layout ?? null;
  const rosterNote = roster
    .map((e) => (e.level > 1 ? `${e.archetype}:${e.level}` : e.archetype))
    .join(',');

  // O5 — `--objective=coverage`: churn every objective mode on BOTH teams for
  // termination/determinism coverage (no win-rate meaning — a churn bot is a
  // near-certain loss; the read that matters is that every seed TERMINATES).
  if (coverageFromArgs(args)) {
    let wins = 0;
    let draws = 0;
    let totalTicks = 0;
    for (const s of seeds) {
      const r = runArena(s, { roster, coverage: true, layoutId });
      if (r.winner === 'player') wins++;
      if (r.winner === 'draw') draws++;
      totalTicks += r.ticks;
    }
    process.stdout.write(
      `Arena: coverage × ${seeds.length} seeds ` +
        `roster=[${rosterNote}] layout=${layoutId ?? 'procedural'}\n` +
        `  all terminated (${seeds.length}/${seeds.length})  ` +
        `win ${((100 * wins) / seeds.length).toFixed(0)}%  ` +
        `draws ${draws}  avgTicks ${(totalTicks / seeds.length).toFixed(0)}\n`,
    );
    return;
  }

  // A single named proclivity (inspect one strategy) vs the full enumeration.
  if (args.objective !== undefined) {
    const proclivity = parseObjectiveFlag(args.objective);
    let wins = 0;
    let totalTicks = 0;
    let draws = 0;
    for (const s of seeds) {
      const r = runArena(s, { roster, proclivity, layoutId });
      if (r.winner === 'player') wins++;
      if (r.winner === 'draw') draws++;
      totalTicks += r.ticks;
    }
    process.stdout.write(
      `Arena: ${proclivityLabel(proclivity)} × ${seeds.length} seeds ` +
        `roster=[${rosterNote}] layout=${layoutId ?? 'procedural'}\n` +
        `  win ${((100 * wins) / seeds.length).toFixed(0)}%  ` +
        `avgTicks ${(totalTicks / seeds.length).toFixed(0)}  draws ${draws}\n`,
    );
    return;
  }

  // K3c3 — `--vectors=N`: random-search the scored-objective weight space
  // instead of enumerating the menu. A `none` baseline line gives the table a
  // floor to read the vectors against.
  if (args.vectors !== undefined) {
    const samplerSeed = args.samplerSeed ?? 1;
    process.stdout.write(
      `Arena scored search: ${args.vectors} vectors × ${seeds.length} seeds, ` +
        `roster=[${rosterNote}] layout=${layoutId ?? 'procedural'} samplerSeed=${samplerSeed}…\n`,
    );
    const result = runArenaVectorSearch(seeds, roster, layoutId, {
      samplerSeed,
      vectors: args.vectors,
    });
    let baselineWins = 0;
    for (const s of seeds) {
      if (runArena(s, { roster, proclivity: { kind: 'none' }, layoutId }).winner === 'player') {
        baselineWins++;
      }
    }
    process.stdout.write('\n' + renderArenaTable(result, 10) + '\n');
    process.stdout.write(
      `  baseline none: win ${((100 * baselineWins) / seeds.length).toFixed(0)}%\n`,
    );
    writeBest(args.outDir, result);
    return;
  }

  process.stdout.write(
    `Arena search: ${objectiveMenu().length} proclivities × ${seeds.length} seeds, ` +
      `roster=[${rosterNote}] layout=${layoutId ?? 'procedural'}…\n`,
  );
  const result = runArenaSearch(seeds, roster, layoutId);
  process.stdout.write('\n' + renderArenaTable(result) + '\n');
  writeBest(args.outDir, result);
}

/** Write the search winner to best-objective.json + print the feed-it hint —
 *  shared by the menu enumeration and the scored vector search (the file
 *  format is the same proclivity JSON either way). */
function writeBest(outDir: string, result: ArenaSearchResult): void {
  mkdirSync(outDir, { recursive: true });
  const bestPath = join(outDir, 'best-objective.json');
  writeFileSync(bestPath, serializeProclivity(result.best.proclivity));
  process.stdout.write(
    `\nBest: ${result.best.label} (win ${(100 * result.best.winRate).toFixed(0)}%) → ${bestPath}\n`,
  );
  process.stdout.write(`  feed it to the run fuzz: npm run fuzz -- --objective=${bestPath}\n`);
}

/** Compact ranked table of every proclivity's arena score (best-first);
 *  `topN` truncates (the vector search samples hundreds — the tail is noise). */
function renderArenaTable(result: ArenaSearchResult, topN?: number): string {
  const lines = [`  ${'proclivity'.padEnd(26)} win%  avgTicks  draws`];
  const shown = topN !== undefined ? result.scores.slice(0, topN) : result.scores;
  for (const s of shown) {
    lines.push(
      `  ${s.label.padEnd(26)} ${(s.winRate * 100).toFixed(0).padStart(4)}  ` +
        `${s.avgTicks.toFixed(0).padStart(8)}  ${String(s.draws).padStart(5)}`,
    );
  }
  if (topN !== undefined && result.scores.length > topN) {
    lines.push(`  … (${result.scores.length - topN} more)`);
  }
  return lines.join('\n');
}
