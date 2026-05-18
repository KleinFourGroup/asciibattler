import type { Unit } from './Unit';
import type { World } from './World';

/**
 * An action is the "verb" a unit performs on a tick: move one cell, swing
 * the sword, channel a heal. Actions are stateless singletons — the same
 * `MOVE_ACTION` is shared across every unit that can move. Per-unit timing
 * (cooldowns, durations, effect-tick offsets) is carried by `ActionProposal`,
 * not the Action itself, because per-unit stat rolls vary those numbers.
 *
 * For most actions, `start` does all the work (logical position update,
 * damage, event emission). Multi-tick actions (charge attacks, channelled
 * heals) use `applyEffect` for work that lands later in the action's
 * lifetime — see `effectTicks` on `ActionProposal`.
 */
export interface Action {
  readonly id: string;
  start(unit: Unit, world: World): void;
  applyEffect?(unit: Unit, world: World, tickOffset: number): void;
}

/**
 * A behavior's offer to the action selector. Carries the per-unit timing
 * (cooldown, duration, effectTicks) so Action singletons stay stat-free.
 *
 * - `cooldown`: ticks before *this same* action can be proposed again.
 *   Decremented once per tick by World; selector filters out proposals
 *   whose remaining cooldown is > 0.
 * - `duration`: ticks the unit is busy after the action starts. While
 *   busy, no proposal — for this action or any other — can fire. For
 *   simple single-tick actions (move, basic attack) `cooldown` and
 *   `duration` are equal; for charge-ups they may differ.
 * - `effectTicks`: tick offsets (measured from start) at which
 *   `Action.applyEffect` should fire. Empty/omitted for actions that
 *   complete all work in `start`.
 */
export interface ActionProposal {
  readonly action: Action;
  readonly score: number;
  readonly cooldown: number;
  readonly duration: number;
  readonly effectTicks?: readonly number[];
}

/**
 * Set on a unit while an action is in flight. The action's `duration`
 * window runs from `startTick` to `finishTick` (exclusive of finish:
 * `currentTick >= finishTick` means the unit is free again). World.tick()
 * fires `applyEffect` whenever `currentTick - startTick` matches an entry
 * in `effectTicks`.
 */
export interface ActiveAction {
  readonly action: Action;
  readonly startTick: number;
  readonly finishTick: number;
  readonly effectTicks: readonly number[];
}
