import type { RNG } from '../core/RNG';
import type { UnitTemplate } from './Unit';
import { ARCHETYPES, type ArchetypeConfig } from '../config/archetypes';
import { scaleStats, simulateLevelUps } from './leveling';

export type Archetype = 'melee' | 'ranged';

/**
 * Per-archetype config, sourced from `config/archetypes.json` and
 * validated by [src/config/archetypes.ts](src/config/archetypes.ts).
 * Re-exported as `ARCHETYPE_CONFIG` for tests that want to assert
 * baseStats / attackRange / glyph without re-importing from config.
 */
const CONFIGS: Record<Archetype, ArchetypeConfig> = ARCHETYPES;

export function glyphForArchetype(archetype: Archetype): string {
  return CONFIGS[archetype].glyph;
}

export function attackRangeForArchetype(archetype: Archetype): number {
  return CONFIGS[archetype].attackRange;
}

/**
 * E3 — per-archetype move-cooldown base in seconds, or `undefined` if
 * the archetype inherits the global default from `config/stats.json`.
 * Threaded into `deriveStats` so slow-walking archetypes can lengthen
 * their move CD without touching the global knob.
 */
export function baseMoveCooldownSecondsForArchetype(
  archetype: Archetype,
): number | undefined {
  return CONFIGS[archetype].baseMoveCooldownSeconds;
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
 * levels consume `7 × (level - 1)` RNG draws against the archetype's
 * growthRates. Used by `rollTeam` (level 1) and `rollOffer` (recruits
 * at currentFloor — see ROADMAP E3 decision point).
 */
export function rollUnit(archetype: Archetype, rng: RNG, level: number = 1): UnitTemplate {
  const cfg = CONFIGS[archetype];
  if (level <= 1) {
    return { archetype, level: 1, stats: { ...cfg.baseStats } };
  }
  return {
    archetype,
    level,
    stats: simulateLevelUps(cfg.baseStats, cfg.growthRates, level - 1, rng),
  };
}

/**
 * E3 — produce an enemy-side template at the given level via the
 * deterministic `scaleStats` path. No RNG draws; same `(archetype,
 * level)` pair always produces the same stats. Used by `rollEnemyTeam`
 * — the difficulty curve is `enemyLevel = 1 + (floor-1) × enemyLevelPerFloor`.
 */
export function scaledUnit(archetype: Archetype, level: number): UnitTemplate {
  const cfg = CONFIGS[archetype];
  if (level <= 1) {
    return { archetype, level: 1, stats: { ...cfg.baseStats } };
  }
  return {
    archetype,
    level,
    stats: scaleStats(cfg.baseStats, cfg.growthRates, level - 1),
  };
}

// Re-exported for tests / fuzz harness diagnostic that want to peek
// at the parsed config without reaching into the config module.
export const ARCHETYPE_CONFIG: Record<Archetype, ArchetypeConfig> = CONFIGS;
