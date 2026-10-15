import type { GridCoord } from '../core/types';
import { chebyshev } from './movement';

/** The cost to enter a cell. Infinity makes it impassable, as a `blockers`
 *  entry does, from data. Every cost must be at least 1, or the Chebyshev
 *  heuristic is no longer admissible and A* loses its optimality (gotcha
 *  #34). Takes bare `(x, y)`, not a coord: it runs once per footprint cell
 *  per neighbour per expansion, where allocating a coord shows in a
 *  profile. */
export type CostFn = (x: number, y: number) => number;

const UNIT_COST: CostFn = () => 1;

/**
 * A count of A* searches, so a test can hold the per-tick search budget
 * (`tests/integration/pathing-perf.test.ts`). It moves no path, no RNG and
 * no sim state, so it cannot disturb determinism. Reset and read in tests.
 */
let pathfindingCallCount = 0;
export const pathfindingStats = {
  get calls(): number {
    return pathfindingCallCount;
  },
  reset(): void {
    pathfindingCallCount = 0;
  },
};

/**
 * A* on the battle grid. Pure function: same inputs, same path, every time.
 *
 * - Eight-way moves (DESIGN.md's adjacency). A step costs the destination
 *   cell's cost, 1 by default; `costAt` weights tiles (`TileGrid`). A
 *   diagonal pays the destination's cost as an orthogonal step does.
 * - The heuristic is Chebyshev distance, admissible and consistent while
 *   every cost is at least 1, so the path found is a cheapest one.
 * - The start cell is always passable, even if it is in `blockers`, so a
 *   unit paths from its own cell without the caller filtering it out. Its
 *   cost is not charged; a cost is paid on entering a cell.
 * - The goal must be passable, unless `bestEffort`. A caller that wants a
 *   cell beside a blocked target passes that cell as the goal.
 *
 * `gridW` and `gridH` are separate, so a rectangular arena paths right;
 * one value passed for both would clip an axis without a sound.
 *
 * Returns `[start, ..., goal]`, both ends included, or `[]` when there is
 * no path, an endpoint is off the grid, or the goal is blocked.
 *
 * `bestEffort` (default false): when the goal is unreachable (blocked or
 * walled off), return the path to the reachable cell closest to it (least
 * Chebyshev to the goal, then the shortest route) instead of `[]`, so a
 * rally or a rubble approach toward a walled-off cell does not freeze the
 * unit. A chase leaves it off.
 *
 * `footprint` (default 1): the mover's N×N body edge. A* still moves the
 * one corner; passability checks the whole block (`corner` to `corner + N`
 * toward +x and +y), so a wider body needs a wider corridor. The footprint
 * is a plain number, so this module knows nothing of units or the catalog.
 */
export function findPath(
  start: GridCoord,
  goal: GridCoord,
  blockers: readonly GridCoord[],
  gridW: number,
  gridH: number,
  costAt: CostFn = UNIT_COST,
  bestEffort = false,
  footprint = 1,
): GridCoord[] {
  pathfindingCallCount++; // the search count (`pathfindingStats`)
  if (!inBounds(start, gridW, gridH) || !inBounds(goal, gridW, gridH)) return [];

  // The search's state is typed arrays over the packed index
  // (`y * gridW + x`), allocated per call. Don't share or pool them: a pooled
  // array reused with a stale field is a determinism bug, and per-call arrays
  // have no reset to get wrong. The expansion order is `popLowestFIdx`'s
  // strict total order (its (y, x) tail is unique per cell), so the open
  // list's order cannot change which node pops. `scripts/perf-oracle.sh` and
  // the pathing pins hold the paths.
  const size = gridW * gridH;
  const startIdx = start.y * gridW + start.x;
  const goalIdx = goal.y * gridW + goal.x;

  // The start cell is passable even if it is in `blockers`. The bounds check
  // is per axis because packing an off-grid coord (x = -1) would alias an
  // on-grid cell (`y * W - 1`, the previous row's last): an off-grid blocker
  // must stay a no-op.
  const blocked = new Uint8Array(size);
  for (const b of blockers) {
    if (b.x < 0 || b.y < 0 || b.x >= gridW || b.y >= gridH) continue;
    const bIdx = b.y * gridW + b.x;
    if (bIdx !== startIdx) blocked[bIdx] = 1;
  }

  // A candidate corner is a node when its whole block is on the grid,
  // unblocked and of finite cost, since a body stands on every cell it
  // covers. The step's cost is still the corner's, so the heuristic on the
  // corner stays admissible (gotcha #34): only passability widens, never the
  // metric. Returns the corner's cost when the block fits, NaN when not, one
  // call per candidate.
  const fitCost = (cx: number, cy: number): number => {
    let cornerCost = NaN;
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= gridW || y >= gridH) return NaN;
        if (blocked[y * gridW + x] === 1) return NaN;
        const cost = costAt(x, y);
        if (!isFinite(cost)) return NaN;
        if (dx === 0 && dy === 0) cornerCost = cost;
      }
    }
    return cornerCost;
  };

  // A goal whose block doesn't fit is unreachable. Strict mode gives up;
  // best-effort still searches toward it and returns the closest reachable corner.
  if (isNaN(fitCost(goal.x, goal.y)) && !bestEffort) return [];

  if (startIdx === goalIdx) return [start];

  const gScore = new Float64Array(size).fill(Infinity);
  const fScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  gScore[startIdx] = 0;
  fScore[startIdx] = chebyshev(start, goal);
  // The open "set": an index list + a membership mask (no dedup scan needed).
  const open: number[] = [startIdx];
  const inOpen = new Uint8Array(size);
  inOpen[startIdx] = 1;

  // best-effort: the closest-to-goal cell actually reached (min Chebyshev-to-
  // goal, ties → shortest approach). Seeded with the start, so a walled-in unit
  // "routes" to itself (a length-1 path = hold), never `[]` (a freeze).
  let closestIdx = startIdx;
  let closestH = chebyshev(start, goal);
  let closestG = 0;

  while (open.length > 0) {
    const currentIdx = popLowestFIdx(open, inOpen, fScore, gridW, start, goal);
    if (currentIdx === goalIdx) return reconstruct(cameFrom, currentIdx, gridW);

    const cx = currentIdx % gridW;
    const cy = (currentIdx / gridW) | 0;
    const currentG = gScore[currentIdx];

    if (bestEffort) {
      const h = Math.max(Math.abs(cx - goal.x), Math.abs(cy - goal.y));
      if (h < closestH || (h === closestH && currentG < closestG)) {
        closestH = h;
        closestG = currentG;
        closestIdx = currentIdx;
      }
    }

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        // The whole block must fit: bounds, blockers and finite cost.
        const stepCost = fitCost(nx, ny);
        if (isNaN(stepCost)) continue;
        const nIdx = ny * gridW + nx;

        const tentativeG = currentG + stepCost;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = currentIdx;
          gScore[nIdx] = tentativeG;
          fScore[nIdx] =
            tentativeG + Math.max(Math.abs(nx - goal.x), Math.abs(ny - goal.y));
          if (inOpen[nIdx] === 0) {
            inOpen[nIdx] = 1;
            open.push(nIdx);
          }
        }
      }
    }
  }
  // Goal never reached. Strict → no path; best-effort → the closest cell we got
  // to (a length-1 [start] if the unit is fully walled in — caller treats that
  // as "hold", never a freeze).
  return bestEffort ? reconstruct(cameFrom, closestIdx, gridW) : [];
}

