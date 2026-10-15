import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';

/**
 * The closed set of phase names an action's timeline can use: what fighting
 * games call startup, active and recovery, and MOBAs a cast point and a
 * projectile's travel. The effect lands on `impact`, not on the first tick.
 * Keep the set small and closed: a new member is a union edit, and a snapshot
 * bump if the serialized shape changes, as with the stat block.
 *
 * - `windup` — charging, the tell; no effect lands.
 * - `release` — the projectile or the charge leaves the caster; the release
 *   gate (`holdCheck`) is tested here.
 * - `travel` — the projectile in flight, counted in sim ticks, so its arrival
 *   tick is fixed; 0 ticks where a projectile is only drawn.
 * - `impact` — the effect boundary, where `Action.applyEffect` fires.
 * - `recovery` — the follow-through, the lockout's tail; no effect.
 *
 * Most actions use a subset: a basic strike is `impact` at offset 0 and
 * `recovery`; a charged projectile adds `windup`, `release` and `travel` before
 * its `impact`.
 */
export type ActionPhaseName = 'windup' | 'release' | 'travel' | 'impact' | 'recovery';

/**
 * One entry in an action's ordered timeline. `ticks` is the phase's length in
 * sim ticks, at least 0; a 0-tick phase is a boundary that fires on the same
 * tick as the phase after it (a strike's `impact`). An action's busy window is
 * the sum of its phases' ticks.
 */
export interface ActionPhase {
  readonly phase: ActionPhaseName;
  readonly ticks: number;
}

/**
 * What an action does when its locked target died before the effect lands
 * (during `windup` or `travel`):
 *
 * - `commit-at-cast` — resolve against the target captured at cast, skipping
 *   it if it is dead (the strikes, the heal, a chain's primary).
 * - `fizzle` — stop if the locked target died: no damage, no `combatRng` draw.
 *   The shot still shows as a dud, so it is not silent.
 * - `ground-target` — hit the cell, whoever stands there; the target captured
 *   at cast does not matter at impact.
 *
 * The interpreter branches on `fizzle`; an `aoe` selector resolves its cell
 * whatever the policy, so `ground-target` names what the selector does.
 */
export type OrphanPolicy = 'commit-at-cast' | 'fizzle' | 'ground-target';

/**
 * An action is what a unit does from a tick: move one cell, swing a sword,
 * channel a heal. Its timing (the cooldown, the phase timeline) rides on the
 * `ActionProposal`, not on the action, since it depends on the unit's stats;
 * the action captures its other parameters (a target, a cell, the scalars) when
 * it is proposed.
 *
 * `start` runs as the action is seated, and `applyEffect`, when present, at the
 * `impact` boundary (`ActionProposal.phases`); an action does its work in one
 * or both.
 *
 * `toData()` returns the plain JSON its registered factory rebuilds it from
 * (`src/sim/actions/registry.ts`), so a `World` snapshot taken while an action
 * is under way can carry it to the `applyEffect` still to come.
 */
