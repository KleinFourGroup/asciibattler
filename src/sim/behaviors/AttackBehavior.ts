import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import { findTarget } from '../Targeting';

/**
 * Per-unit attack. Reads `unit.actionCooldown` (shared with MovementBehavior)
 * and only acts when it's 0 and the nearest enemy is within attack range —
 * so a unit that just moved is locked out until its move cooldown elapses,
 * giving "first hit after the charge" some weight.
 *
 * Death is not handled here — when `target.currentHp` drops to 0 or below
 * the target becomes invisible to Targeting; DeathBehavior (Step 3.8) takes
 * it off the grid.
 */
export class AttackBehavior implements Behavior {
  update(unit: Unit, world: World): void {
    if (unit.currentHp <= 0) return;
    if (unit.actionCooldown > 0) return;

    const target = findTarget(unit, world);
    if (target === null) return;
    if (chebyshev(unit.position, target.position) > unit.stats.attackRange) return;

    const damage = unit.stats.attackDamage;
    target.currentHp -= damage;
    unit.actionCooldown = unit.stats.attackCooldownTicks;
    world.emit('unit:attacked', {
      attackerId: unit.id,
      targetId: target.id,
      damage,
    });
  }
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
