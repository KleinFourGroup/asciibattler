import type { Ability } from './Ability';
import { ABILITY_DEFS, abilityDef } from '../../config/abilities';
import { STATUS_DEFS, assertStatusRefsResolve } from '../../config/statuses';
import { EffectAbility } from '../effects/EffectAbility';

/**
 * The ability factories, by `Ability.id`. `World.fromJSON` rebuilds each unit's
 * `abilities` from a snapshot through them. Their ids are the ability
 * catalog's (the check below), so the unit catalog (`src/config/units.ts`)
 * checks the ability ids an archetype names against the catalog and never
 * imports this module, which reaches it back (gotcha #114).
 *
 * Abilities are stateless, so a factory takes no arguments, as in
 * `behaviors/registry.ts`. An ability that kept state per instance would need
 * a factory that takes a snapshot blob and a `toData()`, as actions have
 * (`actions/registry.ts`).
 */
type AbilityFactory = () => Ability;

// Every id below is an `AbilityDef` in `config/abilities.json`, built as an
// `EffectAbility`; the coverage check below holds the lists to the catalog.
const MELEE_WEAPON_IDS = ['sword', 'club', 'katana', 'whip'] as const;

const MIGRATED_ABILITY_IDS = [
  ...MELEE_WEAPON_IDS,
  'bow',
  'heal_ally',
  'gambit_strike',
  'dash',
  'magic_bolt',
  'catapult_shot',
] as const;

const DEMO_ABILITY_IDS = [
  'cleaver',
  'vial',
  'ice_storm',
  'hex',
  'light_ray',
  'wail',
  'chain_lightning',
  'raise_dead',
  'ghoul_claw',
  'molotov',
  'pistol',
  'halberd',
  'cane',
  'inspire',
] as const;

const FACTORIES: Record<string, AbilityFactory> = {
  ...Object.fromEntries(
    [...MIGRATED_ABILITY_IDS, ...DEMO_ABILITY_IDS].map((id) => [
      id,
      () => new EffectAbility(abilityDef(id)),
    ]),
  ),
};

/**
 * At module load: the factories and the catalog (`ABILITY_DEFS`) must hold
 * exactly the same ids. A factory with no def, or a def with no factory, is a
 * wiring mistake, so it fails at load rather than at the first propose or with
 * a silent default. The unit catalog makes the matching check for the ability
 * ids its archetypes name (`src/config/units.ts`).
 */
(function assertAbilityDefCoverage(): void {
  const factoryIds = Object.keys(FACTORIES);
  const configIds = Object.keys(ABILITY_DEFS);
  const missingConfig = factoryIds.filter((id) => !(id in ABILITY_DEFS));
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
  // Every `applyStatus` op must name a status in the catalog. It runs here, at
  // load, so a typo fails at startup rather than at cast.
  assertStatusRefsResolve(ABILITY_DEFS, STATUS_DEFS);
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
