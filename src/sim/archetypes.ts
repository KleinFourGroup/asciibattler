import type { RNG } from '../core/RNG';
import type { Archetype, UnitTemplate } from './Unit';
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
  return Math.max(...CONFIGS[archetype].abilities.map((id) => abilityConfig(id).range));
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
