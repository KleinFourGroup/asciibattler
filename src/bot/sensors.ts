/**
 * The traffic scripts' sensors: every read a script's trigger takes, as a
 * pure function of the World's state. No history gathered from events, no
 * cache, no RNG, so each sensor answers the same on a cloned snapshot (a
 * rollout's) and on a resumed run.
 *
 * Every sensor here is cache-free. The one cache is `chokeHold.ts`'s memo
 * over its read of `armyMinCut`, keyed on the exact input and checked
 * against the pure `computeChokeRead`; read its doc before adding a second.
 *
 * The jam sensor reads a local signal. The sim's `queue`, `pinned` and
 * `boxed` classes live inside the movement behaviors' polls and surface
 * only as `unit:moveDecision` events (`moveDecision.ts`), and deriving them
 * here would mean running the movement proposal again. So the sensor reads
 * something coarser: idle, out of acting range, and every progress cell
 * toward the nearest enemy held by a teammate who is not vacating soon,
 * from the occupancy's claims and vacancy ETAs.
 */

import type { World } from '../sim/World';
import { isInertNeutral, type Unit } from '../sim/Unit';
import type { ObjectiveTeam } from '../sim/objective';
import type { GridCoord } from '../core/types';
import type { Archetype } from '../sim/archetypes';
import { distanceBetween } from '../core/grid';
import { cellKey, cellsOccupiedBy, claimantOf, unitAt, vacancyEtaOf } from '../sim/occupancy';
import { tileDef, type TileKind } from '../sim/TileGrid';
import type { StatusDef } from '../sim/effects/statusSchema';
import { statusDef, STATUS_DEFS } from '../config/statuses';
import { secondsToTicks } from '../config';

/** The opposing combat team (neutrals have no objective and no opponent). */
export function opposingTeam(team: ObjectiveTeam): ObjectiveTeam {
  return team === 'player' ? 'enemy' : 'player';
}

/**
 * The reach that classes a unit as true artillery (the catapult and the
 * shaman, 6), by capability rather than archetype. Read by cohesion focus,
 * as its assassination bar, which the reach-5 casters stay under, and by
 * `rallyCells`, where only artillery forbids a rally; each gives its
 * reason.
 */
export const ARTILLERY_REACH = 6;

/** The living units of `team` on the grid (`world.units` never holds the
 *  spawn queue). */
export function livingUnits(world: World, team: ObjectiveTeam): Unit[] {
  return world.units.filter((u) => u.team === team && u.currentHp > 0);
}

// ---------------------------------------------------------------------------
// Jam (the unjam script's read)
// ---------------------------------------------------------------------------

/**
 * A teammate blocker counts as draining soon when its move takes it off the
 * contested cell within this window: the unit behind it is queued, a
 * productive wait, not jammed.
 */
const JAM_VACANCY_WINDOW_SECONDS = 0.5;
const JAM_VACANCY_WINDOW_TICKS = secondsToTicks(JAM_VACANCY_WINDOW_SECONDS);

interface JamRead {
  /** The units judged jammed this tick, in `world.units` order. */
  readonly jammedUnitIds: readonly number[];
  /** Jammed over the team's living units; 0 when either team is empty. */
  readonly jamFraction: number;
}

/**
 * A unit is jammed when it (1) has a living enemy but stands out of its own
 * acting range, (2) is idle (`activeAction === null`; a unit mid-move or
 * mid-attack is making progress), (3) has at least one passable progress
 * cell (an 8-way neighbor strictly Chebyshev-closer to its nearest enemy; a
 * unit boxed in by terrain is `no_route`'s problem, not traffic), and (4)
 * finds every progress cell occupied or claimed, with no free cell and no
 * teammate blocker vacating inside `JAM_VACANCY_WINDOW_TICKS`, and at
 * least one blocker a teammate (an enemy wall of bodies is a fight, not a
 * jam).
 *
 * Approximations, acceptable for a trigger: positions are the canonical
 * corner (an N×N enemy's true nearest edge may differ by a cell), and the
 * read is local, one step, so a jam around a corner registers only once
 * the column stalls.
 */
