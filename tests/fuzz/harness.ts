/**
 * Headless fuzz harness. Drives a `Run` end-to-end without a renderer or
 * a clock — the harness just hot-loops `World.tick()` between phase
 * transitions and lets the strategy resolve every choice. Output is a
 * `RunResult` per seed that downstream reporters aggregate into CSV and
 * markdown traces.
 *
 * Determinism contract:
 *   1. Same `seed` + same strategy → byte-identical RunResult.
 *   2. Strategy streams are rooted at a `strategySeed` (defaults to
 *      `seed`; `new RNG(strategySeed)` per stream — 85-pre F4 doc fix)
 *      so changing the strategy doesn't perturb the run-level stream.
 *
 * Safety: every battle is capped at `maxTicksPerBattle`. If a battle
 * doesn't resolve in time it's recorded as a `hang` and the run aborts.
 * Hangs are signal — they tend to flag balance / pathfinding issues that
 * aren't catchable by tick-isolation tests.
 */

import { EventBus } from '../../src/core/EventBus';
import { RNG } from '../../src/core/RNG';
import { secondsToTicks } from '../../src/config';
import { HEALTH } from '../../src/config/health';
import { World } from '../../src/sim/World';
import { findOverlappingCells } from '../../src/sim/occupancy';
import type { GameEvents } from '../../src/core/events';
import type { Team } from '../../src/sim/Unit';
import type { Archetype } from '../../src/sim/archetypes';
import { Run } from '../../src/run/Run';
import { PRE_ROOT_NODE_ID } from '../../src/run/NodeMap';
import type { RunConfig } from '../../src/run/RunConfig';
import { spawnEncounter } from '../../src/sim/battleSetup';
import { orderCampRaid } from './campRaid';
import type { FuzzStrategy } from './Strategy';
import type { UseContext } from '../../src/config/packets';
import { decideObjectiveCommand } from './objectiveStrategy';
import type { ObjectiveProclivity } from './objectiveStrategy';
import { CoverageObjectiveDriver, COVERAGE_MAX_TICKS } from './objectiveCoverage';
import {
  TrafficScriptDriver,
  TRAFFIC_SCRIPTS,
  type TrafficScript,
} from '../../src/bot/TrafficScriptDriver';
import { RolloutSearchDriver, type RolloutSearchConfig } from '../../src/bot/RolloutSearchDriver';
import { selectRedrawPositions } from './redrawPolicy';
import type { RedrawPolicy } from './redrawPolicy';
import { selectEmpowerPosition } from './empowerPolicy';
import type { EmpowerPolicy } from './empowerPolicy';
import { daemonConfigFor } from './daemonSelection';
import type { DaemonSelection } from './daemonSelection';
import { characterConfigFor, DEFAULT_CHARACTER_SELECTION } from './characterSelection';
import type { CharacterSelection } from './characterSelection';
import { TelemetryAccumulator } from './telemetry';
import type { RunTelemetry } from './telemetry';
import type { RunDecisionRecord } from './rollout/driver';

export type RunOutcome = 'complete' | 'defeat' | 'hang' | 'aborted';

export interface BattleResult {
  /** 68e — the 0-based sector ordinal in the walk (counted off `sector:cleared`;
   *  0 for every single-sector run). Hop numbering resets per sector, so act
   *  attribution keys on (sector, hop) — never bare hop. */
  sector: number;
  hop: number;
  worldSeed: number;
  /** X2 — the authored encounter selected onto this node (`Encounter.id`). One
   *  encounter spans multiple turns/waves, so every wave (BattleResult) of the
   *  same node visit shares this id; it's the per-encounter telemetry key. */
  encounterId: string;
  /** Hand-authored layout id, or `null` for procedural terrain. Threaded
   *  through so per-layout hang rates surface in the summary — useful
   *  when a future layout's narrow corridors recreate the C1d Labyrinth
   *  deadlock pattern. */
  layoutId: string | null;
  /** Decisive winner, or `'draw'` when the per-turn cap force-resolved the battle
   *  (N2 — `winner === 'draw'` ⟺ a capped/indecisive turn, the metric that
   *  replaced the old run-ending `'hang'`). `'hang'` now survives only as the
   *  genuine non-termination guard (a World invariant violation; see the battle
   *  loop), so it's effectively never produced. */
  winner: Team | 'draw' | 'hang';
  ticks: number;
  playerDeaths: number;
  enemyDeaths: number;
  /** §83e — camp instances installed on this battle's board (0 = camp-free)
   *  plus camps WIPED per killing faction (the `battle:ended` campKills
   *  payload). The forced-engagement probe's conditioning + non-vacuous
   *  counters; run totals derive in the reporter (the playerDeaths pattern). */
  campsSpawned: number;
  campKillsPlayer: number;
  campKillsEnemy: number;
  /** 57g.5 — the K-sensitivity prefix instrument's per-battle counters,
   *  present ONLY when `rolloutSearch.kFlipTelemetry` is on (the schema is
   *  otherwise untouched — no parity risk for existing arms). Flattened to
   *  the {2,4} prefixes the instrument compares (K=8 is the arm's shape). */
  searcherKFlips?: { searches: number; flips2: number; flips4: number };
  playerTeamSize: number;
  enemyTeamSize: number;
  /** G4 telemetry — per-unit levels of each team at battle START (from the
   *  encounter snapshot), for the per-hop level/size analysis. Captured
   *  before any deaths so it reflects the composition entering the hop. */
  playerLevels: number[];
  enemyLevels: number[];
  /** 87a — the composition entering the hop, index-paired with
   *  `playerLevels` (same capture site, same pre-damage snapshot). The
   *  roster-realism capture: rosters.csv rows + the §87c per-hop table
   *  are built from this. */
  playerArchetypes: Archetype[];
  /** 72b-pre — the run-wide player pool at battle (wave) START. With the
   *  (sector, hop) key this is the pool-HP trajectory sample: the unified
   *  balance frame's connective tissue (encounter damage → trajectory →
   *  reach × wall). Captured where `playerLevels` is, pre-damage. */
  poolAtStart: number;
}

export interface RecruitChoice {
  /** 72b audit (F3) — the act ordinal at recruit time. `hop` is PER-SECTOR
   *  (gotcha #120); without this an act-2 recruit's hop was act-ambiguous. */
  sector: number;
  hop: number;
  archetype: Archetype;
  teamSizeAfter: number;
}

