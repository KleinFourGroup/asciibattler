import type { RNG } from '../core/RNG';
import type { Archetype, UnitArchetype, UnitTemplate } from './Unit';
import type { AbilityDef } from './effects/schema';
import { UNIT_DEFS, type CombatantUnitDef, type UnitRarity } from '../config/units';
import { abilityDef } from '../config/abilities';
import { scaleStats, simulateLevelUps } from './leveling';

// `Archetype` is defined in `./Unit`; re-exported for the sites that import
// it from here.
export type { Archetype };

/**
 * The combatant catalog, from `config/units.json` as
 * [src/config/units.ts](src/config/units.ts) validates it, exported as
 * `ARCHETYPE_CONFIG` for tests. The neutral defs are `NEUTRAL_DEFS`, read by
 * the spawn and status-gate paths (`World`, `environment.ts`), so every
 * accessor here and every reader of `ALL_ARCHETYPES` keeps its combatant
 * type with no union to narrow.
 */
const CONFIGS: Record<Archetype, CombatantUnitDef> = UNIT_DEFS;

export function glyphForArchetype(archetype: Archetype): string {
  return CONFIGS[archetype].glyph;
}

/**
 * One ability's share of `derived.attackRange`, or null when it engages
 * nothing:
 *
 * - a `self` target is null: a leap's or a summon's range is not reach;
 * - an aoe anchored on the caster that affects `allies` is null: a buff
 *   shout is support;
 * - an aoe anchored on the caster that hits enemies (a nova) is its
 *   radius, its true reach: `rangeCells` means nothing for a blast with no
 *   aim, and reading it would strand the unit at a stale authored range.
 *
 * Anything else engages at its `rangeCells`. No shipped def anchors an aoe
 * on the caster.
 */
export function engagementReach(def: AbilityDef): number | null {
  if (def.target.kind === 'self') return null;
  if (def.target.kind === 'aoe' && def.target.anchor === 'caster') {
    return def.target.affects === 'allies' ? null : def.target.radius;
  }
  return def.rangeCells;
}

/**
 * The engagement range: the largest reach among the archetype's engaging
 * abilities (`engagementReach`), passed to `deriveStats` as
 * `derived.attackRange`, which `MovementBehavior`'s in-range abstain and
 * the HUD and audio read. Whether one ability can reach is its own range,
 * checked as it proposes. With no engaging ability, the largest
 * `rangeCells` of all, since a support unit needs some distance to hold.
 */
export function rangeForArchetype(archetype: Archetype): number {
  const ids = CONFIGS[archetype].abilities;
  const reaches = ids
    .map((id) => engagementReach(abilityDef(id)))
    .filter((r): r is number => r !== null);
  if (reaches.length > 0) return Math.max(...reaches);
  return Math.max(...ids.map((id) => abilityDef(id).rangeCells));
}

/**
 * The engagement floor: the `minRangeCells` of the ability that sets the
 * reach (by the same `engagementReach`, the first of equals winning), so
 * `[minRange, attackRange]` is the firing band `MovementBehavior` kites in.
 * Read from the config where it is needed, like `rangeCells`, not stored on
 * `UnitDerived`, so it has no serialized copy. A unit with no engaging
 * ability has a floor of 0, as has an id the combatant catalog lacks
 * (scenery), so a caller needn't narrow `unit.archetype` first.
 */
export function minRangeForArchetype(archetype: UnitArchetype): number {
  const ids = CONFIGS[archetype]?.abilities;
  if (!ids) return 0;
  let best: string | undefined;
  let bestReach = -Infinity;
  for (const id of ids) {
    const r = engagementReach(abilityDef(id));
    if (r !== null && r > bestReach) {
      best = id;
      bestReach = r;
    }
  }
  return best === undefined ? 0 : abilityDef(best).minRangeCells;
}

/**
 * The archetype's target-selection strategy id, against the registry in
 * `targetingStrategies.ts`. Resolved at spawn and kept on `Unit.targeting`,
 * so `Targeting.ts` needn't import the config. An id the combatant catalog
 * lacks (scenery) gets `nearest`, so a caller needn't branch on the team
 * first.
 */
export function targetingForArchetype(archetype: UnitArchetype): string {
  return CONFIGS[archetype]?.targeting ?? 'nearest';
}

/** The archetype's `growthRates`, for `simulateLevelUps` (a player's unit)
 *  and `scaleStats` (an enemy's). */
export function growthRatesForArchetype(archetype: Archetype) {
  return CONFIGS[archetype].growthRates;
}

/** The archetype's `baseStats`, where the level-up math starts. Returned
 *  by reference, the parsed config's own object, so a caller spreads it
 *  before changing it. */
export function baseStatsForArchetype(archetype: Archetype) {
  return CONFIGS[archetype].baseStats;
}

