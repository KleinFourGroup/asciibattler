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
 * E5 — `range` joins `cooldownSeconds` here. Attack range used to be a
 * per-archetype primitive (`config/archetypes.json#attackRange`) fed
 * through `deriveStats`; it now lives per ability, since a multi-ability
 * unit (E7 mage/rogue) can carry a melee swing and a long-range bolt
 * with different reaches. `proposeBasicStrike` gates on the firing
 * ability's own range; a unit's `derived.attackRange` is the MAX over
 * its abilities (its effective engagement range — see `rangeForArchetype`).
 *
 * Damage still stays hard-coded in `basicAttackDamage` because a single
 * `damageStat` field would misrepresent future abilities that scale on
 * several stats — the expressive damage-formula JSON is a later step,
 * designed when there's a real multi-stat consumer to design against.
 *
 * A4 pattern: parse at module load, throw on malformed JSON. The
 * registry ([src/sim/abilities/registry.ts](src/sim/abilities/registry.ts))
 * cross-checks at boot that this config and the ability factories cover
 * exactly the same id set — a registered ability with no cadence, or a
 * cadence for an unregistered ability, is a loud boot failure.
 */

import { z } from 'zod';
import abilitiesJson from '../../config/abilities.json';

/**
 * E7.C — area-of-effect shape for abilities that blast a region instead
 * of hitting a single unit. Optional: only the mage's `magic_bolt`
 * carries it today, so the field is absent on every single-target
 * ability. `radius` is a Chebyshev radius (radius 1 = the 3×3 around the
 * blast center); `ringMultiplier` is the damage factor applied to cells
 * OUTSIDE the center cell (center always takes full damage). Authored as
 * tunable balance per A4 so the blast shape is a JSON edit, not a recompile.
 */
const AoeSchema = z.object({
  radius: z.number().int().positive(),
  ringMultiplier: z.number().min(0).max(1),
});

export type AoeConfig = z.infer<typeof AoeSchema>;

const AbilitySchema = z.object({
  cooldownSeconds: z.number().positive(),
  range: z.number().int().positive(),
  /**
   * F3 — the slice of a multi-tick action's wind-up that the projectile
   * spends in flight: the action declares a `travel` phase of this length
   * (carved OUT of the wind-up, so the total busy window / impact tick /
   * cooldown are unchanged), and the renderer launches the projectile on the
   * `release` boundary so it arrives exactly on `impact`. Absent → no travel
   * phase (the projectile-bearing abilities `magic_bolt` / `catapult_shot`
   * carry it; every single-tick strike/heal omits it). Tune by feel.
   */
  travelSeconds: z.number().nonnegative().optional(),
  /**
   * F4 — the gambit's strike→retreat sequencing knob. When present, the
   * strike's busy window is split `windup(this) → impact → recovery` instead
   * of the plain `impact(0) → recovery(D)` of a basic strike: the damage still
   * lands eagerly in `start` (offset 0), but the rogue's free reposition is
   * deferred to the `impact` boundary this many seconds later, so on screen the
   * strike shove plays out BEFORE the retreat lerp (E6.A made the two mutually
   * exclusive per sprite — a same-tick reposition clobbered the shove). Σ ticks
   * / cooldown are unchanged (the windup is carved out of recovery), so the
   * attack cadence holds; only WHEN within the cycle the rogue darts back moves.
   * Set ≥ the shove duration (~0.2s). Absent → a basic strike (every ability
   * except `gambit_strike`). Tune by feel.
   */
  retreatDelaySeconds: z.number().nonnegative().optional(),
  aoe: AoeSchema.optional(),
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
