import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { MagicBoltAction } from '../actions/MagicBoltAction';
import { currentTarget, collectLosBlockers } from '../Targeting';
import { hasLineOfSight } from '../LineOfSight';
import { magicBoltDamage, attackCooldownTicksFor, critChanceFor } from '../stats';
import { secondsToTicks } from '../../config';
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
    // I6 — `might + magic`; crit per-weapon (`critBase + luck`), zeroed when the
    // bolt is not `critable`. The blast stays unmissable (`cfg.evadable` false),
    // so no `accuracy` threads in — area denial is dodged positionally.
    const baseDamage = magicBoltDamage(unit, cfg.might);
    // K1 — crit + cadence read `effectiveStats` (luck / speed); identity-equal
    // to `stats` when the caster has no effects.
    const critChance = cfg.critable ? critChanceFor(cfg.critBase, unit.effectiveStats.luck) : 0;
    const durationTicks = attackCooldownTicksFor(cfg.cooldownSeconds, unit.effectiveStats.speed);
    // F3 — carve the bolt's flight OUT of the charge so it travels *during* the
    // wind-up and detonates on the impact tick (the renderer launches it on
    // `release`). `min(..., durationTicks)` keeps `windupTicks >= 0`;
    // Σ(windup, travel) == durationTicks, so the impact offset, busy window,
    // and cooldown are all unchanged vs the F2 zero-travel shape.
    const travelTicks = Math.min(secondsToTicks(cfg.travelSeconds ?? 0), durationTicks);
    const windupTicks = durationTicks - travelTicks;

    return {
      action: new MagicBoltAction(
        center,
        baseDamage,
        critChance,
        cfg.aoe.radius,
        cfg.aoe.ringMultiplier,
      ),
      score: 10,
      cooldown: durationTicks,
      // F3 — charge for `windupTicks`, then release the bolt (`release`) and let
      // it fly for `travelTicks` before the blast (`applyEffect`) detonates at
      // `impact` (offset durationTicks — exactly where F2's zero-travel impact
      // fired). The mage gains `release`/`travel` it lacked in F2; `release` is
      // the renderer's launch cue.
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
