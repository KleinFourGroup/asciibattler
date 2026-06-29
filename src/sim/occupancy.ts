/**
 * §35 — the occupancy core. The single abstraction every spatial query routes
 * through, so the same "what occupies a cell" question is answered in exactly one
 * place. Before this, the check was scattered — `World.isOccupied`'s overflow
 * scan, `buildMovementContext`'s sidestep set, the `nearestFreeCells` summon BFS,
 * the gambit `retreatCell` set — each re-deriving it inline. Centralizing now is
 * what makes the two Cluster-2 fills cheap LATER:
 *
 *   - **The footprint seam (`cellsOccupiedBy`).** Single-cell today (returns
 *     `[unit.position]`); §39 fills it to the N×N block. Because every consumer
 *     touches a unit's cells THROUGH this, the multi-tile fill is automatic — no
 *     scattered `key(position)` to hunt down.
 *   - **The plane seam (`OccupancyPlane`).** `'ground'` today; `'air'` is the
 *     flight fill. One unit per cell PER PLANE. Every query takes a plane and
 *     filters by `planeOf`, so the costly part of adding flight (finding the
 *     single-layer assumptions) is already paid.
 *
 * Behavior is byte-identical today: there is exactly one plane and every footprint
 * is one cell, so `planeOf` never excludes and `cellsOccupiedBy` yields one cell.
 */

import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';

/**
 * The occupancy planes. A closed union — `'ground'` is the only plane today; the
 * flight build adds `'air'` (its own design is locked, see ROADMAP "Deferred:
 * Flight"). One unit per cell per plane is the invariant §35 hardens.
 */
export type OccupancyPlane = 'ground';

/** The sole plane today; the default every query falls back to. */
export const GROUND: OccupancyPlane = 'ground';

/**
 * The cells a unit's body occupies. **The footprint seam** — single-cell today
 * (`[unit.position]`); §39 returns the N×N block anchored at the canonical corner
 * `unit.position`. Every occupancy / pathing / targeting consumer routes its
 * per-unit cell touch through here, so the multi-tile fill needs no retrofit.
 */
export function cellsOccupiedBy(unit: Unit): GridCoord[] {
  return [unit.position];
}

/**
 * The plane a unit lives on. **The plane seam** — always `'ground'` today; the
 * §38 `layer` field + the flight build select `'air'`. Centralized so every
 * occupancy query is plane-correct the moment a second plane exists.
 */
export function planeOf(_unit: Unit): OccupancyPlane {
  return GROUND;
}

/** The canonical cell key (`"x,y"`). One definition — the sim's many ad-hoc
 *  `` `${c.x},${c.y}` `` template strings collapse onto this. */
export function cellKey(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

/**
 * The unit (if any) occupying `cell` on `plane` — the single occupancy POINT
 * query. `World.isOccupied`, summon placement, and proactive move checks (§35b)
 * all route here. Scans `world.units` (small N); a future index attaches behind
 * this signature without touching a caller.
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
 * Every occupied cell on `plane`, as a key set — the shared SET builder for the
 * movement sidestep set, the summon BFS, and the gambit retreat. `excludeId`
 * drops one unit (the mover itself), matching the "every OTHER unit" sets those
 * consumers built inline. Footprint-aware via `cellsOccupiedBy` (one cell today).
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
 * Whether EVERY cell in `cells` is free on `plane` — the occupancy half of the
 * footprint-fit check. §39 pairs this with in-bounds + passability for spawn
 * anchoring; single-cell today, `footprintFits(world, [cell])` === `isFree`.
 */
export function footprintFits(
  world: World,
  cells: readonly GridCoord[],
  plane: OccupancyPlane = GROUND,
): boolean {
  return cells.every((c) => isFree(world, c, plane));
}

/**
 * Grid distance between two cells — Chebyshev (8-connected movement, a diagonal
 * costs one step). **The distance seam** — single-tile today; §39 adds a
 * footprint-aware unit-to-unit variant (the min cell-to-cell Chebyshev over the
 * two bodies). Adjacency / acting-position route through here so that fill lands
 * in one place.
 */
export function distanceBetween(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * §35d — the occupancy INVARIANT detector: the cell keys held by MORE THAN ONE
 * unit on `plane` — a breach of the one-unit-per-cell-per-plane invariant §35
 * hardens. Empty ⇒ the invariant holds. Footprint- and plane-aware via
 * `cellsOccupiedBy`/`planeOf` (one cell / one plane today; the §39 N×N block for
 * free). The fuzz harness runs this every tick under an opt-in flag — the
 * corpus-wide generalization of the Qb#3 same-cell fixture. Counts ALL units
 * (combatants AND neutral walls): the invariant is "the grid never double-books
 * a cell," whoever the occupant.
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
 * §36a — an in-flight CELL CLAIM: a cell a moving unit has reserved as its move
 * destination. The claim system closes the same-tick collision window a
 * non-instant move opens (§36b): a unit claims `to` on move-start, the pathing
 * predicate treats a cell as blocked-for-pathing if **occupied OR claimed**, and
 * the claim releases on logical arrival — so two units never converge on one
 * vacant cell (the second sees the claim and re-routes).
 *
 * §36a ships the registry + these queries + serialization **inert**: nothing
 * creates a persistent claim on the instant move model (a move's claim+release
 * would be atomic), so the registry is empty in real play and behavior is
 * byte-identical. §36b wires the claim/release lifecycle onto the deferred
 * position flip, making it load-bearing.
 *
 * Plane-aware (the §35 seam): a claim carries the claiming unit's plane and the
 * queries filter by it. Ground-only today; the registry keys by cell, so a second
 * plane revisits the key the way `cellsOccupiedBy` revisits the footprint.
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
 * The unit id holding a claim on `cell` on `plane`, or undefined — the claim
 * POINT query. `destinationBlocked` (§35b) consults it so a stale move proposal
 * whose destination a peer just claimed aborts. Inert today (no persistent claims).
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
 * The cell `unitId` has CLAIMED (its in-flight move destination), or undefined —
 * the INVERSE of `claimantOf` (unit→cell, not cell→unit). A mover holds at most
 * one claim, live only between move-start and the §36b flip, so this is the cell
 * the unit is ARRIVING at right now. §36b consumer: a melee/ranged pursuer reads
 * its TARGET's claim to recognise "my target is arriving into my firing band" and
 * hold for it, rather than sidestepping around the reservation (the locomotion
 * dual of the claim's pathing-block). O(claims) scan — claims are few.
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
 * Every CLAIMED cell on `plane`, as a key set — the claim sibling of
 * `occupiedCells`. `buildMovementContext` merges it into the soft-block set so a
 * pather routes around (and never sidesteps onto) a peer's claimed destination.
 * `excludeId` drops the building unit's own claims (it may move into what it
 * reserved). Inert today (the set is empty with no persistent claims).
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
