import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
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
