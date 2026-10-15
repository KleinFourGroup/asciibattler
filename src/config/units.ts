/**
 * The unit catalog: every kind of unit, combatant or neutral. Source of truth
 * at `config/units.json`, validated at load, so a malformed entry fails
 * before any gameplay runs rather than falling back to defaults.
 *
 * A combatant gives its display name, glyph, abilities (ids checked against
 * `knownAbilityIds()`), base stats, growth rates and targeting.
 * - `baseStats` — the eleven stats in canonical order: the direct-combat
 *   stats (constitution, strength, ranged, magic, luck, defense), then
 *   precision and evasion, the cadence stats speed and mobility, and power.
 *   `STAT_CAP` catches typos and is not a design limit.
 * - `growthRates` — per stat, 0 to 1: the chance the stat rises by 1 on one
 *   simulated level-up of a player's recruit (`simulateLevelUps`), and the
 *   per-level increment of an enemy (`scaleStats`). At 0 the stat never
 *   grows, as a melee unit's ranged stays 0.
 *
 * A unit's move cooldown is the one `STATS.baseMoveCooldownSeconds` scaled
 * by its mobility, so a slow unit is one with low or negative mobility. Its
 * attack cadence and range come from its abilities, its range being the
 * largest of theirs (`rangeForArchetype`, `src/sim/archetypes.ts`).
 *
 * A new archetype is data only: add its entry to the JSON, or author it in
 * the archetype editor, and the open record validates it and its id resolves
 * everywhere. Add it to `REQUIRED_UNIT_IDS` only if game code names it by
 * literal.
 */

import { z } from 'zod';
import { prose } from '../i18n/prose';
import { loadProse } from '../i18n/locale';
import unitsJson from '../../config/units.json';
import { knownAbilityIds } from '../sim/abilities/registry';
import { knownTargetingIds } from '../sim/targetingStrategies';
import { ABILITY_DEFS } from './abilities';

/** Defensive cap to catch a designer typo (e.g. 500 instead of 5). */
const STAT_CAP = 99;

/**
 * The rarity tiers in ascending order, which matters: `rarityWeights` is
 * checked exhaustive over it and the tier roll walks it. The top tier is
 * `legendary`, since `elite` names an encounter kind. A unit's rarity is
 * looked up from its archetype id, so offers, rosters and snapshots carry
 * only the id.
 */
export const RARITY_TIERS = ['common', 'uncommon', 'rare', 'legendary'] as const;
const RaritySchema = z.enum(RARITY_TIERS);
export type UnitRarity = z.infer<typeof RaritySchema>;

const BaseStatsSchema = z.object({
  constitution: z.number().int().nonnegative().max(STAT_CAP),
  strength: z.number().int().nonnegative().max(STAT_CAP),
  ranged: z.number().int().nonnegative().max(STAT_CAP),
  magic: z.number().int().nonnegative().max(STAT_CAP),
  luck: z.number().int().nonnegative().max(STAT_CAP),
  // Flat subtractive mitigation; 0 is no armour.
  defense: z.number().int().nonnegative().max(STAT_CAP),
  // The attacker's precision against the defender's evasion feeds the hit
  // roll in `World.applyDamage`.
  precision: z.number().int().nonnegative().max(STAT_CAP),
  evasion: z.number().int().nonnegative().max(STAT_CAP),
  // Attack cadence.
  speed: z.number().int().nonnegative().max(STAT_CAP),
  // Signed, unlike the rest: 0 is the base move cooldown, positive is
  // faster, negative slower (the slowest shipped units sit at −14). The lower
  // bound mirrors the typo cap.
  mobility: z.number().int().min(-STAT_CAP).max(STAT_CAP),
  // The unit's weight in the chip rule (`config/health.json`): under the
  // shipped casualty rule, what its fall costs its side's pool.
  power: z.number().int().nonnegative().max(STAT_CAP),
});

