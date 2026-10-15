import type { Action } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const SPAWN_ACTION_ID = 'spawn';

/**
 * The lockout a unit joining a battle under way serves as its first action (a
 * unit from the spawn queue, a camp's drip, a summon). World seats it directly
 * (`seatAction`) with one `impact` phase of `SIM.spawnDurationTicks`; no
 * behaviour proposes it, and the unit's selector finds `activeAction` already
 * set and proposes nothing until it ends. It does nothing itself.
 *
 * The renderer fades the glyph in over the same window off `unit:spawned`'s
 * `instant: false`, not off this action.
 *
 * It has no parameters to serialize: the registry builds a fresh one on
 * rehydrate, and `activeAction.startTick` and `finishTick` carry the window.
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
