import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';

/**
 * Removes the unit from the world the tick after its HP reaches 0. Other
 * action behaviors (Movement, Attack) early-return on dead units, so a
 * killed unit silently stops taking actions until DeathBehavior runs on
 * the next tick and cleans it up.
 *
 * Must sit *last* in the behavior chain so the unit's other behaviors have
 * already short-circuited this tick before the unit disappears.
 */
export class DeathBehavior implements Behavior {
  update(unit: Unit, world: World): void {
    if (unit.currentHp > 0) return;
    world.removeUnit(unit.id);
    world.emit('unit:died', { unitId: unit.id });
  }
}
