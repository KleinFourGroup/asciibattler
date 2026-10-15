import type { GridCoord } from '../core/types';
import type { World } from './World';
import { isInertNeutral } from './Unit';
import { hasLineOfSight } from './LineOfSight';
import { cellKey, cellsOccupiedBy, claimedCells, distanceBetween, occupiedCells } from './occupancy';

/**
 * The nearest reachable cell from which `from` could act on a unit at
 * `target`: a cell whose Chebyshev distance to `target` is within
 * `[minRange, range]` and, when `losBlockers` is not null, with a line of
 * sight to it. A minimum range above 0 makes a unit too close search for a
 * cell farther out (the kite), since its own and the near cells fail the
 * floor. Its one caller is `positioning.engagementDirective`'s firing cell:
 * the occluders for a sight-gated ability, null for one that lobs over walls
 * (the catapult).
 *
 * The caller paths to this cell rather than to the target's, so a ranged
 * unit holds at standoff with a clear shot instead of charging in or
 * creeping at a wall.
 *
 * A bounded breadth-first search outward from `from`:
 *
 *   - It walks `findPath`'s hard-blocker graph: in bounds, of finite tile
 *     cost, and not an inert neutral's cell. So any cell it returns can be
 *     routed to, and `findPath(from, cell)` is never empty; a goal that is
 *     itself a wall freezes the unit.
 *   - It does not skip cells a unit stands on. A briefly occupied acting
 *     cell is still a valid goal: the route goes toward it, and the caller's
 *     in-range hold stops the unit a cell short, before any collision.
 *     Skipping them would fall back to charging each time the best standoff
 *     cell was briefly taken.
 *   - It stops at depth `range + searchSlack` (`SIM.actingCellSearchSlack`).
 *     A target beyond returns null, and the caller charges the target's cell;
 *     the unit takes the acting cell once it is within the cap. This bounds
 *     the work per unit per tick.
 *
 * Deterministic: a fixed neighbour order (`dx, dy` from -1 to 1) and a FIFO
 * queue, so the first qualifying cell is the same every run.
 *
 * Null when no qualifying cell is reachable within the cap.
 */
export function nearestActingCell(
  from: GridCoord,
  target: GridCoord,
  range: number,
  searchSlack: number,
  world: World,
  losBlockers: readonly GridCoord[] | null,
  // The firing floor: a cell closer than this to the target is rejected, and
  // the unit kites out. 0 tests range alone.
  minRange = 0,
): GridCoord | null {
  // The search's hard blockers: every cell of an inert neutral (walls, half
  // cover, rubble), as `buildMovementContext`'s `pathBlockers` has them, so
  // reachability here matches the route's. A camp member is soft there and
  // must not wall the search here. A rubble's whole body counts: with its
  // corner alone the search could return a body cell, a goal no route
  // reaches.
  const wallCells = new Set<string>();
  for (const u of world.units) {
    if (isInertNeutral(u)) for (const c of cellsOccupiedBy(u)) wallCells.add(cellKey(c));
  }

  const maxDepth = range + searchSlack;
  const startKey = `${from.x},${from.y}`;
  const visited = new Set<string>([startKey]);
  const queue: { c: GridCoord; depth: number }[] = [{ c: from, depth: 0 }];

  for (let head = 0; head < queue.length; head++) {
    const { c, depth } = queue[head]!;
    const d = distanceBetween(c, target);
    if (
      d <= range &&
      d >= minRange &&
      (losBlockers === null || hasLineOfSight(c, target, losBlockers))
    ) {
      return c;
    }
    if (depth >= maxDepth) continue;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        const nKey = `${nx},${ny}`;
        if (visited.has(nKey)) continue;
        visited.add(nKey);
        if (nx < 0 || ny < 0 || nx >= world.gridW || ny >= world.gridH) continue;
        if (!isFinite(world.tileGrid.costAt({ x: nx, y: ny }))) continue;
        if (wallCells.has(nKey)) continue;
        queue.push({ c: { x: nx, y: ny }, depth: depth + 1 });
      }
    }
  }
  return null;
}

/**
 * The placement query: up to `count` of the nearest free, passable cells
 * within `radiusCells` (search depth) of `anchor`, for a summon's minions
 * (`interpreter.ts`) and `World.shove`'s landing. The same bounded search
 * and fixed order as `nearestActingCell`, so the first free cells are the
 * same every run, with two differences:
 *
 *   - it returns cells to place units on, not a position to act from;
 *   - a cell is a candidate only when free (no unit on it, no claim), as a
 *     unit cannot appear on a taken cell, though the search still passes
 *     through a taken cell that is passable, so a summon can land beyond an
 *     ally. Walls of terrain (an infinite cost) block both, as they do
 *     movement; this search does not treat inert neutrals as walls.
 *
 * Fewer than `count`, or `[]`, when the radius holds too few free cells,
 * and the summon places only as many.
 */
export function nearestFreeCells(
  anchor: GridCoord,
  count: number,
  radiusCells: number,
  world: World,
): GridCoord[] {
  // Every cell of every unit, scenery included, is taken as a landing, and
  // still passable for the search when its tile is.
  const occupied = occupiedCells(world);
  // A claimed cell is taken too: a unit placed there would collide when the
  // claimant's move lands (gotcha #113). The search still passes through it,
  // since the claimant is not there yet.
  for (const k of claimedCells(world)) occupied.add(k);

  const found: GridCoord[] = [];
  const startKey = `${anchor.x},${anchor.y}`;
  const visited = new Set<string>([startKey]);
  const queue: { c: GridCoord; depth: number }[] = [{ c: anchor, depth: 0 }];

  for (let head = 0; head < queue.length; head++) {
    const { c, depth } = queue[head]!;
    if (!occupied.has(cellKey(c))) {
      found.push(c);
      if (found.length >= count) return found;
    }
    if (depth >= radiusCells) continue;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        const nKey = `${nx},${ny}`;
        if (visited.has(nKey)) continue;
        visited.add(nKey);
        if (nx < 0 || ny < 0 || nx >= world.gridW || ny >= world.gridH) continue;
        if (!isFinite(world.tileGrid.costAt({ x: nx, y: ny }))) continue;
        queue.push({ c: { x: nx, y: ny }, depth: depth + 1 });
      }
    }
  }
  return found;
}
