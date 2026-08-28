import type { GridCoord } from '../core/types';

/** Cost to ENTER a cell. Returning Infinity treats the cell as impassable
 *  (same effect as a `blockers` entry, but data-driven). Callers MUST keep
 *  every returned cost >= 1, otherwise the Chebyshev heuristic stops being
 *  admissible and A* loses its optimality guarantee. */
export type CostFn = (cell: GridCoord) => number;

const UNIT_COST: CostFn = () => 1;

/**
 * J2 — a dev/test instrument counting A* searches so the per-tick recompute
 * budget is assertable (the ROADMAP §J2 "bounded recompute count" guard;
 * see tests/integration/pathing-perf.test.ts). The counter influences no
 * path, no RNG, and no sim state — it is pure-output-neutral, so it can't
 * perturb determinism. The deferred path cache, when it lands, shows up as a
 * drop in this number against the same scenario, so the guard doubles as the
 * cache's effectiveness meter. Reset + read in tests.
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
 * - 8-directional moves (king's moves; matches DESIGN.md "8-directional
 *   adjacency"). Step cost is the destination cell's cost, default 1; pass
 *   `costAt` to weight tiles (e.g. shallow_water costs 2 — see TileGrid).
 *   Diagonal cuts pay the destination cost just like orthogonal moves.
 * - Chebyshev distance is the heuristic — admissible and consistent when
 *   every cost is >= 1, so A* finds the optimal min-cost path.
 * - The start cell is always passable, even if it appears in `blockers`. This
 *   lets a moving unit pathfind from its own cell without the caller having
 *   to filter it out. The start cell's cost is NOT charged (you're already
 *   there); cost is paid only when entering a new cell.
 * - The goal cell must be unblocked. Callers that want "path to a cell next
 *   to a blocked target" should pick a valid neighbour cell as the goal — see
 *   the Step 3.5 movement behaviour notes in ROADMAP.md.
 *
 * D3 takes `(gridW, gridH)` independently so rectangular arenas pathfind
 * correctly — passing a single value where two are wanted would
 * mis-clip one axis silently, which is exactly the bug the signature
 * change is meant to prevent.
 *
 * Returns the path as `[start, ..., goal]` (both ends inclusive), or `[]`
 * if no path exists or either endpoint is out of bounds / the goal is blocked.
 *
 * **`bestEffort`** (default false): when the goal is unreachable (blocked, or
 * walled off), instead of returning `[]`, return the path to the CLOSEST
 * reachable cell to the goal (min Chebyshev-to-goal, then shortest route). This
 * is the J3 "path as close as you can" rally semantic — a tile objective on a
 * wall must NOT freeze the team (a single unreachable goal → `[]` → no step is
 * exactly the retired `pickGoalCellInRange` freeze). Off by default so every
 * other caller (enemy-chasing, firing cells) is byte-identical and the fuzz
 * baseline is untouched.
 *
 * **`footprint`** (default 1): §39b — the mover's axis-aligned N×N body edge. A*
 * still moves the single canonical corner; a wider body just needs a wider
 * corridor, so PASSABILITY checks the whole N×N block (`corner..corner+N` toward
 * +x/+y) rather than the one corner cell. `footprint === 1` collapses to the
 * single-cell check — byte-identical to every pre-§39b caller, which is why this
 * is a trailing default rather than a required arg. Pathfinding stays a pure grid
 * algorithm: the footprint is a plain number, so this module needs no knowledge
 * of units or the catalog.
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
  pathfindingCallCount++; // J2 — recompute-budget instrument (output-neutral).
  if (!inBounds(start, gridW, gridH) || !inBounds(goal, gridW, gridH)) return [];

  // 86c L1 — the numeric core. The search's interior state is packed-integer
  // (`idx = y*gridW + x`) typed arrays ALLOCATED PER CALL — deliberately no
  // shared/module scratch, so there is no reset discipline to get wrong (a
  // pooled array reused with a stale field is the determinism bug class the
  // pooling TODO warns about). Every behavioral contract is carried over
  // verbatim from the string-keyed original: the 43a tie-break total order,
  // gotcha #34 admissibility, §39b footprints, J3 best-effort. Byte-identity
  // is structural: expansion order is decided by `popLowestFIdx`'s STRICT
  // total order (the (y, x) tail is unique per cell), so the open list's
  // container order can't change which node pops; no float summation is
  // reordered. Gate: scripts/perf-oracle.sh + the pathing baseline pins.
  const size = gridW * gridH;
  const startIdx = start.y * gridW + start.x;
  const goalIdx = goal.y * gridW + goal.x;

  // The start cell is implicitly passable, even if it's in `blockers`. The
  // per-AXIS bounds check matters: packing an off-grid coord (e.g. x = -1)
  // would ALIAS a different on-grid cell (`y*W - 1` = the previous row's last
  // cell) — the string keys of the pre-L1 core couldn't collide, so an
  // off-grid blocker must stay a no-op here too.
  const blocked = new Uint8Array(size);
  for (const b of blockers) {
    if (b.x < 0 || b.y < 0 || b.x >= gridW || b.y >= gridH) continue;
    const bIdx = b.y * gridW + b.x;
    if (bIdx !== startIdx) blocked[bIdx] = 1;
  }

  // §39b — a candidate corner is a valid A* node iff its WHOLE footprint block
  // is on-grid, unblocked, and finite-cost (a body stands on passable terrain
  // across every cell it covers). `footprint === 1` iterates exactly the corner
  // cell. The step COST charged (below) is still the corner's entry cost, so
  // Chebyshev-on-corner stays admissible (gotcha #34) — only the passable/
  // impassable decision widens, never the metric. Returns the corner's entry
  // cost when the block fits, NaN when it doesn't — folding the old
  // blockFits + second `costAt(corner)` pair into ONE call per candidate
  // (CostFn is pure, so the dedup is unobservable).
  const fitCost = (cx: number, cy: number): number => {
    let cornerCost = NaN;
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= gridW || y >= gridH) return NaN;
        if (blocked[y * gridW + x] === 1) return NaN;
        const cost = costAt({ x, y });
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
        // §39b — the whole footprint block must fit (bounds + blockers + finite
        // cost across the N×N cells; the single corner when footprint === 1).
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

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Linear-scan pop over the packed-index open list. The largest D3-allowed
 * grid (32×32) caps the open set at ~1024 entries; post-L1 the scan is pure
 * numeric compares (no string parse, no allocation), so a binary heap stays
 * deferred (the 86c L1b decision — build it only if a profile still shows
 * pop dominance). The swap-remove and the list's insertion order CANNOT
 * change which node pops: the comparator below is a STRICT total order (the
 * (y, x) tail is unique per cell), so the argmin is container-order-
 * independent — the structural byte-identity argument, WORKLOG §86c-signing.
 *
 * E5.B + 43a — f-ties break toward the goal, then toward the straight line:
 * among equal-f nodes, expand the one with the lower Chebyshev distance to
 * goal (h), then (43a) the one nearer the start→goal LINE — the cross-track
 * tie-break that drains the Chebyshev cone's tie plateau into a straight
 * route — then numeric (y, x) as the final deterministic total order. All
 * of this is a pure ordering of equal-f nodes: f-values never change, the
 * Chebyshev heuristic stays admissible (gotcha #34), paths stay min-cost.
 * What changes is WHICH min-cost path is returned.
 *
 * 43a — the retired final fallback was a STRING compare of `"x,y"` keys
 * (`"10,3" < "2,3"`, `"5,1" < "6,1"`), which resolved EVERY open-ground tie
 * toward low-x: the world-frame leftward drift PATHING.md measured on every
 * shipped map (openField: literally every step, both teams — the River
 * "walks left" report). Cross-track distance is measured as the integer
 * cross-product magnitude |(n−start) × (goal−start)| — proportional to the
 * true point-to-line distance (the constant |goal−start| divisor can't
 * change comparisons within one search), symmetric under grid mirroring, so
 * mirrored worlds route mirrored paths. The (y, x) numeric fallback only
 * decides genuine double-ties (equal f, h, AND cross — symmetric pairs
 * about the line); some total order must, for determinism. RNG shuffling
 * stays rejected — it would perturb the deterministic byte stream on every
 * tie.
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
