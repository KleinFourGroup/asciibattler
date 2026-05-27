import type { Ability } from './Ability';
import { MeleeStrike, RangedShot } from './strikes';

/**
 * Ability factories keyed by `Ability.id`. `World.fromJSON` uses these
 * to rehydrate each unit's `abilities` list from a snapshot; the
 * archetype-config schema (`src/config/archetypes.ts`) validates that
 * every ability id declared on an archetype resolves here at boot.
 *
 * Pattern mirrors `behaviors/registry.ts` — abilities are stateless in
 * E2, so factories are zero-arg. If a future ability gains per-instance
 * state (charge-up progress, channelled-heal target lock), change its
 * factory signature to take a snapshot blob and add a `toData()` method
 * on the ability class (mirrors `actions/registry.ts`).
 */
export type AbilityFactory = () => Ability;

const FACTORIES: Record<string, AbilityFactory> = {
  [MeleeStrike.id]: () => new MeleeStrike(),
  [RangedShot.id]: () => new RangedShot(),
};

export function createAbility(id: string): Ability {
  const factory = FACTORIES[id];
  if (!factory) {
    throw new Error(`createAbility: no factory registered for ability id '${id}'`);
  }
  return factory();
}

export function knownAbilityIds(): readonly string[] {
  return Object.keys(FACTORIES);
}