const GrowthRatesSchema = z.object({
  constitution: z.number().min(0).max(1),
  strength: z.number().min(0).max(1),
  ranged: z.number().min(0).max(1),
  magic: z.number().min(0).max(1),
  luck: z.number().min(0).max(1),
  defense: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  evasion: z.number().min(0).max(1),
  speed: z.number().min(0).max(1),
  mobility: z.number().min(0).max(1),
  power: z.number().min(0).max(1),
});

const ABILITY_IDS = knownAbilityIds();
const AbilityIdSchema = z.string().refine((id) => ABILITY_IDS.includes(id), {
  message: `unknown ability id; known: [${ABILITY_IDS.join(', ')}]`,
});

// The archetype's targeting policy, checked against the strategy registry
// (`src/sim/targetingStrategies.ts`) at load, as ability ids are.
const TARGETING_IDS = knownTargetingIds();
const TargetingIdSchema = z.string().refine((id) => TARGETING_IDS.includes(id), {
  message: `unknown targeting id; known: [${TARGETING_IDS.join(', ')}]`,
});

// Exported for the archetype editor (tools/archetype-editor/), which checks an
// edited config against the schema the game boots on, so the two cannot
// disagree; no sim, snapshot or fuzz code reads these exports.
//
// An entry is a combatant (this schema: abilities and a stat block) or a
// neutral (`NeutralUnitDefSchema`: a wall, half-cover or rubble, with no
// abilities). The two are told apart by their required fields, with no
// discriminant key. `isNeutralUnitDef` (below) is the runtime narrow; the
// combatant-typed view is `CONFIGS` in `archetypes.ts`, so combatant readers
// never see the union.
export const CombatantUnitDefSchema = z.object({
  // The display name. The key stays the id everywhere (serialization, URL
  // params, errors); the UI reads `nameForArchetype`.
  name: prose(),
  glyph: z.string().length(1),
  abilities: z.array(AbilityIdSchema).min(1),
  baseStats: BaseStatsSchema,
  growthRates: GrowthRatesSchema,
  // Required, so every archetype names its targeting policy.
  targeting: TargetingIdSchema,
  // Whether the archetype appears in recruit offers (`rollOffer` samples
  // `DRAFTABLE_UNIT_DEFS`). True by default, so a new archetype joins the
  // draft; units the player meets but never drafts, such as the enemy casters
  // and the summoned ghoul, set it false. The editor's formatter writes the
  // key only when false.
  draftable: z.boolean().default(true),
  // The draft tier, `common` when absent; the editor's formatter writes it
  // only when not common. The weighted sampler and the card's accent read it.
  // Combatants only: a neutral is never drafted, and its strict schema refuses
  // the key.
  rarity: RaritySchema.default('common'),

  // The fields below are looked up from the def by id at spawn, as glyph and
  // targeting are, so none is in a snapshot.
  //
  // An axis-aligned N×N body, N from 1 to 4; `position` is its corner.
  footprint: z.number().int().min(1).max(4).default(1),
  // The occupancy plane (`src/sim/occupancy.ts`). Every shipped unit is on
  // `ground`.
  layer: z.enum(['ground', 'air']).default('ground'),
  // The statuses this unit can receive; absent, all of them.
  statusSusceptibility: z.array(z.string()).optional(),
  // The statuses it can never receive (`applyStatusEffect` checks both
  // lists). A blocklist, so a new status applies to everyone and an immunity
  // is an opt-out per status, such as the healer's to panic.
  statusImmunities: z.array(z.string()).optional(),
  // `damageStat`: the stat a basic strike and the card's ATK read (absent,
  // the unit does not strike; `damageStatFor`, `stats.ts`).
  // `movementBehavior`: the movement selector (absent, `standard`; `support`
  // is the healer's; `behaviors/registry.ts`). `retargetOnLosLoss`: drop a
  // target unseen too long, as ranged units do (absent, false;
  // `Targeting.ts`).
  damageStat: z.enum(['strength', 'ranged', 'magic']).optional(),
  movementBehavior: z.enum(['standard', 'support']).optional(),
  retargetOnLosLoss: z.boolean().optional(),
});

