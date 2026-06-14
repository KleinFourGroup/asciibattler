import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { CatapultShotAction } from '../actions/CatapultShotAction';
import { currentTarget } from '../Targeting';
import { catapultShotDamage, attackCooldownTicksFor, critChanceFor } from '../stats';
import { secondsToTicks } from '../../config';
import { attackConfig } from '../../config/abilities';
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
    const cfg = attackConfig(this.id);

    const target = currentTarget(unit, world);
    if (target === null) return null;
    if (chebyshev(unit.position, target.position) > cfg.range) return null;

    // No LOS gate — the arcing shot ignores walls.

    // I6 — `might + ranged`; crit per-weapon (`critBase + luck`), zeroed when
    // the shot is not `critable`. The shot stays unmissable (`cfg.evadable`
    // false) — counterplay is killing the slow caster mid-charge, not dodging.
    const baseDamage = catapultShotDamage(unit, cfg.might);
    // K1 — crit + cadence read `effectiveStats` (luck / speed); identity-equal
    // to `stats` when the caster has no effects.
    const critChance = cfg.critable ? critChanceFor(cfg.critBase, unit.effectiveStats.luck) : 0;
    const durationTicks = attackCooldownTicksFor(cfg.cooldownSeconds, unit.effectiveStats.speed);
    // F3 — carve the boulder's flight OUT of the wind-up so it travels
    // *during* the charge and lands on the impact tick (the renderer launches
    // it on `release`). `min(..., durationTicks)` keeps `windupTicks >= 0`;
    // Σ(windup, travel) == durationTicks, so the impact offset, busy window,
    // and cooldown are all unchanged vs the F2 zero-travel shape.
    const travelTicks = Math.min(secondsToTicks(cfg.travelSeconds ?? 0), durationTicks);
    const windupTicks = durationTicks - travelTicks;

    return {
      action: new CatapultShotAction(
        target,
        baseDamage,
        critChance,
        { ...target.position },
      ),
      score: 10,
      cooldown: durationTicks,
      // F3 — charge for `windupTicks`, then loose (`release`) and let the
      // boulder arc for `travelTicks` before the hit (`applyEffect`) lands at
      // `impact` (offset durationTicks — exactly where F2's zero-travel impact
      // fired). `release` is the renderer's launch cue.
      phases: [
        { phase: 'windup', ticks: windupTicks },
        { phase: 'release', ticks: 0 },
        { phase: 'travel', ticks: travelTicks },
        { phase: 'impact', ticks: 0 },
      ],
      cooldownKey: this.id,
    };
  }
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
