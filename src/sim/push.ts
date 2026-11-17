import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import { isInertNeutral } from './Unit';
import type { World } from './World';
import { cellKey, claimedCells, footprintOf, occupiedCells } from './occupancy';

/**
 * A forced move's sense: `away` from its origin (a knockback) or `toward` it
 * (a pull).
 */
export type PushDirection = 'away' | 'toward';

/** Where a forced move lands one unit, and how many cells it walked. */
export interface PushLanding {
  cell: GridCoord;
  /** The cells walked, at least 1: the slide's length. */
  cells: number;
}

/**
 * Where a forced move puts `victim`, or null when it moves no cell.
 *
 * - The direction is one of the eight grid directions, the sign of the offset
 *   from `origin` to the victim (`away`) or from the victim to `origin`
 *   (`toward`), fixed before the first cell, so nothing is drawn. A victim
 *   standing on `origin` is pushed away from `fallback` (the caster); with
 *   no offset there either, it stays.
 * - It walks up to `cells` cells and lands on the last free one. The walk
 *   ends before the board's edge or an impassable tile (a chasm, deep water;
 *   `costAt` prices both as Infinity), a cell another unit's body covers
 *   (scenery included), or a cell another unit has claimed (gotcha #113).
 *   The victim's own claim, a step it is abandoning, does not end it.
 * - `toward` also ends when the next cell would be the origin or no nearer to
 *   it (Chebyshev), so a pull stops beside its caster rather than passing it.
 * - Scenery and a body larger than one cell never move.
 *
 * A diagonal passes between two blocked cells, as a step may (the router has
 * no corner rule). Pure: it reads the world and changes nothing.
 */
export function pushLanding(
  world: World,
  victim: Unit,
  origin: GridCoord,
  direction: PushDirection,
  cells: number,
  fallback?: GridCoord,
): PushLanding | null {
  if (cells <= 0) return null;
  if (isInertNeutral(victim) || footprintOf(victim) > 1) return null;

  const from = victim.position;
  let dx = Math.sign(from.x - origin.x);
  let dy = Math.sign(from.y - origin.y);
  if (dx === 0 && dy === 0) {
    if (direction === 'toward' || fallback === undefined) return null;
    dx = Math.sign(from.x - fallback.x);
    dy = Math.sign(from.y - fallback.y);
    if (dx === 0 && dy === 0) return null;
  }
  if (direction === 'toward') {
    dx = -dx;
    dy = -dy;
  }

  const taken = occupiedCells(world, undefined, { excludeId: victim.id });
  for (const k of claimedCells(world, undefined, { excludeId: victim.id })) taken.add(k);

  let at = from;
  let walked = 0;
  for (let i = 0; i < cells; i++) {
    const next = { x: at.x + dx, y: at.y + dy };
    // Off the board `costAt` is Infinity too, so this is also the edge.
    if (!isFinite(world.tileGrid.costAt(next))) break;
    if (taken.has(cellKey(next))) break;
    if (direction === 'toward') {
      const now = chebyshev(at, origin);
      const then = chebyshev(next, origin);
      if (then === 0 || then >= now) break;
    }
    at = next;
    walked++;
  }
  return walked === 0 ? null : { cell: at, cells: walked };
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
