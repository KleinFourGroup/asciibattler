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
  /** True when `cell` is a tile that drops (a chasm, deep water): the victim
   *  falls as the slide ends. Absent otherwise. */
  drops?: true;
}

/** `pushLanding`'s options. */
export interface PushOptions {
  /** Where a victim standing on the origin is pushed away from (the caster). */
  readonly fallback?: GridCoord;
  /**
   * Whether the victim can fall: the walk then enters the first tile that
   * drops and ends there. False (the default) stops it before one, as at the
   * board's edge: a self-move and a boss never fall.
   */
  readonly drops?: boolean;
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
 *   ends before the board's edge or an impassable tile (`costAt` prices each
 *   as Infinity), a cell another unit's body covers (scenery included), or a
 *   cell another unit has claimed (gotcha #113). The victim's own claim, a
 *   step it is abandoning, does not end it.
 * - With `drops`, a tile that drops (a chasm, deep water) ends the walk on
 *   it instead, the landing marked `drops`: the victim falls as the slide
 *   ends. A body or a claim on that tile (a victim already falling there)
 *   still stops the walk before it.
 * - `toward` also ends when the next cell would be the origin or no nearer to
 *   it (Chebyshev), so a pull stops beside its caster rather than passing it.
 * - Scenery, a body larger than one cell, and a victim already falling (one
 *   standing on a tile that drops) never move.
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
  opts: PushOptions = {},
): PushLanding | null {
  if (cells <= 0) return null;
  if (isInertNeutral(victim) || footprintOf(victim) > 1) return null;
  if (world.tileGrid.defAt(victim.position).drops === true) return null;
  const { fallback } = opts;

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
    if (taken.has(cellKey(next))) break;
    if (direction === 'toward') {
      const now = chebyshev(at, origin);
      const then = chebyshev(next, origin);
      if (then === 0 || then >= now) break;
    }
    // Off the board `costAt` is Infinity too, so this is also the edge.
    if (!isFinite(world.tileGrid.costAt(next))) {
      if (opts.drops === true && world.tileGrid.inBounds(next) && world.tileGrid.defAt(next).drops === true) {
        return { cell: next, cells: walked + 1, drops: true };
      }
      break;
    }
    at = next;
    walked++;
  }
  return walked === 0 ? null : { cell: at, cells: walked };
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
