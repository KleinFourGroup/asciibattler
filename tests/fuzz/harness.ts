/**
 * Headless fuzz harness. Drives a `Run` end-to-end without a renderer or
 * a clock — the harness just hot-loops `World.tick()` between phase
 * transitions and lets the strategy resolve every choice. Output is a
 * `RunResult` per seed that downstream reporters aggregate into CSV and
 * markdown traces.
 *
 * Determinism contract:
 *   1. Same `seed` + same strategy → byte-identical RunResult.
 *   2. Strategy RNG is forked from a `strategySeed` (defaults to `seed`)
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
import type { FuzzStrategy } from './Strategy';
import { decideObjectiveCommand } from './objectiveStrategy';
import type { ObjectiveProclivity } from './objectiveStrategy';
import { CoverageObjectiveDriver, COVERAGE_MAX_TICKS } from './objectiveCoverage';
import { selectRedrawPositions } from './redrawPolicy';
import type { RedrawPolicy } from './redrawPolicy';
import { selectEmpowerPosition } from './empowerPolicy';
import type { EmpowerPolicy } from './empowerPolicy';
import { daemonConfigFor } from './daemonSelection';
import type { DaemonSelection } from './daemonSelection';
import { TelemetryAccumulator } from './telemetry';
import type { RunTelemetry } from './telemetry';

export type RunOutcome = 'complete' | 'defeat' | 'hang' | 'aborted';

export interface BattleResult {
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
  playerTeamSize: number;
  enemyTeamSize: number;
  /** G4 telemetry — per-unit levels of each team at battle START (from the
   *  encounter snapshot), for the per-hop level/size analysis. Captured
   *  before any deaths so it reflects the composition entering the hop. */
  playerLevels: number[];
  enemyLevels: number[];
}

export interface RecruitChoice {
  hop: number;
  archetype: Archetype;
  teamSizeAfter: number;
}

