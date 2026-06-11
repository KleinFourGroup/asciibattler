/**
 * The fuzz CLI's argument grammar + the tiny helpers every command shares.
 *
 * ONE flat `CliArgs` is parsed up front (cli.ts) regardless of mode — the
 * grammar predates the commands/ split and is documented all over BALANCE.md /
 * HANDOFF.md, so it stays put: flags are global, unknown flags throw, and a
 * flag that a mode doesn't read is silently ignored (e.g. `--seeds` on a plain
 * run), exactly as before the split. Each command declares the slice it
 * actually consumes via a `Pick<CliArgs, …>` alias, so "which flags work
 * where" is explicit in the type rather than buried in a 750-line file.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObjectiveFlag, type ObjectiveProclivity } from '../objectiveStrategy';
import { parseRedrawFlag, type RedrawPolicy } from '../redrawPolicy';
import { parseEmpowerFlag, type EmpowerPolicy } from '../empowerPolicy';

export interface CliArgs {
  count: number;
  seed?: number;
  strategy?: string;
  outDir: string;
  perFloor: boolean;
  // Per-layout difficulty breakdown (`--per-layout`) + force one layout across
  // every battle (`--layout=<id>`) for a clean full-sample isolate.
  perLayout: boolean;
  layout?: string;
  // H7b — random-search mode (`--search`).
  search: boolean;
  preset?: string;
  vectors?: number;
  seeds?: number;
  samplerSeed?: number;
  // H7c — balance-sweep mode (`--balance-sweep`).
  balanceSweep: boolean;
  knob?: string;
  range?: string;
  knob2?: string;
  range2?: string;
  tier?: string;
  floors?: number;
  roster?: string;
  dryRun: boolean;
  // H7c parallelism — fan the per-point vector search across N child processes.
  jobs?: number;
  // H7c parallelism — internal `--eval-shard` worker mode (a child of a `--jobs`
  // sweep): evaluate the vectors in `--job=<file>`, write win rates to `--out-file`.
  evalShard: boolean;
  job?: string;
  outFile?: string;
  // H7c — re-render an existing balance-sweep CSV as a readable report.
  report?: string;
  // J4 — arena mode (`--arena`): a single forced World battle (no Run wrapper)
  // for tuning objective strategies. `--objective` names ONE proclivity to
  // inspect; absent, the arena enumerates the menu and writes best-objective.json.
  arena: boolean;
  objective?: string;
  // K3c3 — the redraw policy driven through the run / search / sweep modes
  // (`--redraw=<none|random:k|level:k|file.json>`; default none = gates off,
  // byte-identical baselines).
  redraw?: string;
  // K4c3 — the empower policy, same modes + contract
  // (`--empower=<none|random|level:hi|level:lo|file.json>`; default none).
  empower?: string;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    count: 20,
    outDir: defaultOutDir(),
    perFloor: false,
    perLayout: false,
    search: false,
    balanceSweep: false,
    dryRun: false,
    evalShard: false,
    arena: false,
  };
  for (const raw of argv) {
    const [k, v] = splitFlag(raw);
    switch (k) {
      case '--count':
        args.count = Number(v);
        break;
      case '--seed':
        args.seed = Number(v);
        break;
      case '--strategy':
        args.strategy = v;
        break;
      case '--out':
        args.outDir = v ?? args.outDir;
        break;
      case '--per-floor':
        args.perFloor = true;
        break;
      case '--per-layout':
        args.perLayout = true;
        break;
      case '--layout':
        args.layout = v;
        break;
      case '--search':
        args.search = true;
        break;
      case '--preset':
        args.preset = v;
        break;
      case '--vectors':
        args.vectors = Number(v);
        break;
      case '--seeds':
        args.seeds = Number(v);
        break;
      case '--sampler-seed':
        args.samplerSeed = Number(v);
        break;
      case '--balance-sweep':
        args.balanceSweep = true;
        break;
      case '--knob':
        args.knob = v;
        break;
      case '--range':
        args.range = v;
        break;
      case '--knob2':
        args.knob2 = v;
        break;
      case '--range2':
        args.range2 = v;
        break;
      case '--tier':
        args.tier = v;
        break;
      case '--floors':
        args.floors = Number(v);
        break;
      case '--roster':
        args.roster = v;
        break;
      case '--jobs':
        args.jobs = Number(v);
        break;
      case '--eval-shard':
        args.evalShard = true;
        break;
      case '--job':
        args.job = v;
        break;
      case '--out-file':
        args.outFile = v;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--report':
        // Empty = default to the sweep's own output dir (resolved in runReportCli).
        args.report = v ?? '';
        break;
      case '--arena':
        args.arena = true;
        break;
      case '--objective':
        args.objective = v;
        break;
      case '--redraw':
        args.redraw = v;
        break;
      case '--empower':
        args.empower = v;
        break;
      default:
        if (raw.startsWith('--')) {
          throw new Error(`Unknown flag: ${raw}`);
        }
    }
  }
  return args;
}

function splitFlag(arg: string): [string, string | undefined] {
  const eq = arg.indexOf('=');
  if (eq < 0) return [arg, undefined];
  return [arg.slice(0, eq), arg.slice(eq + 1)];
}

function defaultOutDir(): string {
  // ESM-friendly resolution: this file is at tests/fuzz/commands/args.ts, the
  // output dir sits beside the entry as tests/fuzz/output/.
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', 'output');
}

/** J4 — resolve the `--objective` flag into a proclivity, or `undefined` when
 *  absent (the harness treats undefined as `none` → byte-identical baselines).
 *  Shared by the standard run, `--search`, and `--balance-sweep`. */
export function objectiveFromArgs(args: Pick<CliArgs, 'objective'>): ObjectiveProclivity | undefined {
  return args.objective !== undefined ? parseObjectiveFlag(args.objective) : undefined;
}

/** K3c3 — resolve the `--redraw` flag into a policy, or `undefined` when absent
 *  (the harness treats undefined as `none` → gates off, byte-identical).
 *  Shared by the standard run, `--search`, and `--balance-sweep`. */
export function redrawFromArgs(args: Pick<CliArgs, 'redraw'>): RedrawPolicy | undefined {
  return args.redraw !== undefined ? parseRedrawFlag(args.redraw) : undefined;
}

/** K4c3 — resolve the `--empower` flag into a policy, or `undefined` when
 *  absent (same contract as `redrawFromArgs`). */
export function empowerFromArgs(args: Pick<CliArgs, 'empower'>): EmpowerPolicy | undefined {
  return args.empower !== undefined ? parseEmpowerFlag(args.empower) : undefined;
}

export function range(start: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(start + i);
  return out;
}

/** Human-readable ms → "1.2s" / "3.4m". */
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function bail(message: string): never {
  process.stderr.write(message + '\n');
  process.exit(1);
}
