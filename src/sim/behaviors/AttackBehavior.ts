import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import { findTarget } from '../Targeting';

/**
 * Per-unit attack. On each tick the cooldown counts down; when it hits 0 and
 * the nearest enemy is within attack range, the attacker deals flat
 * `attackDamage` and emits `unit:attacked`. Death is not handled here — when
 * `target.currentHp` drops to or below 0 the target becomes invisible to
 * Targeting; DeathBehavior (Step 3.8) takes it off the grid.
 *
 * Cooldown lives on the behavior instance (one per unit). The `- 1` after
 * acting is the same idiom MovementBehavior uses — see that file for the
 * reasoning.
 */
export class AttackBehavior implements Behavior {
  private cooldown = 0;

  update(unit: Unit, world: World): void {
    if (this.cooldown > 0) {
      this.cooldown--;
      return;
    }

    const target = findTarget(unit, world);
    if (target === null) return;
    if (chebyshev(unit.position, target.position) > unit.stats.attackRange) return;

    const damage = unit.stats.attackDamage;
    target.currentHp -= damage;
    this.cooldown = unit.stats.attackCooldownTicks - 1;
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
