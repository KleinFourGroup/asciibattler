import type { Unit } from './Unit';
import type { GridCoord } from '../core/types';
import { SIM } from '../config/sim';
import { chebyshev } from './movement';

/**
 * O3 — what a unit does under a `focus` objective whose target is a TILE (not
 * an enemy), consumed by `Targeting.updateFocusTarget`:
 *   · `pursue`      — farther than `SIM.rangedLeashCells` from the tile:
 *     beeline to it, ignoring enemies.
 *   · `engageLocal` — within that band: act exactly like `engage{tile}`, engaging
 *     enemies within the unit's own leash, else holding at the tile.
 * The tile focus persists (the team garrisons the area), and a unit that can't
 * reach the exact tile (occupied or walled) still switches once it is within
 * the band: "the nearest cell it can hold".
 *
 * Stateless: each tick's directive is a pure function of the unit's live
 * position and the tile, so `focus` rides O1's snapshot with no field of its
 * own.
 */
type FocusTileDirective = 'pursue' | 'engageLocal';

/** O3 — this unit's per-tick behavior under a TILE focus. */
export function focusTileDirective(unit: Unit, tile: GridCoord): FocusTileDirective {
  return chebyshev(unit.position, tile) <= SIM.rangedLeashCells ? 'engageLocal' : 'pursue';
}