/**
 * A neutral entry: a wall, half-cover or rubble. No abilities, growth or stat
 * block: a glyph, and an `hp` pool if it can be destroyed.
 * `blocksLineOfSight` belongs to the kind (a wall is opaque, half-cover is
 * not), so it is on the def and not the spawn call.
 */
export const NeutralUnitDefSchema = z
  .object({
    glyph: z.string().length(1),
    // Its presence is destructibility: a neutral with `hp` can be destroyed
    // and targeted in combat (rubble, a destructible wall); one without
    // cannot (a wall). `isCombatTargetable` keys off it, and
    // `spawnEnvironment` gives an hp-less neutral a nominal max HP that
    // nothing targets. The cap catches typos.
    hp: z.number().int().positive().max(999).optional(),
    // Walls block ranged sight (the default); half-cover does not.
    blocksLineOfSight: z.boolean().default(true),
    // An axis-aligned N×N body, as on a combatant.
    footprint: z.number().int().min(1).max(4).default(1),
    // Whether units fire at it unprompted, below every reachable hostile, so
    // blocking rubble gets chipped away. A second axis beside `hp`: walls,
    // half-cover and a destructible wall leave it false and are hit only when
    // ordered or caught in an area. A new debris kind opts in with one line.
    autoTarget: z.boolean().default(false),
    // As on a combatant: absent, all statuses; a wall takes burn and frozen,
    // not poison or bleed.
    statusSusceptibility: z.array(z.string()).optional(),
    // As on a combatant. Redundant beside the allowlist for a neutral, but
    // present so the union's shared `statusImmunities` typechecks without a
    // guard per arm.
    statusImmunities: z.array(z.string()).optional(),
  })
  // Strict, because `hp` is optional: without it a combatant, its extra keys
  // stripped, would satisfy this arm. Strict makes the structural discriminant
  // real rather than a matter of which arm is tried first.
  .strict();

// The per-entry schema: a combatant or a neutral. `z.union` tries the
// combatant arm first; a neutral entry, with no `abilities` or `baseStats`,
// fails it and falls to the neutral arm.
export const UnitDefSchema = z.union([CombatantUnitDefSchema, NeutralUnitDefSchema]);

// An open `string → UnitDef` record: the catalog is the one source of which
// unit kinds exist, checked entry by entry, so the editor can author a new
// kind as data. The ids the game builds by literal have no compile-time
// guarantee, so `assertRequiredUnitsPresent` and `assertSummonRefsResolve`
// (below) check them at load. `z.record` keeps the JSON's key order, so the
// archetype editor's formatter round-trips.
export const UnitDefsSchema = z.record(z.string(), UnitDefSchema);

export type CombatantUnitDef = z.infer<typeof CombatantUnitDefSchema>;
export type NeutralUnitDef = z.infer<typeof NeutralUnitDefSchema>;
export type UnitDef = z.infer<typeof UnitDefSchema>;
export type UnitDefsConfig = Record<string, UnitDef>;
export type GrowthRates = z.infer<typeof GrowthRatesSchema>;

/**
 * The union's runtime narrow: it splits the catalog into `UNIT_DEFS` and
 * `NEUTRAL_DEFS` (below) and serves the spawn path and the status filter. It
 * tests `baseStats`, which every combatant carries and no neutral does, and
 * not `hp`, which an indestructible neutral lacks.
 */
export function isNeutralUnitDef(def: UnitDef): def is NeutralUnitDef {
  return !('baseStats' in def);
}

/**
 * The full catalog, combatants and neutrals in `config/units.json` key order:
 * the file's faithful mirror, walked by the archetype editor's formatter and
 * the round-trip tests.
 */