export function jamRead(world: World, team: ObjectiveTeam): JamRead {
  const own = livingUnits(world, team);
  const enemies = livingUnits(world, opposingTeam(team));
  const jammed: number[] = [];
  if (own.length === 0 || enemies.length === 0) {
    return { jammedUnitIds: jammed, jamFraction: 0 };
  }
  for (const unit of own) {
    if (unit.activeAction !== null) continue;
    // The nearest enemy; the first wins a tie, in `world.units` order.
    let nearest = enemies[0]!;
    let best = distanceBetween(unit.position, nearest.position);
    for (const e of enemies) {
      const d = distanceBetween(unit.position, e.position);
      if (d < best) {
        best = d;
        nearest = e;
      }
    }
    if (best <= unit.derived.attackRange) continue; // can act from here
    let sawProgressCell = false;
    let sawFreeCell = false;
    let sawTeammateBlocker = false;
    let sawDrainingTeammate = false;
    for (let dx = -1; dx <= 1 && !sawFreeCell; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const cell = { x: unit.position.x + dx, y: unit.position.y + dy };
        if (cell.x < 0 || cell.y < 0 || cell.x >= world.gridW || cell.y >= world.gridH) continue;
        if (distanceBetween(cell, nearest.position) >= best) continue; // not progress
        if (!tileDef(world.tileGrid.kindAt(cell)).passable) continue;
        sawProgressCell = true;
        const occupant = unitAt(world, cell);
        const claimantId = occupant ? undefined : claimantOf(world, cell);
        const blocker = occupant ?? (claimantId !== undefined ? world.findUnit(claimantId) : undefined);
        if (blocker === undefined) {
          sawFreeCell = true;
          break;
        }
        if (blocker.team === team) {
          sawTeammateBlocker = true;
          const eta = vacancyEtaOf(blocker, world);
          if (eta !== undefined && eta <= JAM_VACANCY_WINDOW_TICKS) sawDrainingTeammate = true;
        }
      }
    }
    if (sawProgressCell && !sawFreeCell && sawTeammateBlocker && !sawDrainingTeammate) {
      jammed.push(unit.id);
    }
  }
  return { jammedUnitIds: jammed, jamFraction: jammed.length / own.length };
}

// ---------------------------------------------------------------------------
// Hazard (the terrain-edge-hold script's read)
// ---------------------------------------------------------------------------

/** A status harms when its periodic op deals damage (burn, bleed, poison;
 *  rejuvenate's `heal` is the beneficial sibling). */
function statusHarms(def: StatusDef): boolean {
  return def.periodic?.op.kind === 'damage';
}

/**
 * Whether standing on or stepping onto `kind` afflicts a unit. It mirrors
 * the sim's two apply sites; keep it in lockstep if they change:
 * - `World.applyTileStatuses` — `fire` sustains `burn` every tick, set by
 *   kind in code, not by the config (`healing` sustains rejuvenate, which
 *   helps and is no hazard).
 * - `World.applyTileEnterEffects` — `TileDef.statusOnEnter` (mud, poison).
 *
 * An impassable tile (chasm, deep water) is no hazard: nothing can stand
 * there, and pathing already treats it as a wall.
 */
export function isHazardKind(kind: TileKind): boolean {
  if (kind === 'fire') return true;
  const def = tileDef(kind);
  if (!def.passable) return false;
  if (def.statusOnEnter) {
    return statusHarms(statusDef(def.statusOnEnter));
  }
  return false;
}

/**
 * The hazards' severity split. A barrier hazard keeps damaging a unit for
 * every tick it stands there, so a crossing costs more the longer it takes
 * and rallying short of it is the play. An on-enter hazard (mud, one
 * application of poison) is a toll booth, not a wall: treated as a barrier,
 * it made terrain-edge hold rally armies at puddle edges while the passive
 * bot walked through and won. The split is the sim's, not a tuned number:
 * `World.applyTileStatuses` sustains a status every tick (fire's burn, set
 * by kind in code) and `World.applyTileEnterEffects` applies one once on
 * entry. Keep it in lockstep if a new sustained kind lands there.
 */
export function isBarrierHazard(kind: TileKind): boolean {
  return kind === 'fire';
}

/** Every hazard cell on the grid, row-major: a scan of the grid on every
 *  call, since tile kinds can change. */
export function hazardCellList(world: World): GridCoord[] {
  const out: GridCoord[] = [];
  for (let y = 0; y < world.gridH; y++) {
    for (let x = 0; x < world.gridW; x++) {
      if (isHazardKind(world.tileGrid.kindAt({ x, y }))) out.push({ x, y });
    }
  }
  return out;
}

