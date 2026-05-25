import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const SPAWN_ACTION_ID = 'spawn';

/**
 * Multi-tick lockout an overflow-queue unit performs as its first
 * "action" after being placed on the grid. The selector's standard
 * `activeAction` short-circuit (see World.tick step 3) keeps the unit
 * from proposing during the lockout; no effect work happens here.
 *
 * Set directly by `World.spawnFromQueue` rather than proposed by a
 * Behavior — the unit's selector never sees a SpawnAction, it just sees
 * activeAction already populated when it first appears in the per-unit
 * step.
 *
 * Renderer-side, BattleRenderer keys off the `instant: false` flag on
 * `unit:spawned` to lerp alpha 0 → 1 over the same duration; the fade
 * is purely wall-clock and is not driven by this action's effects.
 *
 * Pure-data action — no parameters to serialize. The registry factory
 * returns a fresh instance on rehydrate; `activeAction.startTick` /
 * `finishTick` carry the lockout window.
 */
export class SpawnAction implements Action {
  readonly id = SPAWN_ACTION_ID;

  start(_unit: Unit, _world: World): void {}

  toData(): Record<string, never> {
    return {};
  }

  static fromData(): SpawnAction {
    return new SpawnAction();
  }
}
