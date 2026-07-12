/**
 * `npm run gauntlet` — 53e's headless bot baseline over the 10-cell battle
 * gauntlet (cells.ts). Opt-in like the fuzz CLI (never part of `npm test`);
 * runs every cell × its 3 fixed seeds × each objective ARM and reports the
 * per-cell outcome table that lands in BALANCE.md §53 — the bot side of the
 * paired-seed human-vs-bot comparison (the human side is 53g's recorded
 * session over the SAME cell URLs — `--urls` prints them).
 *
 * Usage:
 *   npm run gauntlet                          # all cells, arms none,random
 *   npm run gauntlet -- --arms=none,random,hp:lowest
 *   npm run gauntlet -- --cell=artillery-funnel
 *   npm run gauntlet -- --strategy=greedy     # run-level strategy override
 *   npm run gauntlet -- --urls                # print the 53g session URL list
 *   npm run gauntlet -- --csv                 # also write output/gauntlet.csv
 *
 * Cell outcome = "the target encounter was CLEARED": the run fought the
 * cell's encounter and advanced past its node (`finalHopReached > cell hop`,
 * or run `complete`). A cell×seed whose run never MET its encounter (e.g. an
 * elite-less map for the elite cell) reports `n/a` and a loud warning — a
 * bad seed, swap it in cells.ts.
 *
 * Arms reuse the fuzz `--objective` vocabulary (`parseObjectiveFlag`):
 * `none` = the passive control (byte-identical to a click-less human),
 * `random`/`hp:…`/`stat:…`/`archetype:…`/a saved `.json` = the J4
 * proclivities. Run-level choices (path/recruit) use `greedy`, except the
 * elite cell which walks `path:elite` to reach its node (override: `--strategy`).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOne, type RunResult } from '../fuzz/harness';
import { makeStrategy, STRATEGY_NAMES } from '../fuzz/strategies/registry';
import { parseObjectiveFlag, type ObjectiveProclivity } from '../fuzz/objectiveStrategy';
import { GAUNTLET_CELLS, cellRunConfig, cellUrl, type GauntletCell } from './cells';

interface CliArgs {
  arms: { label: string; proclivity: ObjectiveProclivity }[];
  cellFilter: string | undefined;
  strategyOverride: string | undefined;
  urls: boolean;
  csv: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    arms: [],
    cellFilter: undefined,
    strategyOverride: undefined,
    urls: false,
    csv: false,
  };
  for (const raw of argv) {
    const eq = raw.indexOf('=');
    const flag = eq < 0 ? raw : raw.slice(0, eq);
    const value = eq < 0 ? undefined : raw.slice(eq + 1);
    switch (flag) {
      case '--arms':
        if (!value) throw new Error('--arms needs a comma list (e.g. --arms=none,random)');
        for (const token of value.split(',')) {
          args.arms.push({ label: token, proclivity: parseObjectiveFlag(token) });
        }
        break;
      case '--cell':
        args.cellFilter = value;
        break;
      case '--strategy':
        args.strategyOverride = value;
        break;
      case '--urls':
        args.urls = true;
        break;
      case '--csv':
        args.csv = true;
        break;
      case '--help':
        process.stdout.write(
          'gauntlet — headless bot baseline over the 10-cell battle gauntlet.\n' +
            'Flags: --arms=LIST  --cell=ID  --strategy=NAME  --urls  --csv  --help\n',
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown flag: ${raw}`);
    }
  }
  if (args.arms.length === 0) {
    args.arms = [
      { label: 'none', proclivity: { kind: 'none' } },
      { label: 'random', proclivity: { kind: 'random' } },
    ];
  }
  return args;
}

interface CellRunRow {
  cell: GauntletCell;
  arm: string;
  seed: number;
  fought: boolean;
  cleared: boolean;
  /** Turns (waves) fought against the target encounter. */
  turns: number;
  draws: number;
  ticks: number;
  playerDeaths: number;
}

function strategyNameFor(cell: GauntletCell, override: string | undefined): string {
  if (override) return override;
  return cell.kind === 'elite' ? 'path:elite' : 'greedy';
}

