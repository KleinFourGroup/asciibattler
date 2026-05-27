import type { RNG } from '../core/RNG';
import type { UnitTemplate } from './Unit';
import { ARCHETYPES, type ArchetypeConfig } from '../config/archetypes';

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
 * E1 — produce a level-1 template from the archetype's baseStats.
 *
 * **No RNG draws today.** Stat rolls land in E3 via `simulateLevelUps`
 * (player recruits) and `scaleStats` (enemies); for now every unit
 * spawns at exactly the baseStats numbers. The `_rng` param stays on
 * the signature so callers don't churn when E3 plugs in — they already
 * thread an RNG through `rollOffer` / `rollTeam` / `rollEnemyTeam`.
 */
export function rollUnit(archetype: Archetype, _rng: RNG): UnitTemplate {
  return {
    archetype,
    stats: { ...CONFIGS[archetype].baseStats },
  };
}

// Re-exported for tests / fuzz harness diagnostic that want to peek
// at the parsed config without reaching into the config module.
export const ARCHETYPE_CONFIG: Record<Archetype, ArchetypeConfig> = CONFIGS;
