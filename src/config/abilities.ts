/**
 * E5 pre-work — per-ability tunables. Source of truth at
 * `config/abilities.json`.
 *
 * Before this module, every basic strike's cadence came from the single
 * global `STATS.baseAttackCooldownSeconds`, so melee and ranged could
 * only diverge through the `speed` stat — you couldn't make a sword
 * swing faster than a bow fires without also re-pointing the whole stat
 * curve. Cadence now lives per ability: each entry's `cooldownSeconds`
 * is the base attack interval, still modulated by the unit's `speed`
 * via `cooldownScale` at propose time (see `attackCooldownTicksFor` in
 * [src/sim/stats.ts](src/sim/stats.ts)).
 *
 * Deliberately minimal for now: only `cooldownSeconds`. Damage stays
 * hard-coded in `basicAttackDamage` because a single `damageStat` field
 * would misrepresent future abilities that scale on several stats — the
 * expressive damage-formula JSON is a later step, designed when there's
 * a real multi-stat consumer to design against.
 *
 * A4 pattern: parse at module load, throw on malformed JSON. The
 * registry ([src/sim/abilities/registry.ts](src/sim/abilities/registry.ts))
 * cross-checks at boot that this config and the ability factories cover
 * exactly the same id set — a registered ability with no cadence, or a
 * cadence for an unregistered ability, is a loud boot failure.
 */

import { z } from 'zod';
import abilitiesJson from '../../config/abilities.json';

const AbilitySchema = z.object({
  cooldownSeconds: z.number().positive(),
});

const AbilitiesSchema = z.record(z.string(), AbilitySchema);

export type AbilityConfig = z.infer<typeof AbilitySchema>;

export const ABILITIES: Record<string, AbilityConfig> =
  AbilitiesSchema.parse(abilitiesJson);

/**
 * Look up an ability's tunables by registry id, throwing if absent. The
 * registry boot-check guarantees presence for every registered ability,
 * so a throw here means a caller passed an id that was never registered
 * — a programming error, surfaced loudly rather than silently defaulted.
 */
export function abilityConfig(id: string): AbilityConfig {
  const cfg = ABILITIES[id];
  if (!cfg) {
    throw new Error(`abilityConfig: no config entry for ability id '${id}'`);
  }
  return cfg;
}
