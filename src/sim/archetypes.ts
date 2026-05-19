import type { RNG } from '../core/RNG';
import { secondsToTicks } from '../config';
import type { UnitTemplate } from './Unit';
import { ARCHETYPES, type ArchetypeConfig } from '../config/archetypes';

export type Archetype = 'melee' | 'ranged';

/**
 * Per-archetype stat ranges, sourced from `config/archetypes.json` and
 * validated by [src/config/archetypes.ts](src/config/archetypes.ts).
 * Re-exported as `ARCHETYPE_BOUNDS` for tests that assert against the
 * configured ranges. Bounds are intentionally tight so battles read
 * cleanly even with random rolls — see DESIGN.md "Battle mechanics".
 */
const BOUNDS: Record<Archetype, ArchetypeConfig> = ARCHETYPES;

export function glyphForArchetype(archetype: Archetype): string {
  return BOUNDS[archetype].glyph;
}

export function rollUnit(archetype: Archetype, rng: RNG): UnitTemplate {
  const b = BOUNDS[archetype];
  return {
    archetype,
    stats: {
      maxHp: rng.int(b.hp[0], b.hp[1]),
      attackDamage: rng.int(b.attackDamage[0], b.attackDamage[1]),
      attackRange: b.attackRange,
      attackCooldownTicks: secondsToTicks(rollFloat(rng, b.attackCooldownSeconds)),
      moveCooldownTicks: secondsToTicks(rollFloat(rng, b.moveCooldownSeconds)),
    },
  };
}

/** Internal: uniform float in `[lo, hi]`. RNG only exposes `int` natively. */
function rollFloat(rng: RNG, [lo, hi]: readonly [number, number]): number {
  return lo + rng.next() * (hi - lo);
}

// Re-exported for tests that want to assert bounds.
export const ARCHETYPE_BOUNDS: Record<Archetype, ArchetypeConfig> = BOUNDS;
