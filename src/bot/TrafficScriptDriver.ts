/**
 * §54 (Rung 1) — the traffic-script driver: the bot-side layer ABOVE the
 * typed objective model. Scripts read world STATE and propose objectives in
 * the existing four-mode vocabulary (`atWill`/`engage`/`hold`/`focus`) through
 * the existing command channel — the same vocabulary the 53g human baseline
 * was played with (the expressiveness proof, worklog §54). No new objective
 * kinds, no sim change, no snapshot field: WorldSnapshot v34 holds.
 *
 * Arbitration is DUMB-DETERMINISTIC by design (the §54 lock; scoring is
 * §55's gated domain):
 *   - **Fixed priority** — `TRAFFIC_SCRIPTS` registry order IS the priority;
 *     the first script whose `evaluate` returns a proposal wins the tick.
 *   - **The null action is the arm to beat** — a script returning `null`
 *     means "my trigger didn't clear its threshold"; if NO script triggers,
 *     the driver releases its own standing order (back to `atWill`) rather
 *     than steering. The 53g finding demands this: the passive bot BEATS the
 *     human on labyrinth/river — intervention must earn its slot.
 *   - **Min-dwell no-thrash** — after any command, the driver goes quiet for
 *     `MIN_DWELL_TICKS` (the J4 no-thrash precedent, generalized): orders get
 *     time to play out, and a boundary-flickering trigger can't spam.
 *
 * Determinism: the driver holds NO RNG at all — decisions are pure functions
 * of world state + two internal counters (per-battle, never serialized; the
 * derive-don't-cache doctrine). Same seed → byte-identical command stream,
 * and every sensor a script reads must be computable from a cloned snapshot
 * (the §55 rollout-compatibility lock — no event-history aggregation).
 *
 * Lives in `src/bot/` (the §54 fork-4 lock): sim-pure imports only, nothing
 * shipped calls it — the harness (and later §55 rollouts / a possible enemy
 * driver) are the consumers. `src` never imports from `tests`.
 */

import type { World } from '../sim/World';
import type { WorldCommand } from '../sim/Command';
import type { ObjectiveTeam, TeamObjective } from '../sim/objective';
import { secondsToTicks } from '../config';
import { terrainEdgeHold } from './scripts/terrainEdgeHold';
import { unjam } from './scripts/unjam';
import { chokeHold } from './scripts/chokeHold';
import { cohesionFocus } from './scripts/cohesionFocus';

/**
 * One traffic script: a trigger predicate + a proposed objective, fused —
 * `evaluate` returns the proposal ONLY when the script's trigger clears its
 * own threshold (thresholds are per-script internals, set from the 54c
 * trace-mining table), else `null`. Must be a pure, RNG-free read of world
 * state (rollout-compatible; `Math.random` is ESLint-banned in `src/bot/`).
 */
export interface TrafficScript {
  readonly id: string;
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null;
}

/**
 * The priority-ordered script registry — registry order IS the arbitration
 * order (safety first, opportunism last; the §54 straw order): terrain-edge
 * hold › unjam › choke hold › cohesion focus › attrition stall. Scripts
 * land one commit each (54d–54h); imports stay type-only script-side so
 * the runtime dependency is one-directional. The EXPLICIT-empty registry
 * (`trafficScripts: []`) remains the byte-identical no-op arm (the 54a
 * parity contract, re-pinned at 54d when this list stopped being empty).
 */
export const TRAFFIC_SCRIPTS: readonly TrafficScript[] = [
  terrainEdgeHold,
  unjam,
  chokeHold,
  cohesionFocus,
];

/**
 * The no-thrash dwell: minimum ticks between driver commands. Authored in
 * seconds per the TICK_RATE contract. PROVISIONAL at 54a — 54c's trace
 * mining (human command cadence per cell) is the calibration input.
 */
export const MIN_DWELL_SECONDS = 2;
export const MIN_DWELL_TICKS = secondsToTicks(MIN_DWELL_SECONDS);

/** Structural equality over the objective union (no helper exists sim-side;
 *  `setObjectiveAtWill`'s idempotence guard is mode-only). Target identity is
 *  by unit id / cell value — exactly what `setObjective` serializes. */
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
 * The per-battle driver. Construct fresh each battle (mirrors
 * `CoverageObjectiveDriver`'s lifecycle); call `decide` once per tick BEFORE
 * `world.tick()` and enqueue whatever it returns (0 or 1 commands).
 *
 * Ownership rule: the driver only ever CLEARS an order it itself issued
 * (`standingScriptId` bookkeeping) — a foreign `setObjective` (UI, another
 * driver) is never clobbered by the null action. Auto-reverts land back on
 * `atWill` sim-side; the driver just drops its bookkeeping when it sees one.
 */
export class TrafficScriptDriver {
  private readonly team: ObjectiveTeam;
  private readonly scripts: readonly TrafficScript[];
  /** Tick of the driver's last emitted command; null = none yet (the first
   *  command is never dwell-gated — tick-0 action is legitimate). */
  private lastCommandTick: number | null = null;
  /** Id of the script whose order is currently standing; null = no driver
   *  order (either never issued, released, or auto-reverted sim-side). */
  private standingScriptId: string | null = null;

  constructor(team: ObjectiveTeam = 'player', scripts: readonly TrafficScript[] = TRAFFIC_SCRIPTS) {
    this.team = team;
    this.scripts = scripts;
  }

  decide(world: World): WorldCommand[] {
    const current = world.objectiveFor(this.team);

    // Sim-side auto-revert (dead target → atWill) invalidates the standing
    // bookkeeping regardless of what this tick decides.
    if (this.standingScriptId !== null && current.mode === 'atWill') {
      this.standingScriptId = null;
    }

    // Fixed-priority arbitration: first triggered script wins the tick.
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

    // The winner's proposal already stands — adopt/refresh the bookkeeping
    // without re-issuing (idempotence outranks the dwell gate: nothing is
    // emitted, so nothing thrashes).
    if (winner && proposal && sameObjective(current, proposal)) {
      this.standingScriptId = winner.id;
      return [];
    }

    // Min-dwell no-thrash: after any command, go quiet — even a would-be
    // release waits out the dwell (a stale order may persist up to
    // MIN_DWELL_TICKS past its trigger clearing; the accepted cost).
    if (this.lastCommandTick !== null && world.currentTick - this.lastCommandTick < MIN_DWELL_TICKS) {
      return [];
    }

    if (winner && proposal) {
      this.lastCommandTick = world.currentTick;
      this.standingScriptId = winner.id;
      return [{ kind: 'setObjective', team: this.team, objective: proposal }];
    }

    // The null action won. Release ONLY the driver's own standing order;
    // foreign orders (standingScriptId === null) are never touched.
    if (this.standingScriptId !== null && current.mode !== 'atWill') {
      this.lastCommandTick = world.currentTick;
      this.standingScriptId = null;
      return [{ kind: 'clearObjective', team: this.team }];
    }
    return [];
  }
}