export interface RunResult {
  seed: number;
  strategyName: string;
  /** L1c3 — the run's rolled (or forced) STARTING daemon id, `null` for a
   *  daemon-less arm. The per-daemon win/hop bucketing key. Captured at
   *  construction (48f): reward tables grant daemons mid-run, so end-state
   *  ownership no longer identifies the arm. */
  daemonId: string | null;
  outcome: RunOutcome;
  /** `run.currentHop` at run end — PER-SECTOR (resets at every sector
   *  transition). Read it together with `sectorsCleared`: the walk position at
   *  death is (sectorsCleared, finalHopReached), lexicographic. */
  finalHopReached: number;
  /** 68e — `sector:cleared` transitions the run made (0 = died/completed in
   *  the first sector; a completed two-act walk reads 1 — the sink sector's
   *  clear is the run completion, not a transition). The finalHop-gap fix:
   *  act attribution no longer leans on `battlesPlayed`. */
  sectorsCleared: number;
  totalTicks: number;
  finalTeamSize: number;
  /** 50g — purchases the port buy policy made across the run (all three
   *  buy kinds). The arm's non-vacuous proof + the §52 price-tuning
   *  pre-instrumentation (with `finalBits`, the spend-volume read). */
  portPurchases: number;
  /** 50g — the run's closing bits balance (leftover liquidity: high values
   *  with low `portPurchases` read as "prices out of reach"). */
  finalBits: number;
  /** 59a — packets the fire seam consumed across the run (`usePacket`
   *  dispatches that landed, both contexts). The fire arm's non-vacuous
   *  proof — the `portPurchases` twin; 0 forever on the anchor arms
   *  (absent `pickPacketFire` = the pre-§59 never-fire behavior). */
  packetsFired: number;
  /** 74e — event pages the run OPENED (entries that held in the event
   *  phase; combat-resolved entries count as battles instead). The event
   *  system's non-vacuous proof — the portPurchases/packetsFired twin —
   *  and the §81 event-era read's consumption denominator. */
  eventsVisited: number;
  /** 72b-pre — pool HP recorded at each `sector:cleared` transition, in walk
   *  order (empty = the run never cleared a sector). `[0]` IS the
   *  act-1→act-2 seam value on the two-act walk: health never resets
   *  between acts, so this is the state that disentangles act-2 intrinsic
   *  difficulty from act-1 carried damage (the seam-hazard read's key). */
  poolAtSectorClears: readonly number[];
  /** 72b-pre — the run-wide pool at run end: winners' headroom, the
   *  trajectory's terminal sample (0 on pool-exhaustion defeats). */
  finalPool: number;
  battles: BattleResult[];
  recruits: RecruitChoice[];
  /**
   * H7c — per-archetype mechanism telemetry (damage/healing/deaths/picks/
   * composition + per-turn pool chips + XP). Present ONLY when
   * `HarnessOptions.telemetry` is set, so the default sweep + the `--search`
   * hot-path stay lean and the byte-for-byte fuzz baselines are untouched
   * (a new optional field doesn't alter the existing summary.csv columns).
   */
  telemetry?: RunTelemetry;
  /**
   * 71a — the run's arbitration decision log, harvested by the CLI from the
   * per-seed arbitrated arm's driver AFTER `runOne` returns (the harness
   * itself never touches it — arbitration is a strategy concern). Present
   * ONLY on `--arbitrate` runs; plain JSON data end to end, so it rides the
   * 68e results.json round-trip and `--jobs` composition needs no extra
   * protocol. summary.csv never reads it (the sidecar is additive).
   */
  decisions?: readonly RunDecisionRecord[];
}

export interface HarnessOptions {
  /** Per-battle tick cap. Default ≈100s of game time, derived from
   *  TICK_RATE so it tracks the E3.5 tick-rate change instead of going
   *  stale (gotcha #6). */
  readonly maxTicksPerBattle?: number;
  /** Safety cap on total node hops per run. Default 50. */
  readonly maxNodeHops?: number;
  /**
   * Optional override for the strategy's RNG seed. Defaults to the run
   * seed so a single number captures everything; override only when
   * sweeping the strategy independent of the run.
   */
  readonly strategySeed?: number;
  /**
   * G1 — optional RunConfig (short hop count, forced layout, leveled
   * roster, …) so a sweep can target a 1-hop run or a specific layout.
   * `runConfig.seed` (if set) overrides the run seed; the `seed` arg still
   * identifies the run (strategy RNG + `RunResult.seed`).
   */
  readonly runConfig?: RunConfig;
  /**
   * H7c — collect per-archetype mechanism telemetry into `RunResult.telemetry`
   * (opt-in; off by default so the search hot-path pays nothing). Pure
   * observation — wires extra bus subscribers that only tally, never emit, so
   * determinism + the fuzz baselines are unaffected.
   */
  readonly telemetry?: boolean;
  /**
   * J4 — the objective proclivity the bot drives the player team's shared
   * objective with during each battle (`decideObjectiveCommand`, refill-on-null).
   * Undefined / `{ kind: 'none' }` (the default) injects NOTHING — no objective
   * RNG is forked and no command is enqueued — so the run is byte-identical to
   * the pre-J4 fuzz path (the existing baselines stay intact unless `--objective`
   * opts in). Tuned in isolation via the arena harness (`arena.ts`); fed here as
   * a saved JSON / `random` / `none` so the full-run search can hold one
   * objective strategy fixed while it tunes the difficulty / archetype knobs.
   */
  readonly objective?: ObjectiveProclivity;
  /**
   * O5 — drive the dev-only objective COVERAGE churn bot instead of a
   * measurement `objective` proclivity (the two are mutually exclusive; the CLI
   * maps `--objective=coverage` here and leaves `objective` undefined). It
   * churns every typed-objective mode on BOTH teams with random 1–20s lifetimes
   * for termination + determinism coverage — NEVER a balance input (see
   * `objectiveCoverage.ts`). When set, the default per-battle cap is bumped to
   * `COVERAGE_MAX_TICKS` (the churn needs headroom to resolve; the bigger cap
   * still backstops termination). Off by default → byte-identical.
   */
  readonly coverageObjectives?: boolean;
  /**
   * §54 — the traffic-script bot (Rung 1): `true` drives the player team's
   * objective through `TrafficScriptDriver` over the standard `TRAFFIC_SCRIPTS`
   * registry; an explicit script array substitutes a custom registry (the test
   * seam — how the parity + liveness tests inject stubs). Mutually exclusive
   * with `objective` / `coverageObjectives` (enforced — the anchors stay frozen
   * on the old handling). The driver holds NO RNG: no stream is forked, and an
   * absent / `false` / EMPTY-registry arm enqueues nothing — byte-identical to
   * the pre-§54 path (the 54a parity contract; existing baselines untouched).
   */
  readonly trafficScripts?: boolean | readonly TrafficScript[];
  /**
   * §57f — the portfolio rollout searcher (Rung 2 proper): `true` drives the
   * player team through `RolloutSearchDriver` at the §57c v2 default dials;
   * a script array substitutes a custom nominator registry; a full
   * `RolloutSearchConfig` overrides the dials (the 57g sensitivity seam —
   * K / horizon / ε / cadence arms run through here, no code surgery).
   * Mutually exclusive with all three arms above (the frozen-anchor
   * contract). One RNG is forked per battle off the worldSeed for CRN seed
   * derivation — world/combat streams untouched; an absent / `false` /
   * empty-registry arm enqueues nothing and forks nothing world-side
   * (byte-identical, the 54a parity shape).
   */
  readonly rolloutSearch?: boolean | readonly TrafficScript[] | RolloutSearchConfig;
  /**
   * K3c3 — the redraw policy the bot drives the pre-turn redraw with.
   * Undefined / `{ kind: 'none' }` (the default) keeps the turn gates OFF —
   * the run is byte-identical to the pre-K3c3 path (existing baselines stay
   * intact unless `--redraw` opts in). A live policy flips
   * `run.pauseAtTurnGates` ON (the `redrawCards` command is only legal at the
   * `turn-intro` gate) and the harness dispatches `advanceTurn` at both gates;
   * the gated path is RNG-aligned with the headless one (H4b), pinned by the
   * `level:0` gates-on control test.
   */
  readonly redraw?: RedrawPolicy;
  /**
   * K4c3 — the empower policy the bot drives the pre-turn empower with.
   * Same contract as `redraw`: undefined / `{ kind: 'none' }` (the default)
   * keeps the turn gates OFF and is byte-identical to the pre-K4c3 path. A
   * live policy flips `run.pauseAtTurnGates` ON; at each `turn-intro` the bot
   * empowers AFTER the redraw policy resolves (buff the FINAL hand — the
   * sensible play order, matching the UI flow), asking the selector until the
   * budget runs dry (covers an L-era raised budget; with the stacking `add`
   * merge, repeat picks of the same card stack).
   */
  readonly empower?: EmpowerPolicy;
  /**
   * L1c3 — the daemon arm: `random`/absent leaves the override unset — post-
   * 63c that means the CHARACTER's daemon (the run-start roll is retired;
   * the 63d relabel), still byte-identical to a pre-flag run; `none` forces
   * the daemon-less control arm (both pre-turn gates permanently disabled —
   * what a per-idol lift is measured against); `fixed` forces one idol on
   * every run. Not a per-turn policy — it resolves to the `RunConfig.daemon`
   * override once per run (the G1 determinism contract). The redraw/empower
   * bots above act on whatever the daemon grants (a denied/absent gate reads
   * as zero availability and the bot no-ops).
   */
  readonly daemon?: DaemonSelection;
  /**
   * 63d — the character arm: absent = the EXPLICIT Soldier default (the
   * harness always names its character, never leaning on Run's internal
   * fallback — the §63 exit-criterion lock; byte-identical to the fallback
   * by construction). An explicit selection forces that catalog character;
   * a caller-supplied `runConfig.character` sits between the two in
   * precedence (arm > runConfig > Soldier).
   */
  readonly character?: CharacterSelection;
  /**
   * §35d — assert the occupancy invariant (no two units share a cell, per plane)
   * after every battle tick, across the whole run. OFF by default so the
   * `--search` / sweep hot-path pays nothing (the per-tick scan is test-only,
   * like `telemetry`); the dedicated `occupancyInvariant.test.ts` flips it ON
   * across a seed corpus. A violation throws immediately with the seed + tick +
   * offending cell(s) — the corpus-wide generalization of the Qb#3 same-cell
   * fixture. Byte-identical to a flag-off run (pure observation — no enqueue, no
   * RNG draw), so the existing baselines are untouched.
   */
  readonly assertOccupancy?: boolean;
  /**
   * 85g3 — the per-seed strategy wrap (the `--arbitrate` search-compat
   * seam): applied INSIDE runOne because the arbitrated arm is STATEFUL
   * per run (driver RNG + decision log — the 70a finding) while
   * runMany/evalShard hand ONE base instance across seeds. Deliberately a
   * GENERIC factory — the harness stays arbitration-ignorant; run mode
   * and the `--eval-shard` children build it through the same resolver
   * (`arbitratedWrapFromArgs`, the 59e discipline), so every mode drives
   * the identical arm by construction. The wrapped instance's name flows
   * into `RunResult.strategyName`; if it exposes `driver.decisions`,
   * runOne harvests it onto `RunResult.decisions` post-run (the 71a
   * contract, relocated from run.ts — the relocation is byte-identity
   * proven by the 85g3 oracle). Absent = byte-identical to pre-85g3.
   */
  readonly wrapStrategy?: (seed: number, base: FuzzStrategy) => FuzzStrategy;
}

