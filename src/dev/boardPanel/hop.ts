/**
 * 108c — THE HOP, as a dev dial (`hop`, state.ts): the rival to 107d-post's
 * upright depth, kept until the marks exist (WORKLOG §107d). A diagonal move
 * passes the corner vertex its four cells share; when either corner cell is
 * higher than both ends, the glyph arcs over it, peaking at that corner's
 * height mid-move. The arc is E7.D's `4t(1−t)`, added by `SpriteAnimator` on
 * top of the §81c2 ground profile, so at t = 0.5 the anchor stands exactly on
 * the higher corner (`tests/board/hop.test.ts` measures it with the clip
 * instrument). Upright depth stays on either way. Deleted with the stop-2
 * verdict, or moved into `BattleRenderer.animateStep` if the hop wins.
 *
 * Pure: world positions in, the arc's peak height out. The grid is recovered
 * from world XZ (the inverse of `gridToWorld`), because the seam that calls
 * this sees only the lerp's two positions.
 */

import type { Vector3 } from 'three';

/** How close to a whole tile both axes must be for a move to count as a diagonal step. */
const WHOLE_TILE_EPS = 1e-3;

/**
 * The arc height for a ground lerp from `from` to `to` (world): 0 unless the
 * move is exactly one tile along both axes (a settle-back from mid-move never
 * is) and a corner cell is higher than both ends.
 */
export function diagonalHop(
  from: Vector3,
  to: Vector3,
  gridW: number,
  gridH: number,
  heightAt: (gx: number, gy: number) => number,
): number {
  const dx = Math.abs(to.x - from.x);
  const dz = Math.abs(to.z - from.z);
  if (Math.abs(dx - 1) > WHOLE_TILE_EPS || Math.abs(dz - 1) > WHOLE_TILE_EPS) return 0;
  const gx = (x: number): number => Math.round(x - 0.5 + gridW / 2);
  const gy = (z: number): number => Math.round(gridH / 2 - z - 0.5);
  const corner = Math.max(heightAt(gx(to.x), gy(from.z)), heightAt(gx(from.x), gy(to.z)));
  return Math.max(0, corner - Math.max(from.y, to.y));
}