function runCell(
  cell: GauntletCell,
  seed: number,
  arm: { label: string; proclivity: ObjectiveProclivity },
  strategyOverride: string | undefined,
): CellRunRow {
  const strategyName = strategyNameFor(cell, strategyOverride);
  const strategy = makeStrategy(strategyName);
  if (!strategy) {
    throw new Error(`Unknown strategy: ${strategyName} (choices: ${STRATEGY_NAMES.join(', ')})`);
  }
  const result: RunResult = runOne(seed, strategy, {
    runConfig: cellRunConfig(cell, seed),
    objective: arm.proclivity,
  });
  const target = result.battles.filter((b) => b.encounterId === cell.encounterId);
  const fought = target.length > 0;
  const cellHop = target[0]?.hop ?? -1;
  const cleared = fought && (result.outcome === 'complete' || result.finalHopReached > cellHop);
  return {
    cell,
    arm: arm.label,
    seed,
    fought,
    cleared,
    turns: target.length,
    draws: target.filter((b) => b.winner === 'draw').length,
    ticks: target.reduce((sum, b) => sum + b.ticks, 0),
    playerDeaths: target.reduce((sum, b) => sum + b.playerDeaths, 0),
  };
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const cells = args.cellFilter
    ? GAUNTLET_CELLS.filter((c) => c.id === args.cellFilter)
    : GAUNTLET_CELLS;
  if (cells.length === 0) {
    throw new Error(
      `No cell matches --cell=${args.cellFilter} (ids: ${GAUNTLET_CELLS.map((c) => c.id).join(', ')})`,
    );
  }

  if (args.urls) {
    process.stdout.write('The 53g human-session launch URLs (play each once, recorder on):\n\n');
    for (const cell of cells) {
      process.stdout.write(`## ${cell.id} — ${cell.why}\n`);
      if (cell.kind === 'elite') {
        process.stdout.write('   (enter the * elite node at hop 1)\n');
      } else if (cell.kind === 'boss') {
        process.stdout.write('   (the cell is the boss at hop 1; hop 0 is a pool roll)\n');
      }
      for (const seed of cell.seeds) process.stdout.write(`   ${cellUrl(cell, seed)}\n`);
      process.stdout.write('\n');
    }
    return;
  }

  const rows: CellRunRow[] = [];
  for (const cell of cells) {
    for (const seed of cell.seeds) {
      for (const arm of args.arms) {
        rows.push(runCell(cell, seed, arm, args.strategyOverride));
      }
    }
  }

  // Per cell × arm aggregation.
  process.stdout.write(
    `\n${pad('cell', 18)}${pad('arm', 12)}${pad('cleared', 9)}${pad('draws', 7)}${pad('deaths', 8)}avg ticks\n`,
  );
  for (const cell of cells) {
    for (const arm of args.arms) {
      const sub = rows.filter((r) => r.cell.id === cell.id && r.arm === arm.label);
      const fought = sub.filter((r) => r.fought);
      const cleared = fought.filter((r) => r.cleared).length;
      const clearedStr =
        fought.length === 0 ? 'n/a' : `${cleared}/${fought.length}`;
      const avgTicks =
        fought.length === 0
          ? '—'
          : String(Math.round(fought.reduce((s, r) => s + r.ticks, 0) / fought.length));
      const draws = fought.reduce((s, r) => s + r.draws, 0);
      const deaths = fought.reduce((s, r) => s + r.playerDeaths, 0);
      process.stdout.write(
        `${pad(cell.id, 18)}${pad(arm.label, 12)}${pad(clearedStr, 9)}${pad(String(draws), 7)}${pad(String(deaths), 8)}${avgTicks}\n`,
      );
    }
  }

  // Loud seed validation — a cell×seed that never met its encounter is a bad
  // seed (e.g. an elite-less map): swap it in cells.ts.
  const unfought = rows.filter((r) => !r.fought);
  if (unfought.length > 0) {
    process.stdout.write('\n⚠ BAD SEEDS (the run never met the cell encounter):\n');
    for (const r of unfought) {
      process.stdout.write(`   ${r.cell.id} seed=${r.seed} arm=${r.arm}\n`);
    }
  }

  if (args.csv) {
    const outDir = join(dirname(fileURLToPath(import.meta.url)), 'output');
    mkdirSync(outDir, { recursive: true });
    const header = 'cell,arm,seed,fought,cleared,turns,draws,ticks,playerDeaths';
    const lines = rows.map(
      (r) =>
        `${r.cell.id},${r.arm},${r.seed},${r.fought},${r.cleared},${r.turns},${r.draws},${r.ticks},${r.playerDeaths}`,
    );
    const file = join(outDir, 'gauntlet.csv');
    writeFileSync(file, [header, ...lines].join('\n') + '\n');
    process.stdout.write(`\nCSV written: ${file}\n`);
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`gauntlet: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