// The per-turn tick cap — the SINGLE source is `config/health.json`'s
// `maxTurnSeconds`, converted via the TICK_RATE contract (so the E3.5 10 → 20 Hz
// doubling didn't silently halve it — what once made grown-team battles on the
// 32-long endlessCorridors board read as false "hangs"). N2 UNIFIED this: the
// live game (BattleScene), this harness, and the arena all read the same config
// value and all force-resolve a battle that reaches it as a DRAW (resolveAsDraw —
// chips both pools, the run continues), instead of the old divergence where the
// harness alone labeled a cap-hit a run-ending 'hang'. 'hang' now means genuine
// non-termination only (a World invariant violation).
const DEFAULT_MAX_TICKS = secondsToTicks(HEALTH.maxTurnSeconds);
const DEFAULT_MAX_HOPS = 50;
// 74b — the event-phase loop guard: `hops` freezes while a run sits in the
// 'event' phase (it increments only on 'map'), so neither run guard bounds a
// spinning event page. The 74a termination assert guarantees a random walk
// exits with probability 1; this cap converts an authoring/engine loop into
// a loud failure instead of a silent wedge (the §74 kickoff hazard).
const MAX_EVENT_STEPS = 500;

/**
 * Drive one full run with `strategy`, return a `RunResult`. Throws only
 * for harness bugs (missing encounter, etc.) — every game-side outcome
 * is encoded in `RunResult.outcome`.
 */
export function runOne(
  seed: number,
  strategy: FuzzStrategy,
  options: HarnessOptions = {},
): RunResult {
  // 85g3 — the per-seed wrap + the decisions harvest (see
  // HarnessOptions.wrapStrategy). A thin shell so the inner body's many
  // return sites stay untouched; no wrap = the exact old path.
  if (options.wrapStrategy === undefined) return runOneInner(seed, strategy, options);
  const effective = options.wrapStrategy(seed, strategy);
  const result = runOneInner(seed, effective, options);
  const driver = (effective as { driver?: { decisions?: RunResult['decisions'] } }).driver;
  if (driver?.decisions !== undefined) result.decisions = driver.decisions;
  return result;
}

