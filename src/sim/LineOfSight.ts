import type { GridCoord } from '../core/types';

/**
 * Integer-grid line-of-sight check. Walks the cells along the line from
 * `from` to `to` using Bresenham's algorithm; returns `true` iff no
 * intermediate cell appears in `blockers`. Endpoints are NOT checked — the
 * caller decides whether the source or destination cell counts as a
 * blocker (typically the attacker is at `from` and the target itself is at
 * `to`, so neither should be in the blocker set).
 *
 * Bresenham was chosen over a supercover (every-cell-the-line-touches)
 * walk because it's the standard roguelike LOS shape and matches the
 * existing 8-directional Chebyshev movement: a unit that can reach a cell
 * in one orthogonal step covers the same trajectory the LOS check walks.
 * If a future feature needs strict "no diagonal squeeze through touching
 * walls," we can swap to a supercover variant — for now this is the
 * tactically simplest behaviour.
 *
 * Calling with `from === to` returns `true` (you can always see yourself /
 * an adjacent target — no intermediate cells to check). The caller is
 * expected to handle out-of-bounds inputs; the function doesn't validate
 * the grid extent because LOS doesn't need it (cells outside the grid are
 * never in the blocker list).
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

  // Step until we reach the destination. Each iteration advances one cell
  // along the Bresenham line and checks the new cell against blockers
  // (excluding the destination itself, which is the target's cell).
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
