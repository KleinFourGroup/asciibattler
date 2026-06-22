/**
 * Phase Y2 — the caster-reposition primitive shared by the move interpreter and
 * the legacy `GambitStrikeAction` (a behavior-preserving extraction, so the
 * data-driven gambit and the hand-coded one compute the SAME step — the Y3
 * determinism oracle then proves the migration byte-identical).
 *
 * `retreatCell` is the gambit's conservative one-cell dart-back: the neighbor
 * that STRICTLY increases Chebyshev distance from the anchor (so a sideways /
 * closer step never reads as a "retreat"), tie-broken toward open space (the
 * candidate with the most free neighbors), then by fixed `NEIGHBORS` order for
 * determinism. Returns null when nothing qualifies (boxed in / corner / 1-wide
 * corridor) — the caller then holds position. Pure given the world snapshot.
 *
 * Cluster 2's `move` knockback/pull (target-moving) will live alongside this in
 * the hardened occupancy core; this round ships only caster-reposition.
 */

import type { GridCoord } from '../../core/types';
import type { Unit } from '../Unit';
import type { World } from '../World';

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export function retreatCell(unit: Unit, anchor: GridCoord, world: World): GridCoord | null {
  const occupied = new Set<string>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    occupied.add(key(u.position));
  }

  const currentDist = chebyshev(unit.position, anchor);
  let best: GridCoord | null = null;
  let bestDist = -1;
  let bestOpenness = -1;
  for (const [dx, dy] of NEIGHBORS) {
    const c: GridCoord = { x: unit.position.x + dx, y: unit.position.y + dy };
    if (!passable(c, world, occupied)) continue;
    const dist = chebyshev(c, anchor);
    if (dist <= currentDist) continue;
    const openness = countOpenNeighbors(c, world, occupied);
    if (dist > bestDist || (dist === bestDist && openness > bestOpenness)) {
      best = c;
      bestDist = dist;
      bestOpenness = openness;
    }
  }
  return best;
}

function countOpenNeighbors(c: GridCoord, world: World, occupied: ReadonlySet<string>): number {
  let n = 0;
  for (const [dx, dy] of NEIGHBORS) {
    if (passable({ x: c.x + dx, y: c.y + dy }, world, occupied)) n++;
  }
  return n;
}

function passable(c: GridCoord, world: World, occupied: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  if (occupied.has(key(c))) return false;
  return true;
}

function key(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
