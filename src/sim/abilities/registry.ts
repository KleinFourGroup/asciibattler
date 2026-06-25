import type { Ability } from './Ability';
import { ABILITY_DEFS, abilityDef } from '../../config/abilities';
import { STATUS_DEFS, assertStatusRefsResolve } from '../../config/statuses';
import { EffectAbility } from '../effects/EffectAbility';

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

// Every combat verb is a data-driven `EffectAbility` — its `AbilityDef` lives in
// `config/abilities.json`. `createAbility(id)` routes each id to
// `new EffectAbility(abilityDef(id))`; the hand-coded ability + action classes
// were retired across Phase Y (the strangler migration), so this list is
// exhaustive — there is no un-migrated verb. (Each def id equals the verb's id;
// for magic_bolt/catapult_shot that also equals the old action id, which is why
// those colliding action-factory entries were dropped — see actions/registry.ts.)
const MIGRATED_ABILITY_IDS = [
  ...MELEE_WEAPON_IDS,
  'bow',
  'heal_ally',
  'gambit_strike',
  'dash',
  'magic_bolt',
  'catapult_shot',
] as const;

// §29 — the new demo-roster verbs (status-on-hit / chain / summon). NET-NEW
// data-driven abilities (not Phase-Y migrations), but the SAME generic
// `EffectAbility` factory — each is just an `AbilityDef` in config/abilities.json.
// Append one per archetype commit as the roster lands.
const DEMO_ABILITY_IDS = [
  'cleaver', // 29a — bleed-on-hit melee
  // 29b — the afflicter disruptors (status-on-hit AoE / ranged).
  'vial', // poison
  'ice_storm', // frozen
  'hex', // confusion
  'light_ray', // blind
  'wail', // panic
  'chain_lightning', // 29c — chain (arcs to N nearest, falloff per hop)
  // 29d — the summon consumers.
  'raise_dead', // the Shaman's caster-anchored summon
  'ghoul_claw', // the summoned Ghoul's basic melee
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
 * A4 boot validation: the ability factories and the `config/abilities.json`
 * catalog (`ABILITY_DEFS`) must cover exactly the same id set. A registered
 * ability with no def (or a def for an ability that was never registered) is a
 * wiring mistake — fail loudly at module load rather than at the first propose
 * tick or, worse, with a silent default the user explicitly didn't want. Mirrors
 * the archetype-abilities check in `src/config/archetypes.ts`.
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
  // Phase 27 — every `applyStatus` op (§29) must reference a real status id.
  // Rides this guaranteed-at-boot IIFE so a typo fails at startup, not at cast.
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
