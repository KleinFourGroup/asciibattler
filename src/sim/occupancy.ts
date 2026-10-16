/**
 * The occupancy core: the one place that answers "what occupies a cell", for
 * every spatial query.
 *
 * - The footprint (`cellsOccupiedBy`): a unit's body is the N×N block whose
 *   minimum corner is `unit.position`, N from its catalog def's `footprint`.
 *   Every occupancy, pathing and targeting consumer touches a unit's cells
 *   through it. Combatants are one cell; rubble ships at 2×2 and 3×3.
 * - The plane (`OccupancyPlane`): one unit per cell per plane. Every query
 *   takes a plane and filters by `planeOf`; there is one plane, `'ground'`,
 *   so the filter never excludes.
 */

import type { GridCoord } from '../core/types';
import type { RNG } from '../core/RNG';
import { distanceBetween } from '../core/grid';
import { ALL_UNIT_DEFS } from '../config/units';
import { MOVE_ACTION_ID } from './actions/MoveAction';
import type { Unit } from './Unit';
import type { World } from './World';

/**
 * The occupancy planes, a closed union with one member. One unit per cell per
 * plane is the invariant (`findOverlappingCells`).
 */
export type OccupancyPlane = 'ground';

/** The one plane, and the default every query takes. */
export const GROUND: OccupancyPlane = 'ground';

/**
 * A unit's footprint edge N (an N×N body; the schema allows 1 to 4), read off
 * its catalog def at call time (gotcha #114: never at module evaluation, and
 * imported from `config/units`), 1 for an id the catalog lacks. The one place
 * the geometry below learns how big a body is.
 */
export function footprintOf(unit: Unit): number {
  return ALL_UNIT_DEFS[unit.archetype]?.footprint ?? 1;
}

/**
 * The N×N block whose minimum corner is `corner`, extending toward +x and +y.
 * `cellsOccupiedBy` maps a unit onto it, and `anchorFootprint` tests a
 * candidate corner's block with it. `n === 1` yields a one-cell copy of
 * `corner`.
 */
export function footprintCells(corner: GridCoord, n: number): GridCoord[] {
  const cells: GridCoord[] = [];
  for (let dy = 0; dy < n; dy++) {
    for (let dx = 0; dx < n; dx++) {
      cells.push({ x: corner.x + dx, y: corner.y + dy });
    }
  }
  return cells;
}

/**
 * The cells a unit's body occupies: the N×N block whose minimum corner is
 * `unit.position`, extending toward +x and +y (`anchorFootprint` chooses which
 * corner a spawn takes). A one-cell unit gets `[unit.position]`, its position
 * object, not a copy. Every occupancy, pathing and targeting consumer reads a
 * unit's cells here.
 */
export function cellsOccupiedBy(unit: Unit): GridCoord[] {
  const n = footprintOf(unit);
  if (n === 1) return [unit.position];
  return footprintCells(unit.position, n);
}

/**
 * The plane a unit is on: always `'ground'`. Every occupancy query asks here,
 * so a second plane would change this function and no query.
 */
export function planeOf(_unit: Unit): OccupancyPlane {
  return GROUND;
}

