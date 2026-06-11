/**
 * J4 — `--arena` mode. A single forced `World` battle (no `Run` wrapper) for
 * tuning objective strategies in isolation (ROADMAP §J4). With `--objective` it
 * runs ONE named proclivity over the seeds and prints its win rate; without, it
 * enumerates the whole proclivity menu, ranks by player win rate, prints the
 * table, and writes the winner to `output/best-objective.json` — the strategy
 * the full-run fuzz then consumes via `--objective=<file>.json` (commit 2).
 *
 *   npm run fuzz -- --arena --seeds=40 --roster=mercenary:5,mercenary:5,ranged:5
 *   npm run fuzz -- --arena --objective=stat:evasion:lowest --layout=junctionAmbush
 *   npm run fuzz -- --arena --objective=output/best-objective.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runArena, runArenaSearch, DEFAULT_ARENA_ROSTER, type ArenaSearchResult } from '../arena';
import {
  parseObjectiveFlag,
  objectiveMenu,
  proclivityLabel,
  serializeProclivity,
} from '../objectiveStrategy';
import { parseRunConfig } from '../../../src/run/RunConfig';
import { LAYOUT_IDS } from '../../../src/sim/layouts';
import { bail, range, type CliArgs } from './args';

export type ArenaModeArgs = Pick<CliArgs, 'seeds' | 'roster' | 'layout' | 'objective' | 'outDir'>;

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

  // A single named proclivity (inspect one strategy) vs the full enumeration.
  if (args.objective !== undefined) {
    const proclivity = parseObjectiveFlag(args.objective);
    let wins = 0;
    let totalTicks = 0;
    let hangs = 0;
    for (const s of seeds) {
      const r = runArena(s, { roster, proclivity, layoutId });
      if (r.winner === 'player') wins++;
      if (r.winner === 'hang') hangs++;
      totalTicks += r.ticks;
    }
    process.stdout.write(
      `Arena: ${proclivityLabel(proclivity)} × ${seeds.length} seeds ` +
        `roster=[${rosterNote}] layout=${layoutId ?? 'procedural'}\n` +
        `  win ${((100 * wins) / seeds.length).toFixed(0)}%  ` +
        `avgTicks ${(totalTicks / seeds.length).toFixed(0)}  hangs ${hangs}\n`,
    );
    return;
  }

  process.stdout.write(
    `Arena search: ${objectiveMenu().length} proclivities × ${seeds.length} seeds, ` +
      `roster=[${rosterNote}] layout=${layoutId ?? 'procedural'}…\n`,
  );
  const result = runArenaSearch(seeds, roster, layoutId);
  process.stdout.write('\n' + renderArenaTable(result) + '\n');

  mkdirSync(args.outDir, { recursive: true });
  const bestPath = join(args.outDir, 'best-objective.json');
  writeFileSync(bestPath, serializeProclivity(result.best.proclivity));
  process.stdout.write(
    `\nBest: ${result.best.label} (win ${(100 * result.best.winRate).toFixed(0)}%) → ${bestPath}\n`,
  );
  process.stdout.write(`  feed it to the run fuzz: npm run fuzz -- --objective=${bestPath}\n`);
}

/** Compact ranked table of every proclivity's arena score (best-first). */
function renderArenaTable(result: ArenaSearchResult): string {
  const lines = [`  ${'proclivity'.padEnd(26)} win%  avgTicks  hangs`];
  for (const s of result.scores) {
    lines.push(
      `  ${s.label.padEnd(26)} ${(s.winRate * 100).toFixed(0).padStart(4)}  ` +
        `${s.avgTicks.toFixed(0).padStart(8)}  ${String(s.hangs).padStart(5)}`,
    );
  }
  return lines.join('\n');
}
