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
import { parseDaemonFlag, type DaemonSelection } from '../daemonSelection';
import { parseScriptsSpec } from '../scriptSubset';
import { AUDITION_SCRIPTS, type TrafficScript } from '../../../src/bot/TrafficScriptDriver';
import type { RolloutSearchConfig } from '../../../src/bot/RolloutSearchDriver';
import { FORCE_PROCEDURAL } from '../../../src/run/RunConfig';
import { LAYOUT_IDS } from '../../../src/sim/layouts';
import { ENCOUNTER_IDS } from '../../../src/config/encounters';

export interface CliArgs {
  count: number;
  seed?: number;
  strategy?: string;
  outDir: string;
  perHop: boolean;
  // Per-layout difficulty breakdown (`--per-layout`) + force one layout across
  // every battle (`--layout=<id>`) for a clean full-sample isolate.
  perLayout: boolean;
  layout?: string;
  // X2 — per-encounter pool-damage breakdown (`--per-encounter`); implies
  // telemetry-on so the pool-damage metric is populated.
  perEncounter: boolean;
  // X2 — force ONE authored encounter across every matching-kind node
  // (`--encounter=<id>`) for a clean per-encounter isolation sample.
  encounter?: string;
  // H7b — random-search mode (`--search`).
  search: boolean;
  preset?: string;
  vectors?: number;
  seeds?: number;
  samplerSeed?: number;
  // X2 — shift the eval-seed base past the tuned range (the config-overfit
  // holdout for the X3 verify; H7d prereq). Applies to run / search / sweep.
  seedOffset?: number;
  // H7c — balance-sweep mode (`--balance-sweep`).
  balanceSweep: boolean;
  knob?: string;
  range?: string;
  knob2?: string;
  range2?: string;
  tier?: string;
  hops?: number;
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
  // L1c3 — the daemon arm driven through the run / search / sweep modes
  // (`--daemon=<random|none|id>`; default random = the Run's own roll, the
  // real game's behavior — byte-identical to the flag being absent).
  daemon?: string;
  // §55 pre-gate — drive the §54 traffic-script bot (`trafficScripts: true`,
  // the standard registry) in every battle. RUN MODE ONLY for now (the
  // fixed-vector probe); --search/--sweep/--arena bail loudly rather than
  // silently measuring the old bot. Mutually exclusive with --objective.
  scripts: boolean;
  // 57a — the optional `--scripts=<spec>` subset (leave-one-out / only-arm
  // registries; grammar + loud-bail validation in scriptSubset.ts). Absent =
  // the full standard registry, exactly the bare `--scripts` behavior.
  scriptsSpec?: string;
  // §57f — the portfolio rollout searcher arm (`--searcher[=<spec>]`; the
  // spec selects a nominator subset, same grammar as --scripts). RUN +
  // SEARCH modes (59e — sweep/arena still bail); mutually exclusive with
  // --objective AND --scripts (one bot arm at a time — the frozen-anchor
  // contract).
  searcher: boolean;
  searcherSpec?: string;
  // 57g.4 — the audition-everyone arm: `--audition` swaps the searcher's
  // nominator registry to AUDITION_SCRIPTS (propose-regardless nominate on
  // every script). Requires --searcher; composes with --searcher=<spec>.
  audition: boolean;
  // 57g.5 — searcher dial + instrument: `--k=<n>` overrides
  // rolloutsPerCandidate; `--k-telemetry` turns on the prefix-flip
  // instrument (run it at --k=8). Both require --searcher.
  k?: number;
  kTelemetry: boolean;
  // 59d — the top-K perturb-and-reselect refinement stage: `--refine`
  // enables it after the base `--search` (defaults K=3 · 8 perturbs ·
  // ±0.15 box-scale, the kickoff lock); the three dial flags override.
  refine: boolean;
  refineK?: number;
  refinePerturbs?: number;
  refineRadius?: number;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    count: 20,
    outDir: defaultOutDir(),
    perHop: false,
    perLayout: false,
    perEncounter: false,
    search: false,
    balanceSweep: false,
    dryRun: false,
    evalShard: false,
    arena: false,
    scripts: false,
    searcher: false,
    audition: false,
    kTelemetry: false,
    refine: false,
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
        if (v !== undefined) args.strategy = v;
        break;
      case '--out':
        args.outDir = v ?? args.outDir;
        break;
      case '--per-hop':
        args.perHop = true;
        break;
      case '--per-layout':
        args.perLayout = true;
        break;
      case '--per-encounter':
        args.perEncounter = true;
        break;
      case '--layout':
        if (v !== undefined) args.layout = v;
        break;
      case '--encounter':
        if (v !== undefined) args.encounter = v;
        break;
      case '--search':
        args.search = true;
        break;
      case '--preset':
        if (v !== undefined) args.preset = v;
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
      case '--seed-offset':
        args.seedOffset = Number(v);
        break;
      case '--balance-sweep':
        args.balanceSweep = true;
        break;
      case '--knob':
        if (v !== undefined) args.knob = v;
        break;
      case '--range':
        if (v !== undefined) args.range = v;
        break;
      case '--knob2':
        if (v !== undefined) args.knob2 = v;
        break;
      case '--range2':
        if (v !== undefined) args.range2 = v;
        break;
      case '--tier':
        if (v !== undefined) args.tier = v;
        break;
      case '--hops':
        args.hops = Number(v);
        break;
      case '--roster':
        if (v !== undefined) args.roster = v;
        break;
      case '--jobs':
        args.jobs = Number(v);
        break;
      case '--eval-shard':
        args.evalShard = true;
        break;
      case '--job':
        if (v !== undefined) args.job = v;
        break;
      case '--out-file':
        if (v !== undefined) args.outFile = v;
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
        if (v !== undefined) args.objective = v;
        break;
      case '--redraw':
        if (v !== undefined) args.redraw = v;
        break;
      case '--empower':
        if (v !== undefined) args.empower = v;
        break;
      case '--daemon':
        if (v !== undefined) args.daemon = v;
        break;
      case '--scripts':
        args.scripts = true;
        if (v !== undefined) args.scriptsSpec = v;
        break;
      case '--searcher':
        args.searcher = true;
        if (v !== undefined) args.searcherSpec = v;
        break;
      case '--audition':
        args.audition = true;
        break;
      case '--refine':
        args.refine = true;
        break;
      case '--refine-k':
        args.refineK = Number(v);
        break;
      case '--refine-perturbs':
        args.refinePerturbs = Number(v);
        break;
      case '--refine-radius':
        args.refineRadius = Number(v);
        break;
      case '--k': {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1)
          throw new Error(`--k needs a positive integer (got '${v}')`);
        args.k = n;
        break;
      }
      case '--k-telemetry':
        args.kTelemetry = true;
        break;
      default:
        if (raw.startsWith('--')) {
          throw new Error(`Unknown flag: ${raw}`);
        }
    }
  }
  // §55 pre-gate — --scripts is run-mode-only until a mode needs it: a search
  // or sweep silently ignoring it would measure the OLD bot under a flag that
  // claims otherwise. Support lands mode-by-mode, deliberately.
  if (args.scripts && (args.search || args.balanceSweep || args.arena || args.evalShard)) {
    throw new Error(
      '--scripts is not supported in --search/--balance-sweep/--arena yet (run mode only)',
    );
  }
  if (args.scripts && args.objective !== undefined) {
    throw new Error(
      '--scripts is mutually exclusive with --objective (the frozen-anchor contract)',
    );
  }
  // §57f — same contracts for the searcher arm. 59e — `--search` now
  // SUPPORTS it (the audition-searcher regen path); sweep/arena still bail,
  // and the internal --eval-shard worker takes it via the job file, never
  // the CLI.
  if (args.searcher && (args.balanceSweep || args.arena || args.evalShard)) {
    throw new Error(
      '--searcher is not supported in --balance-sweep/--arena (run + search modes only)',
    );
  }
  // 59e — the K-flip prefix instrument stays a serial RUN-mode read.
  if (args.kTelemetry && args.search) {
    throw new Error('--k-telemetry is a run-mode instrument (not supported with --search)');
  }
  if (args.searcher && args.objective !== undefined) {
    throw new Error(
      '--searcher is mutually exclusive with --objective (the frozen-anchor contract)',
    );
  }
  if (args.searcher && args.scripts) {
    throw new Error('--searcher is mutually exclusive with --scripts (one bot arm at a time)');
  }
  // 57g.4 — audition is a searcher registry swap, meaningless without one.
  if (args.audition && !args.searcher) {
    throw new Error('--audition requires --searcher (it swaps the nominator registry)');
  }
  // 57g.5 — the K dial and the prefix instrument are searcher-only too.
  if ((args.k !== undefined || args.kTelemetry) && !args.searcher) {
    throw new Error('--k / --k-telemetry require --searcher');
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

/** O5 — the reserved `--objective` value that selects the dev-only objective
 *  COVERAGE driver instead of a measurement proclivity. */
export const COVERAGE_OBJECTIVE = 'coverage';

/** J4 — resolve the `--objective` flag into a proclivity, or `undefined` when
 *  absent OR when it selects the O5 coverage driver (`--objective=coverage`,
 *  which `coverageFromArgs` handles separately — the two are mutually
 *  exclusive). The harness treats undefined as `none` → byte-identical
 *  baselines. Shared by the standard run, `--search`, and `--balance-sweep`. */
export function objectiveFromArgs(
  args: Pick<CliArgs, 'objective'>,
): ObjectiveProclivity | undefined {
  if (args.objective === undefined || args.objective === COVERAGE_OBJECTIVE) return undefined;
  return parseObjectiveFlag(args.objective);
}

/** O5 — is the dev-only objective coverage driver selected (`--objective=coverage`)?
 *  Routed separately from the proclivity since it's a both-team stateful churn
 *  bot, not a target-selection policy. Debug-only — consumed by the plain run +
 *  `--arena` modes, never by the balance sweep / search. */
export function coverageFromArgs(args: Pick<CliArgs, 'objective'>): boolean {
  return args.objective === COVERAGE_OBJECTIVE;
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

/** L1c3 — resolve the `--daemon` flag into a selection, or `undefined` when
 *  absent (the harness leaves the Run's own roll — byte-identical to
 *  `random`). Bails loudly on an unknown idol id. */
export function daemonFromArgs(args: Pick<CliArgs, 'daemon'>): DaemonSelection | undefined {
  return args.daemon !== undefined ? parseDaemonFlag(args.daemon) : undefined;
}

/** M6/N2 — resolve + VALIDATE the `--layout` flag into a `forcedLayoutId` (a
 *  known `LAYOUT_IDS` member or the `FORCE_PROCEDURAL` sentinel), or `undefined`
 *  when absent. **Bails loudly on an unknown id** — unlike `parseRunConfig`'s
 *  silent drop — so a typo fails the run instead of silently sweeping the
 *  default layout mix. Shared by the run / `--search` / `--balance-sweep` modes
 *  so the N2 procedural isolate (`--layout=procedural`) reaches every one. */
export function layoutFromArgs(args: Pick<CliArgs, 'layout'>): string | undefined {
  if (args.layout === undefined) return undefined;
  if (args.layout !== FORCE_PROCEDURAL && !LAYOUT_IDS.includes(args.layout)) {
    bail(`Unknown layout: ${args.layout} (choices: ${LAYOUT_IDS.join(', ')}, ${FORCE_PROCEDURAL})`);
  }
  return args.layout;
}

/** X2 — resolve + VALIDATE the `--encounter` flag into a `forcedEncounterId` (a
 *  known `ENCOUNTER_IDS` member), or `undefined` when absent. **Bails loudly on an
 *  unknown id** (like `layoutFromArgs`) so a typo fails the run rather than
 *  silently sampling the default encounter mix. Shared by the run / `--search` /
 *  `--balance-sweep` modes so the isolation sweep reaches every one. */
export function encounterFromArgs(args: Pick<CliArgs, 'encounter'>): string | undefined {
  if (args.encounter === undefined) return undefined;
  if (!ENCOUNTER_IDS.includes(args.encounter)) {
    bail(`Unknown encounter: ${args.encounter} (choices: ${ENCOUNTER_IDS.join(', ')})`);
  }
  return args.encounter;
}

/** 59e — resolve the searcher flags into the `rolloutSearch` harness arm:
 *  the ONE resolver shared by run mode, the `--search` serial path, and the
 *  `--eval-shard` children (which receive the FLAGS via the job file — the
 *  arm value itself isn't JSON-safe — and re-resolve here), so every mode
 *  drives the identical registry by construction. Extracted verbatim from
 *  run.ts's §57f/57g.4/57g.5 block: `--audition` swaps the resolution base
 *  to AUDITION_SCRIPTS; a spec selects a subset; dial overrides force the
 *  full-config form (otherwise the minimal boolean/array forms keep
 *  existing arms byte-shaped). */
export function searcherFromArgs(
  args: Pick<CliArgs, 'searcher' | 'searcherSpec' | 'audition' | 'k' | 'kTelemetry'>,
): true | readonly TrafficScript[] | RolloutSearchConfig | undefined {
  if (!args.searcher) return undefined;
  const registry = args.audition ? AUDITION_SCRIPTS : undefined;
  const scripts =
    args.searcherSpec !== undefined ? parseScriptsSpec(args.searcherSpec, registry) : registry;
  if (args.k !== undefined || args.kTelemetry) {
    return {
      ...(scripts !== undefined ? { scripts } : {}),
      ...(args.k !== undefined ? { rolloutsPerCandidate: args.k } : {}),
      ...(args.kTelemetry ? { kFlipTelemetry: true } : {}),
    };
  }
  return scripts ?? true;
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