/** The cell key, `"x,y"`, defined once. */
export function cellKey(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

/**
 * The packed cell key, `y * gridW + x`: `cellKey`'s numeric form for the hot
 * movement path, where number-keyed maps and sets skip a string's allocation
 * and hashing. It means something only on one grid: an index from one width
 * must never probe a set built for another, so `gridW` is passed, never
 * defaulted, and a call site says whose grid it means. Pass in-bounds coords
 * only: an off-grid coord aliases an on-grid index (the hazard `findPath`'s
 * blocker loop guards axis by axis).
 */
export function cellIndex(c: GridCoord, gridW: number): number {
  return c.y * gridW + c.x;
}

/**
 * The unit, if any, occupying `cell` on `plane`: the occupancy point query.
 * `World.isOccupied`, the move's destination check (`destinationBlocked`)
 * and the bot's sensors ask here. A scan of `world.units`, which is small.
 */
export function unitAt(
  world: World,
  cell: GridCoord,
  plane: OccupancyPlane = GROUND,
): Unit | undefined {
  for (const u of world.units) {
    if (planeOf(u) !== plane) continue;
    for (const c of cellsOccupiedBy(u)) {
      if (c.x === cell.x && c.y === cell.y) return u;
    }
  }
  return undefined;
}

/** Whether `cell` is free of any unit on `plane`. The negation of `unitAt`. */
export function isFree(world: World, cell: GridCoord, plane: OccupancyPlane = GROUND): boolean {
  return unitAt(world, cell, plane) === undefined;
}

/**
 * Every occupied cell on `plane`, as a key set, every cell of a body
 * included: the set the placement search (`nearestFreeCells`), the blind
 * wander, the healer's retreat, the blocked-ally check and the effects'
 * reposition build on. `excludeId` drops one unit, the mover itself.
 */
export function occupiedCells(
  world: World,
  plane: OccupancyPlane = GROUND,
  opts?: { excludeId?: number },
): Set<string> {
  const excludeId = opts?.excludeId;
  const set = new Set<string>();
  for (const u of world.units) {
    if (u.id === excludeId) continue;
    if (planeOf(u) !== plane) continue;
    for (const c of cellsOccupiedBy(u)) set.add(cellKey(c));
  }
  return set;
}

/**
 * How a body anchors on its spawn tile. `corner` is deterministic;
 * `random-intersect` picks uniformly among every fitting placement whose
 * block covers the spawn tile, for the camp drip's scatter.
 */
type AnchorPolicy = 'corner' | 'random-intersect';

/**
 * Where an N×N body anchors when its spawn tile is `spawnTile`, or null when
 * it can't fit there. Under `corner` the spawn tile is a corner of the block:
 * the four orientations are tried, the +x/+y extension first, and the first
 * block wholly on the grid and passing `isFreeCell` wins, so an edge tile
 * still fits, the block extending inward. Null tells the caller to try its
 * next tile. At `size` 1, both policies ask whether `spawnTile` is free and
 * on the grid.
 *
 * Pure and World-free (grid dimensions and an `isFreeCell` predicate), so
 * the caller decides what free means (unoccupied, passable, unclaimed).
 * `random-intersect` draws on `rng`, the only randomness this module takes,
 * and only when more than one placement fits (gotcha #111): the camp drip
 * passes `campRng`, so the draw never touches the combat stream. The drip is
 * the shipped caller; `corner` serves the layout editor's deploy check.
 */
export function anchorFootprint(
  spawnTile: GridCoord,
  size: number,
  grid: { gridW: number; gridH: number },
  isFreeCell: (cell: GridCoord) => boolean,
  policy: AnchorPolicy = 'corner',
  rng?: RNG,
): GridCoord[] | null {
  const { x, y } = spawnTile;
  const d = size - 1;

  if (policy === 'random-intersect') {
    // Every minimum corner in [x-d..x] × [y-d..y] keeps the block over the
    // spawn tile; collect the fitting ones in a fixed order (dy outer, dx
    // inner), then pick uniformly. One fit draws nothing, so a 1×1 drip costs
    // the camp stream nothing; `rng` is required only for a draw.
    const fitting: GridCoord[][] = [];
    for (let dy = 0; dy <= d; dy++) {
      for (let dx = 0; dx <= d; dx++) {
        const cells = footprintCells({ x: x - dx, y: y - dy }, size);
        const fits = cells.every(
          (c) => c.x >= 0 && c.y >= 0 && c.x < grid.gridW && c.y < grid.gridH && isFreeCell(c),
        );
        if (fits) fitting.push(cells);
      }
    }
    if (fitting.length === 0) return null;
    if (fitting.length === 1) return fitting[0]!;
    if (rng === undefined) {
      throw new Error('anchorFootprint: random-intersect with >1 candidates requires an rng');
    }
    return fitting[Math.floor(rng.next() * fitting.length)]!;
  }

  // Min-corner candidates in deterministic preference order: extend +x/+y first
  // (spawn tile = the min corner), then flip x, then y, then both, so the block
  // stays on-grid near an edge. All four keep the spawn tile as a corner of the
  // block. (d === 0 makes these identical — the single-cell case.)
  const minCorners: GridCoord[] = [
    { x, y },
    { x: x - d, y },
    { x, y: y - d },
    { x: x - d, y: y - d },
  ];
  for (const corner of minCorners) {
    const cells = footprintCells(corner, size);
    const fits = cells.every(
      (c) => c.x >= 0 && c.y >= 0 && c.x < grid.gridW && c.y < grid.gridH && isFreeCell(c),
    );
    if (fits) return cells;
  }
  return null;
}

/**
 * The distance between two units' bodies: the least cell-to-cell Chebyshev
 * over the two blocks. For two one-cell units it is
 * `distanceBetween(a.position, b.position)`; a larger body measures from its
 * nearest cell, so a 2×2 and a unit against its edge are at 1, and two
 * overlapping bodies at 0. The dash's abstain (`effects/propose.ts`), the
 * kite (`positioning.ts`), the aura's radius (`World`) and the targeting's
 * reach and range checks read it.
 */
export function unitDistance(a: Unit, b: Unit): number {
  const aCells = cellsOccupiedBy(a);
  const bCells = cellsOccupiedBy(b);
  if (aCells.length === 1 && bCells.length === 1) {
    return distanceBetween(aCells[0], bCells[0]);
  }
  let min = Infinity;
  for (const ca of aCells) {
    for (const cb of bCells) {
      const d = distanceBetween(ca, cb);
      if (d < min) min = d;
    }
  }
  return min;
}

/**
 * The distance from a cell to a unit's body: the least Chebyshev from `cell`
 * over the unit's block, `unitDistance`'s cell-to-body form. For a one-cell
 * unit it is `distanceBetween(cell, unit.position)`; 0 means `cell` is inside
 * the body. The blast's centre test and the chain's hop range
 * (`effects/targeting.ts`) and the rubble approach (`Targeting.ts`) read it.
 */
export function cellUnitDistance(cell: GridCoord, unit: Unit): number {
  const cells = cellsOccupiedBy(unit);
  if (cells.length === 1) return distanceBetween(cell, cells[0]);
  let min = Infinity;
  for (const c of cells) {
    const d = distanceBetween(cell, c);
    if (d < min) min = d;
  }
  return min;
}

/**
 * The invariant's detector: the cell keys more than one unit holds on
 * `plane`, every cell of a body counted. Empty means one unit per cell per
 * plane holds. The fuzz harness runs it after every tick under an opt-in
 * flag, and the chaos census reads it. Counts every unit, scenery included:
 * the grid never double-books a cell, whoever the occupant.
 */
export function findOverlappingCells(world: World, plane: OccupancyPlane = GROUND): string[] {
  const counts = new Map<string, number>();
  for (const u of world.units) {
    if (planeOf(u) !== plane) continue;
    for (const c of cellsOccupiedBy(u)) {
      const k = cellKey(c);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const out: string[] = [];
  for (const [k, n] of counts) if (n > 1) out.push(k);
  return out;
}

/**
 * A cell claim: a cell a moving unit has reserved as its destination. A move
 * is not instant, so two units could set out for one empty cell; a unit
 * claims `to` as its move starts (`MoveAction`), pathing treats a cell
 * occupied or claimed as blocked, and the claim is released at the flip, so
 * the second mover sees the claim and goes another way. A placement must
 * exclude claims too (gotcha #113). The registry is `World.claims`, and it is
 * serialized.
 *
 * A claim carries its unit's plane, and the queries filter by it. The
 * registry is keyed by cell alone, which a second plane would have to change.
 */
export interface Claim {
  /** The reserved cell (the mover's destination). */
  readonly cell: GridCoord;
  /** The unit holding the reservation. */
  readonly unitId: number;
  /** The plane the reservation is on (the claiming unit's plane). */
  readonly plane: OccupancyPlane;
}

/**
 * The id of the unit holding a claim on `cell` on `plane`, or undefined: the
 * claim point query. `World.destinationBlocked` asks it, so a stale move
 * whose destination a peer has just claimed aborts.
 */
export function claimantOf(
  world: World,
  cell: GridCoord,
  plane: OccupancyPlane = GROUND,
): number | undefined {
  const claim = world.claims.get(cellKey(cell));
  return claim !== undefined && claim.plane === plane ? claim.unitId : undefined;
}

/** Whether `cell` is claimed by any unit on `plane`. The boolean form of `claimantOf`. */
export function isClaimed(world: World, cell: GridCoord, plane: OccupancyPlane = GROUND): boolean {
  return claimantOf(world, cell, plane) !== undefined;
}

/**
 * The cell `unitId` has claimed, its move's destination, or undefined:
 * `claimantOf` the other way round. A mover holds at most one claim, live
 * from the move's start to its flip, so this is the cell the unit is arriving
 * at. A pursuer reads its target's claim to see the target arriving into its
 * firing band and hold for it, rather than step around the reservation
 * (`positioning.ts`). A scan of the claims, which are few.
 */
export function claimedDestinationOf(
  world: World,
  unitId: number,
  plane: OccupancyPlane = GROUND,
): GridCoord | undefined {
  for (const claim of world.claims.values()) {
    if (claim.unitId === unitId && claim.plane === plane) return claim.cell;
  }
  return undefined;
}

/**
 * The vacancy ETA: ticks until `unit`'s move flips it off the cells it
 * occupies, or undefined when it is not leaving them. Defined only for a unit
 * mid-move and before the flip, while its destination claim is live: the
 * flip falls at the `impact` boundary, `startTick` plus the ticks of the
 * phases before it (`moveProposal`'s timeline), so the ETA is that minus
 * `currentTick`, at least 0 (a flip later this tick vacates now). After the
 * flip the unit stands on its destination through its recovery and the
 * claim is released, so the claim check tells the halves apart without
 * reading the action's internals.
 *
 * Derived, never serialized: computed from `activeAction`, which a snapshot
 * carries, on every query, so a restored world answers the same. Read by the
 * path costs (`buildMovementContext`, `costAt`) and by the step's wait gate,
 * for the forward cell.
 */
export function vacancyEtaOf(unit: Unit, world: World): number | undefined {
  const active = unit.activeAction;
  if (active === null || active.action.id !== MOVE_ACTION_ID) return undefined;
  if (claimedDestinationOf(world, unit.id, planeOf(unit)) === undefined) return undefined;
  let flipOffset = 0;
  for (const p of active.phases) {
    if (p.phase === 'impact') break;
    flipOffset += p.ticks;
  }
  return Math.max(0, active.startTick + flipOffset - world.currentTick);
}

/**
 * Every claimed cell on `plane`, as a key set: `occupiedCells`' claim
 * counterpart, for the placements that must exclude claims (the placement
 * search, `nearestFreeCells`, and the effects' reposition; gotcha #113).
 * `excludeId` drops the building unit's own claim, since it may move into
 * what it reserved.
 */
export function claimedCells(
  world: World,
  plane: OccupancyPlane = GROUND,
  opts?: { excludeId?: number },
): Set<string> {
  const excludeId = opts?.excludeId;
  const set = new Set<string>();
  for (const claim of world.claims.values()) {
    if (claim.unitId === excludeId) continue;
    if (claim.plane !== plane) continue;
    set.add(cellKey(claim.cell));
  }
  return set;
}

/**
 * Every claimed cell on `plane` with its occupancy ETA: ticks until the
 * claimant's move flips and the cell holds a body. `claimedCells` with
 * timing (the same filter): a claim and its claimant's vacancy share one
 * flip, so the value is `vacancyEtaOf(claimant)`. Undefined for a claim whose
 * claimant is not a live move (a test claiming by hand), which `costAt`
 * prices at the premium, as timing unknown. Feeds `costAt`'s claim tiers: a
 * flip inside the pather's arrival window is a convergence risk, the
 * premium; a flip long done by then is a body standing there.
 */
export function claimEtas(
  world: World,
  plane: OccupancyPlane = GROUND,
  opts?: { excludeId?: number },
): Map<number, number | undefined> {
  // Keyed by the packed `cellIndex`, not `cellKey`: `costAt` reads this map
  // once per A* expansion, the hottest lookup a battle makes.
  const excludeId = opts?.excludeId;
  const etas = new Map<number, number | undefined>();
  for (const claim of world.claims.values()) {
    if (claim.unitId === excludeId) continue;
    if (claim.plane !== plane) continue;
    const claimant = world.findUnit(claim.unitId);
    etas.set(
      cellIndex(claim.cell, world.gridW),
      claimant === undefined ? undefined : vacancyEtaOf(claimant, world),
    );
  }
  return etas;
}
