import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';
import { currentTarget } from './Targeting';
import { NEIGHBORS, passable } from './positioning';
import { GROUND, cellsOccupiedBy, occupiedCells } from './occupancy';
import { key, chebyshev } from './movement';

/**
 * GP5 #5, extracted at 56c2 — the "strictly blocking a boxed ally" detector,
 * the blocker-initiated half of the swap protocol. Born as the healer's
 * chokepoint-yield trigger inside SupportMovementBehavior; 56c2 generalizes
 * the same question to ranged units ("is a melee teammate boxed behind me?"),
 * so the detector moves here and the ROLE half of the decision moves to an
 * `eligible` filter each caller supplies:
 *
 *   - the healer's yield: any swappable ally (its GP5 semantics, unchanged);
 *   - the ranged yield (MovementBehavior): swappable MELEE allies only (the
 *     role order — ranged yields to melee, never the reverse).
 *
 * This re-derivable world-state question is what makes the 56c2 "swap
 * request" design STATELESS: a busy blocker doesn't need a stored request
 * from the mover — at its next action-selection poll it re-asks this
 * detector and finds the same boxed teammate still there.
 */

/**
 * The living ally (if any) for whom `unit` is the *only* cell it can advance
 * through — i.e. the ally to swap places with. An adjacent ally `a` qualifies
 * when the unit's cell `h` is `a`'s single forward step toward its target:
 * stepping onto `h` brings `a` closer (in real path distance) to its enemy,
 * and every *other* available neighbour of `a` does not. That's the
 * "strictly blocking a boxed ally" condition (ROADMAP GP5): it fires in a
 * genuine chokepoint, not in open field where `a` always has another forward
 * cell. Returns the first such ally in `world.units` order (deterministic),
 * or null when the unit isn't strictly blocking anyone `eligible`.
 *
 * "Forward" is measured by **grid path distance to the target**, NOT Chebyshev
 * — in a funnel layout the route to an enemy can run *away* from it in
 * straight-line terms (back through a gap, then around), so a Chebyshev test
 * mistakes the gap cell for a retreat and never fires. A BFS distance field
 * from the ally's target (over the static neutral-wall topology, computed once
 * per distinct target) gives the true "does stepping here get me closer"
 * answer for `h` and every neighbour in one sweep.
 *
 * Uses `currentTarget` (the ally's E5 sticky target) so the field is anchored
 * where `a` actually paths; a null target (no enemies) is skipped. The
 * "other forward cell" availability test runs against the NEUTRAL-INCLUSIVE
 * occupancy set — half-cover / walls are neutral *units*, not tiles, so
 * `passable` only rejects them when they're in `occupied`.
 */
export function blockedAlly(
  unit: Unit,
  world: World,
  eligible: (a: Unit) => boolean,
): Unit | null {
  const h = unit.position;
  const hKey = key(h);
  // 44-pre-a — footprint-aware (the §35 set builder); corner-only, a rubble's
  // body cells read as open "other forward" cells. No behavior change expected:
  // the BFS `distanceField` walls are already footprint-correct and gate the
  // result.
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  const walls = neutralCells(world);
  const fields = new Map<number, Map<string, number>>(); // target id → dist field

  for (const a of world.units) {
    if (a.team !== unit.team) continue;
    if (a.id === unit.id) continue;
    if (a.currentHp <= 0) continue;
    if (chebyshev(a.position, h) !== 1) continue;
    if (!eligible(a)) continue;

    const enemy = currentTarget(a, world);
    if (enemy === null) continue;
    let dist = fields.get(enemy.id);
    if (dist === undefined) {
      dist = distanceField(enemy.position, world, walls);
      fields.set(enemy.id, dist);
    }

    const aDist = dist.get(key(a.position));
    if (aDist === undefined) continue; // `a` can't reach its target at all
    const hDist = dist.get(hKey);
    // `h` must be a forward cell for `a` (stepping onto it advances it).
    if (hDist === undefined || hDist >= aDist) continue;

    // Does `a` have any OTHER available forward cell? If so, `h` isn't its
    // only way through → the unit isn't strictly blocking it.
    let hasOtherForward = false;
    for (const [dx, dy] of NEIGHBORS) {
      const n: GridCoord = { x: a.position.x + dx, y: a.position.y + dy };
      if (n.x === h.x && n.y === h.y) continue;
      if (!passable(n, world, occupied)) continue;
      const nDist = dist.get(key(n));
      if (nDist !== undefined && nDist < aDist) {
        hasOtherForward = true;
        break;
      }
    }
    if (!hasOtherForward) return a;
  }
  return null;
}

/**
 * BFS step-distance from `start` to every cell reachable over the static
 * navigable graph (in-bounds, finite tile cost, NOT a neutral/wall cell) —
 * 8-directional, uniform cost, fixed `NEIGHBORS` expansion order so the field
 * is deterministic. Units other than walls are treated as passable here: this
 * is the *topology* of the board (does a route exist through this cell), not a
 * live occupancy check — the caller layers the unoccupied test on top. Returns
 * a `key → distance` map; cells walled off from `start` are simply absent.
 */
export function distanceField(
  start: GridCoord,
  world: World,
  walls: ReadonlySet<string>,
): Map<string, number> {
  const dist = new Map<string, number>();
  const startKey = key(start);
  if (!isNavigable(start, world, walls)) return dist;
  dist.set(startKey, 0);
  const queue: GridCoord[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const d = dist.get(key(c))! + 1;
    for (const [dx, dy] of NEIGHBORS) {
      const n: GridCoord = { x: c.x + dx, y: c.y + dy };
      const nKey = key(n);
      if (dist.has(nKey)) continue;
      if (!isNavigable(n, world, walls)) continue;
      dist.set(nKey, d);
      queue.push(n);
    }
  }
  return dist;
}

/** Set of neutral-unit (wall + half-cover) cell keys — the static blockers.
 *  43-pre — full footprints (`cellsOccupiedBy`): corner-only let the GP5.2
 *  navigable-snap accept a multi-tile rubble's body cell as a trail anchor. */
export function neutralCells(world: World): Set<string> {
  const cells = new Set<string>();
  for (const u of world.units) {
    if (u.team === 'neutral') for (const c of cellsOccupiedBy(u)) cells.add(key(c));
  }
  return cells;
}

/** In-bounds, finite tile cost (excludes chasm), and not a neutral/wall cell. */
export function isNavigable(c: GridCoord, world: World, walls: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  return !walls.has(key(c));
}
