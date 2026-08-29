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
import {
  parseCharacterFlag,
  DEFAULT_CHARACTER_SELECTION,
  type CharacterSelection,
} from '../characterSelection';
import { parseScriptsSpec } from '../scriptSubset';
import { AUDITION_SCRIPTS, type TrafficScript } from '../../../src/bot/TrafficScriptDriver';
import type { RolloutSearchConfig } from '../../../src/bot/RolloutSearchDriver';
import type { FuzzStrategy } from '../Strategy';
import type { InnerTier } from '../rollout/walker';
import { makeArbitratedStrategy, type ArbitratedConfig } from '../rollout/arbitratedStrategy';
import { loadPriorTable, priorFoldValues, priorFoldValuesBySite } from '../prior/priorTable';
import { FORCE_PROCEDURAL } from '../../../src/run/RunConfig';
import { LAYOUT_IDS } from '../../../src/sim/layouts';
import { ENCOUNTER_IDS } from '../../../src/config/encounters';
import { daemonById } from '../../../src/config/daemons';
import { packetById } from '../../../src/config/packets';
import { ALL_ARCHETYPES } from '../../../src/sim/archetypes';

export interface CliArgs {
  count: number;
  seed?: number;
  strategy?: string;
  outDir: string;
  // 86e1 — the verbatim argv this parse consumed, recorded into each batch
  // dir's manifest.json (provenance for the fail-closed board). Optional so
  // tests can build synthetic arg objects; absent = an empty argv recorded.
  raw?: readonly string[];
  // 86d2 — true iff `--out` was passed explicitly. The stage-merge mode
  // refuses to run without it (writing a merged artifact set into the
  // rolling default dir invites clobbering a live batch).
  outDirExplicit: boolean;
  // 86d2 — staged-n merge mode (`--merge-stages=<dirA>,<dirB>[,…]`): merge
  // completed same-arm run-mode output dirs with adjacent seed windows (the
  // n=120 protocol's 40+80 extension) into the byte-identical artifact set
  // one serial run over the union window writes. Guards: identical headers,
  // identical strategy sets, same-arm args (when stages carry `args` files),
  // disjoint + contiguous seed windows. See commands/mergeStages.ts.
  mergeStages?: string;
  perHop: boolean;
  // 68e — internal shard-protocol flag (`--emit-results`): run mode also dumps
  // its full RunResult[] to results.json. Injected by the --jobs parent so it
  // can recompute the aggregate analyses over the merged results — never set
  // by hand (the file is big and nothing else reads it).
  emitResults: boolean;
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
  // 68e — stamp the first sector's root node kind (`--first-node=elite`): the
  // full-pool elite isolation shape (pairs with --hops=2 --encounter=<elite>).
  firstNode?: string;
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
  sectorHops?: number;
  // 68b — the kind-agnostic grant list (comma-separated daemon/packet/unit
  // ids), run mode only: the paired marginal-value instrument's WITH arm.
  grant?: string;
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
  // (`--daemon=<random|none|id>`). 63d relabel: `random`/absent = no
  // override → the CHARACTER's daemon (the run-start roll retired at 63c);
  // still byte-identical to the flag being absent.
  daemon?: string;
  // 63d — the character arm (`--character=<id>`), all three modes. Absent =
  // the EXPLICIT Soldier default (the harness names its arm rather than
  // leaning on Run's internal fallback — the §63 exit-criterion lock).
  character?: string;
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
  // 60c — scale per-run bits income (`--bits-multiplier=<f>`): exposes the
  // 48f RunConfig lever to RUN MODE ONLY (the economy lever sweeps at the
  // fixed operating point). Run mode's runConfig wiring consumes it; other
  // modes ignore it per the flags-are-global grammar note above.
  bitsMultiplier?: number;
  // 65d — the forced-draw dial (`--draw-add=<n>`): exposes the RunConfig
  // `drawAmountAdd` lever to RUN MODE ONLY (the max-hand A/B — a persistent
  // fold arm, so the deal AND the Option-B budget basis both move). Run
  // mode's runConfig wiring consumes it; other modes ignore it per the
  // flags-are-global grammar note above.
  drawAdd?: number;
  // 72e — the node-scatter probe dials (`--elite-chance=<0..1>` /
  // `--port-chance=<0..1>`): expose the RunConfig eliteChance/portChance
  // overrides to RUN MODE ONLY (the forced-shape decision-grade reads —
  // elite-chance=1 offers an elite every eligible hop; port-chance=1 a
  // dock every eligible hop). Other modes ignore them per the
  // flags-are-global grammar note above. 74e adds `--event-chance`
  // (event-chance=0 is the event-free control arm).
  eliteChance?: number;
  portChance?: number;
  eventChance?: number;
  // 75l — the generic numeric config override for probe arms
  // (`--set=group.key=value`, repeatable). Applied at run-mode entry through
  // the sweep's knob registry (resolveKnob — loud on typos), so it addresses
  // exactly the groups the registry exposes. First consumer:
  // `--set=sim.enemyPullChance=0`, the camps pull-ablation arm.
  set?: string[];
  // 59d — the top-K perturb-and-reselect refinement stage: `--refine`
  // enables it after the base `--search` (defaults K=3 · 8 perturbs ·
  // ±0.15 box-scale, the kickoff lock); the three dial flags override.
  refine: boolean;
  refineK?: number;
  refinePerturbs?: number;
  refineRadius?: number;
  // 70a — the run-layer arbitrated arm (`--arbitrate`): wraps the selected
  // strategy in makeArbitratedStrategy PER SEED (the arm is stateful —
  // driver RNG + decision log). RUN MODE ONLY (the --scripts discipline:
  // other modes bail loudly rather than silently measure the wrong arm).
  // `--arbitrate-tier=<bare|traffic|searcher>` is resolution 3's recursion
  // dial (default traffic); requires --arbitrate.
  arbitrate: boolean;
  arbitrateTier?: string;
  // 71c — the flip-rate instrument (`--flip-telemetry[=<tier>]`): shadow-
  // judge every arbitrated decision under a second inner tier with the same
  // CRN pairs and count disagreements (tier-flips.csv + a stdout aggregate).
  // Bare flag = 'searcher' (the resolution-3 cheap-vs-recursive read); the
  // value form exists for cheap cross-tier reads and test sizing. Requires
  // --arbitrate; must differ from the primary tier.
  flipTelemetry?: string;
  // 71d — the grant-site ε override (`--grant-epsilon=<f>`): the ablation
  // dial for the free-action gate diagnosis (grant margins sit under the
  // pooled noise floor; ε=0 = spend on any positive point estimate, exact
  // ties still pass — the strict-> rule holds). Requires --arbitrate.
  grantEpsilon?: number;
  // 85c — λ_prior (`--prior-lambda=<f>`): the fold's board arm ({0, 0.5,
  // 1} at the §85 cohort; any finite ≥ 0 accepted — a dial, not a doctrine
  // constant). 0 = the fold path never engages (byte-identical, the board
  // control). Requires --arbitrate; the committed prior table loads at
  // launch when ≠ 0 (missing table = loud throw).
  priorLambda?: number;
  // 85g6a — the campRaid causal-arm dial (`--camp-raid=off|on`, default on):
  // off OMITS the site from the arbitrated strategy (ABSENT = never raid,
  // the pre-85d Strategy.ts contract), so an enabled-vs-disabled pair reads
  // the site's causal value under paired luck. Requires --arbitrate; a
  // run-mode ablation dial (refused with --search).
  campRaid?: string;
  // 84c — the §84 long-horizon shadow instrument (`--shadow-horizon[=run|N]`,
  // bare = 'run'): every sampled arbitrated decision's candidates ALSO walked
  // to the horizon as a separate decisions.csv record, plus the shadow-only
  // recruit site. `--shadow-sample=<m>` = 1-in-m decisions (default every).
  // Requires --arbitrate; REFUSED with --hops / --sector-hops (the 84b
  // finding: a clone drops both run-shape dials, so a run-end walk is
  // unbounded whatever the batch dial — the instrument is a full-walk shape).
  shadowHorizon?: string;
  shadowSample?: number;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    count: 20,
    raw: [...argv],
    outDir: defaultOutDir(),
    outDirExplicit: false,
    perHop: false,
    emitResults: false,
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
    arbitrate: false,
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
        if (v !== undefined) args.outDirExplicit = true;
        break;
      case '--merge-stages':
        if (v !== undefined) args.mergeStages = v;
        break;
      case '--per-hop':
        args.perHop = true;
        break;
      case '--emit-results':
        args.emitResults = true;
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
      case '--first-node':
        if (v !== undefined) args.firstNode = v;
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
      case '--sector-hops':
        // 67c — the shortened FULL-WALK dial (every sector's map = N hops,
        // the DAG still sinks); --hops stays the single-sector probe.
        args.sectorHops = Number(v);
        break;
      case '--grant':
        if (v !== undefined) args.grant = v;
        break;
      case '--roster':
        if (v !== undefined) args.roster = v;
        break;
      case '--bits-multiplier':
        if (v !== undefined) args.bitsMultiplier = Number(v);
        break;
      case '--draw-add':
        if (v !== undefined) args.drawAdd = Number(v);
        break;
      case '--elite-chance':
        if (v !== undefined) args.eliteChance = Number(v);
        break;
      case '--port-chance':
        if (v !== undefined) args.portChance = Number(v);
        break;
      case '--event-chance':
        if (v !== undefined) args.eventChance = Number(v);
        break;
      case '--set':
        if (v !== undefined) (args.set ??= []).push(v);
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
      case '--character':
        if (v !== undefined) args.character = v;
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
      case '--arbitrate':
        args.arbitrate = true;
        break;
      case '--flip-telemetry':
        args.flipTelemetry = v ?? 'searcher';
        break;
      case '--grant-epsilon':
        if (v !== undefined) args.grantEpsilon = Number(v);
        break;
      case '--prior-lambda':
        if (v !== undefined) args.priorLambda = Number(v);
        break;
      case '--camp-raid':
        if (v !== undefined) args.campRaid = v;
        break;
      case '--arbitrate-tier':
        if (v !== undefined) args.arbitrateTier = v;
        break;
      case '--shadow-horizon':
        args.shadowHorizon = v ?? 'run';
        break;
      case '--shadow-sample':
        if (v !== undefined) args.shadowSample = Number(v);
        break;
      default:
        if (raw.startsWith('--')) {
          throw new Error(`Unknown flag: ${raw}`);
        }
    }
  }
  // 68b — the two run-shape dials contradict (single-sector probe vs
  // shortened full walk); bail at the flag level rather than letting the
  // first Run construction throw mid-batch.
  if (args.hops !== undefined && args.sectorHops !== undefined) {
    throw new Error('--hops (single-sector probe) and --sector-hops (full walk) are mutually exclusive');
  }
  // 68b — --grant is run-mode-only (the --scripts discipline below: silent
  // ignoring would label a batch as a WITH arm while measuring the control).
  if (args.grant !== undefined && (args.search || args.balanceSweep || args.arena)) {
    throw new Error('--grant is not supported in --search/--balance-sweep/--arena (run mode only)');
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
  // 70a (relaxed at 85g3, the 59e mode-by-mode discipline) — `--search`
  // now SUPPORTS the arbitrated arm (the wrapStrategy seam; the eval-shard
  // children re-resolve via arbitratedWrapFromArgs, never the CLI);
  // sweep/arena still bail — support lands mode-by-mode, deliberately.
  if (args.arbitrate && (args.balanceSweep || args.arena || args.evalShard)) {
    throw new Error(
      '--arbitrate is not supported in --balance-sweep/--arena yet (run + search modes only)',
    );
  }
  // 85g3 — the run-mode INSTRUMENTS never ride a search: a search silently
  // ignoring them would label the batch wrong (the same 70a discipline),
  // and none of them belong in a training loop (--flip-telemetry /
  // --shadow-horizon are telemetry, --grant-epsilon is an ablation dial).
  if (args.search && args.flipTelemetry !== undefined) {
    throw new Error('--flip-telemetry is a run-mode instrument (not supported with --search)');
  }
  if (args.search && args.shadowHorizon !== undefined) {
    throw new Error('--shadow-horizon is a run-mode instrument (not supported with --search)');
  }
  if (args.search && args.grantEpsilon !== undefined) {
    throw new Error('--grant-epsilon is a run-mode ablation dial (not supported with --search)');
  }
  if (args.search && args.campRaid !== undefined) {
    throw new Error('--camp-raid is a run-mode ablation dial (not supported with --search)');
  }
  if (args.arbitrateTier !== undefined) {
    if (!args.arbitrate) {
      throw new Error('--arbitrate-tier requires --arbitrate (it dials the rollout inner tier)');
    }
    if (!['bare', 'traffic', 'searcher'].includes(args.arbitrateTier)) {
      throw new Error(
        `--arbitrate-tier must be bare|traffic|searcher (got '${args.arbitrateTier}')`,
      );
    }
  }
  // 71c — the flip-rate instrument's guards: arbitrate-only, a real tier,
  // and a shadow that actually differs from the primary (an equal pair
  // would measure zero flips by construction and label the batch wrong).
  if (args.flipTelemetry !== undefined) {
    if (!args.arbitrate) {
      throw new Error('--flip-telemetry requires --arbitrate (it shadows the arbitrated arm)');
    }
    if (!['bare', 'traffic', 'searcher'].includes(args.flipTelemetry)) {
      throw new Error(
        `--flip-telemetry must be bare|traffic|searcher (got '${args.flipTelemetry}')`,
      );
    }
    const primary = args.arbitrateTier ?? 'traffic';
    if (args.flipTelemetry === primary) {
      throw new Error(
        `--flip-telemetry=${args.flipTelemetry} equals the primary tier (${primary}) — the read would be vacuously flip-free`,
      );
    }
  }
  // 71d — the grant-ε dial rides the arbitrated arm only, and a negative or
  // non-finite ε would silently break the strict-> gate.
  if (args.grantEpsilon !== undefined) {
    if (!args.arbitrate) {
      throw new Error('--grant-epsilon requires --arbitrate (it dials the grant-site gate)');
    }
    if (!Number.isFinite(args.grantEpsilon) || args.grantEpsilon < 0) {
      throw new Error(`--grant-epsilon must be a finite number ≥ 0 (got '${args.grantEpsilon}')`);
    }
  }
  // 85c — the fold arm rides the arbitrated arm only; NaN/negative λ would
  // silently corrupt every score.
  if (args.priorLambda !== undefined) {
    if (!args.arbitrate) {
      throw new Error('--prior-lambda requires --arbitrate (it folds the arbitrated terminal score)');
    }
    if (!Number.isFinite(args.priorLambda) || args.priorLambda < 0) {
      throw new Error(`--prior-lambda must be a finite number ≥ 0 (got '${args.priorLambda}')`);
    }
  }
  // 85g6a — the campRaid dial rides the arbitrated arm only (the site
  // exists nowhere else), and only the two explicit states parse — a
  // typo'd value must never silently run the default arm under an
  // ablation label (the 70a labeling discipline).
  if (args.campRaid !== undefined) {
    if (!args.arbitrate) {
      throw new Error('--camp-raid requires --arbitrate (it dials the campRaid site)');
    }
    if (!['on', 'off'].includes(args.campRaid)) {
      throw new Error(`--camp-raid must be on|off (got '${args.campRaid}')`);
    }
  }
  // 85-pre F3 (user-signed 2026-08-23, the 84b refusal class CLOSED):
  // Run.fromJSON resets every RunConfig probe dial (forcedEncounterId /
  // forcedLayoutId / drawAmountAdd / difficultyMultipliers and the sector
  // scatter config — Run.ts fromJSON), so an arbitrated arm's rollout
  // clones judge candidates against futures the dialed live run cannot
  // have (WORKLOG §85-pre finding 4 — live on the pre-F3A board's two
  // --encounter wall rows). Refuse the combination outright, the 84b
  // shape. The scatter chances bite only at a sector TRANSITION (the
  // start map rides the clone's wire; only next-sector generation
  // re-rolls), so they refuse only on multi-sector shapes — the act-1
  // (--hops) probe combos stay legal.
  if (args.arbitrate) {
    const dials: Array<[string, unknown]> = [
      ['--encounter', args.encounter],
      ['--layout', args.layout],
      ['--draw-add', args.drawAdd],
      ['--bits-multiplier', args.bitsMultiplier],
      ...(args.hops === undefined
        ? ([
            ['--elite-chance', args.eliteChance],
            ['--port-chance', args.portChance],
            ['--event-chance', args.eventChance],
          ] as Array<[string, unknown]>)
        : []),
    ];
    const set = dials.filter(([, v]) => v !== undefined).map(([f]) => f);
    if (set.length > 0) {
      throw new Error(
        `--arbitrate is refused with ${set.join(', ')}: rollout clones drop every RunConfig probe dial (Run.fromJSON), so arbitration would judge candidates against futures the dialed run cannot have (WORKLOG §85-pre finding 4; the 84b refusal class)`,
      );
    }
  }
  // 84c — the shadow instrument's guards: arbitrate-only; 'run' or an
  // integer battle count; never on a run-shape probe (84b: the clone walks
  // unbounded, so the live record's hopsRemaining and the shadow's walk
  // would disagree on what "the rest of the run" is); the sample is a
  // positive integer and meaningless without the horizon.
  if (args.shadowHorizon !== undefined) {
    if (!args.arbitrate) {
      throw new Error('--shadow-horizon requires --arbitrate (it shadows the arbitrated arm)');
    }
    if (args.shadowHorizon !== 'run') {
      const n = Number(args.shadowHorizon);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`--shadow-horizon must be 'run' or an integer ≥ 1 (got '${args.shadowHorizon}')`);
      }
    }
    if (args.hops !== undefined || args.sectorHops !== undefined) {
      throw new Error(
        '--shadow-horizon is refused with --hops / --sector-hops: a rollout clone drops both run-shape dials (Run.fromJSON), so the shadow walk would be unbounded while the live run is not — the instrument is a full-walk shape (WORKLOG §84b)',
      );
    }
  }
  if (args.shadowSample !== undefined) {
    if (args.shadowHorizon === undefined) {
      throw new Error('--shadow-sample requires --shadow-horizon (it samples the shadowed decisions)');
    }
    if (!Number.isInteger(args.shadowSample) || args.shadowSample < 1) {
      throw new Error(`--shadow-sample must be an integer ≥ 1 (got '${args.shadowSample}')`);
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
 *  absent (no override → the character's daemon; the 63d relabel of what
 *  was "the Run's own roll" — still byte-identical to `random`). Bails
 *  loudly on an unknown idol id. */
export function daemonFromArgs(args: Pick<CliArgs, 'daemon'>): DaemonSelection | undefined {
  return args.daemon !== undefined ? parseDaemonFlag(args.daemon) : undefined;
}

/** 63d — resolve the `--character` flag into a selection; absent = the
 *  EXPLICIT Soldier default (never `undefined` — a batch always names its
 *  character arm). Throws loudly on an unknown id. */
export function characterFromArgs(args: Pick<CliArgs, 'character'>): CharacterSelection {
  return args.character !== undefined
    ? parseCharacterFlag(args.character)
    : DEFAULT_CHARACTER_SELECTION;
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

/** 68b — resolve + VALIDATE the `--grant` flag into a `RunConfig.grants`
 *  list (comma-separated daemon / packet / unit-archetype ids), or
 *  `undefined` when absent. **Bails loudly on an unknown id** with the kind
 *  probes named (the layoutFromArgs discipline) — Run would throw at first
 *  construction anyway, but a batch should die at the flag, not mid-run.
 *  Run mode only (parseArgs enforces). */
export function grantsFromArgs(args: Pick<CliArgs, 'grant'>): readonly string[] | undefined {
  if (args.grant === undefined) return undefined;
  const ids = args.grant
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (ids.length === 0) bail('--grant needs at least one id (daemon, packet, or unit archetype)');
  for (const id of ids) {
    const known =
      daemonById(id) !== undefined ||
      packetById(id) !== undefined ||
      (ALL_ARCHETYPES as readonly string[]).includes(id);
    if (!known) {
      bail(`Unknown grant id: ${id} (not a daemon, packet, or unit archetype)`);
    }
  }
  return ids;
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

/** 85g3 — normalize a `searcherFromArgs` value into the arbitrated arm's
 *  `rolloutSearch` config (the harness's own normalization, 85b finding 6;
 *  `kFlipTelemetry` deliberately stripped — a rollout needs the play
 *  policy, not the instrument). Extracted verbatim from run.ts so the
 *  eval-shard children normalize identically. */
export function normalizeArbRolloutSearch(
  rolloutSearch: true | readonly TrafficScript[] | RolloutSearchConfig | undefined,
): RolloutSearchConfig | undefined {
  return rolloutSearch === undefined
    ? undefined
    : rolloutSearch === true
      ? {}
      : Array.isArray(rolloutSearch)
        ? { scripts: rolloutSearch as readonly TrafficScript[] }
        : (({ kFlipTelemetry: _drop, ...keep }) => keep)(rolloutSearch as RolloutSearchConfig);
}

/**
 * 85g3 — resolve the arbitrated arm's CORE flags into the harness's
 * per-seed `wrapStrategy` factory (the 59e `searcherFromArgs` discipline:
 * ONE resolver shared by run mode and the `--eval-shard` children, which
 * receive the FLAGS via the job file and re-resolve here — so a sharded
 * search drives the identical arm byte-for-byte). Core = tier + the fold
 * (λ + both table views, loaded ONCE at resolve time — a missing table
 * throws before any seed runs, the 85c contract) + the searcher config
 * for searcher-tier rollouts. The run-mode INSTRUMENTS (`--flip-telemetry`
 * / `--shadow-horizon` / `--grant-epsilon`) are run.ts compositions passed
 * through `extras` and are REFUSED with `--search` (validateArgs above).
 */
export function arbitratedWrapFromArgs(
  args: Pick<
    CliArgs,
    'arbitrate' | 'arbitrateTier' | 'priorLambda' | 'searcher' | 'searcherSpec' | 'audition' | 'k' | 'kTelemetry'
  >,
  extras: Partial<ArbitratedConfig> = {},
): ((seed: number, base: FuzzStrategy) => FuzzStrategy) | undefined {
  if (!args.arbitrate) return undefined;
  const innerTier = args.arbitrateTier as InnerTier | undefined;
  const arbRolloutSearch = normalizeArbRolloutSearch(searcherFromArgs(args));
  const priorTable =
    args.priorLambda !== undefined && args.priorLambda !== 0 ? loadPriorTable() : undefined;
  const priorFold =
    priorTable !== undefined
      ? {
          priorLambda: args.priorLambda!,
          priorTable: priorFoldValues(priorTable),
          priorTableBySite: priorFoldValuesBySite(priorTable),
        }
      : {};
  return (seed, base) =>
    makeArbitratedStrategy(seed, {
      base,
      ...(innerTier !== undefined ? { innerTier } : {}),
      ...(arbRolloutSearch !== undefined ? { rolloutSearch: arbRolloutSearch } : {}),
      ...priorFold,
      ...extras,
    });
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
