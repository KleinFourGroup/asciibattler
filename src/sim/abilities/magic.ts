import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { MagicBoltAction } from '../actions/MagicBoltAction';
import { currentTarget, collectLosBlockers } from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { magicBoltDamage, attackCooldownTicksFor } from '../stats';
import { abilityConfig } from '../../config/abilities';
import type { Ability } from './Ability';
import type { GridCoord } from '../../core/types';

/**
 * E7.C — the mage's only ability. A charged, ground-targeted area blast.
 *
 * Propose path mirrors the ranged strike's reach + sight gating — find the
 * committed target (`currentTarget`), gate on the ability's own range, and
 * abstain if a wall breaks line of sight (a bolt can't be lobbed through
 * stone). When it clears, it captures the target's CURRENT cell as the
 * blast center and proposes a `MagicBoltAction`. Because the selector calls
 * `start` on the same tick it proposes, that captured cell is the target's
 * position at cast START — the ground-target the blast commits to before
 * the ~2s charge (E7.C decision: telegraphed, can whiff if the cluster
 * scatters).
 *
 * The multi-tick shape is what sets this apart from every other ability so
 * far: `duration` is the full charge (cadence × speed via
 * `attackCooldownTicksFor`, same curve the strikes use) and
 * `effectTicks: [duration]` lands the blast on the tick the charge
 * completes — exercising A1's `applyEffect` path and the action progress
 * bar for the first time. `cooldown == duration`, so the mage re-charges
 * immediately after each detonation (a perpetual channeler).
 *
 * Score is 10 — same as the strikes — enough to beat MovementBehavior's 1.
 * (A clustering-aware score that bumps when N enemies fall under the blast
 * is a documented future option; the mage carries only this one offensive
 * ability today, so the relative score doesn't yet matter.)
 */
export class MagicBolt implements Ability {
  static readonly id = 'magic_bolt';
  readonly id = MagicBolt.id;

  propose(unit: Unit, world: World): ActionProposal | null {
    const cfg = abilityConfig(this.id);
    if (!cfg.aoe) {
      // Config invariant: magic_bolt must declare its blast shape. A loud
      // throw (A4 style) beats a silent default the designer didn't intend.
      throw new Error(`MagicBolt: ability '${this.id}' has no aoe config`);
    }

    const target = currentTarget(unit, world);
    if (target === null) return null;
    if (chebyshev(unit.position, target.position) > cfg.range) return null;

    // LOS gate (mirrors the ranged strike): a wall on the line blocks the
    // cast, so MovementBehavior keeps pathing for a clear shot instead of
    // the unit freezing in a mutual abstain.
    const blockers = collectLosBlockers(world);
    if (blockers.length > 0 && !hasLineOfSight(unit.position, target.position, blockers)) {
      return null;
    }

    const center: GridCoord = { ...target.position };
    const baseDamage = magicBoltDamage(unit);
    const durationTicks = attackCooldownTicksFor(cfg.cooldownSeconds, unit.stats.speed);

    return {
      action: new MagicBoltAction(
        center,
        baseDamage,
        unit.derived.critChance,
        cfg.aoe.radius,
        cfg.aoe.ringMultiplier,
      ),
      score: 10,
      cooldown: durationTicks,
      // F2 — charge for the whole wind-up, then detonate at impact. The blast
      // (`applyEffect`) lands at offset `durationTicks` — exactly where the
      // pre-F2 `effectTicks:[durationTicks]` fired.
      phases: [
        { phase: 'windup', ticks: durationTicks },
        { phase: 'impact', ticks: 0 },
      ],
      cooldownKey: this.id,
    };
  }
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
