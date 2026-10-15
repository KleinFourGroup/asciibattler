import type { GridCoord } from '../core/types';

/**
 * Line of sight on the grid: walks the cells from `from` to `to` by
 * Bresenham's algorithm, true when no cell between them is in `blockers`.
 * The endpoints are not checked, since the attacker stands at `from` and
 * the target at `to`, and neither should block.
 *
 * Bresenham, not a supercover walk (every cell the line touches): it is the
 * usual roguelike shape and matches eight-way movement. It lets a ray pass
 * diagonally between two walls that touch at a corner; a supercover walk
 * would not.
 *
 * `from === to`, or an adjacent target, is true: there is no cell between.
 * The grid's extent isn't checked, as nothing off the grid is a blocker; the
 * caller handles out-of-bounds input.
 */
export function hasLineOfSight(
  from: GridCoord,
  to: GridCoord,
  blockers: readonly GridCoord[],
): boolean {
  if (blockers.length === 0) return true;
  if (from.x === to.x && from.y === to.y) return true;

  const blocked = new Set<string>();
  for (const b of blockers) blocked.add(`${b.x},${b.y}`);

  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx - dy;

  // Step to the destination, one cell along the line each pass, checking the
  // new cell against the blockers; the destination itself is not checked.
  while (true) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === to.x && y === to.y) return true;
    if (blocked.has(`${x},${y}`)) return false;
  }
}
