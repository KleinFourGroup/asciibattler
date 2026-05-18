import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { AttackAction } from '../actions/AttackAction';
import { findTarget } from '../Targeting';

/**
 * Proposes a melee/ranged strike on the nearest enemy in attack range.
 * Abstains (returns null) when no enemy is reachable. Scores higher than
 * MovementBehavior so a unit that's just stepped into range prefers
 * attacking over taking another step.
 *
 * Score 10 — comfortably above MovementBehavior's 1. The gap leaves
 * headroom for future behaviors (e.g. a healer that scores higher than
 * attack when an ally is critical).
 */
export class AttackBehavior implements Behavior {
  static readonly kind = 'attack';
  readonly kind = AttackBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const target = findTarget(unit, world);
    if (target === null) return null;
    if (chebyshev(unit.position, target.position) > unit.stats.attackRange) return null;

    const damage = unit.stats.attackDamage;
    const durationTicks = unit.stats.attackCooldownTicks;

    return {
      action: new AttackAction(target, damage),
      score: 10,
      cooldown: durationTicks,
      duration: durationTicks,
    };
  }
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