function inBounds(c: GridCoord, gridW: number, gridH: number): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < gridW && c.y < gridH;
}

/**
 * A linear-scan pop over the open list of packed indices: plain numeric
 * compares on a small grid's open set. A heap is worth building only if a
 * profile shows the pop dominating. Neither the swap-remove nor the list's
 * order can change which node pops: the comparator is a strict total order
 * (the (y, x) tail is unique per cell), so the minimum does not depend on
 * the container's order.
 *
 * An f tie goes toward the goal, then toward the straight line: among equal
 * f, the lower Chebyshev distance to the goal (h), then the node nearer the
 * start-to-goal line, which drains the Chebyshev cone's plateau of ties into
 * a straight route, then the numeric (y, x). This only orders nodes of equal
 * f: f never changes, the heuristic stays admissible (gotcha #34), and the
 * path stays a cheapest one; it chooses which.
 *
 * The distance from the line is the integer cross product
 * |(n − start) × (goal − start)|, proportional to the true distance (the
 * constant divisor changes no comparison within a search) and symmetric
 * under mirroring, so a mirrored world routes mirrored paths. Without it the
 * last key would decide every open-ground tie and drift routes to one side;
 * with it, (y, x) decides only true double ties, pairs mirrored about the
 * line, and some total order must. Don't shuffle ties with the RNG: it would
 * change the stream on every tie.
 */
function popLowestFIdx(
  open: number[],
  inOpen: Uint8Array,
  fScore: Float64Array,
  gridW: number,
  start: GridCoord,
  goal: GridCoord,
): number {
  const lineDx = goal.x - start.x;
  const lineDy = goal.y - start.y;
  let bestPos = 0;
  let bestIdx = -1;
  let bestF = Infinity;
  let bestH = Infinity;
  let bestCross = Infinity;
  let bestX = Infinity;
  let bestY = Infinity;
  for (let p = 0; p < open.length; p++) {
    const idx = open[p];
    const f = fScore[idx];
    if (f > bestF) continue;
    const x = idx % gridW;
    const y = (idx / gridW) | 0;
    const h = Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y));
    const cross = Math.abs((x - start.x) * lineDy - (y - start.y) * lineDx);
    const better =
      f < bestF ||
      h < bestH ||
      (h === bestH &&
        (cross < bestCross || (cross === bestCross && (y < bestY || (y === bestY && x < bestX)))));
    if (better) {
      bestF = f;
      bestH = h;
      bestCross = cross;
      bestX = x;
      bestY = y;
      bestPos = p;
      bestIdx = idx;
    }
  }
  open[bestPos] = open[open.length - 1];
  open.pop();
  inOpen[bestIdx] = 0;
  return bestIdx;
}

function reconstruct(cameFrom: Int32Array, endIdx: number, gridW: number): GridCoord[] {
  const path: GridCoord[] = [{ x: endIdx % gridW, y: (endIdx / gridW) | 0 }];
  let cur = endIdx;
  while (cameFrom[cur] !== -1) {
    cur = cameFrom[cur];
    path.push({ x: cur % gridW, y: (cur / gridW) | 0 });
  }
  return path.reverse();
}
