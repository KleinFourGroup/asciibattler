/**
 * Who an op resolves to, for the effect interpreter. A single-target selector
 * resolves to one unit when the ability proposes; an `aoe` selector resolves to
 * the units in its cells when it fires, whoever is standing there then, and
 * these helpers do that.
 *
 * A unit is in an area when any cell of its footprint is (`cellsOccupiedBy`),
 * so a blast over any body cell of a 2×2 or 3×3 rubble catches it.
 */

import type { GridCoord } from '../../core/types';
import type { World } from '../World';
import { type Unit, type Team } from '../Unit';
import { isDestructibleNeutral } from '../../config/units';
import { cellKey, cellUnitDistance, cellsOccupiedBy } from '../occupancy';
import type { Affects } from './schema';

/**
 * The units whose footprint meets the cell set, in `world.units` order, which
 * fixes the order of each victim's events and draws downstream.
 */
export function unitsInCells(world: World, cells: Iterable<GridCoord>): Unit[] {
  const keys = new Set<string>();
  for (const c of cells) keys.add(cellKey(c));
  return world.units.filter((u) => cellsOccupiedBy(u).some((c) => keys.has(cellKey(c))));
}

/** The square of Chebyshev radius `radius` around `center`, (2·radius+1)² cells. */
export function squareCells(center: GridCoord, radius: number): GridCoord[] {
  const cells: GridCoord[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      cells.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  return cells;
}

/** The cells an `aoe` shape covers around its centre. Only `square` is built;
 *  `line` and `cross` pass the schema and throw here when an op fires one. */
function cellsForAoeShape(
  shape: 'square' | 'line' | 'cross',
  center: GridCoord,
  radius: number,
): GridCoord[] {
  switch (shape) {
    case 'square':
      return squareCells(center, radius);
    case 'line':
    case 'cross':
      throw new Error(`aoe shape '${shape}' is reserved — no consumer until a verb needs it`);
  }
}

/**
 * The team filter, relative to the caster. `'enemies'` is every team but the
 * caster's, neutrals included; which neutrals can be hit at all is
 * `isCombatTargetable`'s call, not this filter's.
 */
export function affectsMatch(affects: Affects, unitTeam: Team, casterTeam: Team): boolean {
  switch (affects) {
    case 'enemies':
      return unitTeam !== casterTeam;
    case 'allies':
      return unitTeam === casterTeam;
    case 'all':
      return true;
  }
}

/**
 * Whether a unit can be hit: alive, and a combatant, a destructible neutral or
 * a camp member. A neutral is destructible when its catalog entry has an `hp`
 * pool (rubble); a neutral without one (a wall, half cover) is never hit. So an
 * `affects: 'enemies'` blast breaks rubble and leaves walls whole. A combatant
 * passes on the team check alone, without the catalog.
 */
export function isCombatTargetable(u: Unit): boolean {
  if (u.currentHp <= 0) return false;
  // A camp member is a body in the blast: splash and chain arcs hit it, and a
  // landed hit turns its camp hostile (`World.dealDamage`).
  return u.team !== 'neutral' || isDestructibleNeutral(u.archetype) || u.campId !== null;
}

/**
 * The chain op's next hop: the nearest hittable unit not on `casterTeam` within
 * `rangeCells` (Chebyshev) of `from`, skipping the ids in `exclude` (those
 * already hit, so an arc never repeats a target). Distance is to the unit's
 * nearest footprint cell (`cellUnitDistance`), so a large rubble whose body
 * reaches into range is a hop even when its anchor cell is outside. An equal
 * distance goes to the first in `world.units` order, as a blast's victims are
 * ordered. `undefined` when no fresh target is in range, and the chain ends.
 *
 * It takes the caster's team rather than the caster, so a hop resolved ticks
 * after the cast never reads a caster that died mid-chain; the caller stops a
 * dead caster's chain itself.
 */
export function nearestChainTarget(
  world: World,
  casterTeam: Team,
  from: GridCoord,
  rangeCells: number,
  exclude: Set<number>,
): Unit | undefined {
  let best: Unit | undefined;
  let bestDist = Infinity;
  for (const u of world.units) {
    if (exclude.has(u.id)) continue;
    if (u.team === casterTeam) continue;
    if (!isCombatTargetable(u)) continue;
    const d = cellUnitDistance(from, u);
    if (d > rangeCells) continue;
    if (d < bestDist) {
      best = u;
      bestDist = d;
    }
  }
  return best;
}

/** An area victim and its damage multiplier (1 at the centre, `ringMultiplier` on the ring). */
interface AreaVictim {
  unit: Unit;
  mult: number;
}

/**
 * An `aoe` selector's victims as it fires: the hittable units in the shape that
 * `affects` admits, in `world.units` order, each with its multiplier. A unit
 * takes the centre's 1 when any footprint cell is on the centre
 * (`cellUnitDistance === 0`), and the ring's multiplier otherwise.
 */
export function resolveAreaVictims(
  world: World,
  caster: Unit,
  center: GridCoord,
  params: { shape: 'square' | 'line' | 'cross'; radius: number; ringMultiplier: number; affects: Affects },
): AreaVictim[] {
  const cells = cellsForAoeShape(params.shape, center, params.radius);
  return unitsInCells(world, cells)
    .filter((u) => isCombatTargetable(u) && affectsMatch(params.affects, u.team, caster.team))
    .map((u) => ({ unit: u, mult: cellUnitDistance(center, u) === 0 ? 1 : params.ringMultiplier }));
}
