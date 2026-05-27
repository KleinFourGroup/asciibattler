import type { Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { AttackAction } from '../actions/AttackAction';
import { findTarget } from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { basicAttackDamage } from '../stats';
import type { Ability } from './Ability';

/**
 * The pre-E2 `AttackBehavior` propose path, generalized over ability id.
 * Both `MeleeStrike` and `RangedShot` share this — they differ only in
 * the registry id they wear (and indirectly through `basicAttackDamage`
 * picking strength vs. ranged via the unit's archetype).
 *
 * Half-cover damage attenuation deferred to E4 (the multiplier needs to
 * be tuned alongside the rest of the stat curve, not in isolation). The
 * LOS-blocker collection here already filters half-covers (`blocksLineOfSight`
 * false) the same way pre-E2 `AttackBehavior` did — D6's contract is
 * preserved exactly.
 *
 * The proposal score is 10 — same as pre-E2 — chosen so AbilityBehavior's
 * basic-strike proposal beats MovementBehavior's 1. Future per-ability
 * scoring (e.g. a clustering-aware AoE) returns its own value here.
 */
function proposeBasicStrike(
  unit: Unit,
  world: World,
  abilityId: string,
): ActionProposal | null {
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
    cooldownKey: abilityId,
  };
}

export class MeleeStrike implements Ability {
  static readonly id = 'melee_strike';
  readonly id = MeleeStrike.id;
  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeBasicStrike(unit, world, this.id);
  }
}

export class RangedShot implements Ability {
  static readonly id = 'ranged_shot';
  readonly id = RangedShot.id;
  propose(unit: Unit, world: World): ActionProposal | null {
    return proposeBasicStrike(unit, world, this.id);
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
