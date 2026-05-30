import type { ActionProposal } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

/**
 * E2 — per-unit ability primitive. Each tick `AbilityBehavior` walks
 * `unit.abilities` and asks every `Ability` for a proposal; the highest-
 * scoring proposal wins (ties resolved by config order — first proposer
 * in the array). Score is decided per-ability inside `propose`, not
 * uniformly: the basic-strike abilities all return 10 (mirrors the
 * pre-E2 `AttackBehavior` score), but future abilities can return
 * context-dependent values (e.g. a hypothetical mage AoE returning 15
 * when N enemies cluster). Movement stays at 1 in `MovementBehavior`,
 * unchanged.
 *
 * Cooldown isolation: the returned `ActionProposal` carries
 * `cooldownKey: this.id` so the selector keys per-ability cooldowns on
 * the ability id, not the underlying `Action.id`. Two abilities that
 * both wrap `AttackAction` (e.g. melee_strike + a future cleave_strike
 * on the same multi-ability unit) get independent cooldown counters.
 *
 * `id` is the registry key used by `World` snapshots to rehydrate a
 * unit's abilities after JSON round-trip. New implementations declare a
 * unique string `id` and register a factory in
 * `src/sim/abilities/registry.ts`.
 */
export interface Ability {
  readonly id: string;
  propose(unit: Unit, world: World): ActionProposal | null;
  /**
   * E7.D — when `true`, this ability engages without needing line of sight
   * (e.g. the catapult's arcing shot lobs over walls). `MovementBehavior`'s
   * in-range abstain reads it: a unit carrying an LOS-ignoring ability holds
   * + lets the ability fire the moment it's in range, instead of creeping
   * forward to clear a wall it doesn't need cleared. Absent/false on every
   * line-of-sight-gated ability (strikes, ranged, magic).
   */
  readonly ignoresLineOfSight?: boolean;
}