/** Every barrier-hazard cell (`isBarrierHazard`), row-major. */
export function barrierCellList(world: World): GridCoord[] {
  const out: GridCoord[] = [];
  for (let y = 0; y < world.gridH; y++) {
    for (let x = 0; x < world.gridW; x++) {
      if (isBarrierHazard(world.tileGrid.kindAt({ x, y }))) out.push({ x, y });
    }
  }
  return out;
}

/**
 * The units of `team` within `withinSteps` Chebyshev steps of a
 * barrier-hazard cell whose nearest enemy lies on the far side (the hazard
 * sits between, so stepping toward the enemy closes on the hazard first).
 * Terrain-edge hold's core read: "my advance is about to walk into the
 * fire". Barriers only, since mud is not worth a team rally; the trace
 * mining's numbers hold, since every mined battle's hazard was fire.
 */
export function unitsApproachingHazard(
  world: World,
  team: ObjectiveTeam,
  withinSteps: number,
): number[] {
  const cells = barrierCellList(world);
  if (cells.length === 0) return [];
  const enemies = livingUnits(world, opposingTeam(team));
  if (enemies.length === 0) return [];
  const out: number[] = [];
  for (const unit of livingUnits(world, team)) {
    let nearestHazard: GridCoord | undefined;
    let hazardDist = Infinity;
    for (const c of cells) {
      const d = distanceBetween(unit.position, c);
      if (d < hazardDist) {
        hazardDist = d;
        nearestHazard = c;
      }
    }
    if (nearestHazard === undefined || hazardDist > withinSteps) continue;
    let enemyDist = Infinity;
    let enemyDistFromHazard = Infinity;
    for (const e of enemies) {
      const d = distanceBetween(unit.position, e.position);
      if (d < enemyDist) {
        enemyDist = d;
        enemyDistFromHazard = distanceBetween(nearestHazard, e.position);
      }
    }
    // The hazard is "between" when the enemy is beyond it on this axis:
    // closing on the enemy means closing on the hazard first.
    if (enemyDistFromHazard < enemyDist) out.push(unit.id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rally (the attrition-stall and unjam scripts' tile search)
// ---------------------------------------------------------------------------

/** A cell a group may rally to, with its distances to the group's centroid
 *  and to the nearest enemy. */
export interface RallyCell {
  readonly cell: GridCoord;
  readonly centroidDist: number;
  readonly enemyDist: number;
}

/**
 * The cells `group` may rally to, in row-major order: within `radius` of
 * the group's rounded centroid, passable, not a hazard, free of units and
 * claims, no nearer the nearest enemy than the centroid is (back or
 * sideways, never forward), and outside every artillery piece's reach.
 * Only artillery forbids a cell (`ARTILLERY_REACH`): counting every enemy's
 * reach let the bows' and mages' coverage push rallies out of the local
 * area, and a re-sort became a retreat march. Empty when either side has no
 * living unit; each script scores the cells its own way.
 */
export function rallyCells(
  world: World,
  group: readonly Unit[],
  enemies: readonly Unit[],
  radius: number,
): RallyCell[] {
  if (group.length === 0 || enemies.length === 0) return [];
  const centroid = {
    x: Math.round(group.reduce((s, u) => s + u.position.x, 0) / group.length),
    y: Math.round(group.reduce((s, u) => s + u.position.y, 0) / group.length),
  };
  const minEnemyDist = (c: GridCoord) =>
    enemies.reduce((m, e) => Math.min(m, distanceBetween(c, e.position)), Infinity);
  const centroidEnemyDist = minEnemyDist(centroid);
  const underFire = (c: GridCoord) =>
    enemies.some(
      (e) =>
        e.derived.attackRange >= ARTILLERY_REACH &&
        distanceBetween(c, e.position) <= e.derived.attackRange,
    );

  const out: RallyCell[] = [];
  const y1 = Math.min(world.gridH - 1, centroid.y + radius);
  const x1 = Math.min(world.gridW - 1, centroid.x + radius);
  for (let y = Math.max(0, centroid.y - radius); y <= y1; y++) {
    for (let x = Math.max(0, centroid.x - radius); x <= x1; x++) {
      const c = { x, y };
      const centroidDist = distanceBetween(c, centroid);
      if (centroidDist > radius) continue;
      const kind = world.tileGrid.kindAt(c);
      if (!tileDef(kind).passable || isHazardKind(kind)) continue;
      if (unitAt(world, c) !== undefined || claimantOf(world, c) !== undefined) continue;
      const enemyDist = minEnemyDist(c);
      if (enemyDist < centroidEnemyDist) continue;
      if (underFire(c)) continue;
      out.push({ cell: c, centroidDist, enemyDist });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Choke (the choke-hold script's read)
// ---------------------------------------------------------------------------

/**
 * The passable grid's articulation cells (the cut vertices of the 8-way
 * passability graph): cells whose loss disconnects some pair of passable
 * cells, such as corridors, isthmuses and doorways. Passable means a
 * passable tile not held by a living inert neutral: walls, half-cover and
 * rubble are neutral units, not tiles (`battleSetup` spawns them), so a
 * read of the tiles alone would see every walled corridor as an open
 * field. Mobile units do not count, combatants or a camp's members: bodies
 * move, and a choke is the arena's shape. Rubble's death opens its cells
 * on the next call, since the scan runs on every call. Row-major, an
 * iterative DFS (Hopcroft–Tarjan) in O(cells).
 */
export function chokeCells(world: World): GridCoord[] {
  const w = world.gridW;
  const h = world.gridH;
  const idx = (x: number, y: number) => y * w + x;
  // Inert neutrals only: an active neutral (a camp member) is a mobile
  // body, and bodies move.
  const neutralBlocked = new Set<string>();
  for (const u of world.units) {
    if (!isInertNeutral(u) || u.currentHp <= 0) continue;
    for (const c of cellsOccupiedBy(u)) neutralBlocked.add(cellKey(c));
  }
  const passable: boolean[] = new Array<boolean>(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      passable[idx(x, y)] =
        tileDef(world.tileGrid.kindAt({ x, y })).passable && !neutralBlocked.has(cellKey({ x, y }));
    }
  }
  const disc = new Array<number>(w * h).fill(-1);
  const low = new Array<number>(w * h).fill(0);
  const isCut = new Array<boolean>(w * h).fill(false);
  let timer = 0;

  const neighborsOf = (v: number): number[] => {
    const x = v % w;
    const y = (v - x) / w;
    const out: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = idx(nx, ny);
        if (passable[n]) out.push(n);
      }
    }
    return out;
  };

  // An iterative DFS with an explicit frame stack, since recursion would
  // overflow on a long corridor map. The articulation rule: a non-root v is
  // a cut vertex when some child's low >= v's disc, and the root when it has
  // two or more DFS children.
  for (let root = 0; root < w * h; root++) {
    if (!passable[root] || disc[root] !== -1) continue;
    let rootChildren = 0;
    const stack: { v: number; parent: number; nbrs: number[]; i: number }[] = [
      { v: root, parent: -1, nbrs: neighborsOf(root), i: 0 },
    ];
    disc[root] = low[root] = timer++;
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      if (frame.i < frame.nbrs.length) {
        const n = frame.nbrs[frame.i]!;
        frame.i++;
        if (n === frame.parent) continue;
        if (disc[n] !== -1) {
          low[frame.v] = Math.min(low[frame.v]!, disc[n]!);
          continue;
        }
        disc[n] = low[n] = timer++;
        if (frame.v === root) rootChildren++;
        stack.push({ v: n, parent: frame.v, nbrs: neighborsOf(n), i: 0 });
      } else {
        stack.pop();
        const parent = frame.parent;
        if (parent !== -1) {
          low[parent] = Math.min(low[parent]!, low[frame.v]!);
          if (parent !== root && low[frame.v]! >= disc[parent]!) isCut[parent] = true;
        }
      }
    }
    if (rootChildren >= 2) isCut[root] = true;
  }

  const out: GridCoord[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isCut[idx(x, y)]) out.push({ x, y });
    }
  }
  return out;
}

/**
 * The min vertex cut between the armies: the smallest set of free passable
 * cells the enemy must cross to reach us, or null when no cut of at most
 * `maxCut` cells exists (open ground, found early and cheaply) or the
 * armies are not connected at all (nothing to hold). It takes `chokeCells`
 * to any passage width: the articulation scan reads nothing on a bridge
 * two or more cells wide, and a cut of one cell is an articulation door.
 *
 * A node-split max-flow (Even–Tarjan): each free passable cell splits into
 * an in and an out with capacity 1, and the 8-way adjacency carries ∞. A
 * cell any living unit holds carries ∞ too (a body, not geometry), so the
 * cut lands only on free cells, the ones a holder could stand on; the
 * inert neutrals are impassable, as in `chokeCells`. The flow augments by
 * BFS from the enemy's cells toward ours and stops once it passes
 * `maxCut`; the cut is read from what the source still reaches in the
 * residual. Deterministic (the cells in row-major order, no RNG),
 * state-only, O(maxCut × cells), cheap enough for every tick.
 */
export function armyMinCut(
  world: World,
  team: ObjectiveTeam,
  maxCut: number,
): GridCoord[] | null {
  const w = world.gridW;
  const h = world.gridH;
  const n = w * h;
  const idx = (x: number, y: number) => y * w + x;

  // The passability mask, as `chokeCells` builds it: inert neutrals only,
  // for the same reason.
  const neutralBlocked = new Set<string>();
  for (const u of world.units) {
    if (!isInertNeutral(u) || u.currentHp <= 0) continue;
    for (const c of cellsOccupiedBy(u)) neutralBlocked.add(cellKey(c));
  }
  const passable = new Array<boolean>(n).fill(false);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      passable[idx(x, y)] =
        tileDef(world.tileGrid.kindAt({ x, y })).passable && !neutralBlocked.has(cellKey({ x, y }));
    }
  }
  const own = livingUnits(world, team);
  const enemies = livingUnits(world, opposingTeam(team));
  if (own.length === 0 || enemies.length === 0) return null;
  const sourceCells = new Set(enemies.map((u) => idx(u.position.x, u.position.y)));
  const sinkCells = new Set(own.map((u) => idx(u.position.x, u.position.y)));
  // Any unit's cell is a body, not geometry, and cannot be cut (∞ capacity).
  const uncuttable = new Set<number>();
  for (const u of world.units) {
    if (u.currentHp <= 0) continue;
    for (const c of cellsOccupiedBy(u)) uncuttable.add(idx(c.x, c.y));
  }

  // An edge-list max-flow (Edmonds–Karp) over the node-split graph. Reading
  // the cut from reachability needs a true residual, with reverse arcs: a
  // search along forward arcs alone finds a maximal path set, not a maximum
  // one, and reads a wrong frontier. Nodes: 2v is v's in, 2v+1 its out,
  // then S and T. Arcs: in(v)→out(v) cap 1 (∞ when it cannot be cut);
  // out(u)→in(v) ∞ per 8-adjacency; S→in(enemy) ∞; out(own)→T ∞.
  const S = 2 * n;
  const T = 2 * n + 1;
  const INF = 1 << 29;
  const head: number[] = new Array<number>(2 * n + 2).fill(-1);
  const to: number[] = [];
  const nxt: number[] = [];
  const cap: number[] = [];
  const addEdge = (u: number, v: number, c: number) => {
    to.push(v);
    cap.push(c);
    nxt.push(head[u]!);
    head[u] = to.length - 1;
    to.push(u);
    cap.push(0);
    nxt.push(head[v]!);
    head[v] = to.length - 1;
  };
  for (let v = 0; v < n; v++) {
    if (!passable[v]) continue;
    addEdge(2 * v, 2 * v + 1, uncuttable.has(v) ? INF : 1);
    const x = v % w;
    const y = (v - x) / w;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx2 = x + dx;
        const ny2 = y + dy;
        if (nx2 < 0 || ny2 < 0 || nx2 >= w || ny2 >= h) continue;
        const u = idx(nx2, ny2);
        if (passable[u]) addEdge(2 * v + 1, 2 * u, INF);
      }
    }
  }
  for (const s of sourceCells) if (passable[s]) addEdge(S, 2 * s, INF);
  for (const t of sinkCells) if (passable[t]) addEdge(2 * t + 1, T, INF);

  // What S reaches in the residual, by BFS; fills prevEdge to recover a path.
  const bfs = (prevEdge: number[] | null): boolean[] => {
    const seen = new Array<boolean>(2 * n + 2).fill(false);
    seen[S] = true;
    const queue = [S];
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi]!;
      for (let e = head[u]!; e !== -1; e = nxt[e]!) {
        if (cap[e]! <= 0 || seen[to[e]!]) continue;
        seen[to[e]!] = true;
        if (prevEdge) prevEdge[to[e]!] = e;
        if (to[e] === T) return seen;
        queue.push(to[e]!);
      }
    }
    return seen;
  };

  let flow = 0;
  for (;;) {
    const prevEdge = new Array<number>(2 * n + 2).fill(-1);
    const seen = bfs(prevEdge);
    if (!seen[T]) break;
    flow++;
    if (flow > maxCut) return null; // open ground: no choke to hold
    // Augment by one: every S→T path carries exactly 1 through a split.
    for (let v = T; v !== S; ) {
      const e = prevEdge[v]!;
      cap[e] = cap[e]! - 1;
      cap[e ^ 1] = cap[e ^ 1]! + 1;
      v = to[e ^ 1]!;
    }
  }
  if (flow === 0) return null; // the armies are not connected: nothing to hold

  // The min cut: the cells whose in S reaches in the final residual and
  // whose out it does not, the saturated splits on the frontier.
  const reach = bfs(null);
  const cut: GridCoord[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = idx(x, y);
      if (passable[v] && reach[2 * v] && !reach[2 * v + 1]) cut.push({ x, y });
    }
  }
  return cut.length > 0 && cut.length <= maxCut ? cut : null;
}

