/**
 * The traffic-script driver, a bot layer above the typed objective model.
 * Scripts read the World's state and propose objectives in the four modes
 * a player has (`atWill`, `engage`, `hold`, `focus`), through the command
 * channel a player's orders take, so the bot needs no objective kind, sim
 * code or snapshot field of its own.
 *
 * Arbitration is fixed and deterministic:
 * - Fixed priority: `TRAFFIC_SCRIPTS`' order is the priority, and the
 *   first script whose `evaluate` returns a proposal wins the tick.
 * - The null action is the arm to beat: a script returns `null` when its
 *   trigger stays under its threshold, and when no script triggers, the
 *   driver releases its own standing order (back to `atWill`) rather than
 *   steer. A passive bot outplayed a human player on some layouts, so an
 *   intervention has to earn its place.
 * - No thrash: after any command the driver stays quiet for
 *   `MIN_DWELL_TICKS`, so an order has time to play out and a trigger
 *   flickering at its threshold cannot spam.
 *
 * Determinism: the driver holds no RNG. Its decisions are pure functions
 * of the World's state and two per-battle fields, never serialized, so a
 * seed gives a byte-identical command stream. Every sensor a script reads
 * must be computable from a cloned snapshot, with no history gathered from
 * events, so that the searcher's rollouts can run it.
 *
 * Nothing the game ships calls `src/bot`; the instruments under `tests` do
 * (the fuzz harness and its rollouts, the gauntlet). It imports from the
 * sim, the run, the config and the core only, and never from `tests`.
 */

import type { World } from '../sim/World';
import type { WorldCommand } from '../sim/Command';
import type { ObjectiveTeam, TeamObjective } from '../sim/objective';
import { secondsToTicks } from '../config';
import { terrainEdgeHold, nominateTerrainEdgeHold } from './scripts/terrainEdgeHold';
import { unjam, nominateUnjam } from './scripts/unjam';
import { chokeHold, nominateChokeHold } from './scripts/chokeHold';
import { cohesionFocus, nominateCohesionFocus } from './scripts/cohesionFocus';
import { attritionStall, nominateAttritionStall } from './scripts/attritionStall';

/**
 * One traffic script, a trigger and a proposal in one: `evaluate` returns
 * the proposal only when the script's trigger clears its own threshold
 * (each script's internals), and `null` otherwise. It must be a pure read
 * of the World's state with no RNG, so a rollout clone can run it; ESLint
 * bans `Math.random` in `src/bot`.
 */
export interface TrafficScript {
  readonly id: string;
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null;
  /**
   * Proposes whenever the proposal is well formed, ignoring the trigger's
   * threshold: under the searcher the rollouts decide, so a looser
   * nominator costs only an audition, never a wrong action. Optional; the
   * searcher asks `evaluate` when it is absent. No script object defines
   * it: `AUDITION_SCRIPTS` attaches each script's own (`nominateUnjam` and
   * its kin).
   * The same purity as `evaluate`.
   */
  nominate?(world: World, team: ObjectiveTeam): TeamObjective | null;
}

/**
 * The script registry, in priority order, safety first and opportunism
 * last: terrain-edge hold, unjam, choke hold, cohesion focus, attrition
 * stall. The scripts import this file's types only, so the runtime
 * dependency runs one way. An empty registry (`trafficScripts: []`) issues
 * nothing and is byte-identical to no driver (`harnessTraffic.test.ts`).
 */
export const TRAFFIC_SCRIPTS: readonly TrafficScript[] = [
  terrainEdgeHold,
  unjam,
  chokeHold,
  cohesionFocus,
  attritionStall,
];

/**
 * The audition registry: the same five scripts, each with its `nominate`,
 * which drops the trigger's threshold and keeps only the proposal's
 * geometric checks (each script's file gives its reasons). A registry of
 * its own, since the searcher asks `nominate ?? evaluate` of the script
 * object: with `TRAFFIC_SCRIPTS` free of `nominate`, the plain searcher arm
 * cannot change, and `--audition` swaps the registry, never a code path.
 * The trigger-mode driver never asks `nominate`, so the registry also runs
 * there, to no purpose.
 */
export const AUDITION_SCRIPTS: readonly TrafficScript[] = [
  { ...terrainEdgeHold, nominate: nominateTerrainEdgeHold },
  { ...unjam, nominate: nominateUnjam },
  { ...chokeHold, nominate: nominateChokeHold },
  { ...cohesionFocus, nominate: nominateCohesionFocus },
  { ...attritionStall, nominate: nominateAttritionStall },
];

