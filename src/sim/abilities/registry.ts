import type { Ability } from './Ability';
import { GambitStrike } from './strikes';
import { MagicBolt } from './magic';
import { CatapultShot } from './catapult';
import { DashAbility } from './dash';
import { ABILITIES } from '../../config/abilities';
import { EffectAbility } from '../effects/EffectAbility';
import { abilityDef } from '../../config/abilityDefs';

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

// I6 — the four melee subclasses each carry a distinct weapon id (their
// `config/abilities.json` profile differs).
const MELEE_WEAPON_IDS = ['sword', 'club', 'katana', 'whip'] as const;

// Phase Y3 — ids whose hand-coded ability class has been strangler-migrated to
// the data-driven `EffectAbility` (its `AbilityDef` lives in
// `config/abilityDefs.json`, proven byte-identical against the determinism
// oracle). `createAbility(id)` routes these to `new EffectAbility(abilityDef(id))`
// instead of the legacy class; the now-unreferenced classes stay registered-
// nowhere until Y5 deletes the lot. Grows one verb per commit (melee first).
const MIGRATED_ABILITY_IDS = [...MELEE_WEAPON_IDS, 'bow', 'heal_ally'] as const;

const FACTORIES: Record<string, AbilityFactory> = {
  ...Object.fromEntries(
    MIGRATED_ABILITY_IDS.map((id) => [id, () => new EffectAbility(abilityDef(id))]),
  ),
  [GambitStrike.id]: () => new GambitStrike(),
  [MagicBolt.id]: () => new MagicBolt(),
  [CatapultShot.id]: () => new CatapultShot(),
  // N1 — the rogue's gap-closer. Registered + configured but on NO archetype
  // yet (commit 3 adds it to the rogue), so it stays byte-identical: the
  // factory is only ever invoked via `createAbility('dash')`, which no spawn or
  // snapshot triggers until the rogue carries it.
  [DashAbility.id]: () => new DashAbility(),
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
  // Phase Y3 — every migrated id must resolve an `AbilityDef` in
  // config/abilityDefs.json. `abilityDef` throws if absent, so a verb added to
  // `MIGRATED_ABILITY_IDS` without its def fails at boot, not at the first spawn.
  for (const id of MIGRATED_ABILITY_IDS) abilityDef(id);
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
