/**
 * The caster's step back: the `move` op in `retreat` mode (the gambit's
 * dart-back after its strike, `interpreter.ts`) and a fleeing unit's panic
 * step (`MovementBehavior`).
 *
 * `retreatCell` gives the one-cell step away from `anchor`, or null when there
 * is none (boxed in, a corner, a corridor one cell wide) and the caller holds.
 * The geometry, a strictly farther cell with the tie going to open space, is
 * `positioning.awayStep`'s; this file decides which cells are taken. Pure given
 * the world.
 */

import type { GridCoord } from '../../core/types';
import type { Unit } from '../Unit';
import type { World } from '../World';
import { awayStep } from '../positioning';
import { GROUND, claimedCells, occupiedCells } from '../occupancy';

export function retreatCell(unit: Unit, anchor: GridCoord, world: World): GridCoord | null {
  // Every other unit's cells, from the occupancy module.
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  // A cell another unit has claimed (a move's destination, mid-flight) is taken
  // too: the dart-back writes `position` at once, so landing on a claimed cell
  // collides when the claimant's move lands. The unit's own claim is excluded.
  // The healer's `stepAwayFrom` (SupportMovementBehavior) leaves claims out,
  // since it proposes a move, which aborts as it runs if the cell is taken.
  for (const k of claimedCells(world, GROUND, { excludeId: unit.id })) occupied.add(k);

  return awayStep(unit.position, anchor, world, occupied);
}
