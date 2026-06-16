import type { GridCoord } from '../core/types';
import type { World } from './World';
import { hasLineOfSight } from './LineOfSight';

/**
 * GP4 — find the nearest reachable cell from which `from` could ACT on a unit
 * at `target`: a cell `c` with `chebyshev(c, target)` in the band
 * `[minRange, range]` (O4 — `minRange` defaults 0, i.e. range-only, GP4's
 * original behavior) and (when `losBlockers` is non-null) line of sight to the
 * target. A non-zero `minRange` makes a too-close unit search for a cell FARTHER
 * out (the kiting standoff), since its own cell / near cells fail the lower
 * bound. The two callers:
 *
 *   - archers / mage  — `losBlockers` = the LOS occluders (the shot is gated);
 *   - the catapult    — `losBlockers` = null (it lobs over walls, range only).
 *
 * The caller pathfinds to the returned cell instead of to the target's own
 * cell, so a ranged unit holds at standoff with a clear shot rather than
 * charging in / creeping at a wall. (The helper is `losBlockers`-agnostic so a
 * future range-only support caller could reuse it — the healer was considered
 * but its approach is already capped at heal range by its own in-range idle,
 * so its real fix is GP5, not here.)
 *
 * Method — a bounded breadth-first search outward from `from`:
 *
 *   - **Traverses the same hard-blocker graph `findPath` uses**: in-bounds,
 *     finite `tileGrid.costAt`, and not a neutral/wall cell (built here from
 *     `world.units`). So any cell this returns is provably routable-to over
 *     that graph — `findPath(from, cell)` cannot come back empty, which is
 *     what keeps this from re-introducing the old `pickGoalCellInRange` freeze
 *     (a goal cell that was itself a wall/ally → `findPath` → `[]` → stall).
 *   - **Does NOT filter soft (unit-occupied) cells.** A transiently-occupied
 *     acting cell is still a valid *goal*: `findPath` routes toward it and the
 *     caller's in-range abstain stops the unit a cell short, before any
 *     collision. Filtering them would cause spurious fallbacks every time the
 *     ideal standoff cell is briefly occupied.
 *   - **Capped at `range + searchSlack` BFS depth.** A target beyond the cap
 *     returns null → the caller falls back to charging the target's cell (the
 *     anti-freeze guarantee); the unit snaps to the acting cell once it closes
 *     to within the cap. This bounds the per-unit-per-tick work.
 *
 * Deterministic: fixed `dx,dy = -1..1` neighbour expansion order + FIFO queue
 * → "the first qualifying cell wins" is reproducible, so the sim stays
 * byte-stable per seed.
 *
 * Returns null when no qualifying cell is reachable within the cap.
 */
export function nearestActingCell(
  from: GridCoord,
  target: GridCoord,
  range: number,
  searchSlack: number,
  world: World,
  losBlockers: readonly GridCoord[] | null,
  // O4 — the engagement FLOOR; cells closer than this to the target are rejected
  // (the unit kites out). Defaults 0 (range-only) so GP4's other callers and the
  // pre-O4 firing-cell search stay byte-identical.
  minRange = 0,
): GridCoord | null {
  // Hard blockers for BFS traversal: neutral-team units (walls + half-cover),
  // exactly what `findPath` treats as impassable, so reachability matches.
  const wallCells = new Set<string>();
  for (const u of world.units) {
    if (u.team === 'neutral') wallCells.add(`${u.position.x},${u.position.y}`);
  }

  const maxDepth = range + searchSlack;
  const startKey = `${from.x},${from.y}`;
  const visited = new Set<string>([startKey]);
  const queue: { c: GridCoord; depth: number }[] = [{ c: from, depth: 0 }];

  for (let head = 0; head < queue.length; head++) {
    const { c, depth } = queue[head]!;
    const d = chebyshev(c, target);
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

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
