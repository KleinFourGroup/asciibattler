import type { ActionProposal } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';
import type { Aura } from '../effects/schema';

/**
 * A unit's ability. Each tick `AbilityBehavior` asks every entry in
 * `unit.abilities` to `propose`, and returns null to abstain; how the
 * proposals are ranked is documented there. The one implementation,
 * `EffectAbility`, scores a proposal with its def's `priority`
 * (`config/abilities.json`).
 *
 * A proposal carries `cooldownKey: id`, so each ability on a unit has its own
 * entry in `unit.actionCooldowns`.
 *
 * `id` is the `AbilityDef` id and the key `createAbility`
 * (`src/sim/abilities/registry.ts`) rehydrates a snapshot's ability list by.
 * The registry asserts at load that its ids and the config's match.
 */
export interface Ability {
  readonly id: string;
  propose(unit: Unit, world: World): ActionProposal | null;
  /**
   * True when the ability fires without line of sight (the catapult's lobbed
   * shot). The positioning protocol reads it (`unitIgnoresLos` in
   * `positioning.ts`): such a unit tests its firing band on range alone, so it
   * holds and fires once in range instead of walking to clear a wall. Absent
   * on every line-of-sight-gated ability.
   */
  readonly ignoresLineOfSight?: boolean;
  /**
   * The def's aura, surfaced so `World.applyAuraStatuses` can find aura
   * carriers through `unit.abilities` without reaching into `EffectAbility`'s
   * private def. Absent on every non-aura ability.
   */
  readonly aura?: Aura;
}
