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
 *            [--allow-unmanifested]  86e2: downgrade the missing-manifest
 *                                    FAIL to WARN (pre-86e1 archives ONLY;
 *                                    dirty trees / head splits still FAIL)
 *
 * 86e2 — the report is a three-way split: VERDICT (fail-closed measurement
 * integrity — missing/unparseable/empty-arm/under-n/dup-seed/window/
 * provenance/N-A all FAIL and exit 1) → DRIFT (the reference bands, WARN)
 * → INSTRUMENT HEALTH (self-checks, never gate). A board that can't prove
 * what it measured is VOID, never a quieter shade of green.
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
  evaluateSkillGradient,
  evaluateVerdict,
  parseSummaryCsv,
  renderReport,
  renderSkillGradient,
  renderVerdictReport,
  type Board,
  type InstrumentAudit,
  type InstrumentMetrics,
} from './board';
import { captureGitProvenance, readBatchManifest, type BatchManifest } from '../manifest';
import {
  inertClasses,
  parseDecisionsCsv,
  renderDecisionAnalysis,
  renderInertClassTripwire,
} from '../reporters';

const HERE = dirname(fileURLToPath(import.meta.url));
const FUZZ_CLI = join(HERE, '..', 'cli.ts');
const DEFAULT_DIR = join(HERE, '..', 'output', 'board');

interface BoardArgs {
  mode: 'plan' | 'run' | 'report';
  jobs?: number;
  only?: readonly string[];
  dir: string;
  /** 86e2 (decision A, user-signed): downgrade exactly the missing-manifest
   *  FAIL to WARN — for reading pre-86e1 archives only. Corrupt manifests,
   *  dirty trees, and head splits still FAIL under it. */
  allowUnmanifested: boolean;
}

function parseBoardArgs(argv: readonly string[]): BoardArgs {
  const args: BoardArgs = { mode: 'report', dir: DEFAULT_DIR, allowUnmanifested: false };
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
      case '--allow-unmanifested':
        args.allowUnmanifested = true;
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

/** 86e2 — gather the raw per-dir facts the pure verdict layer judges (and
 *  hand back the matched rows so metrics don't re-parse). */
function auditInstrumentDir(
  dir: string,
  strategyRow: string,
): { audit: InstrumentAudit; matched: ReturnType<typeof parseSummaryCsv> } {
  const csvPath = join(dir, 'summary.csv');
  if (!existsSync(csvPath)) {
    return {
      audit: { dir, summaryFound: false, totalRows: 0, matchedRows: 0, seeds: [], manifest: null },
      matched: [],
    };
  }
  let manifest: BatchManifest | null = null;
  let manifestError: string | undefined;
  try {
    manifest = readBatchManifest(dir);
  } catch (e) {
    manifestError = e instanceof Error ? e.message : String(e);
  }
  try {
    const all = parseSummaryCsv(readFileSync(csvPath, 'utf8'));
    const matched = all.filter((r) => r.strategy === strategyRow);
    return {
      audit: {
        dir,
        summaryFound: true,
        totalRows: all.length,
        matchedRows: matched.length,
        seeds: matched.map((r) => r.seed),
        manifest,
        ...(manifestError !== undefined ? { manifestError } : {}),
      },
      matched,
    };
  } catch (e) {
    return {
      audit: {
        dir,
        summaryFound: true,
        parseError: e instanceof Error ? e.message : String(e),
        totalRows: 0,
        matchedRows: 0,
        seeds: [],
        manifest,
        ...(manifestError !== undefined ? { manifestError } : {}),
      },
      matched: [],
    };
  }
}

function report(
  fullBoard: Board,
  dir: string,
  allowUnmanifested: boolean,
  only?: readonly string[],
): { text: string; fails: number } {
  // 86e3 — an explicit --only scopes the verdict + drift to the selection
  // (loud PARTIAL banner below): fail-closed targets SILENT partiality; a
  // named partial read is a legitimate smoke, never a signing board.
  const partial = only !== undefined && only.length > 0;
  const board: Board = partial
    ? (() => {
        const ids = new Set(only);
        return {
          ...fullBoard,
          instruments: fullBoard.instruments.filter((i) => ids.has(i.id)),
          deltas: fullBoard.deltas.filter((d) => ids.has(d.a) && ids.has(d.b)),
        };
      })()
    : fullBoard;
  const metrics = new Map<string, InstrumentMetrics>();
  const audits = new Map<string, InstrumentAudit>();
  for (const inst of board.instruments) {
    const { audit, matched } = auditInstrumentDir(join(dir, inst.id), inst.strategyRow);
    audits.set(inst.id, audit);
    if (!audit.summaryFound || audit.parseError !== undefined) continue;
    metrics.set(inst.id, computeMetrics(matched));
  }
  // 86e2 — the three-way split: VERDICT (fail-closed integrity, gates the
  // exit) → DRIFT (the reference bands) → INSTRUMENT HEALTH (never gates).
  const verdict = evaluateVerdict(board, audits, metrics, {
    allowUnmanifested,
    currentHead: captureGitProvenance().head,
  });
  const evaluated = evaluateBoard(board, metrics);
  let text =
    `BALANCE BOARD — vs the signed sheet (${board.sheet.signedAt})\n\n` +
    (partial
      ? `⚠ PARTIAL BOARD (--only=${[...(only ?? [])].join(',')}) — a scoped smoke read, NEVER a signing board\n\n`
      : '') +
    renderVerdictReport(verdict) +
    '\n' +
    renderReport(evaluated, board) +
    '\n## INSTRUMENT HEALTH — self-checks (never gate the exit code)\n\n' +
    // 86e3 — the skill gradient (random < greedy < ARM on the act-1 shape).
    renderSkillGradient(evaluateSkillGradient(metrics));
  // 71b — the per-item decision-grade sections: any instrument dir carrying a
  // decisions.csv (an arbitrated arm ran there) gets its read appended to the
  // report.
  // 84f2 — the inert-class tripwire rides every decisions.csv the report
  // touches; a class at Live 0 is a board-level WARN (instrument health,
  // not a balance verdict — it never gates the exit code).
  let inertTotal = 0;
  let healthSections = 0;
  for (const inst of board.instruments) {
    const decisionsPath = join(dir, inst.id, 'decisions.csv');
    if (!existsSync(decisionsPath)) continue;
    const rows = parseDecisionsCsv(readFileSync(decisionsPath, 'utf8'));
    text +=
      `\n### ${inst.id} — per-item decision value\n\n` +
      renderDecisionAnalysis(rows) +
      '\n' +
      renderInertClassTripwire(rows);
    inertTotal += inertClasses(rows).length;
    healthSections++;
  }
  if (inertTotal > 0) {
    text += `\n⚠ inert-class tripwire: ${inertTotal} WARN (a candidate class no rollout can see — 84f2; see the per-instrument sections)\n`;
  }
  if (healthSections === 0) {
    text += '\n(no decisions.csv in any instrument dir — nothing to health-check yet)\n';
  }
  // Fail-closed: the verdict's integrity FAILs gate the exit alongside any
  // signed-band breach (the drift table's FAILs — none exist today by the
  // 68d design, but the semantics stay wired).
  return { text, fails: verdict.fails + evaluated.fails };
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
  const { text, fails } = report(board, args.dir, args.allowUnmanifested, args.only);
  process.stdout.write('\n' + text);
  const reportPath = join(args.dir, 'board-report.txt');
  mkdirSync(args.dir, { recursive: true });
  writeFileSync(reportPath, text);
  process.stdout.write(`(written to ${reportPath})\n`);
  if (fails > 0) process.exitCode = 1;
}

main();
