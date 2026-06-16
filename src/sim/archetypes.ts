import type { RNG } from '../core/RNG';
import type { Archetype, UnitArchetype, UnitTemplate } from './Unit';
import { ARCHETYPES, type ArchetypeConfig } from '../config/archetypes';
import { abilityConfig } from '../config/abilities';
import { scaleStats, simulateLevelUps } from './leveling';

// E7.A — `Archetype` is now defined once in `./Unit` (the canonical closed
// set) and re-exported here so the many `import { Archetype } from
// './archetypes'` sites keep working. Adding an archetype is a one-line edit
// to the union in Unit.ts, not two definitions that can drift apart.
export type { Archetype };

/**
 * Per-archetype config, sourced from `config/archetypes.json` and
 * validated by [src/config/archetypes.ts](src/config/archetypes.ts).
 * Re-exported as `ARCHETYPE_CONFIG` for tests that want to assert
 * baseStats / glyph without re-importing from config.
 */
const CONFIGS: Record<Archetype, ArchetypeConfig> = ARCHETYPES;

export function glyphForArchetype(archetype: Archetype): string {
  return CONFIGS[archetype].glyph;
}

/**
 * E5 — a unit's effective engagement range: the MAX attack range over
 * the archetype's abilities. Range moved off the archetype (E1's
 * `attackRange` primitive) onto each ability in `config/abilities.json`,
 * so this is now derived rather than read directly. Fed into
 * `deriveStats` as `derived.attackRange` — the value MovementBehavior's
 * in-range abstain and the HUD/audio readers consult. Per-ability gates
 * (whether a *specific* strike can reach) read the ability's own range
 * in `proposeBasicStrike`, not this max.
 */
export function rangeForArchetype(archetype: Archetype): number {
  // N1 — a `movement` ability's `range` is a LEAP distance, not engagement
  // reach, so it's excluded from `derived.attackRange` (the in-range-abstain
  // threshold MovementBehavior reads, and the gate the dash itself uses to ask
  // "am I out of strike range?"). Without this, the rogue's 2-cell dash would
  // inflate its firing range to 2 and strand it a cell short whenever the dash
  // is on cooldown. Falls back to all abilities if a unit somehow carries only
  // movement abilities. Today only the rogue's dash is `movement`; every other
  // archetype is unaffected (byte-identical).
  const ids = CONFIGS[archetype].abilities;
  const engaging = ids.filter((id) => abilityConfig(id).kind !== 'movement');
  const reach = engaging.length > 0 ? engaging : ids;
  return Math.max(...reach.map((id) => abilityConfig(id).range));
}

/**
 * O4 — a unit's engagement FLOOR: the `minRange` of the archetype's longest-range
 * engaging (non-`movement`) ability — the same ability whose `range` defines
 * `derived.attackRange`, so `[minRange, attackRange]` is the firing band
 * `MovementBehavior` kites within. Config-READ (parallels `rangeForArchetype`),
 * deliberately NOT plumbed into `UnitDerived` — there's no serialized per-unit
 * copy, so `minRange` needs no WorldSnapshot bump (it's looked up live wherever
 * `attackRange` is, exactly like `range`/`accuracy`). Every archetype today
 * carries a single attack ability, so "longest-range engaging" is unambiguous;
 * the max-by-range tie-break generalizes it to a future multi-weapon unit.
 * `minRange 0` for every weapon today → byte-identical (no kiting) until the O4
 * value commit sets bow/mage/catapult floors.
 *
 * Accepts the full `UnitArchetype` (like `targetingForArchetype`): environment
 * entities (walls/half-cover) never seek a firing position, so they map to 0 and
 * `MovementBehavior` needn't pre-narrow `unit.archetype` (a wall has no behaviors
 * and never reaches the band logic anyway).
 */
export function minRangeForArchetype(archetype: UnitArchetype): number {
  if (archetype === 'environment') return 0;
  const ids = CONFIGS[archetype].abilities;
  const engaging = ids.filter((id) => abilityConfig(id).kind !== 'movement');
  const reach = engaging.length > 0 ? engaging : ids;
  let best = reach[0]!;
  for (const id of reach) {
    if (abilityConfig(id).range > abilityConfig(best).range) best = id;
  }
  return abilityConfig(best).minRange;
}

/**
 * Per-archetype target-selection strategy id (resolved against the registry
 * in `src/sim/targetingStrategies.ts`). Resolved at spawn and stashed on
 * `Unit.targeting` so the leaf `Targeting.ts` needn't import the config layer.
 * Accepts the full `UnitArchetype`: environment entities (walls/half-cover)
 * never seek a target, so they get the harmless `nearest` default and callers
 * needn't branch on team/neutral first.
 */
export function targetingForArchetype(archetype: UnitArchetype): string {
  if (archetype === 'environment') return 'nearest';
  return CONFIGS[archetype].targeting;
}

/**
 * E3 — per-archetype `growthRates` block, used by `simulateLevelUps`
 * (player recruits) and `scaleStats` (enemies).
 */
export function growthRatesForArchetype(archetype: Archetype) {
  return CONFIGS[archetype].growthRates;
}

/**
 * E3 — per-archetype `baseStats` block, used as the starting point for
 * level-up math. Returned by reference (frozen-by-zod-parse JSON), so
 * callers MUST spread before mutating.
 */
export function baseStatsForArchetype(archetype: Archetype) {
  return CONFIGS[archetype].baseStats;
}

/**
 * E2 — registry ids of the abilities an archetype unit spawns with.
 * Order is significant: `AbilityBehavior` walks the list in stored
 * order and ties go to the first proposer. Spawn-site callers pass each
 * id through `createAbility` to instantiate a fresh stateless ability
 * per unit.
 */
export function abilityIdsForArchetype(archetype: Archetype): readonly string[] {
  return CONFIGS[archetype].abilities;
}

/**
 * E3 — produce a player-side template at the given level via simulated
 * level-ups. Level 1 returns baseStats verbatim (no RNG draws); higher
 * levels consume `9 × (level - 1)` RNG draws against the archetype's
 * growthRates (one per stat; H1 made it 9). Used by `rollTeam` (level 1)
 * and `rollOffer` (recruits at currentFloor — see ROADMAP E3 decision point).
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
 * E3 — produce an enemy-side template at the given level via the
 * deterministic `scaleStats` path. No RNG draws; same `(archetype,
 * level)` pair always produces the same stats. Used by G4's
 * `buildEnemyTeam` to materialize each budget-allocated enemy level.
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
export const ARCHETYPE_CONFIG: Record<Archetype, ArchetypeConfig> = CONFIGS;

/**
 * F1 — the draft / recruit pool: every defined archetype, in
 * `config/archetypes.json` key order (melee, ranged, rogue, healer,
 * mage, catapult). Derived from the config so a newly-added archetype
 * joins the pool automatically; the stable key order keeps the byte
 * stream deterministic for whoever samples from it. `rollOffer` draws
 * DISTINCT archetypes from this at uniform weight (F1, recruit-only) —
 * rarity tiers + floor-depth weighting + enemy-side diversification
 * layer on top in Phase G (recruitment refactor).
 */
export const ALL_ARCHETYPES: readonly Archetype[] = Object.keys(CONFIGS) as Archetype[];