export interface Action {
  readonly id: string;
  start(unit: Unit, world: World): void;
  /**
   * The cell this action moves the unit onto, which must be free as it starts;
   * undefined for an action that does not move onto an empty cell (attacks,
   * heals, and `SwapAction`, whose `to` holds the partner on purpose). World
   * checks the cell just before `start`: if another unit stands on it or it is
   * untraversable, the action aborts (nothing changes, `unit:moveAborted`
   * fires, the cooldown is not spent) rather than writing the unit onto a
   * filled cell. A move holds its destination by a claim until its flip
   * (`MoveAction`), and this check is what stops two units landing together.
   */
  destinationCell?(): GridCoord | undefined;
  /**
   * Fired at the `impact` boundary, the one boundary World fires it at.
   * `tickOffset` is the ticks since the start; `phase` is the boundary, always
   * `'impact'`. Absent on an action whose work is all in `start`.
   */
  applyEffect?(unit: Unit, world: World, tickOffset: number, phase?: ActionPhaseName): void;
  /**
   * The target for the `action:phase` events the renderer schedules from,
   * without exposing the action's insides: an action that tracks a unit returns
   * `{ targetId }`, one aimed at a cell `{ targetCell }`. Absent, it is `{}` (a
   * move, an action with no target).
   */
  phaseTarget?(): { targetId?: number | undefined; targetCell?: GridCoord | undefined };
  /**
   * The release gate. `World.tick` calls it for each phase of an action under
   * way, before that phase's event; a number holds fire: World clears
   * `activeAction` (no phase event, no effect, no RNG draw), sets the ability's
   * cooldown to the returned ticks, the re-aim window, and emits
   * `unit:actionHeld`. Null or absent, the phase goes ahead. Only
   * `EffectAction` implements it, for a def with a `releaseGate`, tested at its
   * `release` boundary. A phase at offset 0 is never tested: the propose step
   * checked the band on the same tick, and nothing has moved since.
   */
  holdCheck?(phase: ActionPhaseName, unit: Unit, world: World): number | null;
  /**
   * The unit this action reserves for its whole seated window: `SwapAction`'s
   * partner, which the selector skips and every swap proposer refuses. World's
   * seat and clear keep the reserved-partner index from it; absent, the action
   * reserves nobody. It belongs to the action instance (rebuilt by
   * `fromData`), so it is never serialized on its own.
   */
  reservedPartnerId?(): number;
  toData(): unknown;
}

/**
 * A behaviour's offer to the action selector. It carries the unit's timing (the
 * cooldown and the phase timeline), so an action holds no stats.
 *
 * - `cooldown` — the ticks before this action (by `cooldownKey`) may be
 *   proposed again. World takes one off every entry each tick before the
 *   selector runs, the selector drops a proposal whose cooldown is still above
 *   0, and a seated action's cooldown is set to the full value (gotchas #7, #8).
 *   It is apart from the timeline: a long-cooldown ability finishes its phases
 *   and still waits out its cooldown.
 * - `phases` — the ordered timeline. The unit is busy for the sum of the
 *   phases' ticks, and `applyEffect` fires at the `impact` boundary. A basic
 *   strike is `[{impact, 0}, {recovery, D}]`. For a simple strike `cooldown`
 *   equals the total; for a charge-up the two may differ.
 * - `cooldownKey` — the key in `unit.actionCooldowns`, `action.id` by default.
 *   An ability passes its own id, so a unit's abilities keep separate
 *   cooldowns though they share one action class.
 */
export interface ActionProposal {
  readonly action: Action;
  readonly score: number;
  readonly cooldown: number;
  readonly phases: readonly ActionPhase[];
  readonly cooldownKey?: string;
}

/**
 * Set on a unit while an action is under way. The busy window runs from
 * `startTick` to `finishTick`, the unit free again once `currentTick >=
 * finishTick`. `World.tick()` emits `action:phase` at each phase boundary (the
 * offset where a phase begins) and fires `applyEffect` at `impact`. The current
 * phase is derived from `currentTick - startTick` against `phases`, so a
 * snapshot taken mid-action resumes on the right phase.
 */
export interface ActiveAction {
  readonly action: Action;
  readonly startTick: number;
  readonly finishTick: number;
  readonly phases: readonly ActionPhase[];
}

/** A timeline's whole busy window: the sum of its phases' ticks. */
export function totalTicks(phases: readonly ActionPhase[]): number {
  let n = 0;
  for (const p of phases) n += p.ticks;
  return n;
}

/**
 * The phases that begin at `offset`, in order. A phase begins at the sum of the
 * phases before it, and a 0-tick phase shares its offset with the next, so one
 * offset can return several, which fire on the same tick (a shot's `release`
 * and `travel` at the end of its wind-up).
 */
export function phasesBeginningAt(
  phases: readonly ActionPhase[],
  offset: number,
): ActionPhaseName[] {
  const out: ActionPhaseName[] = [];
  let acc = 0;
  for (const p of phases) {
    if (acc === offset) out.push(p.phase);
    acc += p.ticks;
  }
  return out;
}
