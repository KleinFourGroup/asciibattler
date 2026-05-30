import type { Ability } from './Ability';
import { MeleeStrike, RangedShot, GambitStrike } from './strikes';
import { ABILITIES } from '../../config/abilities';

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
  [GambitStrike.id]: () => new GambitStrike(),
};

/**
 * A4 boot validation: the ability factories and `config/abilities.json`
 * must cover exactly the same id set. A registered ability with no
 * cadence config (or a cadence for an ability that was never
 * registered) is a wiring mistake — fail loudly at module load rather
 * than at the first propose tick or, worse, with a silent default the
 * user explicitly didn't want. Mirrors the archetype-abilities check in
 * `src/config/archetypes.ts`.
 */
(function assertAbilityConfigCoverage(): void {
  const factoryIds = Object.keys(FACTORIES);
  const configIds = Object.keys(ABILITIES);
  const missingConfig = factoryIds.filter((id) => !(id in ABILITIES));
  const orphanConfig = configIds.filter((id) => !(id in FACTORIES));
  if (missingConfig.length > 0) {
    throw new Error(
      `abilities registry: no config/abilities.json entry for ${missingConfig.join(', ')}`,
    );
  }
  if (orphanConfig.length > 0) {
    throw new Error(
      `config/abilities.json: entry for unregistered ability id ${orphanConfig.join(', ')}`,
    );
  }
})();

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