export const ALL_UNIT_DEFS: UnitDefsConfig = UnitDefsSchema.parse(unitsJson);
// A combatant's `name` is prose (a neutral has none), addressed as
// `units.<archetype>.name`. UNIT_DEFS and NEUTRAL_DEFS are views over the same
// objects, so resolving in place reaches every reader.
export const UNITS_PROSE = loadProse('units', UnitDefsSchema, ALL_UNIT_DEFS);

/**
 * The catalog split by kind. `UNIT_DEFS` is the combatant catalog most readers
 * want (stats, abilities, growth), with no union to narrow; `NEUTRAL_DEFS`
 * holds the walls, half-cover and rubble, read by the spawn path and the
 * status filter. Both are views over the one parse.
 */
export const UNIT_DEFS: Record<string, CombatantUnitDef> = Object.fromEntries(
  Object.entries(ALL_UNIT_DEFS).filter(
    (e): e is [string, CombatantUnitDef] => !isNeutralUnitDef(e[1]),
  ),
);
export const NEUTRAL_DEFS: Record<string, NeutralUnitDef> = Object.fromEntries(
  Object.entries(ALL_UNIT_DEFS).filter((e): e is [string, NeutralUnitDef] => isNeutralUnitDef(e[1])),
);

/**
 * Whether a neutral can take combat damage: whether its def has an `hp` pool.
 * Combatants are never neutral, so `isCombatTargetable` checks `team ===
 * 'neutral'` first. It is keyed by the archetype id, which is serialized, so it
 * re-derives on a snapshot load with no state of its own. An unknown id has no
 * def and no hp, so it is indestructible.
 */
export function isDestructibleNeutral(archetype: string): boolean {
  return NEUTRAL_DEFS[archetype]?.hp !== undefined;
}

/**
 * Whether units fire at this neutral unprompted (its def's `autoTarget`), a
 * question apart from `isDestructibleNeutral`. Keyed by the archetype id, so it
 * needs no snapshot state.
 */
export function isAutoTargetNeutral(archetype: string): boolean {
  return NEUTRAL_DEFS[archetype]?.autoTarget === true;
}

/**
 * Boot check: the ids code names by literal exist, since with an open string
 * id a typo, rename or removal would otherwise surface only at spawn. `bandit`
 * and `archer` make up the random enemy wave (`enemyBudget.ts`); `mercenary`
 * is named by the dev board's fixtures and by two editors under `tools/`
 * (characters, encounters). Summon targets have their own check below.
 */
const REQUIRED_UNIT_IDS = ['mercenary', 'bandit', 'archer'] as const;
(function assertRequiredUnitsPresent(): void {
  for (const id of REQUIRED_UNIT_IDS) {
    if (!(id in UNIT_DEFS)) {
      throw new Error(
        `config/units.json is missing required unit '${id}' (hard-referenced by run/enemy-comp code)`,
      );
    }
  }
})();

/**
 * Boot check: every `summon` op in the ability catalog names an archetype in
 * this catalog, so a typo fails at startup and not at cast. It lives here,
 * where the valid ids are, because the ability registry's own boot check runs
 * before `UNIT_DEFS` exists, and importing it there would cycle through
 * `knownAbilityIds`. config/abilities is already loaded and never imports this
 * module. `summon` is a top-level op only, so there is no recursion.
 */
(function assertSummonRefsResolve(): void {
  const archetypeIds = new Set(Object.keys(UNIT_DEFS));
  for (const def of Object.values(ABILITY_DEFS)) {
    for (const entry of def.effects) {
      if (entry.op.kind !== 'summon') continue;
      const archetype = entry.op.summon.archetype;
      if (!archetypeIds.has(archetype)) {
        throw new Error(`ability '${def.id}': summon references unknown archetype '${archetype}'`);
      }
    }
  }
})();
