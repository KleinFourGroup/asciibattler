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
 * I6 — the per-ability combat profile finally lands (the "later step"
 * the note below anticipated; I5's four melee subclasses sharing one
 * strike are the multi-consumer it waited for). An `attack`-kind ability
 * carries three numeric profile values + two boolean gates:
 *   - `might` — flat base damage/heal ADDED to the scaling stat
 *     (`damage = might + scalingStat`). Flat (a weapon constant the
 *     wielder's stat outgrows), so it's early/mid-game texture.
 *   - `accuracy` — base hit chance; REPLACES the old global
 *     `STATS.hitChanceBase` in `hitChanceFor`. Consumed only when `evadable`.
 *   - `critBase` — base crit chance folded into the luck calc
 *     (`clamp(critBase + luck·critPerLuck, 0, critCap)`). Consumed only
 *     when `critable`. Crit is resolved per-ability at attack time now, so
 *     there is no single `UnitDerived.critChance` anymore.
 *   - `evadable` — does this attack roll precision-vs-evasion to-hit? Migrates
 *     I2's hard-coded per-call-site flag into config (single-target strikes
 *     true; AoE / artillery false).
 *   - `critable` — can this attack crit at all?
 * All five are REQUIRED on an `attack`-kind ability (N1's discriminated union
 * scoped them there — the `heal` kind doesn't carry the combat profile, since
 * a heal never rolls to-hit or crit; see the union below). The damage stat an
 * ability scales on stays archetype-derived (`damageStatFor`) — scaling-stat-
 * on-the-ability is the separately-deferred basic-vs-special design.
 *
 * N1 — the config becomes a DISCRIMINATED UNION on `kind`. The single combat-
 * shaped schema forced `heal_ally` to carry dead `accuracy`/`critBase`/
 * `evadable`/`critable` it never rolls, and left a utility ability (the rogue's
 * Phase-N dash, a `movement` kind landing in N1 commit 2) with no honest home.
 * The discriminant fixes both: each `kind` declares exactly the fields it uses,
 * and the compiler forces every consumer to narrow before reading kind-specific
 * data (hence the typed `attackConfig`/`healConfig` accessors below). This is a
 * *data-shape* distinction only — the RUNTIME ability model stays flat (every
 * ability is a `propose()` returning a scored proposal; `AbilityBehavior` never
 * branches on `kind`). A new `kind` is warranted only when an ability's
 * required fields / resolution semantics diverge; optional modifiers (aoe,
 * travel, retreatDelay) stay INSIDE a kind.
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

/**
 * Fields shared by every ability kind. `range` is the engagement reach
 * (attack/heal) or the leap distance (a future `movement` ability), in cells;
 * `cooldownSeconds` is the base recharge interval, scaled by the unit's speed
 * at propose time (`attackCooldownTicksFor`).
 *
 * O4 — `minRange` is the engagement FLOOR: a unit whose target sits inside
 * `minRange` repositions OUT to the `[minRange, range]` band (kiting) and
 * abstains from firing while the target is closer (`MovementBehavior`'s band
 * abstain + the propose-gate lower bound). **`minRange 0` (the default — `.default`
 * fills it when the JSON omits it, so every existing entry stays byte-identical)
 * = today's behavior exactly** (no floor). Meaningful only for the to-hit/heal
 * kinds; a `movement` leap carries it harmlessly (always 0, never read — the
 * engagement-minRange helper excludes movement abilities).
 */
const CommonFields = {
  range: z.number().int().positive(),
  cooldownSeconds: z.number().positive(),
  minRange: z.number().int().nonnegative().default(0),
};

/**
 * `attack` — the to-hit/crit damage abilities (the four melee weapons, the bow,
 * the gambit, the mage bolt, the catapult). Carries the full I6 combat profile
 * plus the optional `travel` / `aoe` / `retreatDelay` modifiers (see the I6
 * block above for each field's role).
 */
