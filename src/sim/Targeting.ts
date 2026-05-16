import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';

/**
 * Pick the nearest living enemy of `unit`. Ties on Chebyshev distance go to
 * the lower-HP candidate; ties on HP go to the lower id. Returning null is
 * a normal outcome — the caller (Step 3.5 movement, Step 3.7 attacks) treats
 * it as "no target, idle this tick."
 *
 * Pure function: same `(unit, world.units)` always yields the same answer.
 */
export function findTarget(unit: Unit, world: World): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;

  for (const candidate of world.units) {
    if (candidate.team === unit.team) continue;
    if (candidate.currentHp <= 0) continue;

    const dist = chebyshev(unit.position, candidate.position);
    if (best === null || isBetter(candidate, dist, best, bestDist)) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function isBetter(
  candidate: Unit,
  candidateDist: number,
  best: Unit,
  bestDist: number,
): boolean {
  if (candidateDist !== bestDist) return candidateDist < bestDist;
  if (candidate.currentHp !== best.currentHp) return candidate.currentHp < best.currentHp;
  return candidate.id < best.id;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