export interface RunResult {
  seed: number;
  strategyName: string;
  /** L1c3 — the run's rolled (or forced) daemon id, `null` for a daemon-less
   *  run. The per-daemon win/hop bucketing key. */
  daemonId: string | null;
  outcome: RunOutcome;
  finalHopReached: number;
  totalTicks: number;
  finalTeamSize: number;
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
   * L1c3 — the daemon arm: `random`/absent leaves the Run's own uniform roll
   * (the REAL GAME's default — byte-identical to a pre-flag run, pinned);
   * `none` forces the daemon-less control arm (both pre-turn gates
   * permanently disabled — what a per-idol lift is measured against);
   * `fixed` forces one idol on every run. Not a per-turn policy — it resolves
   * to the `RunConfig.daemon` override once per run, so the roll/skip stays
   * on the Run's child stream (the G1 determinism contract). The redraw/
   * empower bots above act on whatever the daemon grants (a denied/absent
   * gate reads as zero availability and the bot no-ops).
   */
  readonly daemon?: DaemonSelection;
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

  bus.on('battle:started', ({ worldSeed }) => {
    const encounter = run.currentEncounter!;
    currentWorld = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    // 47f — the run's compiled daemon battle-hooks (BattleScene mirrors this
    // at the live construction site).
    currentWorld.installBattleRules(encounter.battleRules ?? []);
    currentObjRng = objectiveActive ? new RNG(worldSeed).fork() : null;
    currentCoverage = coverageActive ? new CoverageObjectiveDriver(new RNG(worldSeed).fork()) : null;
    unitTeams = new Map();
    currentBattle = {
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
      playerDeaths: 0,
      enemyDeaths: 0,
      startTick: 0,
    };
    // spawnEncounter emits unit:spawned for each unit; those handlers
    // need `currentWorld` set first (the unit team lookup happens
    // synchronously inside the emit), so this ordering matters.
    spawnEncounter(currentWorld, encounter);
  });

  bus.on('unit:spawned', ({ unitId }) => {
    const unit = currentWorld?.findUnit(unitId);
    if (!unit) return;
    unitTeams.set(unitId, unit.team);
    // 'environment' neutrals (walls / half-cover) carry no combatant archetype
    // and never figure in the per-archetype read, so skip them.
    if (telemetry && unit.archetype !== 'environment') {
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

  bus.on('battle:ended', ({ winner, xpAwards, survivorPower }) => {
    if (!currentBattle || !currentWorld) return;
    // H7c telemetry — recorded here (not in a separate subscriber) so
    // `currentBattle.hop` is still live: each headless turn is one
    // battle:started/ended cycle, so `survivorPower` IS this turn's pool chip.
    if (telemetry) {
      for (const a of xpAwards) telemetry.recordXp(a.unitId, a.xpGained);
      if (survivorPower) {
        telemetry.recordTurnChip(
          currentBattle.hop,
          currentBattle.encounterId,
          survivorPower.player,
          survivorPower.enemy,
        );
      }
    }
    battles.push({
      hop: currentBattle.hop,
      worldSeed: currentBattle.worldSeed,
      encounterId: currentBattle.encounterId,
      layoutId: currentBattle.layoutId,
      winner,
      ticks: currentWorld.currentTick,
      playerDeaths: currentBattle.playerDeaths,
      enemyDeaths: currentBattle.enemyDeaths,
      playerTeamSize: currentBattle.playerTeamSize,
      enemyTeamSize: currentBattle.enemyTeamSize,
      playerLevels: currentBattle.playerLevels,
      enemyLevels: currentBattle.enemyLevels,
    });
    currentBattle = null;
    currentWorld = null;
  });

  // L1c3 — resolve the daemon arm into the RunConfig override. `random`/absent
  // resolves to undefined = options.runConfig used untouched (byte-identical).
  const daemonOverride = options.daemon !== undefined ? daemonConfigFor(options.daemon) : undefined;
  const runConfig =
    daemonOverride !== undefined ? { ...options.runConfig, daemon: daemonOverride } : options.runConfig;
  const run = new Run(runConfig?.seed ?? seed, bus, runConfig);
  // K3c3/K4c3 — a live redraw OR empower policy needs the turn gates: the
  // `redrawCards`/`empowerUnit` commands are only legal in `turn-intro`,
  // which exists only when `pauseAtTurnGates` is on.
  if (redrawActive || empowerActive) run.pauseAtTurnGates = true;

  let hops = 0;
  let totalTicks = 0;

  while (true) {
    if (run.phase === 'defeat' || run.phase === 'complete') break;

    if (hops > maxNodeHops) {
      return aborted(seed, strategy.name, run, battles, recruits, totalTicks, telemetry);
    }

    switch (run.phase) {
      case 'map': {
        const frontier = computeFrontier(run);
        if (frontier.length === 0) {
          return aborted(seed, strategy.name, run, battles, recruits, totalTicks, telemetry);
        }
        const nodeId = strategy.pickNextNode(frontier, run, strategyRng);
        run.dispatch({ kind: 'enterNode', nodeId });
        hops++;
        break;
      }
      case 'turn-intro': {
        // K3c3 — the pre-turn gate (only entered with a live redraw policy).
        // Policy loop: keep deciding while the budget allows and the policy
        // tosses, so ONE policy covers both the shipped one-batch mode and the
        // L-era "N actions" mode. The no-progress guard (a silently-rejected
        // dispatch changes no counter) bounds the loop absolutely.
        if (redraw && redrawRng) {
          for (;;) {
            const hand = run.hand.map((i) => run.team[i]!);
            const pool = [...run.drawPile, ...run.discardPile].map((i) => run.team[i]!);
            const positions = selectRedrawPositions(
              hand,
              pool,
              run.redrawAvailability,
              redraw,
              redrawRng,
            );
            if (positions.length === 0) break;
            const before = run.cardsRedrawnThisTurn;
            run.dispatch({ kind: 'redrawCards', handIndices: positions });
            if (run.cardsRedrawnThisTurn === before) break; // rejected — never spin
          }
        }
        // K4c3 — empower AFTER redraw (buff the FINAL hand). Same ask-until-
        // null loop + no-progress guard shape as the redraw policy above.
        // 47d — per-source grants: the bot drains each granted idol's budget
        // in grant order (index 0 first — a single-daemon run makes the same
        // policy draws as before, byte-for-byte).
        if (empower && empowerRng) {
          for (let grantIndex = 0; grantIndex < run.empowerGrants.length; grantIndex++) {
            for (;;) {
              const hand = run.hand.map((i) => run.team[i]!);
              const remaining = run.empowerGrants[grantIndex]!.empowersRemaining;
              const pos = selectEmpowerPosition(
                hand,
                { empowersRemaining: remaining },
                empower,
                empowerRng,
              );
              if (pos === null) break;
              const before = run.empowersUsedThisTurn[grantIndex]!;
              run.dispatch({ kind: 'empowerUnit', handIndex: pos, grantIndex });
              if (run.empowersUsedThisTurn[grantIndex] === before) break; // rejected — never spin
            }
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
              hop: cb.hop,
              worldSeed: cb.worldSeed,
              encounterId: cb.encounterId,
              layoutId: cb.layoutId,
              winner: 'hang',
              ticks: battleTicks,
              playerDeaths: cb.playerDeaths,
              enemyDeaths: cb.enemyDeaths,
              playerTeamSize: cb.playerTeamSize,
              enemyTeamSize: cb.enemyTeamSize,
              playerLevels: cb.playerLevels,
              enemyLevels: cb.enemyLevels,
            });
          }
          return finalize(seed, strategy.name, 'hang', run, battles, recruits, totalTicks, telemetry);
        }
        break;
      }
      case 'reward': {
        // 48b: headless policy — accept EVERYTHING, front to back. No
        // strategy seam and no policy draws yet (acceptance is
        // deterministic): bits exercise the `gainBits` settle, daemons the
        // `addDaemon` acquisition seam. A §50-style purchase-policy arm can
        // upgrade this to a real decision later.
        run.dispatch({ kind: 'acceptReward', index: 0 });
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
    battles,
    recruits,
    totalTicks,
    telemetry,
  );
}

interface PartialBattle {
  hop: number;
  worldSeed: number;
  encounterId: string;
  layoutId: string | null;
  playerTeamSize: number;
  enemyTeamSize: number;
  playerLevels: number[];
  enemyLevels: number[];
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
  battles: BattleResult[],
  recruits: RecruitChoice[],
  totalTicks: number,
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
    daemonId: run.daemons[0]?.id ?? null,
    outcome,
    finalHopReached: run.currentHop,
    totalTicks,
    finalTeamSize: run.team.length,
    battles,
    recruits,
    ...(finishedTelemetry !== undefined ? { telemetry: finishedTelemetry } : {}),
  };
}

function aborted(
  seed: number,
  strategyName: string,
  run: Run,
  battles: BattleResult[],
  recruits: RecruitChoice[],
  totalTicks: number,
  telemetry: TelemetryAccumulator | null,
): RunResult {
  return finalize(seed, strategyName, 'aborted', run, battles, recruits, totalTicks, telemetry);
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