function runOneInner(
  seed: number,
  strategy: FuzzStrategy,
  options: HarnessOptions = {},
): RunResult {
  // O5 — coverage churn needs a generous per-battle cap (see COVERAGE_MAX_TICKS);
  // an explicit `maxTicksPerBattle` still wins.
  const coverageActive = options.coverageObjectives === true;
  const maxTicksPerBattle =
    options.maxTicksPerBattle ?? (coverageActive ? COVERAGE_MAX_TICKS : DEFAULT_MAX_TICKS);
  const maxNodeHops = options.maxNodeHops ?? DEFAULT_MAX_HOPS;
  // §35d — opt-in per-tick occupancy assertion (off by default; test-only).
  const assertOccupancy = options.assertOccupancy === true;
  const strategyRng = new RNG(options.strategySeed ?? seed);
  // J4 — the objective bot is inert unless an active proclivity is supplied; a
  // `none`/absent objective forks no RNG + enqueues nothing (byte-identical).
  // O5 — `coverage` replaces it (mutually exclusive); the CLI never sets both.
  const objective = options.objective;
  const objectiveActive = objective !== undefined && objective.kind !== 'none';
  // §54 — the traffic-script arm: `true` = the standard registry, an array =
  // a custom (test) registry. Null when off. Mutually exclusive with BOTH
  // older objective arms — enforced here (not just at the CLI) because the
  // frozen-anchor doctrine depends on it: an anchor arm accidentally layered
  // with scripts would silently unfreeze the comparison floor.
  const trafficScripts: readonly TrafficScript[] | null =
    options.trafficScripts === true
      ? TRAFFIC_SCRIPTS
      : options.trafficScripts === false || options.trafficScripts === undefined
        ? null
        : options.trafficScripts;
  if (trafficScripts !== null && (objectiveActive || coverageActive)) {
    throw new Error(
      'harness: trafficScripts is mutually exclusive with objective/coverageObjectives ' +
        '(the §54 frozen-anchor contract)',
    );
  }
  // §57f — the searcher arm: `true` = default dials over the standard
  // registry, an array = a custom nominator registry, an object = full dial
  // overrides (the 57g seam). Null when off. Mutually exclusive with ALL
  // THREE arms above — same frozen-anchor reasoning, enforced here too.
  const rolloutSearch: RolloutSearchConfig | null =
    options.rolloutSearch === true
      ? {}
      : options.rolloutSearch === false || options.rolloutSearch === undefined
        ? null
        : Array.isArray(options.rolloutSearch)
          ? { scripts: options.rolloutSearch }
          : (options.rolloutSearch as RolloutSearchConfig);
  if (rolloutSearch !== null && (objectiveActive || coverageActive || trafficScripts !== null)) {
    throw new Error(
      'harness: rolloutSearch is mutually exclusive with objective/coverageObjectives/' +
        'trafficScripts (the frozen-anchor contract)',
    );
  }
  // K3c3 — same contract for the redraw bot: `none`/absent forks no RNG and
  // leaves the turn gates off. Only the `random` policy ever draws from this
  // stream (a dedicated fork, so policy draws never perturb the run streams).
  const redraw = options.redraw;
  const redrawActive = redraw !== undefined && redraw.kind !== 'none';
  const redrawRng = redrawActive ? new RNG(seed).fork() : null;
  // K4c3 — and for the empower bot. Its stream is the SECOND fork off a fresh
  // seed-RNG so it stays independent of the redraw stream (the first fork —
  // two `new RNG(seed).fork()` calls would yield the SAME sequence) without
  // perturbing the K3c3 redraw stream's derivation. Only `random` draws.
  const empower = options.empower;
  const empowerActive = empower !== undefined && empower.kind !== 'none';
  const empowerRng = empowerActive
    ? (() => {
        const base = new RNG(seed);
        base.fork(); // skip the redraw bot's stream
        return base.fork();
      })()
    : null;

  const bus = new EventBus<GameEvents>();
  const battles: BattleResult[] = [];
  const recruits: RecruitChoice[] = [];
  // 68e — the walk ordinal. Incremented on every sector transition (the 67a
  // `sector:cleared` emit fires AFTER the state swap, and always BEFORE the
  // successor sector's first battle:started), so `sectorsCleared` IS the
  // 0-based sector index of whatever battle starts next.
  let sectorsCleared = 0;
  // 72b-pre — the pool at each sector seam, in walk order. [0] is THE
  // act-1→act-2 handoff state on the two-act walk (health never resets
  // between acts — the disentangling instrument's key value). `run` is
  // declared below; the closure only fires from dispatches long after.
  const poolAtSectorClears: number[] = [];
  bus.on('sector:cleared', () => {
    sectorsCleared++;
    poolAtSectorClears.push(run.playerHealth);
  });
  // H7c — opt-in mechanism telemetry. Null (and zero overhead) by default.
  const telemetry = options.telemetry ? new TelemetryAccumulator() : null;

  // Per-battle scratch state. Re-initialized on every battle:started.
  let currentWorld: World | null = null;
  let currentBattle: PartialBattle | null = null;
  let unitTeams = new Map<number, Team>();
  // J4 — a per-battle objective RNG stream, forked off the battle's worldSeed so
  // the bot's `random` draws never perturb the World's sim / combat streams.
  // Null (and untouched) whenever no objective is active.
  let currentObjRng: RNG | null = null;
  // O5 — a per-battle coverage churn bot, reset each battle off the same forked
  // worldSeed stream (mutually exclusive with the objective bot). Null when
  // coverage is off.
  let currentCoverage: CoverageObjectiveDriver | null = null;
  // §54 — a per-battle traffic-script driver (mutually exclusive with both
  // arms above). RNG-free by lock, so nothing is forked; fresh per battle so
  // the dwell/standing bookkeeping never leaks across battles.
  let currentTraffic: TrafficScriptDriver | null = null;
  // §57f — a per-battle rollout searcher (mutually exclusive with all three).
  // Fresh per battle: the standing/tracker bookkeeping and the CRN stream
  // (forked off the worldSeed) never leak across battles.
  let currentSearcher: RolloutSearchDriver | null = null;
  // 85d — set at turn-intro when the strategy's raid plan says so; consumed
  // (and cleared) by the next battle:started's spawn — harness-side
  // battle-plan state, never Run state (no snapshot bump).
  let raidNextBattle = false;

  bus.on('battle:started', ({ worldSeed }) => {
    const encounter = run.currentEncounter!;
    currentWorld = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    // 47f — the run's compiled daemon battle-hooks (BattleScene mirrors this
    // at the live construction site).
    currentWorld.installBattleRules(encounter.battleRules ?? []);
    currentObjRng = objectiveActive ? new RNG(worldSeed).fork() : null;
    currentCoverage = coverageActive
      ? new CoverageObjectiveDriver(new RNG(worldSeed).fork())
      : null;
    currentTraffic =
      trafficScripts !== null ? new TrafficScriptDriver('player', trafficScripts) : null;
    currentSearcher =
      rolloutSearch !== null
        ? new RolloutSearchDriver('player', new RNG(worldSeed).fork(), rolloutSearch)
        : null;
    unitTeams = new Map();
    currentBattle = {
      sector: sectorsCleared,
      hop: run.currentHop,
      worldSeed,
      // X2 — the authored encounter id (set in `beginEncounter` before this
      // fires); the per-encounter telemetry key. Always present mid-encounter.
      encounterId: run.selectedEncounter!.id,
      layoutId: encounter.layoutId,
      playerTeamSize: encounter.playerTeam.length,
      enemyTeamSize: encounter.enemyTeam.length,
      playerLevels: encounter.playerTeam.map((u) => u.level),
      enemyLevels: encounter.enemyTeam.map((u) => u.level),
      playerArchetypes: encounter.playerTeam.map((u) => u.archetype),
      poolAtStart: run.playerHealth,
      playerDeaths: 0,
      enemyDeaths: 0,
      startTick: 0,
    };
    // spawnEncounter emits unit:spawned for each unit; those handlers
    // need `currentWorld` set first (the unit team lookup happens
    // synchronously inside the emit), so this ordering matters.
    spawnEncounter(currentWorld, encounter);
    // 85d — the campRaid order, placed right after spawn (primes are
    // alive, the drip hasn't ticked): the player-side §75g pull mirror,
    // shared with the walker via orderCampRaid. One battle only.
    if (raidNextBattle) {
      raidNextBattle = false;
      orderCampRaid(currentWorld);
    }
  });

  bus.on('unit:spawned', ({ unitId }) => {
    const unit = currentWorld?.findUnit(unitId);
    if (!unit) return;
    unitTeams.set(unitId, unit.team);
    // Neutrals (walls / half-cover / rubble — and §75 camp units) never figure
    // in the per-archetype read, so skip them. Team is the durable gate: the
    // old `archetype !== 'environment'` check tested a sentinel retired in
    // §38d, so inert neutrals had been slipping into the meta map (75-pre).
    if (telemetry && unit.team !== 'neutral') {
      telemetry.registerUnit(unitId, unit.team, unit.archetype);
    }
  });

  bus.on('unit:died', ({ unitId }) => {
    telemetry?.recordDeath(unitId);
    if (!currentBattle) return;
    const team = unitTeams.get(unitId);
    if (team === 'player') currentBattle.playerDeaths++;
    else if (team === 'enemy') currentBattle.enemyDeaths++;
  });

  // Telemetry-only combat hooks (registered only under the flag so a default
  // run wires no extra subscribers). XP + the per-turn pool chip ride the
  // existing `battle:ended` handler below (where `currentBattle.hop` is still
  // live), so they're order-safe regardless of subscriber registration order.
  if (telemetry) {
    bus.on('unit:attacked', ({ attackerId, targetId, damage }) => {
      telemetry.recordAttack(attackerId, damage);
      telemetry.recordDamageTaken(targetId, damage);
    });
    bus.on('unit:healed', ({ healerId, amount }) => {
      if (healerId !== null) telemetry.recordHeal(healerId, amount);
    });
  }

  bus.on('battle:ended', ({ winner, xpAwards, survivorPower, campKills }) => {
    if (!currentBattle || !currentWorld) return;
    // H7c telemetry — recorded here (not in a separate subscriber) so
    // `currentBattle.hop` is still live: each headless turn is one
    // battle:started/ended cycle, so `survivorPower` IS this turn's pool chip.
    if (telemetry) {
      for (const a of xpAwards) telemetry.recordXp(a.unitId, a.xpGained);
      if (survivorPower) {
        telemetry.recordTurnChip(
          currentBattle.sector,
          currentBattle.hop,
          currentBattle.encounterId,
          survivorPower.player,
          survivorPower.enemy,
        );
      }
    }
    // 57g.5 — harvest the prefix-instrument counters while this battle's
    // searcher is still live (a fresh driver is built per battle, so the
    // stats ARE this battle's totals). Attached only under the telemetry
    // flag so every other arm's battle records stay byte-shaped.
    const endedSearcher = currentSearcher as RolloutSearchDriver | null;
    const kFlips =
      rolloutSearch?.kFlipTelemetry === true && endedSearcher
        ? {
            searcherKFlips: {
              searches: endedSearcher.searchCount,
              flips2: endedSearcher.kFlipStats.byPrefix.get(2) ?? 0,
              flips4: endedSearcher.kFlipStats.byPrefix.get(4) ?? 0,
            },
          }
        : {};
    battles.push({
      ...kFlips,
      sector: currentBattle.sector,
      hop: currentBattle.hop,
      worldSeed: currentBattle.worldSeed,
      encounterId: currentBattle.encounterId,
      layoutId: currentBattle.layoutId,
      winner,
      ticks: currentWorld.currentTick,
      playerDeaths: currentBattle.playerDeaths,
      enemyDeaths: currentBattle.enemyDeaths,
      // §83e — camps re-roll per battle, so campsList() at battle end IS this
      // board's installed set (instances persist through member deaths).
      campsSpawned: currentWorld.campsList().length,
      campKillsPlayer: (campKills ?? []).filter((k) => k.killedBy === 'player').length,
      campKillsEnemy: (campKills ?? []).filter((k) => k.killedBy === 'enemy').length,
      playerTeamSize: currentBattle.playerTeamSize,
      enemyTeamSize: currentBattle.enemyTeamSize,
      playerLevels: currentBattle.playerLevels,
      enemyLevels: currentBattle.enemyLevels,
      playerArchetypes: currentBattle.playerArchetypes,
      poolAtStart: currentBattle.poolAtStart,
    });
    currentBattle = null;
    currentWorld = null;
  });

  // L1c3 — resolve the daemon arm into the RunConfig override. `random`/absent
  // resolves to undefined = no override (the character's daemon, post-63c).
  const daemonOverride = options.daemon !== undefined ? daemonConfigFor(options.daemon) : undefined;
  // 63d — the character arm resolves ALWAYS (arm > caller runConfig > the
  // explicit Soldier default), so every run's RunConfig names its character.
  const character =
    options.character !== undefined
      ? characterConfigFor(options.character)
      : (options.runConfig?.character ?? characterConfigFor(DEFAULT_CHARACTER_SELECTION));
  const runConfig: RunConfig = {
    ...options.runConfig,
    character,
    ...(daemonOverride !== undefined ? { daemon: daemonOverride } : {}),
  };
  const run = new Run(runConfig.seed ?? seed, bus, runConfig);
  // L1c3/48f — the arm key is the STARTING daemon (rolled or forced at
  // construction). Read it NOW: reward tables grant daemons mid-run (accepted
  // by the harness's accept-all policy), so end-state `run.daemons` no longer
  // answers "which arm ran" — a `none` control run can finish owning loot.
  const startingDaemonId = run.daemons[0]?.id ?? null;
  // K3c3/K4c3 — a live redraw OR empower policy needs the turn gates: the
  // `redrawCards`/`empowerUnit` commands are only legal in `turn-intro`,
  // which exists only when `pauseAtTurnGates` is on. 59a — a strategy that
  // DEFINES `pickPacketFire` needs the gate too (preTurn is one of the two
  // legal fire contexts); the gated path is RNG-aligned with the headless
  // one (H4b), pinned by the fire-null control in harnessEconomy.test.ts.
  const fireActive = strategy.pickPacketFire !== undefined;
  // 70d — same contract for a strategy-driven grant walk (`redrawCards`/
  // `empowerUnit` are turn-intro-only commands).
  const grantActive = strategy.pickGrantAction !== undefined;
  // 85d — the campRaid plan is asked AT turn-intro, so defining it needs
  // the gate too (same contract as fires/grants).
  const raidActive = strategy.pickCampRaid !== undefined;
  if (redrawActive || empowerActive || fireActive || grantActive || raidActive) {
    run.pauseAtTurnGates = true;
  }

  // 59a — the ask-until-null packet-fire loop at one legal fire site. A
  // rejected `usePacket` consumes nothing (the 49e validate-before-mutate
  // contract), so "cache didn't shrink" is the break condition — never spin.
  let packetsFired = 0;
  const firePackets = (context: UseContext): void => {
    if (!strategy.pickPacketFire) return;
    for (;;) {
      const fire = strategy.pickPacketFire(context, run, strategyRng);
      if (fire === null) break;
      const before = run.cache.length;
      run.dispatch({ kind: 'usePacket', ...fire });
      if (run.cache.length >= before) break; // rejected — never spin
      packetsFired++;
    }
  };

  let hops = 0;
  let eventSteps = 0; // 74b — consecutive event choices since the last map hop
  let eventsVisited = 0; // 74e — opened event pages (the non-vacuous counter)
  let totalTicks = 0;
  let portPurchases = 0; // 50g — the buy policy's transaction count

  while (true) {
    if (run.phase === 'defeat' || run.phase === 'complete') break;

    if (hops > maxNodeHops) {
      return aborted(
        seed,
        strategy.name,
        run,
        startingDaemonId,
        battles,
        recruits,
        totalTicks,
        portPurchases,
        packetsFired,
        eventsVisited,
        sectorsCleared,
        poolAtSectorClears,
        telemetry,
      );
    }

    switch (run.phase) {
      case 'map': {
        // 59a — the outOfBattle fire site (the map screen; roster-targeted
        // packets take `rosterIndex` here). Before the node pick, so a fired
        // buff/heal lands ahead of the hop it was fired for.
        firePackets('outOfBattle');
        const frontier = computeFrontier(run);
        if (frontier.length === 0) {
          return aborted(
            seed,
            strategy.name,
            run,
            startingDaemonId,
            battles,
            recruits,
            totalTicks,
            portPurchases,
            packetsFired,
            eventsVisited,
            sectorsCleared,
            poolAtSectorClears,
            telemetry,
          );
        }
        const nodeId = strategy.pickNextNode(frontier, run, strategyRng);
        run.dispatch({ kind: 'enterNode', nodeId });
        hops++;
        eventSteps = 0; // 74b — the cap is per event visit, not per run
        break;
      }
      case 'event': {
        // 74b — the doctrine event policy: uniform-random among the ENABLED
        // choices off the policy stream, one draw per resolved page (the
        // checkless arms' event play, per the §74 shape-lock; arbitration
        // is §74g's). The 74a termination assert guarantees an
        // unconditioned exit on every page, so `enabled` is never empty —
        // both throws below are loud engine/authoring failures, never
        // normal outcomes.
        const enabled = run.enabledEventChoices();
        if (enabled.length === 0) {
          throw new Error('harness: event page with no enabled choices');
        }
        eventSteps++;
        // 74e — the first choice-iteration after a map hop IS the visit
        // marker (eventSteps resets per hop), counted here rather than at
        // the dispatch site because TS narrows `run.phase` to 'map' there.
        if (eventSteps === 1) eventsVisited++;
        if (eventSteps > MAX_EVENT_STEPS) {
          throw new Error(
            `harness: ${MAX_EVENT_STEPS} event choices without leaving the event phase`,
          );
        }
        // 74g — an arm that defines pickEventChoice owns the pick (the
        // arbitrated arm's eventChoice site); ABSENT = the doctrine draw.
        const pick = strategy.pickEventChoice
          ? strategy.pickEventChoice(run, strategyRng)
          : enabled[strategyRng.int(0, enabled.length - 1)]!;
        run.dispatch({ kind: 'chooseEventOption', choiceIndex: pick });
        break;
      }
      case 'turn-intro': {
        // 85d — the campRaid battle plan, decided BEFORE the fire loop
        // (the plan concerns the upcoming battle; fires concern the
        // hand/cache — independent surfaces, plan first).
        if (strategy.pickCampRaid?.(run, strategyRng)) raidNextBattle = true;
        // 59a — the preTurn fire site, BEFORE the grant walk: a fired
        // grantRedraws packet inserts its grant at the cursor (49e), so the
        // walk below can actually spend it — firing after the walk would
        // leave reroute-style packets outcome-inert, the exact smell §59
        // exists to remove. Hand-targeted packets take `handIndex`; buffs
        // land before the redraw/empower policies read the hand.
        firePackets('preTurn');
        // K3c3/K4c3→49d — the pre-turn gate: the bot walks the GRANT QUEUE
        // in order (acquisition order — naturally compliant under BOTH
        // finality modes), asking its policy per grant. The ask-until-null
        // inner loop covers both the shipped one-action mode and a raised-
        // budget grant; the no-progress guard (a silently-rejected dispatch
        // moves no budget) bounds every loop absolutely. A single-daemon run
        // makes the same policy draws as the pre-49d bot, byte-for-byte
        // (one grant = one policy block, same order).
        for (let grantIndex = 0; grantIndex < run.grantViews().length; grantIndex++) {
          const view = () => run.grantViews()[grantIndex]!;
          const kind = view().effect.kind;
          if (strategy.pickGrantAction !== undefined) {
            // 70d — the strategy-driven walk (the §70 grant site): same
            // ask-until-null + no-progress contract as the policy blocks
            // below; the strategy owns WHICH action, the harness owns the
            // loop. Defining the method supersedes the --redraw/--empower
            // policy path entirely (documented on the interface).
            for (;;) {
              const grant = view();
              if (grant.remaining <= 0) break;
              const action = strategy.pickGrantAction(grantIndex, run, strategyRng);
              if (action === null) break;
              const before = grant.remaining;
              run.dispatch(
                action.kind === 'redraw'
                  ? { kind: 'redrawCards', handIndices: [...action.handIndices], grantIndex }
                  : { kind: 'empowerUnit', handIndex: action.handIndex, grantIndex },
              );
              if (view().remaining === before) break; // rejected — never spin
            }
          } else if (kind === 'redraw' && redraw && redrawRng) {
            for (;;) {
              const grant = view();
              if (grant.remaining <= 0) break;
              const effect = grant.effect;
              if (effect.kind !== 'redraw') break;
              const hand = run.hand.map((i) => run.team[i]!);
              const pool = [...run.drawPile, ...run.discardPile].map((i) => run.team[i]!);
              const positions = selectRedrawPositions(
                hand,
                pool,
                { redrawsRemaining: grant.remaining, cardsRemaining: effect.maxCards },
                redraw,
                redrawRng,
              );
              if (positions.length === 0) break;
              const before = grant.remaining;
              run.dispatch({ kind: 'redrawCards', handIndices: positions, grantIndex });
              if (view().remaining === before) break; // rejected — never spin
            }
          } else if (kind === 'empower' && empower && empowerRng) {
            for (;;) {
              const grant = view();
              if (grant.remaining <= 0) break;
              const hand = run.hand.map((i) => run.team[i]!);
              const pos = selectEmpowerPosition(
                hand,
                { empowersRemaining: grant.remaining },
                empower,
                empowerRng,
              );
              if (pos === null) break;
              const before = grant.remaining;
              run.dispatch({ kind: 'empowerUnit', handIndex: pos, grantIndex });
              if (view().remaining === before) break; // rejected — never spin
            }
          }
          // 49d — under STRICT finality a declined/unpoliced grant blocks
          // the queue; pass it so later grants stay reachable. Free mode
          // makes this a harmless no-op (passGrant no-ops there).
          if (view().active && view().remaining > 0) {
            run.dispatch({ kind: 'passGrant' });
          }
        }
        run.dispatch({ kind: 'advanceTurn' });
        break;
      }
      case 'turn-outcome': {
        // K3c3 — the post-turn gate: nothing to decide, just resume (the live
        // game's outcome screen has its own timer; the bot doesn't linger).
        run.dispatch({ kind: 'advanceTurn' });
        break;
      }
      case 'battle': {
        // `currentWorld`/`currentCoverage`/`currentBattle` are assigned ONLY
        // inside bus-event closures, so TS's control-flow analysis (it only
        // tracks the linear body) pins their flow-type to the `null` initializer;
        // a truthy/null guard then narrows that to `never`. The runtime guards
        // below are real — the `battle:started` handler always sets these before
        // this phase runs — and the `as` casts just restore the type the closure
        // assignment actually gives them. Same caveat at the coverage + hang
        // guards further down.
        if (!currentWorld) {
          throw new Error('harness: battle phase but no active World — bus wiring bug');
        }
        const w = currentWorld as World;
        let battleTicks = 0;
        while (!w.ended && battleTicks < maxTicksPerBattle) {
          // J4 — drive the shared objective before the tick drains commands.
          // `decideObjectiveCommand` is the no-thrash gate (refill only when the
          // objective is null), so this is at most one enqueue per kill.
          if (currentObjRng && objective) {
            const cmd = decideObjectiveCommand(w, objective, currentObjRng);
            if (cmd) w.enqueueCommand(cmd);
          }
          // O5 — or churn both teams' objectives for coverage (mutually exclusive
          // with the measurement bot above; the CLI never sets both).
          const coverage = currentCoverage as CoverageObjectiveDriver | null;
          if (coverage) {
            for (const cmd of coverage.decide(w)) w.enqueueCommand(cmd);
          }
          // §54 — or the traffic-script driver (mutually exclusive with both,
          // enforced above). Same placement contract: decide BEFORE the tick
          // drains, at most one command per dwell window.
          const traffic = currentTraffic as TrafficScriptDriver | null;
          if (traffic) {
            for (const cmd of traffic.decide(w)) w.enqueueCommand(cmd);
          }
          // §57f — or the rollout searcher (mutually exclusive with all
          // three, enforced above). Same placement contract: decide BEFORE
          // the tick drains; at most one command per search point.
          const searcher = currentSearcher as RolloutSearchDriver | null;
          if (searcher) {
            for (const cmd of searcher.decide(w)) w.enqueueCommand(cmd);
          }
          w.tick();
          battleTicks++;
          // §35d — assert the one-unit-per-cell-per-plane invariant after every
          // tick (opt-in). Throws on the first breach with the seed + tick +
          // cell, so the corpus run pinpoints any regression instead of silently
          // tolerating an overlap.
          if (assertOccupancy) {
            const overlaps = findOverlappingCells(w);
            if (overlaps.length > 0) {
              throw new Error(
                `§35 occupancy invariant violated (seed ${seed}, tick ${w.currentTick}): ` +
                  `cell(s) ${overlaps.join(', ')} hold >1 unit`,
              );
            }
          }
        }
        totalTicks += battleTicks;
        if (!w.ended) {
          // N2 — the per-turn cap (`config/health.json` maxTurnSeconds) was reached
          // without a decisive end. Force-resolve as a DRAW exactly like the live
          // driver: resolveAsDraw chips BOTH pools and emits battle:ended('draw')
          // (the handler records the battle with winner 'draw' + nulls currentBattle/
          // World), and the RUN CONTINUES. A long/indecisive turn is no longer a
          // run-ending 'hang'; capped draws read downstream as winner === 'draw'.
          w.resolveAsDraw();
        }
        if (!w.ended) {
          // Unreachable in practice — resolveAsDraw is the single idempotent
          // end-emit, so the battle is always ended above. Kept ONLY as the genuine
          // non-termination guard (a World invariant violation): synthesize a battle
          // record + bail with outcome 'hang', which now means EXACTLY that, never
          // just a slow turn.
          // Same closure-assignment caveat as `currentWorld` above.
          const cb = currentBattle as PartialBattle | null;
          if (cb) {
            battles.push({
              sector: cb.sector,
              hop: cb.hop,
              worldSeed: cb.worldSeed,
              encounterId: cb.encounterId,
              layoutId: cb.layoutId,
              winner: 'hang',
              ticks: battleTicks,
              playerDeaths: cb.playerDeaths,
              enemyDeaths: cb.enemyDeaths,
              // §83e — no battle:ended fired on this guard path: presence is
              // readable off the live world, kills are unknowable → 0.
              campsSpawned: w.campsList().length,
              campKillsPlayer: 0,
              campKillsEnemy: 0,
              playerTeamSize: cb.playerTeamSize,
              enemyTeamSize: cb.enemyTeamSize,
              playerLevels: cb.playerLevels,
              enemyLevels: cb.enemyLevels,
              playerArchetypes: cb.playerArchetypes,
              poolAtStart: cb.poolAtStart,
            });
          }
          return finalize(
            seed,
            strategy.name,
            'hang',
            run,
            startingDaemonId,
            battles,
            recruits,
            totalTicks,
            portPurchases,
            packetsFired,
            eventsVisited,
            sectorsCleared,
            poolAtSectorClears,
            telemetry,
          );
        }
        break;
      }
      case 'reward': {
        // 48b: headless policy — accept EVERYTHING, front to back. No
        // policy draws (acceptance is deterministic): bits exercise the
        // `gainBits` settle, daemons the `addDaemon` acquisition seam.
        // 49c: one refinement — a packet portion against a FULL cache is
        // DECLINED (the kickoff lock: accept-if-room; a swap policy would
        // need a value model the harness doesn't have). Still deterministic,
        // still zero draws.
        // 70c: the strategy seam the 48b comment promised — an OPTIONAL
        // `pickReward` decides the head portion (the §70 daemon-pick site
        // rides it); ABSENT = the hardwired policy above, byte for byte.
        const portion = run.pendingRewards![0]!;
        const accept =
          strategy.pickReward !== undefined
            ? strategy.pickReward(portion, run, strategyRng)
            : !(portion.kind === 'packet' && !run.cacheHasRoom);
        run.dispatch(
          accept ? { kind: 'acceptReward', index: 0 } : { kind: 'declineReward', index: 0 },
        );
        break;
      }
      case 'port': {
        // 50g: the purchase policy — the reward accept-all analog. BUYS
        // ONLY, in outcome-coupling order: daemons (idols change battles)
        // → units (roster growth) → packets IF the cache has room (the
        // 49c accept-if-room lock; a swap would need a value model, and
        // the harness never fires packets anyway — the future fire-policy
        // arm's business). Sell/remove stay unexercised here for the same
        // value-model reason (pinned by the Run suite + the 50e
        // browser-verify). Slot order within each kind; skip what's
        // unaffordable, never wait for it. Deterministic, ZERO policy
        // draws — every price is serialized state; the pre-dispatch
        // guards mirror the handlers' no-op conditions exactly, so every
        // issued command lands (portPurchases counts real transactions).
        // Then undock — the dock consumed a hop in the 'map' case above,
        // so the abort guard still bounds the walk.
        const stock = run.portStock;
        if (stock && strategy.pickPortBuy) {
          // 59a — the strategy-driven purchase loop (ask-until-null, the
          // grant-walk idiom): one proposal per ask, dispatched against the
          // live stock/bits, re-asked after each landed buy. The sold-flag
          // flip is the landed-transaction read (portPurchases keeps
          // counting REAL transactions, same as the fixed policy below); a
          // proposal that doesn't land breaks the loop — never spin.
          for (;;) {
            const buy = strategy.pickPortBuy(stock, run, strategyRng);
            if (buy === null) break;
            const lane =
              buy.kind === 'daemon'
                ? stock.daemons
                : buy.kind === 'unit'
                  ? stock.units
                  : stock.packets;
            const slot = lane[buy.index];
            if (slot === undefined || slot.sold) break;
            run.dispatch(
              buy.kind === 'daemon'
                ? { kind: 'buyPortDaemon', index: buy.index }
                : buy.kind === 'unit'
                  ? { kind: 'buyPortUnit', index: buy.index }
                  : { kind: 'buyPortPacket', index: buy.index },
            );
            if (!slot.sold) break; // rejected (unaffordable / cache full) — never spin
            portPurchases++;
          }
        } else if (stock) {
          stock.daemons.forEach((slot, index) => {
            if (!slot.sold && run.bits >= slot.price) {
              run.dispatch({ kind: 'buyPortDaemon', index });
              portPurchases++;
            }
          });
          stock.units.forEach((slot, index) => {
            if (!slot.sold && run.bits >= slot.price) {
              run.dispatch({ kind: 'buyPortUnit', index });
              portPurchases++;
            }
          });
          stock.packets.forEach((slot, index) => {
            if (!slot.sold && run.bits >= slot.price && run.cacheHasRoom) {
              run.dispatch({ kind: 'buyPortPacket', index });
              portPurchases++;
            }
          });
        }
        run.dispatch({ kind: 'leavePort' });
        break;
      }
      case 'promotion': {
        // E4: headless run; PromotionScene has no observable side
        // effects on the sim, just dismiss and continue. M1: promotions
        // fire at the TURN boundary, so dismissal usually re-enters the
        // encounter loop (the next tick lands back in 'battle'); on a won
        // final turn it lands in 'recruit'/'complete' as before.
        run.dispatch({ kind: 'dismissPromotion' });
        break;
      }
      case 'sectorCleared': {
        // 67a — the between-sector gate: nothing to decide headlessly (the
        // sector state already swapped in advanceSector), just release it;
        // the next iteration lands on the new sector's map. Not a hop —
        // no node is entered.
        run.dispatch({ kind: 'dismissSectorCleared' });
        break;
      }
      case 'recruit': {
        const offer = run.currentOffer!;
        const idx = strategy.pickRecruit(offer, run, strategyRng);
        // H6b — `null` means PASS: decline the offer, leave the roster
        // untouched, and record nothing (only actual recruits are logged).
        if (idx === null) {
          run.dispatch({ kind: 'passRecruit' });
          break;
        }
        const pick = offer[idx]!;
        run.dispatch({ kind: 'chooseRecruit', unitTemplate: pick });
        recruits.push({
          sector: sectorsCleared,
          hop: run.currentHop,
          archetype: pick.archetype,
          teamSizeAfter: run.team.length,
        });
        break;
      }
      default:
        throw new Error(`harness: unexpected phase ${run.phase satisfies never}`);
    }
  }

  return finalize(
    seed,
    strategy.name,
    run.phase === 'complete' ? 'complete' : 'defeat',
    run,
    startingDaemonId,
    battles,
    recruits,
    totalTicks,
    portPurchases,
    packetsFired,
    eventsVisited,
    sectorsCleared,
    poolAtSectorClears,
    telemetry,
  );
}

