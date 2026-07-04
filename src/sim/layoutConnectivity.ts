/**
 * §40 follow-up — AUTO-TARGET-AWARE spawn-region connectivity.
 *
 * The single source of truth for "can the two teams actually reach each other?"
 * on a hand-authored layout. Extracted so the layout editor's live validation and
 * the shipped-layout test guard classify a map IDENTICALLY (they were duplicated
 * king's-move BFS "mirrors" before).
 *
 * The subtlety this module encodes is the Phase-40 rubble-vs-wall asymmetry — a
 * destructible obstacle is NOT uniformly "passable" for connectivity, because the
 * default AI can only get through SOME of them:
 *
 *  - **rubble** (`autoTarget: true`): a unit walled off from every hostile
 *    auto-targets and chips the nearest approachable rubble (`applyRubbleAutoTarget`
 *    in Targeting.ts), iterating until it punches through. So a rubble-only
 *    connection genuinely plays out → rubble is PASSABLE here (never a blocker).
 *  - **destructible walls / half-cover** (`hp`, but NO `autoTarget`): nothing in the
 *    default AI ever auto-breaks them; only a *manual* player focus (§40e) or an
 *    incidental AoE splash destroys one. So a map whose only connection runs through
 *    a destructible wall stalemates under pure-AI play — playable, but only with
 *    manual intervention. That's a soft **destructible-dependent** result, not a
 *    hard sever.
 *  - **indestructible walls / half-cover / chasm / deep water**: nothing removes
 *    them → a true **severed** map (an unplayable draw).
 *
 * `classifyConnectivity` returns which of the three tiers a layout is in; callers
 * decide severity (the editor: severed → error, destructible-dependent → warn; the
 * test guard: shipped maps must not be `severed`). The dynamic layout-deadlock
 * integration test remains the behavioral backstop for whatever ships.
 */

export interface ConnectivityCoord {
  readonly x: number;
  readonly y: number;
}

export interface ConnectivityRegion {
  readonly tiles: readonly ConnectivityCoord[];
}

export type ConnectivityTier =
  /** Connected over open ground (or through auto-targeted rubble) — no wall-break needed. */
  | 'connected'
  /** Reachable only if a DESTRUCTIBLE wall/half-cover is destroyed — the AI won't do
   *  it on its own, so it needs a manual player order (editor WARN). */
  | 'destructible-dependent'
  /** Severed by indestructible obstacles — no path even if every destructible breaks
   *  (editor ERROR). */
  | 'severed';

export interface ConnectivityQuery {
  readonly gridW: number;
  readonly gridH: number;
  /** Connectivity is probed between the first two regions' centroids (the same heuristic
   *  the editor + terrainGen use). */
  readonly spawns: readonly ConnectivityRegion[];
  /** Cells no unit can traverse without outside help: indestructible walls/half-cover
   *  (no `hp`), chasm, deep water. */
  readonly hardBlockers: readonly ConnectivityCoord[];
  /** Cells blocked ONLY by a DESTRUCTIBLE wall/half-cover (`hp`, no `autoTarget`). The
   *  default AI won't auto-break these; a player must. Rubble is deliberately absent —
   *  it's auto-targeted, so it's passable and belongs in NEITHER blocker set. */
  readonly destructibleBlockers: readonly ConnectivityCoord[];
}

/** The centroid of a spawn region (rounded), the probe endpoint for connectivity. */
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
 * King's-move BFS reachability between two regions' centroids, treating `blockers`
 * as impassable. Same 8-neighborhood as pathfinding. Pure — no World / DOM.
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
 * Classify a layout's spawn-region connectivity into the three tiers. Fewer than two
 * regions returns `connected` (the schema requires ≥2, so that only fires on a
 * transient editor state, never on exported JSON).
 */
export function classifyConnectivity(q: ConnectivityQuery): ConnectivityTier {
  if (q.spawns.length < 2) return 'connected';
  const a = q.spawns[0]!;
  const b = q.spawns[1]!;
  // Pass 1 — hard blockers only. If even this severs, destroying every destructible
  // wouldn't help: a genuine, unplayable sever.
  if (!reachableBetween(q.hardBlockers, q.gridW, q.gridH, a, b)) return 'severed';
  // Pass 2 — add the destructible walls/cover back as blockers. If THAT severs, the
  // only path depends on breaking one, which the default AI won't do.
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