// ---------------------------------------------------------------------------
// Attrition (the attrition-stall script's read)
// ---------------------------------------------------------------------------

interface AttritionRead {
  /** Σ `effectiveStats.power` over each side's living units, the sum
   *  `World.survivorPower` takes (private there, so derived again here in
   *  lockstep): the standing power a capped turn charges the other side's
   *  pool, on top of each pool's own fallen (`run/chipRule.ts`). */
  readonly ownPower: number;
  readonly enemyPower: number;
  /** The units carrying a damaging periodic status (burn, bleed, poison,
   *  resolved by key), per side: attrition already in motion. */
  readonly ownDotCount: number;
  readonly enemyDotCount: number;
}

/**
 * Whether the fight is joined: any unit on either side stands within its
 * own attack range of an opposing unit, each side judged by its own reach
 * (a bow shooting us from 3 is contact even when our melee cannot answer
 * yet). The attrition stall's contact gate (its header gives the reason)
 * and the searcher's contact trigger read it.
 */
export function armiesInContact(world: World, team: ObjectiveTeam): boolean {
  const own = livingUnits(world, team);
  const enemies = livingUnits(world, opposingTeam(team));
  for (const u of own) {
    for (const e of enemies) {
      const d = distanceBetween(u.position, e.position);
      if (d <= u.derived.attackRange || d <= e.derived.attackRange) return true;
    }
  }
  return false;
}

