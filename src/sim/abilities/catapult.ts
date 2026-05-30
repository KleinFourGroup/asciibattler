import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { CatapultShotAction } from '../actions/CatapultShotAction';
import { currentTarget } from '../Targeting';
import { catapultShotDamage, attackCooldownTicksFor } from '../stats';
import { abilityConfig } from '../../config/abilities';
import type { Ability } from './Ability';
import type { GridCoord } from '../../core/types';

/**
 * E7.D — the catapult's only ability. A slow, telegraphed wind-up that lobs
 * a single heavy shot at a locked target.
 *
 * The propose path is the ranged strike's MINUS the line-of-sight gate: the
 * catapult lobs an arcing shot OVER walls (E7.D decision — "ignores LOS"),
 * so it commits the moment a target is within range regardless of what's
 * between them. Find the committed target (`currentTarget`), gate on the
 * ability's own range, and propose — no `hasLineOfSight` check, unlike
 * `RangedShot`/`MagicBolt`.
 *
 * `ignoresLineOfSight = true` tells `MovementBehavior` the same thing: when
 * in range, abstain (let this fire) even with no LOS, instead of creeping
 * forward to clear a wall it doesn't need cleared.
 *
 * Multi-tick like the mage: `duration` is the full wind-up (cadence × speed
 * via `attackCooldownTicksFor`) and `effectTicks: [duration]` lands the shot
 * on the tick the charge completes, filling the action-progress bar.
 * `cooldown == duration`, so the catapult re-winds immediately after each
 * shot (a perpetual siege engine).
 *
 * The target is captured as the LIVE unit (homing) — `CatapultShotAction`
 * holds the reference and resolves damage at impact. Score is 10, same as
 * the strikes, enough to beat `MovementBehavior`'s 1.
 */
export class CatapultShot implements Ability {
  static readonly id = 'catapult_shot';
  readonly id = CatapultShot.id;
  // E7.D — declares this unit needs no LOS to engage. Read by
  // `MovementBehavior`'s in-range abstain (see there).
  readonly ignoresLineOfSight = true;

  propose(unit: Unit, world: World): ActionProposal | null {
    const cfg = abilityConfig(this.id);

    const target = currentTarget(unit, world);
    if (target === null) return null;
    if (chebyshev(unit.position, target.position) > cfg.range) return null;

    // No LOS gate — the arcing shot ignores walls.

    const baseDamage = catapultShotDamage(unit);
    const durationTicks = attackCooldownTicksFor(cfg.cooldownSeconds, unit.stats.speed);

    return {
      action: new CatapultShotAction(
        target,
        baseDamage,
        unit.derived.critChance,
        { ...target.position },
      ),
      score: 10,
      cooldown: durationTicks,
      duration: durationTicks,
      effectTicks: [durationTicks],
      cooldownKey: this.id,
    };
  }
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
