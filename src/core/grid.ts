import type { GridCoord } from './types';

/**
 * The grid distance between two cells: Chebyshev, since movement is
 * eight-way and a diagonal costs one step. Cell to cell; `unitDistance`
 * (`src/sim/occupancy.ts`) measures body to body on top of it.
 *
 * It lives in core, apart from the occupancy helpers, so that the targeting
 * strategies, which the unit catalog calls while it loads, import nothing
 * that imports the catalog (gotcha #114).
 */
export function distanceBetween(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
