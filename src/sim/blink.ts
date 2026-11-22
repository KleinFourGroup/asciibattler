import type { GridCoord } from '../core/types';
import { isInertNeutral, type Unit } from './Unit';
import type { World } from './World';
import { cellKey, cellsOccupiedBy, claimedCells, occupiedCells } from './occupancy';

/**
 * Where a blink (a `move` op in `blink` mode) puts its caster beside
 * `target`, or null when no cell beside it is free.
 *
 * The blink is blind to what stands between: no route and no line of sight,
 * so it passes walls, chasms and bodies that stop the dash. Its range is
 * checked by the caller, body to body.
 *
 * - A candidate is a cell at Chebyshev distance 1 from the target's body:
 *   on the board, of finite tile cost (so never a chasm or deep water, and a
 *   blink never falls), with no unit's body on it, the caster's own
 *   included, and no claim on it (gotcha #113: a unit placed on a claimed
 *   cell overlaps the mover arriving there).
 * - Of those, the farthest from the caster by Chebyshev distance, the
 *   board's measure; among equals, the one nearest it in a straight line
 *   (the least squared Euclidean distance), so a blink from the west lands
 *   due east of its target rather than on a diagonal; then the first in
 *   scan order (y, then x), so nothing is drawn.
 *
 * Pure: it reads the world and changes nothing.
 */
export function blinkLanding(world: World, caster: Unit, target: Unit): GridCoord | null {
  const taken = occupiedCells(world);
  for (const k of claimedCells(world)) taken.add(k);
  const body = cellsOccupiedBy(target);
  const bodyKeys = new Set(body.map(cellKey));

  const from = caster.position;
  let best: GridCoord | null = null;
  let bestCheb = -1;
  let bestEuclid = Infinity;
  const seen = new Set<string>();
  const candidates: GridCoord[] = [];
  for (const c of body) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = { x: c.x + dx, y: c.y + dy };
        const k = cellKey(n);
        if (bodyKeys.has(k) || seen.has(k)) continue;
        seen.add(k);
        if (!world.tileGrid.inBounds(n) || !isFinite(world.tileGrid.costAt(n))) continue;
        if (taken.has(k)) continue;
        candidates.push(n);
      }
    }
  }
  candidates.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const n of candidates) {
    const cheb = Math.max(Math.abs(n.x - from.x), Math.abs(n.y - from.y));
    const euclid = (n.x - from.x) ** 2 + (n.y - from.y) ** 2;
    if (cheb > bestCheb || (cheb === bestCheb && euclid < bestEuclid)) {
      best = n;
      bestCheb = cheb;
      bestEuclid = euclid;
    }
  }
  return best;
}

/**
 * The cost of walking from every cell to the nearest of `seeds`, as the
 * pather prices a step: the tile cost of each cell entered
 * (`TileGrid.costAt`: 1 on floor, sand 2, hills 3, mud 4), over the eight
 * neighbours, through cells of finite cost that no inert neutral (a wall,
 * cover, rubble) stands on. Bodies are passed, since they move. Infinity
 * where no walk reaches. Indexed `y × gridW + x`.
 *
 * A Dijkstra outward from the seeds, which cost 0, with a bucket for each
 * whole cost, since tile costs are whole numbers. Pure.
 */
export function walkCosts(world: World, seeds: readonly GridCoord[]): Float64Array {
  const w = world.gridW;
  const h = world.gridH;
  const cost = new Float64Array(w * h).fill(Infinity);
  const walls = new Set<number>();
  for (const u of world.units) {
    if (isInertNeutral(u)) for (const c of cellsOccupiedBy(u)) walls.add(c.y * w + c.x);
  }
  const enter = (i: number): number => {
    if (walls.has(i)) return Infinity;
    const x = i % w;
    return world.tileGrid.costAt({ x, y: (i - x) / w });
  };
  const buckets: number[][] = [];
  for (const s of seeds) {
    if (s.x < 0 || s.y < 0 || s.x >= w || s.y >= h) continue;
    const i = s.y * w + s.x;
    if (cost[i] === 0) continue;
    cost[i] = 0;
    (buckets[0] ??= []).push(i);
  }
  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d];
    if (bucket === undefined) continue;
    for (let j = 0; j < bucket.length; j++) {
      const i = bucket[j]!;
      if (cost[i] !== d) continue;
      // A walker reaching this cell from a neighbour pays its entry.
      const step = enter(i);
      if (!isFinite(step)) continue;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (!isFinite(enter(n))) continue; // the walker must stand there
          const nd = d + step;
          if (nd < cost[n]!) {
            cost[n] = nd;
            (buckets[nd] ??= []).push(n);
          }
        }
      }
    }
  }
  return cost;
}

/**
 * Where a ready blink jumps when no foe is within its range: toward `seeds`,
 * where its caster is walking (a tile order's rally cell, or the cells from
 * which its foe is in blink range). Of the cells within `range` of the
 * caster by Chebyshev distance, on the board, of finite tile cost, with no
 * body and no claim on them (as `blinkLanding`'s), the one whose walk to the
 * seeds costs least (`walkCosts`); null unless that walk is cheaper than the
 * caster's own by more than `range`. On open floor a jump saves exactly its
 * range, so the blink is spent only where something stands in the way: a
 * chasm, a wall, a slow tile to wade. Ties go to the cell nearest the caster
 * in a straight line, then the first in scan order (y, then x).
 *
 * Pure: it reads the world and changes nothing.
 */
export function blinkJump(
  world: World,
  caster: Unit,
  seeds: readonly GridCoord[],
  range: number,
): GridCoord | null {
  const w = world.gridW;
  const walk = walkCosts(world, seeds);
  const from = caster.position;
  const here = walk[from.y * w + from.x]!;
  const taken = occupiedCells(world);
  for (const k of claimedCells(world)) taken.add(k);

  let best: GridCoord | null = null;
  let bestWalk = Infinity;
  let bestEuclid = Infinity;
  for (let y = from.y - range; y <= from.y + range; y++) {
    for (let x = from.x - range; x <= from.x + range; x++) {
      const c = { x, y };
      if (!world.tileGrid.inBounds(c) || !isFinite(world.tileGrid.costAt(c))) continue;
      if (taken.has(cellKey(c))) continue;
      const cw = walk[y * w + x]!;
      const euclid = (x - from.x) ** 2 + (y - from.y) ** 2;
      if (cw < bestWalk || (cw === bestWalk && euclid < bestEuclid)) {
        best = c;
        bestWalk = cw;
        bestEuclid = euclid;
      }
    }
  }
  if (best === null || !isFinite(bestWalk) || !(here - bestWalk > range)) return null;
  return best;
}
