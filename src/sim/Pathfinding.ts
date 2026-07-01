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

  const startKey = key(start);
  const goalKey = key(goal);

  // The start cell is implicitly passable, even if it's in `blockers`.
  const blocked = new Set<string>();
  for (const b of blockers) {
    const k = key(b);
    if (k !== startKey) blocked.add(k);
  }

  // §39b — a candidate corner is a valid A* node iff its WHOLE footprint block is
  // on-grid, unblocked, and finite-cost (a body stands on passable terrain across
  // every cell it covers). `footprint === 1` iterates exactly the corner cell, so
  // this is the pre-§39b `in-bounds && !blocked && finite-cost` test verbatim. The
  // step COST charged (below) is still the corner's entry cost, so Chebyshev-on-
  // corner stays admissible (gotcha #34) — only the passable/impassable decision
  // widens, never the metric.
  const blockFits = (corner: GridCoord): boolean => {
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        const x = corner.x + dx;
        const y = corner.y + dy;
        if (x < 0 || y < 0 || x >= gridW || y >= gridH) return false;
        if (blocked.has(`${x},${y}`)) return false;
        if (!isFinite(costAt({ x, y }))) return false;
      }
    }
    return true;
  };

  // A goal whose block doesn't fit is unreachable. Strict mode gives up;
  // best-effort still searches toward it and returns the closest reachable corner.
  if (!blockFits(goal) && !bestEffort) return [];

  if (startKey === goalKey) return [start];

  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, chebyshev(start, goal)]]);
  const cameFrom = new Map<string, string>();
  const open = new Set<string>([startKey]);

  // best-effort: the closest-to-goal cell actually reached (min Chebyshev-to-
  // goal, ties → shortest approach). Seeded with the start, so a walled-in unit
  // "routes" to itself (a length-1 path = hold), never `[]` (a freeze).
  let closestKey = startKey;
  let closestH = chebyshev(start, goal);
  let closestG = 0;

  while (open.size > 0) {
    const currentKey = popLowestF(open, fScore, goal);
    if (currentKey === goalKey) return reconstruct(cameFrom, currentKey);

    const current = fromKey(currentKey);
    const currentG = gScore.get(currentKey)!;

    if (bestEffort) {
      const h = chebyshev(current, goal);
      if (h < closestH || (h === closestH && currentG < closestG)) {
        closestH = h;
        closestG = currentG;
        closestKey = currentKey;
      }
    }

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = current.x + dx;
        const ny = current.y + dy;
        const corner = { x: nx, y: ny };
        // §39b — the whole footprint block must fit (bounds + blockers + finite
        // cost across the N×N cells; the single corner when footprint === 1).
        if (!blockFits(corner)) continue;
        const nKey = `${nx},${ny}`;

        const stepCost = costAt(corner); // corner entry cost (finite per blockFits).
        const tentativeG = currentG + stepCost;
        if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
          cameFrom.set(nKey, currentKey);
          gScore.set(nKey, tentativeG);
          fScore.set(nKey, tentativeG + chebyshev({ x: nx, y: ny }, goal));
          open.add(nKey);
        }
      }
    }
  }
  // Goal never reached. Strict → no path; best-effort → the closest cell we got
  // to (a length-1 [start] if the unit is fully walled in — caller treats that
  // as "hold", never a freeze).
  return bestEffort ? reconstruct(cameFrom, closestKey) : [];
}

function inBounds(c: GridCoord, gridW: number, gridH: number): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < gridW && c.y < gridH;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function key(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

function fromKey(k: string): GridCoord {
  const i = k.indexOf(',');
  return { x: Number(k.slice(0, i)), y: Number(k.slice(i + 1)) };
}

/**
 * Linear-scan pop. The largest D3-allowed grid (32×32) caps the open set
 * at ~1024 entries; a binary heap would be overkill and harder to debug
 * at this scale.
 *
 * E5.B — f-ties break toward the goal: among equal-f nodes, expand the one
 * with the lower Chebyshev distance to goal (h), then the lexicographically
 * lower key as a final deterministic fallback. This is a pure ordering of
 * equal-f nodes, so it does NOT change f-values and keeps the Chebyshev
 * heuristic admissible (gotcha #34) — paths stay min-cost. What changes is
 * WHICH min-cost path is returned: the old insertion-order tie-break let
 * the `dx=-1..1` neighbour scan bias paths leftward (units crabbing on
 * open ground); the goal-directed tie-break yields straighter routes. RNG
 * shuffling was rejected — it would perturb the deterministic byte stream
 * on every tie.
 */
function popLowestF(open: Set<string>, fScore: Map<string, number>, goal: GridCoord): string {
  let bestKey = '';
  let bestF = Infinity;
  let bestH = Infinity;
  for (const k of open) {
    const f = fScore.get(k) ?? Infinity;
    if (f > bestF) continue;
    const h = chebyshev(fromKey(k), goal);
    if (f < bestF || h < bestH || (h === bestH && k < bestKey)) {
      bestF = f;
      bestH = h;
      bestKey = k;
    }
  }
  open.delete(bestKey);
  return bestKey;
}

function reconstruct(cameFrom: Map<string, string>, endKey: string): GridCoord[] {
  const path: GridCoord[] = [fromKey(endKey)];
  let curKey = endKey;
  while (cameFrom.has(curKey)) {
    curKey = cameFrom.get(curKey)!;
    path.push(fromKey(curKey));
  }
  return path.reverse();
}