/** The no-thrash dwell: the fewest ticks between two of the driver's
 *  commands. */
const MIN_DWELL_SECONDS = 2;
export const MIN_DWELL_TICKS = secondsToTicks(MIN_DWELL_SECONDS);

/** Structural equality over the objective union; the sim has none, and
 *  `setObjectiveAtWill`'s guard compares modes only. A target is the same
 *  by unit id or by cell, what a `setObjective` command carries. */
export function sameObjective(a: TeamObjective, b: TeamObjective): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === 'atWill' || a.mode === 'hold') return true;
  const ta = a.target;
  const tb = (b as Extract<TeamObjective, { target: unknown }>).target as typeof ta;
  if (ta.kind !== tb.kind) return false;
  if (ta.kind === 'tile') {
    const cb = (tb as Extract<typeof tb, { kind: 'tile' }>).cell;
    return ta.cell.x === cb.x && ta.cell.y === cb.y;
  }
  return ta.unitId === (tb as Extract<typeof tb, { kind: 'enemy' | 'neutral' }>).unitId;
}

/**
 * The per-battle driver. Build one each battle, as the harness builds its
 * `CoverageObjectiveDriver`; call `decide` once a tick before
 * `world.tick()` and enqueue what it returns (no command or one).
 *
 * The driver only clears an order it issued (`standingScriptId`), so the
 * null action never clobbers an order someone else gave (the UI, another
 * driver). The sim's reverts land on `atWill`, and the driver drops its
 * bookkeeping when it sees one.
 */
export class TrafficScriptDriver {
  private readonly team: ObjectiveTeam;
  private readonly scripts: readonly TrafficScript[];
  /** The tick of the driver's last command, or null before the first,
   *  which the dwell never gates: acting at tick 0 is legitimate. */
  private lastCommandTick: number | null = null;
  /** The script whose order stands, or null when no driver order does
   *  (never issued, released, or reverted by the sim). */
  private standingScriptId: string | null = null;

  constructor(team: ObjectiveTeam = 'player', scripts: readonly TrafficScript[] = TRAFFIC_SCRIPTS) {
    this.team = team;
    this.scripts = scripts;
  }

  decide(world: World): WorldCommand[] {
    const current = world.objectiveFor(this.team);

    // The sim's revert to atWill (a resolved order) clears the bookkeeping,
    // whatever this tick decides.
    if (this.standingScriptId !== null && current.mode === 'atWill') {
      this.standingScriptId = null;
    }

    // While an order someone else issued stands, hold, as the searcher
    // does: a triggered script must not clobber it. The camp raid
    // (`orderCampRaid`) is such an order: raid first, then fight. The
    // sim's revert to atWill releases the hold.
    if (current.mode !== 'atWill' && this.standingScriptId === null) return [];

    // Fixed priority: the first script that triggers wins the tick.
    let winner: TrafficScript | null = null;
    let proposal: TeamObjective | null = null;
    for (const script of this.scripts) {
      const p = script.evaluate(world, this.team);
      if (p !== null) {
        winner = script;
        proposal = p;
        break;
      }
    }

    // The winner's proposal already stands: adopt the bookkeeping without
    // issuing it again. This comes before the dwell, since nothing is
    // emitted and so nothing thrashes.
    if (winner && proposal && sameObjective(current, proposal)) {
      this.standingScriptId = winner.id;
      return [];
    }

    // The dwell: after any command, stay quiet, even for a release. A stale
    // order may outlive its trigger by up to MIN_DWELL_TICKS, the accepted
    // cost.
    if (this.lastCommandTick !== null && world.currentTick - this.lastCommandTick < MIN_DWELL_TICKS) {
      return [];
    }

    if (winner && proposal) {
      this.lastCommandTick = world.currentTick;
      this.standingScriptId = winner.id;
      return [{ kind: 'setObjective', team: this.team, objective: proposal }];
    }

    // The null action won: release only the driver's own order. An order
    // someone else gave (standingScriptId === null) is never touched.
    if (this.standingScriptId !== null && current.mode !== 'atWill') {
      this.lastCommandTick = world.currentTick;
      this.standingScriptId = null;
      return [{ kind: 'clearObjective', team: this.team }];
    }
    return [];
  }
}
