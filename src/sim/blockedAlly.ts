import type { GridCoord } from '../core/types';
import { isInertNeutral, type Unit } from './Unit';
import type { World } from './World';
import { currentTarget } from './Targeting';
import { NEIGHBORS, passable } from './positioning';
import { GROUND, cellsOccupiedBy, occupiedCells } from './occupancy';
import { key, chebyshev } from './movement';

/**
 * The "strictly blocking a boxed ally" detector, the blocker's half of the
 * swap: is a teammate boxed behind me? The role half of the decision is an
 * `eligible` filter each caller passes:
 *
 *   - the healer's yield (`SupportMovementBehavior`): any swappable ally;
 *   - the ranged yield (`MovementBehavior`): a swappable one-cell melee ally
 *     only, by the role order (ranged yields to melee, never the reverse).
 *
 * The question is answered from the world as it stands, which is what keeps
 * the swap stateless: a busy blocker needs no stored request from the
 * mover, since at its next poll it asks again and finds the same boxed
 * teammate.
 */

/**
 * The living ally (if any) for whom `unit` is the *only* cell it can advance
 * through — i.e. the ally to swap places with. An adjacent ally `a` qualifies
 * when the unit's cell `h` is `a`'s single forward step toward its target:
 * stepping onto `h` brings `a` closer (in real path distance) to its enemy,
 * and every other available neighbour of `a` does not. That is the strict
 * block: it fires at a real choke, not in the open, where `a` always has
 * another forward cell. Returns the first such ally in `world.units` order,
 * or null when the unit strictly blocks no one `eligible`.
 *
 * Forward is measured by path distance on the grid to the target, not
 * Chebyshev: in a funnel the route to an enemy can run away from it in a
 * straight line (back through a gap, then round), and a Chebyshev test reads
 * the gap cell as a retreat and never fires. A distance field from the
 * ally's target, over the inert neutrals' topology and built once per
 * target, answers "does stepping here bring me closer" for `h` and every
 * neighbour in one sweep.
 *
 * The field is anchored on `currentTarget(a)`, where `a` paths; an ally with
 * no target is skipped. The "other forward cell" test reads the occupancy
 * set with neutrals in it: walls and half cover are units, not tiles, so
 * `passable` rejects them only through `occupied`.
 */
export function blockedAlly(
  unit: Unit,
  world: World,
  eligible: (a: Unit) => boolean,
): Unit | null {
  const h = unit.position;
  const hKey = key(h);
  // Every cell of a body, so a rubble's body never reads as an open forward
  // cell.
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  const walls = neutralCells(world);
  const fields = new Map<number, Map<string, number>>(); // target id → dist field

  for (const a of world.units) {
    if (a.team !== unit.team) continue;
    if (a.id === unit.id) continue;
    if (a.currentHp <= 0) continue;
    if (chebyshev(a.position, h) !== 1) continue;
    if (!eligible(a)) continue;

    const enemy = currentTarget(a, world);
    if (enemy === null) continue;
    let dist = fields.get(enemy.id);
    if (dist === undefined) {
      dist = distanceField(enemy.position, world, walls);
      fields.set(enemy.id, dist);
    }

    const aDist = dist.get(key(a.position));
    if (aDist === undefined) continue; // `a` can't reach its target at all
    const hDist = dist.get(hKey);
    // `h` must be a forward cell for `a` (stepping onto it advances it).
    if (hDist === undefined || hDist >= aDist) continue;

    // Does `a` have any OTHER available forward cell? If so, `h` isn't its
    // only way through → the unit isn't strictly blocking it.
    let hasOtherForward = false;
    for (const [dx, dy] of NEIGHBORS) {
      const n: GridCoord = { x: a.position.x + dx, y: a.position.y + dy };
      if (n.x === h.x && n.y === h.y) continue;
      if (!passable(n, world, occupied)) continue;
      const nDist = dist.get(key(n));
      if (nDist !== undefined && nDist < aDist) {
        hasOtherForward = true;
        break;
      }
    }
    if (!hasOtherForward) return a;
  }
  return null;
}

/**
 * The step distance from `start` to every cell reachable over the static
 * graph (in bounds, of finite tile cost, not an inert neutral's cell):
 * eight-way, uniform cost, in the fixed `NEIGHBORS` order, so the field is
 * deterministic. Units other than scenery count as passable: this is the
 * board's topology (does a route pass this cell), not live occupancy, which
 * the caller tests on top. A `key → distance` map; a cell walled off from
 * `start` is absent.
 */
function distanceField(
  start: GridCoord,
  world: World,
  walls: ReadonlySet<string>,
): Map<string, number> {
  const dist = new Map<string, number>();
  const startKey = key(start);
  if (!isNavigable(start, world, walls)) return dist;
  dist.set(startKey, 0);
  const queue: GridCoord[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const d = dist.get(key(c))! + 1;
    for (const [dx, dy] of NEIGHBORS) {
      const n: GridCoord = { x: c.x + dx, y: c.y + dy };
      const nKey = key(n);
      if (dist.has(nKey)) continue;
      if (!isNavigable(n, world, walls)) continue;
      dist.set(nKey, d);
      queue.push(n);
    }
  }
  return dist;
}

/** The cell keys of every inert neutral (walls, half cover, rubble), whole
 *  bodies: the static blockers. A camp member is a mobile body, not
 *  topology, and stays out, as a combatant does. Whole bodies, so the
 *  healer's snap to a navigable cell (`SupportMovementBehavior`) never takes
 *  a rubble's body cell as its anchor. */
export function neutralCells(world: World): Set<string> {
  const cells = new Set<string>();
  for (const u of world.units) {
    if (isInertNeutral(u)) for (const c of cellsOccupiedBy(u)) cells.add(key(c));
  }
  return cells;
}

/** In bounds, of finite tile cost (no chasm or deep water), and not an inert
 *  neutral's cell. */
export function isNavigable(c: GridCoord, world: World, walls: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  return !walls.has(key(c));
}