/**
 * The registry ids of the abilities the archetype spawns with. The order
 * matters: `AbilityBehavior` walks them in it, and a tie goes to the first.
 * A spawn passes each id through `createAbility`, a fresh ability for each
 * unit.
 */
export function abilityIdsForArchetype(archetype: Archetype): readonly string[] {
  return CONFIGS[archetype].abilities;
}

/**
 * A player's template at `level`, by simulated level-ups. Level 1 is the
 * base stats, with no draw; a higher level draws once a stat a level,
 * `11 × (level − 1)`, against the archetype's growth rates. The starting
 * roster, the recruit offer and a reward's unit come through here.
 */
export function rollUnit(archetype: Archetype, rng: RNG, level: number = 1): UnitTemplate {
  const cfg = CONFIGS[archetype];
  if (level <= 1) {
    return { archetype, level: 1, stats: { ...cfg.baseStats }, xp: 0 };
  }
  return {
    archetype,
    level,
    stats: simulateLevelUps(cfg.baseStats, cfg.growthRates, level - 1, rng),
    xp: 0,
  };
}

/**
 * An enemy's template at `level`, by the deterministic `scaleStats`: no
 * draw, so an `(archetype, level)` pair always gives the same stats.
 * `buildEnemyTeam`, a wave's units, a camp's members and a summon come
 * through here.
 */
export function scaledUnit(archetype: Archetype, level: number): UnitTemplate {
  const cfg = CONFIGS[archetype];
  if (level <= 1) {
    return { archetype, level: 1, stats: { ...cfg.baseStats }, xp: 0 };
  }
  return {
    archetype,
    level,
    stats: scaleStats(cfg.baseStats, cfg.growthRates, level - 1),
    xp: 0,
  };
}

// Re-exported for tests / fuzz harness diagnostic that want to peek
// at the parsed config without reaching into the config module.
export const ARCHETYPE_CONFIG: Record<Archetype, CombatantUnitDef> = CONFIGS;

/**
 * Every combatant archetype, in `config/units.json`'s key order: derived
 * from the catalog, so a new one joins at once, and in a fixed order, so
 * whoever samples from it stays deterministic. The full list, for the
 * roster's order, the prices, telemetry and the fuzz; the recruit offer
 * draws from the draftable ones (`DRAFTABLE_BY_TIER`).
 */
export const ALL_ARCHETYPES: readonly Archetype[] = Object.keys(CONFIGS) as Archetype[];

/**
 * The archetypes the player can draft: those whose `draftable` flag is true,
 * the default. The enemies' disruptors (the frozen, confusion, blind and
 * panic casters) and the summon-only ghoul are on the board but never the
 * player's to draft, so each is out by one `"draftable": false`, and a new
 * player archetype joins at once. The recruit offer samples them by tier
 * (`DRAFTABLE_BY_TIER`).
 */
export const DRAFTABLE_ARCHETYPES: readonly Archetype[] = ALL_ARCHETYPES.filter(
  (a) => CONFIGS[a].draftable,
);

/**
 * The archetype's rarity tier, read from its def by id, with no copy on the
 * unit. An id the combatant catalog lacks gets `common`: scenery is never
 * drafted or carded, and an old fixture's id shouldn't throw.
 */
export function rarityForArchetype(archetype: UnitArchetype): UnitRarity {
  return CONFIGS[archetype]?.rarity ?? 'common';
}

/**
 * The archetype's display name (`UnitDef.name`), read from its def by id.
 * An id without a combatant def shows as itself, so a display path never
 * throws; the id stays the key everywhere else (serialization, URLs, error
 * messages).
 */
export function nameForArchetype(archetype: UnitArchetype): string {
  return CONFIGS[archetype]?.name ?? archetype;
}

/**
 * The draftable archetypes of one tier, in the catalog's order. Every tier
 * has a key, empty or not; the recruit sampler (`Recruitment.ts`) rolls a
 * tier over the ones that aren't, its weights renormalized, then picks
 * uniformly within it. Built from the flags `DRAFTABLE_ARCHETYPES` reads, so
 * the tiers together are that list.
 */
function draftableOfTier(tier: UnitRarity): readonly Archetype[] {
  return DRAFTABLE_ARCHETYPES.filter((a) => CONFIGS[a].rarity === tier);
}
// Explicit keys, not `Object.fromEntries`, which loses the key union: the
// exhaustive `Record` makes a new tier in `RARITY_TIERS` a compile error
// here, not a missing bucket.
export const DRAFTABLE_BY_TIER: Readonly<Record<UnitRarity, readonly Archetype[]>> = {
  common: draftableOfTier('common'),
  uncommon: draftableOfTier('uncommon'),
  rare: draftableOfTier('rare'),
  legendary: draftableOfTier('legendary'),
};
