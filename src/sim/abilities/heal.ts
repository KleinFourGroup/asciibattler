import type { Unit } from '../Unit';
import type { World } from '../World';
import type { ActionProposal } from '../Action';
import { HealAction } from '../actions/HealAction';
import { lowestWoundedAlly } from '../Targeting';
import { healAmountFor, attackCooldownTicksFor } from '../stats';
import { abilityConfig } from '../../config/abilities';
import type { Ability } from './Ability';

/**
 * E7.B — the healer's only ability. Picks the lowest-HP wounded ally within
 * the ability's range (`config/abilities.json#heal_ally.range`), self
 * included, and proposes a `HealAction` restoring `healAmountFor(unit)` HP
 * (scales on `magic`). Abstains (null) when nobody in range is hurt — the
 * selector then falls through to `SupportMovementBehavior` for positioning.
 *
 * Mirrors the strike abilities' propose shape: score 10 (so a ready heal
 * beats any movement step), cadence resolved from the ability's own
 * `cooldownSeconds` scaled by the unit's `speed`, and `cooldownKey:
 * 'heal_ally'` so the heal counter stays independent of any other ability
 * the unit might gain later. Unlike the strikes there's no LOS / half-cover
 * gate — healing a friendly unit isn't a line-blocked shot (E7.B call).
 */
export class HealAlly implements Ability {
  static readonly id = 'heal_ally';
  readonly id = HealAlly.id;

  propose(unit: Unit, world: World): ActionProposal | null {
    const range = abilityConfig(this.id).range;
    const target = lowestWoundedAlly(unit, world, range);
    if (target === null) return null;

    const amount = healAmountFor(unit);
    const durationTicks = attackCooldownTicksFor(
      abilityConfig(this.id).cooldownSeconds,
      unit.stats.speed,
    );

    return {
      action: new HealAction(target, amount),
      score: 10,
      cooldown: durationTicks,
      duration: durationTicks,
      cooldownKey: this.id,
    };
  }
}