export function attritionRead(world: World, team: ObjectiveTeam): AttritionRead {
  const sum = (units: Unit[]) => units.reduce((acc, u) => acc + u.effectiveStats.power, 0);
  // Not every unit effect is a catalog status: the plain stat effects
  // (fatigued, honed, warded; `statusBehavior.ts`) have no `STATUS_DEFS`
  // entry, so the lookup must take a key with no def (a stat effect is
  // never a DoT), where the throwing `statusDef()` would crash on one.
  const dots = (units: Unit[]) =>
    units.filter(
      (u) =>
        u.effects.some((e) => {
          const def = STATUS_DEFS[e.key];
          return def !== undefined && statusHarms(def);
        }),
    ).length;
  const own = livingUnits(world, team);
  const enemy = livingUnits(world, opposingTeam(team));
  return {
    ownPower: sum(own),
    enemyPower: sum(enemy),
    ownDotCount: dots(own),
    enemyDotCount: dots(enemy),
  };
}

// ---------------------------------------------------------------------------
// Focus-target features (the cohesion-focus script's read)
// ---------------------------------------------------------------------------

/**
 * The raw features of each enemy, for cohesion focus, which filters and
 * ranks them (its header). No weights live here: the `scored` objective
 * proclivity under `tests/fuzz` keeps its own model, which `src` cannot
 * import.
 */
export interface FocusTargetFeature {
  readonly unitId: number;
  readonly archetype: Archetype;
  /** currentHp / derived.maxHp: how near the kill is. */
  readonly hpFraction: number;
  /** `effectiveStats.power`. */
  readonly power: number;
  readonly attackRange: number;
  /** Chebyshev steps to the closest living unit of `team`: its reach. */
  readonly distToNearestOwn: number;
}

export function focusTargetFeatures(world: World, team: ObjectiveTeam): FocusTargetFeature[] {
  const own = livingUnits(world, team);
  return livingUnits(world, opposingTeam(team)).map((e) => {
    let dist = Infinity;
    for (const u of own) dist = Math.min(dist, distanceBetween(u.position, e.position));
    return {
      unitId: e.id,
      archetype: e.archetype,
      hpFraction: e.currentHp / e.derived.maxHp,
      power: e.effectiveStats.power,
      attackRange: e.derived.attackRange,
      distToNearestOwn: dist,
    };
  });
}