const AttackSchema = z.object({
  kind: z.literal('attack'),
  ...CommonFields,
  might: z.number().nonnegative(),
  accuracy: z.number().min(0).max(1),
  critBase: z.number().min(0).max(1),
  evadable: z.boolean(),
  critable: z.boolean(),
  /**
   * F3 — the slice of a multi-tick action's wind-up the projectile spends in
   * flight (carved OUT of the wind-up, so total busy window / impact tick /
   * cooldown are unchanged). Absent → no travel phase. Only `magic_bolt` /
   * `catapult_shot` carry it.
   */
  travelSeconds: z.number().nonnegative().optional(),
  /**
   * F4 — the gambit's strike→retreat sequencing knob: defers the rogue's free
   * reposition to an `impact` boundary this many seconds after the (eager)
   * strike, so the shove plays before the dart-back. Σ ticks / cooldown
   * unchanged. Absent → a basic strike (every ability except `gambit_strike`).
   */
  retreatDelaySeconds: z.number().nonnegative().optional(),
  aoe: AoeSchema.optional(),
});

/**
 * `heal` — restores HP to an ally, magic-scaled, never rolls to-hit or crit.
 * Carries only `might` (the flat heal base ADDED to the healer's magic:
 * `heal = might + magic`) atop the common `range` / `cooldownSeconds`. The
 * dropped combat fields were dead weight under the old single schema — a heal
 * has no `accuracy`/`crit` to speak of.
 */
const HealSchema = z.object({
  kind: z.literal('heal'),
  ...CommonFields,
  might: z.number().nonnegative(),
});

/**
 * `movement` — a utility leap (N1's rogue dash). No damage, no target-effect:
 * the unit just relocates. `range` is the leap distance in cells;
 * `durationSeconds` is the motion's lerp/lockout window, DECOUPLED from
 * `cooldownSeconds` (a fast blink on a long cooldown — `moveProposal`'s
 * `cooldown == duration` invariant doesn't hold here, which is exactly why
 * `DashAbility` builds its own proposal rather than going through it). Flat, not
 * speed-scaled: a utility cooldown, not an attack cadence.
 */
const MovementSchema = z.object({
  kind: z.literal('movement'),
  ...CommonFields,
  durationSeconds: z.number().positive(),
});

const AbilitySchema = z.discriminatedUnion('kind', [AttackSchema, HealSchema, MovementSchema]);

const AbilitiesSchema = z.record(z.string(), AbilitySchema);

export type AttackConfig = z.infer<typeof AttackSchema>;
export type HealConfig = z.infer<typeof HealSchema>;
export type MovementConfig = z.infer<typeof MovementSchema>;
export type AbilityConfig = z.infer<typeof AbilitySchema>;

export const ABILITIES: Record<string, AbilityConfig> =
  AbilitiesSchema.parse(abilitiesJson);

/**
 * Look up an ability's tunables by registry id, throwing if absent. The
 * registry boot-check guarantees presence for every registered ability,
 * so a throw here means a caller passed an id that was never registered
 * — a programming error, surfaced loudly rather than silently defaulted.
 *
 * Returns the `kind`-discriminated union; callers reading kind-specific fields
 * (a strike's `accuracy`, a heal's `might`) should use the typed accessors
 * below so the compiler narrows for them.
 */
export function abilityConfig(id: string): AbilityConfig {
  const cfg = ABILITIES[id];
  if (!cfg) {
    throw new Error(`abilityConfig: no config entry for ability id '${id}'`);
  }
  return cfg;
}

/**
 * N1 — narrowing accessors: fetch an ability's config and assert its `kind`,
 * throwing on a mismatch. They keep kind-specific call sites (strikes read
 * `accuracy`/`critBase`, heal reads its `might`) free of inline narrowing while
 * turning a wrong-kind id into a loud programming error rather than a silent
 * `undefined` field read.
 */
function configOfKind<K extends AbilityConfig['kind']>(
  id: string,
  kind: K,
): Extract<AbilityConfig, { kind: K }> {
  const cfg = abilityConfig(id);
  if (cfg.kind !== kind) {
    throw new Error(`ability '${id}' is kind '${cfg.kind}', expected '${kind}'`);
  }
  return cfg as Extract<AbilityConfig, { kind: K }>;
}

export const attackConfig = (id: string): AttackConfig => configOfKind(id, 'attack');
export const healConfig = (id: string): HealConfig => configOfKind(id, 'heal');
export const movementConfig = (id: string): MovementConfig => configOfKind(id, 'movement');
