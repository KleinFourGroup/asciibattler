/**
 * A unit's behaviour overrides, folded from its statuses. The status holds no
 * AI logic: a status def authors a `behavior` block (`effects/statusSchema.ts`),
 * and the decision points read the folded flags where they decide and change
 * what they propose (`AbilityBehavior`, `MovementBehavior`,
 * `CampWanderBehavior`, `Targeting`, the interpreter). This module is the pure
 * fold of a unit's live `effects` into one `BehaviorFlags`.
 *
 * The block is read off `STATUS_DEFS[key]` here, never serialized: a
 * `StatusEffect` carries only its `key`, so a behaviour status adds no state to
 * a snapshot.
 *
 * A plain stat effect (fatigued, honed; no catalog entry) and a status with no
 * `behavior` block (burn) contribute nothing. When no effect has a block, the
 * fold returns the shared `NEUTRAL`, so the common case allocates nothing.
 */

import { STATUS_DEFS } from '../config/statuses';
import type { StatusEffect } from './statusEffects';

/**
 * The overrides on a unit this tick. Each consumer reads the field it owns:
 *
 * - `preventsAttack` — `AbilityBehavior` proposes no ability.
 * - `preventsMove` — the movement behaviours propose no step.
 * - `movement` — `MovementBehavior`'s goal (`flee` or `wander`).
 * - `targeting` — `Targeting` picks a random unit of any team.
 * - `acquisitionRange` — `Targeting`'s cap on acquisition reach.
 * - `affects` — the interpreter's override of the unit's area attacks.
 */
interface BehaviorFlags {
  preventsAttack: boolean;
  preventsMove: boolean;
  /** The movement goal, or `null` for the normal pursuit. */
  movement: 'flee' | 'wander' | null;
  /** `'random'` for a random target of any team, or `null`. */
  targeting: 'random' | null;
  /** The cap on acquisition reach in cells, or `null` for the unit's own. */
  acquisitionRange: number | null;
  /** `'all'` when the unit's area attacks hit every team, or `null`. */
  affects: 'all' | null;
}

/** No overrides: the shared, frozen value returned when nothing applies. */
const NEUTRAL: BehaviorFlags = Object.freeze({
  preventsAttack: false,
  preventsMove: false,
  movement: null,
  targeting: null,
  acquisitionRange: null,
  affects: null,
});

export { NEUTRAL as NEUTRAL_BEHAVIOR };

/**
 * A unit's effects folded into one `BehaviorFlags`, each effect's block read off
 * `STATUS_DEFS[key]`:
 *
 * - `preventsAttack`, `preventsMove`, `targeting`, `affects` — any contributor
 *   sets them; each has one value.
 * - `movement` — `flee` outranks `wander` (fleeing in panic is more urgent than
 *   wandering blind), so the order of the effects does not matter.
 * - `acquisitionRange` — the smallest cap wins; two sources never widen it.
 *
 * Returns the shared `NEUTRAL` when no effect has a block, so callers treat the
 * result as read-only.
 */
export function behaviorFlags(effects: readonly StatusEffect[]): BehaviorFlags {
  let out: BehaviorFlags | null = null;
  for (const effect of effects) {
    const behavior = STATUS_DEFS[effect.key]?.behavior;
    if (!behavior) continue;
    if (out === null) out = { ...NEUTRAL };
    if (behavior.preventsAttack) out.preventsAttack = true;
    if (behavior.preventsMove) out.preventsMove = true;
    if (behavior.movement && out.movement !== 'flee') out.movement = behavior.movement;
    if (behavior.targeting) out.targeting = behavior.targeting;
    if (behavior.acquisitionRange !== undefined) {
      out.acquisitionRange =
        out.acquisitionRange === null
          ? behavior.acquisitionRange
          : Math.min(out.acquisitionRange, behavior.acquisitionRange);
    }
    if (behavior.affects) out.affects = behavior.affects;
  }
  return out ?? NEUTRAL;
}
