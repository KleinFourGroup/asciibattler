import type { RNG } from '../core/RNG';
import { secondsToTicks } from '../config';
import type { UnitTemplate } from './Unit';

export type Archetype = 'melee' | 'ranged';

interface ArchetypeBounds {
  readonly hp: readonly [number, number];
  readonly attackDamage: readonly [number, number];
  readonly attackRange: number;
  readonly attackCooldownSeconds: readonly [number, number];
  readonly moveCooldownSeconds: readonly [number, number];
}

/**
 * Per-archetype stat ranges. Bounds are intentionally tight so battles read
 * cleanly even with random rolls — see DESIGN.md "Battle mechanics". These
 * are first-draft values; CHECKPOINT 5 (after combat is wired up) is where
 * we tune them against actual battle pacing.
 */
const BOUNDS: Record<Archetype, ArchetypeBounds> = {
  melee: {
    hp: [40, 60],
    attackDamage: [8, 14],
    attackRange: 1,
    attackCooldownSeconds: [0.9, 1.5],
    moveCooldownSeconds: [0.5, 0.8],
  },
  ranged: {
    hp: [20, 30],
    attackDamage: [5, 9],
    attackRange: 3,
    attackCooldownSeconds: [1.0, 1.8],
    moveCooldownSeconds: [0.6, 1.0],
  },
};

const GLYPHS: Record<Archetype, string> = {
  melee: 'M',
  ranged: 'a',
};

export function glyphForArchetype(archetype: Archetype): string {
  return GLYPHS[archetype];
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
export const ARCHETYPE_BOUNDS: Record<Archetype, ArchetypeBounds> = BOUNDS;