interface PartialBattle {
  sector: number;
  hop: number;
  worldSeed: number;
  encounterId: string;
  layoutId: string | null;
  playerTeamSize: number;
  enemyTeamSize: number;
  playerLevels: number[];
  enemyLevels: number[];
  playerArchetypes: Archetype[];
  poolAtStart: number;
  playerDeaths: number;
  enemyDeaths: number;
  startTick: number;
}

function computeFrontier(run: Run): number[] {
  // S2 — at the pre-root start the root is the sole frontier; thereafter the
  // frontier is the current node's outgoing edges.
  if (run.currentNodeId === PRE_ROOT_NODE_ID) return [run.nodeMap.rootId];
  const out: number[] = [];
  for (const e of run.nodeMap.edges) {
    if (e.from === run.currentNodeId) out.push(e.to);
  }
  return out;
}

function finalize(
  seed: number,
  strategyName: string,
  outcome: RunOutcome,
  run: Run,
  startingDaemonId: string | null,
  battles: BattleResult[],
  recruits: RecruitChoice[],
  totalTicks: number,
  portPurchases: number,
  packetsFired: number,
  eventsVisited: number,
  sectorsCleared: number,
  poolAtSectorClears: readonly number[],
  telemetry: TelemetryAccumulator | null,
): RunResult {
  // Fold in the recruit log + final roster composition (player-side, already
  // tracked) and emit the immutable telemetry. Absent when the flag is off — and
  // under `exactOptionalPropertyTypes` an absent value must OMIT the key, not set
  // it to `undefined`, so spread it conditionally.
  const finishedTelemetry = telemetry?.finish(
    recruits.map((r) => r.archetype),
    run.team.map((u) => u.archetype),
  );
  return {
    seed,
    strategyName,
    daemonId: startingDaemonId,
    outcome,
    finalHopReached: run.currentHop,
    sectorsCleared,
    totalTicks,
    finalTeamSize: run.team.length,
    portPurchases,
    finalBits: run.bits,
    packetsFired,
    eventsVisited,
    poolAtSectorClears,
    finalPool: run.playerHealth,
    battles,
    recruits,
    ...(finishedTelemetry !== undefined ? { telemetry: finishedTelemetry } : {}),
  };
}

function aborted(
  seed: number,
  strategyName: string,
  run: Run,
  startingDaemonId: string | null,
  battles: BattleResult[],
  recruits: RecruitChoice[],
  totalTicks: number,
  portPurchases: number,
  packetsFired: number,
  eventsVisited: number,
  sectorsCleared: number,
  poolAtSectorClears: readonly number[],
  telemetry: TelemetryAccumulator | null,
): RunResult {
  return finalize(
    seed,
    strategyName,
    'aborted',
    run,
    startingDaemonId,
    battles,
    recruits,
    totalTicks,
    portPurchases,
    packetsFired,
    eventsVisited,
    sectorsCleared,
    poolAtSectorClears,
    telemetry,
  );
}

/**
 * Convenience: run `seeds.length` runs, return an array of results. The
 * runs are independent so a future caller could parallelize trivially,
 * but for the modest seed counts we expect (a few hundred) the serial
 * loop is fine and keeps determinism easier to reason about.
 */
export function runMany(
  seeds: readonly number[],
  strategy: FuzzStrategy,
  options: HarnessOptions = {},
): RunResult[] {
  return seeds.map((s) => runOne(s, strategy, options));
}
