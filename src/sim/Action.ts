import type { Unit } from './Unit';
import type { World } from './World';

/**
 * An action is the "verb" a unit performs on a tick: move one cell, swing
 * the sword, channel a heal. Per-unit timing (cooldowns, durations,
 * effect-tick offsets) is carried by `ActionProposal`, not the Action
 * itself, because per-unit stat rolls vary those numbers. Move/Attack
 * capture their other parameters (target unit, dest cell, damage) on the
 * instance at propose time, since those vary per call.
 *
 * For most actions, `start` does all the work (logical position update,
 * damage, event emission). Multi-tick actions (charge attacks, channelled
 * heals) use `applyEffect` for work that lands later in the action's
 * lifetime — see `effectTicks` on `ActionProposal`.
 *
 * `toData()` returns the plain-JSON payload sufficient to reconstruct this
 * Action via its registered factory (see `src/sim/actions/registry.ts`).
 * Needed for `World` snapshots — when a unit's `activeAction` is in flight
 * mid-tick, the snapshot has to carry enough state for future `applyEffect`
 * calls after rehydrate.
 */
export interface Action {
  readonly id: string;
  start(unit: Unit, world: World): void;
  applyEffect?(unit: Unit, world: World, tickOffset: number): void;
  toData(): unknown;
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
 * - `cooldownKey` (E2): selector key for `unit.actionCooldowns`. Defaults
 *   to `action.id` (the pre-E2 behavior); abilities override with their
 *   own id so a multi-ability unit gets independent cooldowns even when
 *   two abilities wrap the same Action class.
 */
export interface ActionProposal {
  readonly action: Action;
  readonly score: number;
  readonly cooldown: number;
  readonly duration: number;
  readonly effectTicks?: readonly number[];
  readonly cooldownKey?: string;
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
