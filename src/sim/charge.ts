import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';
import { SIM } from '../config/sim';
import { secondsToTicks } from '../config';
import { cellKey, cellsOccupiedBy, GROUND, vacancyEtaOf } from './occupancy';

/**
 * The cells of a straight line from `from` to `to`, by the same Bresenham
 * stepping `hasLineOfSight` walks (`LineOfSight.ts`), `from` left out and
 * `to` included: the line a unit sees along is the line it charges along.
 * It steps diagonally between two cells that touch at a corner, as sight, a
 * push's walk and a step all pass. Empty when `from` is `to`.
 */
export function lineCells(from: GridCoord, to: GridCoord): GridCoord[] {
  const cells: GridCoord[] = [];
  if (from.x === to.x && from.y === to.y) return cells;
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx - dy;
  while (true) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    cells.push({ x, y });
    if (x === to.x && y === to.y) return cells;
  }
}

/** Where a charge ends: its landing, the cells walked, and the body it met. */
export interface ChargeWalk {
  landing: GridCoord;
  /** The cells walked, at least 1. */
  cells: number;
  /** The unit whose body stopped the walk, or whose claim did as it arrives
   *  in time (`chargeWalk`); null when a tile, another claim or the line's
   *  end did. */
  met: Unit | null;
}

/**
 * A charge's walk (a `move` op in `charge` mode): along `lineCells` from the
 * caster toward `toward`, up to the cell before the first that stops it: a
 * body (any unit's but the caster's, scenery included), a cell another unit
 * has claimed (gotcha #113), or a tile of infinite cost, the board's edge, a
 * wall's tile, a chasm or deep water, so the charger never falls. Null when
 * it moves no cell.
 *
 * A claim meets its claimant as a body does when the claimant's step flips
 * it onto the cell before the blow lands, the rush's `travel` (the cells
 * walked at `SIM.pushSecondsPerCell`) from now: a foe walking in stands
 * there by then, beside the landing. Strictly before, so the order the two
 * units act in on the blow's tick never decides it. A claim that flips later,
 * or whose claimant is not mid-step, stops the walk with no one met, so a
 * foe starting a slow step on sand is not rushed a cell short.
 *
 * Pure: it reads the world and changes nothing.
 */
export function chargeWalk(world: World, caster: Unit, toward: GridCoord): ChargeWalk | null {
  const bodies = new Map<string, Unit>();
  for (const u of world.units) {
    if (u.id === caster.id) continue;
    for (const c of cellsOccupiedBy(u)) bodies.set(cellKey(c), u);
  }
  // Every claim on the ground but the caster's own, by the unit that made it.
  const claimants = new Map<string, Unit | undefined>();
  for (const claim of world.claims.values()) {
    if (claim.unitId === caster.id || claim.plane !== GROUND) continue;
    claimants.set(cellKey(claim.cell), world.findUnit(claim.unitId));
  }

  let landing = caster.position;
  let cells = 0;
  let met: Unit | null = null;
  for (const c of lineCells(caster.position, toward)) {
    const k = cellKey(c);
    const body = bodies.get(k);
    if (body !== undefined) {
      met = body;
      break;
    }
    if (claimants.has(k)) {
      const claimant = claimants.get(k);
      const eta = claimant === undefined ? undefined : vacancyEtaOf(claimant, world);
      const blowTicks = Math.max(1, secondsToTicks(cells * SIM.pushSecondsPerCell));
      if (claimant !== undefined && eta !== undefined && eta < blowTicks) met = claimant;
      break;
    }
    if (!isFinite(world.tileGrid.costAt(c))) break;
    landing = c;
    cells++;
  }
  return cells === 0 ? null : { landing: { ...landing }, cells, met };
}
