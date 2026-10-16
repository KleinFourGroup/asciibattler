/**
 * Whether the two teams can reach each other on a hand-authored layout: the
 * one classifier that the layout editor's live check and the shipped-layout
 * guard in `layouts.test.ts` both call. A procedural board makes its own
 * route (`ensureConnectivity` in `proceduralMap.ts`).
 *
 * A destructible obstacle is not passable alike here, because the `atWill`
 * AI breaks only some of them:
 *
 * - rubble (`autoTarget`): a unit that can reach no hostile chips the
 *   nearest approachable rubble (`applyRubbleAutoTarget` in Targeting.ts)
 *   until it is through, so rubble is in neither blocker set.
 * - a destructible wall or half cover (`hp`, no `autoTarget`): the AI never
 *   picks one. Only a player's order on it (an `engage` or a `focus`) or an
 *   area effect's splash breaks it, so a route only through one stalls
 *   under the AI alone: the middle tier, not a sever.
 * - an indestructible wall or half cover, a chasm, deep water: nothing
 *   removes them, so a route only through them is severed.
 *
 * `classifyConnectivity` returns the tier, and the caller decides what it
 * means: the editor reports a sever as an error and the middle tier as a
 * warning, and the guard fails a shipped layout only when it is severed.
 * `tests/integration/layout-deadlock.test.ts` plays every layout to its
 * end, the check on movement that this static one can't see.
 */

interface ConnectivityCoord {
  readonly x: number;
  readonly y: number;
}

export interface ConnectivityRegion {
  readonly tiles: readonly ConnectivityCoord[];
}

type ConnectivityTier =
  /** Reachable over open ground or through rubble. */
  | 'connected'
  /** Reachable only through a destructible wall or half cover, which the AI
   *  won't break by itself. */
  | 'destructible-dependent'
  /** Not reachable even with every destructible broken. */
  | 'severed';

interface ConnectivityQuery {
  readonly gridW: number;
  readonly gridH: number;
  /** Only the first two regions are probed, centroid to centroid, as the
   *  procedural guard probes its spawn bands. */
  readonly spawns: readonly ConnectivityRegion[];
  /** Cells nothing opens: an indestructible wall or half cover (no `hp`), a
   *  chasm, deep water. */
  readonly hardBlockers: readonly ConnectivityCoord[];
  /** Cells blocked only by a destructible wall or half cover (`hp`, no
   *  `autoTarget`). Rubble is in neither set, as the AI breaks it. */
  readonly destructibleBlockers: readonly ConnectivityCoord[];
}

/** A spawn region's centroid, rounded to a cell: the probe's endpoint. */
function centroidOf(region: ConnectivityRegion): ConnectivityCoord {
  let sx = 0;
  let sy = 0;
  for (const t of region.tiles) {
    sx += t.x;
    sy += t.y;
  }
  return {
    x: Math.round(sx / region.tiles.length),
    y: Math.round(sy / region.tiles.length),
  };
}

/**
 * Breadth-first reachability between two regions' centroids over eight-way
 * moves, the pather's neighbourhood, with `blockers` impassable. A centroid
 * on a blocker is unreachable. Pure: no World, no DOM.
 */
export function reachableBetween(
  blockers: readonly ConnectivityCoord[],
  gridW: number,
  gridH: number,
  a: ConnectivityRegion,
  b: ConnectivityRegion,
): boolean {
  const start = centroidOf(a);
  const goal = centroidOf(b);

  const blocked = new Set<string>();
  for (const w of blockers) blocked.add(`${w.x},${w.y}`);
  if (blocked.has(`${goal.x},${goal.y}`)) return false;
  if (blocked.has(`${start.x},${start.y}`)) return false;

  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue: ConnectivityCoord[] = [start];
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (c.x === goal.x && c.y === goal.y) return true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key) || blocked.has(key)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

/**
 * A layout's tier. Fewer than two regions answers `connected`: the schema
 * requires two, so only the editor's state mid-edit has fewer.
 */
export function classifyConnectivity(q: ConnectivityQuery): ConnectivityTier {
  if (q.spawns.length < 2) return 'connected';
  const a = q.spawns[0]!;
  const b = q.spawns[1]!;
  // The hard blockers alone: a sever here holds with every destructible
  // broken.
  if (!reachableBetween(q.hardBlockers, q.gridW, q.gridH, a, b)) return 'severed';
  // The destructible walls and half cover as blockers too: a sever here
  // means every route breaks one.
  if (
    !reachableBetween(
      [...q.hardBlockers, ...q.destructibleBlockers],
      q.gridW,
      q.gridH,
      a,
      b,
    )
  ) {
    return 'destructible-dependent';
  }
  return 'connected';
}
