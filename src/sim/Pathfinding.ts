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
 */
export function findPath(
  start: GridCoord,
  goal: GridCoord,
  blockers: readonly GridCoord[],
  gridW: number,
  gridH: number,
  costAt: CostFn = UNIT_COST,
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
  if (blocked.has(goalKey)) return [];

  if (startKey === goalKey) return [start];

  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, chebyshev(start, goal)]]);
  const cameFrom = new Map<string, string>();
  const open = new Set<string>([startKey]);

  while (open.size > 0) {
    const currentKey = popLowestF(open, fScore, goal);
    if (currentKey === goalKey) return reconstruct(cameFrom, currentKey);

    const current = fromKey(currentKey);
    const currentG = gScore.get(currentKey)!;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        const nKey = `${nx},${ny}`;
        if (blocked.has(nKey)) continue;

        const stepCost = costAt({ x: nx, y: ny });
        if (!isFinite(stepCost)) continue; // Infinity cost = data-driven block.
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
  return [];
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
