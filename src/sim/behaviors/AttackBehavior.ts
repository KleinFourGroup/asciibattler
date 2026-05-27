import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { AttackAction } from '../actions/AttackAction';
import { findTarget } from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { basicAttackDamage } from '../stats';

/**
 * Proposes a melee/ranged strike on the nearest enemy in attack range.
 * Abstains (returns null) when no enemy is reachable. Scores higher than
 * MovementBehavior so a unit that's just stepped into range prefers
 * attacking over taking another step.
 *
 * Score 10 — comfortably above MovementBehavior's 1. The gap leaves
 * headroom for future behaviors (e.g. a healer that scores higher than
 * attack when an ally is critical).
 *
 * C1b: ranged attacks require a clear line of sight through walls. Melee
 * (adjacent target) trivially passes — there are no intermediate cells —
 * but the check runs uniformly so future short-range AoE / cone attacks
 * pick up the same gate.
 *
 * D6: LOS blockers are gathered via per-Unit `blocksLineOfSight` — walls
 * stay in (default `true`), half-cover (`false`) is filtered out so
 * ranged units shoot OVER it.
 *
 * E1: damage + cooldown come from `unit.derived` (precomputed from stats
 * at spawn time) and `basicAttackDamage` (per-archetype stat lookup —
 * melee → strength, ranged → ranged). Crit is rolled at start-time in
 * AttackAction via `world.combatRng`; the proposal just carries the
 * base damage + derived crit probability.
 */
export class AttackBehavior implements Behavior {
  static readonly kind = 'attack';
  readonly kind = AttackBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const target = findTarget(unit, world);
    if (target === null) return null;
    if (chebyshev(unit.position, target.position) > unit.derived.attackRange) return null;

    const blockers = collectLosBlockers(world);
    if (blockers.length > 0 && !hasLineOfSight(unit.position, target.position, blockers)) {
      return null;
    }

    const baseDamage = basicAttackDamage(unit);
    const durationTicks = unit.derived.attackCooldownTicks;

    return {
      action: new AttackAction(target, baseDamage, unit.derived.critChance),
      score: 10,
      cooldown: durationTicks,
      duration: durationTicks,
    };
  }
}

function collectLosBlockers(world: World): GridCoord[] {
  const blockers: GridCoord[] = [];
  for (const u of world.units) {
    if (u.team === 'neutral' && u.blocksLineOfSight) blockers.push(u.position);
  }
  return blockers;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
