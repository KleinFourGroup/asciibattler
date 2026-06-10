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
import { World } from '../../src/sim/World';
import type { GameEvents } from '../../src/core/events';
import type { Team } from '../../src/sim/Unit';
import type { Archetype } from '../../src/sim/archetypes';
import { Run } from '../../src/run/Run';
import type { RunConfig } from '../../src/run/RunConfig';
import { spawnEncounter } from '../../src/sim/battleSetup';
import type { FuzzStrategy } from './Strategy';
import { decideObjectiveCommand } from './objectiveStrategy';
import type { ObjectiveProclivity } from './objectiveStrategy';
import { TelemetryAccumulator } from './telemetry';
import type { RunTelemetry } from './telemetry';

export type RunOutcome = 'complete' | 'defeat' | 'hang' | 'aborted';

export interface BattleResult {
  floor: number;
  worldSeed: number;
  /** Hand-authored layout id, or `null` for procedural terrain. Threaded
   *  through so per-layout hang rates surface in the summary — useful
   *  when a future layout's narrow corridors recreate the C1d Labyrinth
   *  deadlock pattern. */
  layoutId: string | null;
  winner: Team | 'hang';
  ticks: number;
  playerDeaths: number;
  enemyDeaths: number;
  playerTeamSize: number;
  enemyTeamSize: number;
  /** G4 telemetry — per-unit levels of each team at battle START (from the
   *  encounter snapshot), for the per-floor level/size analysis. Captured
   *  before any deaths so it reflects the composition entering the floor. */
  playerLevels: number[];
  enemyLevels: number[];
}

export interface RecruitChoice {
  floor: number;
  archetype: Archetype;
  teamSizeAfter: number;
}

export interface RunResult {
  seed: number;
  strategyName: string;
  outcome: RunOutcome;
  finalFloorReached: number;
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
   * G1 — optional RunConfig (short floor count, forced layout, leveled
   * roster, …) so a sweep can target a 1-floor run or a specific layout.
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
}

// 150s of game time. Authored in seconds and converted via the
// TICK_RATE contract so the E3.5 doubling (10 → 20 Hz) didn't silently
// halve the real cap — which is exactly what made grown-team battles on
// the 32-long endlessCorridors board read as false "hangs" at the old
// hardcoded 1000 (= 50s post-E3.5). Kept in lockstep with the in-game turn
// cap (`config/health.json` maxTurnSeconds) — I2 raised both 100 → 150 so a
// dodge-era battle (whiffs lengthen fights ~33–66%) gets room to resolve
// decisively before it reads as a false hang here / a draw in-game. The two
// caps are still SEPARATE constants (this one + the config one); unifying
// them onto one source is a Phase-N cleanup (see ROADMAP §Phase N).
const DEFAULT_MAX_TICKS = secondsToTicks(150);
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
  const maxTicksPerBattle = options.maxTicksPerBattle ?? DEFAULT_MAX_TICKS;
  const maxNodeHops = options.maxNodeHops ?? DEFAULT_MAX_HOPS;
  const strategyRng = new RNG(options.strategySeed ?? seed);
  // J4 — the objective bot is inert unless an active proclivity is supplied; a
  // `none`/absent objective forks no RNG + enqueues nothing (byte-identical).
  const objective = options.objective;
  const objectiveActive = objective !== undefined && objective.kind !== 'none';

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

  bus.on('battle:started', ({ worldSeed }) => {
    const encounter = run.currentEncounter!;
    currentWorld = new World(bus, new RNG(worldSeed), encounter.gridW, encounter.gridH);
    currentObjRng = objectiveActive ? new RNG(worldSeed).fork() : null;
    unitTeams = new Map();
    currentBattle = {
      floor: run.currentFloor,
      worldSeed,
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
  // existing `battle:ended` handler below (where `currentBattle.floor` is still
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
    // `currentBattle.floor` is still live: each headless turn is one
    // battle:started/ended cycle, so `survivorPower` IS this turn's pool chip.
    if (telemetry) {
      for (const a of xpAwards) telemetry.recordXp(a.unitId, a.xpGained);
      if (survivorPower) {
        telemetry.recordTurnChip(currentBattle.floor, survivorPower.player, survivorPower.enemy);
      }
    }
    battles.push({
      floor: currentBattle.floor,
      worldSeed: currentBattle.worldSeed,
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

  const run = new Run(options.runConfig?.seed ?? seed, bus, options.runConfig);

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
      case 'battle': {
        if (!currentWorld) {
          throw new Error('harness: battle phase but no active World — bus wiring bug');
        }
        const w = currentWorld;
        let battleTicks = 0;
        while (!w.ended && battleTicks < maxTicksPerBattle) {
          // J4 — drive the shared objective before the tick drains commands.
          // `decideObjectiveCommand` is the no-thrash gate (refill only when the
          // objective is null), so this is at most one enqueue per kill.
          if (currentObjRng && objective) {
            const cmd = decideObjectiveCommand(w, objective, currentObjRng);
            if (cmd) w.enqueueCommand(cmd);
          }
          w.tick();
          battleTicks++;
        }
        totalTicks += battleTicks;
        if (!w.ended) {
          // Hang: synthesize a battle record so the report shows it,
          // then bail with outcome 'hang'.
          if (currentBattle) {
            battles.push({
              floor: currentBattle.floor,
              worldSeed: currentBattle.worldSeed,
              layoutId: currentBattle.layoutId,
              winner: 'hang',
              ticks: battleTicks,
              playerDeaths: currentBattle.playerDeaths,
              enemyDeaths: currentBattle.enemyDeaths,
              playerTeamSize: currentBattle.playerTeamSize,
              enemyTeamSize: currentBattle.enemyTeamSize,
              playerLevels: currentBattle.playerLevels,
              enemyLevels: currentBattle.enemyLevels,
            });
          }
          return finalize(seed, strategy.name, 'hang', run, battles, recruits, totalTicks, telemetry);
        }
        break;
      }
      case 'promotion': {
        // E4: headless run; PromotionScene has no observable side
        // effects on the sim, just dismiss and continue. Run resolves
        // dismissal into the same recruit-offer / run:victory branch
        // a no-promotion battle would take, so the next loop tick
        // lands in 'recruit' or 'complete' naturally.
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
          floor: run.currentFloor,
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
  floor: number;
  worldSeed: number;
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
  return {
    seed,
    strategyName,
    outcome,
    finalFloorReached: run.currentFloor,
    totalTicks,
    finalTeamSize: run.team.length,
    battles,
    recruits,
    // Fold in the recruit log + final roster composition (player-side, already
    // tracked) and emit the immutable telemetry. Absent when the flag is off.
    telemetry:
      telemetry?.finish(
        recruits.map((r) => r.archetype),
        run.team.map((u) => u.archetype),
      ) ?? undefined,
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
