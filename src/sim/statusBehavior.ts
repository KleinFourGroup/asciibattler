/**
 * §28 — the BEHAVIOR-axis def-resolve.
 *
 * The status system holds NO AI logic (the brief's "decision-hooks, not
 * reach-in"). A behavior status (frozen/blind/panic/confusion) authors a
 * `StatusDef.behavior` block (`effects/statusSchema.ts`); the existing AI
 * consumers — the action-selector (`World.tick`), `MovementBehavior`,
 * `Targeting` — READ the resolved flags at their own decision points and change
 * what they propose. This module is the pure fold that turns a unit's live
 * `effects[]` into one merged `BehaviorFlags`.
 *
 * Like the §27 periodic cursor, behavior is **def-resolved by `key`**: the
 * serialized `StatusEffect` carries only its `key`; the `behavior` block lives
 * on `STATUS_DEFS[key]` and is looked up here, NOT serialized. So §28 adds no
 * per-unit snapshot state — no `WorldSnapshot` bump (it stays v27).
 *
 * Plain K1 effects (fatigued/empowered — no `STATUS_DEFS` entry) and periodic-
 * only statuses (burn — a def, but no `behavior`) contribute nothing; only the
 * four behavior statuses move the flags. The no-behavior common case returns the
 * shared `NEUTRAL` singleton (zero allocation, identity-stable).
 */

import { STATUS_DEFS } from '../config/statuses';
import type { StatusEffect } from './statusEffects';

/**
 * The merged behavior overrides active on a unit this tick. A consumer reads the
 * one field it owns:
 *   - `preventsAttack` / `preventsMove` — the selector / `MovementBehavior` skip.
 *   - `movement` — the `MovementBehavior` goal override (`flee` / `wander`).
 *   - `targeting` — `Targeting` picks a random-team mark (confusion).
 *   - `acquisitionRange` — `Targeting` caps the acquisition reach (blind).
 *   - `affects` — the interpreter forces this unit's attacks to friendly-fire.
 */
export interface BehaviorFlags {
  preventsAttack: boolean;
  preventsMove: boolean;
  /** The movement-goal override, or `null` for normal pursuit. */
  movement: 'flee' | 'wander' | null;
  /** `'random'` forces random-team target selection, or `null` for normal. */
  targeting: 'random' | null;
  /** The acquisition-reach cap in cells, or `null` for the unit's normal reach. */
  acquisitionRange: number | null;
  /** A forced friendly-fire override for this unit's attacks, or `null`. */
  affects: 'all' | null;
}

/** The no-override flags — returned (shared, frozen) when nothing applies. */
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
 * Fold a unit's active effects into its merged `BehaviorFlags`. Resolves each
 * effect's `behavior` block from `STATUS_DEFS[key]` (def-resolve) and combines:
 *   - `preventsAttack` / `preventsMove` / `targeting` / `affects` — OR / set-once
 *     (any contributor wins; the values are single-valued).
 *   - `movement` — `flee` outranks `wander` (panic's flee is more urgent than
 *     blind's wander), so the merge is order-independent.
 *   - `acquisitionRange` — the MIN across contributors (the most restrictive cap
 *     wins; two blinding sources don't widen the reach).
 *
 * Returns the shared `NEUTRAL` when no effect carries a behavior block (the
 * overwhelmingly common case) — callers must treat the result as read-only.
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
