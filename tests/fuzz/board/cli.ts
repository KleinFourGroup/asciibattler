/**
 * 68c — the balance-board CLI: `npm run balance:board -- <mode>`.
 *
 *   --plan [--jobs=N] [--only=a,b]   print the fuzz commands, one per line
 *                                    (the box path: feed these to box-batch.sh)
 *   --run  [--jobs=N] [--only=a,b]   run each instrument locally (sequential
 *                                    spawns of the real fuzz CLI, each into
 *                                    output/board/<id>/), then report
 *   --report [--dir=<root>]          evaluate existing summary.csv files vs
 *                                    the signed sheet (default output/board/)
 *
 * The runner is a thin shell (spawn + move on) — the measurement logic lives
 * in board.ts as pure functions, which is where the tests point. ⚠ A full
 * board is ~5 searcher batches: prefer `--plan` + the box for real reads;
 * `--run` locally is for tier-quick smoke shapes and single instruments
 * (`--only=`). Reboot before a heavy local `--jobs` run (the dwm leak).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBoard,
  computeMetrics,
  evaluateBoard,
  parseSummaryCsv,
  renderReport,
  type Board,
  type InstrumentMetrics,
} from './board';

const HERE = dirname(fileURLToPath(import.meta.url));
const FUZZ_CLI = join(HERE, '..', 'cli.ts');
const DEFAULT_DIR = join(HERE, '..', 'output', 'board');

interface BoardArgs {
  mode: 'plan' | 'run' | 'report';
  jobs?: number;
  only?: readonly string[];
  dir: string;
}

function parseBoardArgs(argv: readonly string[]): BoardArgs {
  const args: BoardArgs = { mode: 'report', dir: DEFAULT_DIR };
  let modeSeen = false;
  for (const raw of argv) {
    const eq = raw.indexOf('=');
    const [flag, v] = eq < 0 ? [raw, undefined] : [raw.slice(0, eq), raw.slice(eq + 1)];
    switch (flag) {
      case '--plan':
      case '--run':
      case '--report':
        if (modeSeen) throw new Error('balance:board takes ONE mode (--plan | --run | --report)');
        args.mode = flag.slice(2) as BoardArgs['mode'];
        modeSeen = true;
        break;
      case '--jobs':
        args.jobs = Number(v);
        break;
      case '--only':
        args.only = (v ?? '').split(',').map((t) => t.trim()).filter((t) => t.length > 0);
        break;
      case '--dir':
        if (v !== undefined) args.dir = v;
        break;
      default:
        throw new Error(`balance:board: unknown flag ${raw}`);
    }
  }
  if (!modeSeen) throw new Error('balance:board needs a mode: --plan | --run | --report');
  return args;
}

function selectInstruments(board: Board, only?: readonly string[]): Board['instruments'] {
  if (!only || only.length === 0) return board.instruments;
  const known = new Set(board.instruments.map((i) => i.id));
  for (const id of only) {
    if (!known.has(id)) {
      throw new Error(`balance:board: unknown instrument '${id}' (choices: ${[...known].join(', ')})`);
    }
  }
  return board.instruments.filter((i) => only.includes(i.id));
}

function commandFor(
  inst: Board['instruments'][number],
  dir: string,
  jobs: number | undefined,
): string[] {
  const argv = [...inst.args, `--out=${join(dir, inst.id)}`];
  if (jobs !== undefined && jobs > 1) argv.push(`--jobs=${jobs}`);
  return argv;
}

function report(board: Board, dir: string): { text: string; fails: number } {
  const metrics = new Map<string, InstrumentMetrics>();
  for (const inst of board.instruments) {
    const csvPath = join(dir, inst.id, 'summary.csv');
    if (!existsSync(csvPath)) continue;
    const rows = parseSummaryCsv(readFileSync(csvPath, 'utf8')).filter(
      (r) => r.strategy === inst.strategyRow,
    );
    metrics.set(inst.id, computeMetrics(rows));
  }
  const evaluated = evaluateBoard(board, metrics);
  return { text: renderReport(evaluated, board), fails: evaluated.fails };
}

function main(): void {
  const args = parseBoardArgs(process.argv.slice(2));
  const board = buildBoard();
  const instruments = selectInstruments(board, args.only);

  if (args.mode === 'plan') {
    for (const inst of instruments) {
      process.stdout.write(`npm run fuzz -- ${commandFor(inst, args.dir, args.jobs).join(' ')}\n`);
    }
    return;
  }

  if (args.mode === 'run') {
    for (const inst of instruments) {
      const argv = commandFor(inst, args.dir, args.jobs);
      process.stdout.write(`\n=== ${inst.id}: ${inst.title} ===\n`);
      mkdirSync(join(args.dir, inst.id), { recursive: true });
      const child = spawnSync(process.execPath, ['--import', 'tsx', FUZZ_CLI, ...argv], {
        stdio: 'inherit',
      });
      if (child.status !== 0) {
        throw new Error(`balance:board: instrument '${inst.id}' exited ${child.status}`);
      }
    }
  }

  // run falls through to report; --report reads whatever exists.
  const { text, fails } = report(board, args.dir);
  process.stdout.write('\n' + text);
  const reportPath = join(args.dir, 'board-report.txt');
  mkdirSync(args.dir, { recursive: true });
  writeFileSync(reportPath, text);
  process.stdout.write(`(written to ${reportPath})\n`);
  if (fails > 0) process.exitCode = 1;
}

main();
