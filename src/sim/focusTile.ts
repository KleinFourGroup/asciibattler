import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';
import type { ObjectiveTeam } from './objective';
import { OBJECTIVE } from '../config/objective';
import type { FocusTileResolutionKey } from '../config/objective';

/**
 * O3 — the switchable resolution strategy for a `focus` objective whose target
 * is a TILE (not an enemy). The brief wants all three behaviors easily
 * swappable so playtest can A/B; this is the ONE keyed resolver (config-selected
 * via `OBJECTIVE.focusTileResolution`), not three forks scattered across the sim.
 *
 * Each strategy answers two questions:
 *   - `directive(unit, world, tile)` — what should THIS unit do this tick under
 *     the tile focus (consumed by `Targeting.updateFocusTarget`):
 *       · `pursue`      — beeline to the tile, ignore enemies (the full preempt).
 *       · `engageLocal` — act exactly like `engage{tile}` here: engage nearby
 *         enemies within the unit's leash, else walk to the tile.
 *       · `atWill`      — behave as if no objective (a defensive fallback; in
 *         practice `disallow` reverts the focus at the World boundary first).
 *   - `resolvedByArrival(team, tile, world)` — should the WORLD revert this
 *     team's tile focus to `atWill` now (consumed by
 *     `World.clearResolvedObjectives`)?
 *
 * The strategies are STATELESS (no per-unit serialized flag) — each tick's
 * directive is a pure function of the unit's live position vs the tile, so
 * `focus` rides O1's snapshot with no extra field/bump (like `hold` did).
 */
export type FocusTileDirective = 'pursue' | 'engageLocal' | 'atWill';

export interface FocusTileResolution {
  directive(unit: Unit, world: World, tile: GridCoord): FocusTileDirective;
  resolvedByArrival(team: ObjectiveTeam, tile: GridCoord, world: World): boolean;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Any LIVING unit of `team` standing ON the tile — `clearOnArrival`'s trigger. */
function teamUnitAtTile(team: ObjectiveTeam, tile: GridCoord, world: World): boolean {
  for (const u of world.units) {
    if (u.team !== team) continue;
    if (u.currentHp <= 0) continue;
    if (u.position.x === tile.x && u.position.y === tile.y) return true;
  }
  return false;
}

/**
 * `disallow` — a tile focus is rejected outright: the World reverts the team to
 * `atWill` on the same tick it's set (the revert scan runs right after the
 * command drain). The `atWill` directive is the one-tick defensive fallback in
 * case targeting somehow sees it before the revert.
 */
const disallow: FocusTileResolution = {
  directive: () => 'atWill',
  resolvedByArrival: () => true,
};

/**
 * `clearOnArrival` — units beeline to the tile (`pursue`, ignoring enemies);
 * once ANY team unit stands on it, the whole team focus reverts to `atWill`.
 * (Caveat: an UNREACHABLE tile — a wall — is never stood on, so the focus
 * persists as a permanent beeline; `leashAtNearest` is the default precisely
 * because it degrades gracefully there.)
 */
const clearOnArrival: FocusTileResolution = {
  directive: () => 'pursue',
  resolvedByArrival: (team, tile, world) => teamUnitAtTile(team, tile, world),
};

/**
 * `leashAtNearest` (DEFAULT) — units beeline to the tile (`pursue`) while far,
 * then once within `OBJECTIVE.rangedLeashCells` of it switch to `engageLocal`
 * (act like `engage{tile}`: engage enemies within their own leash, else hold at
 * the tile). The tile focus persists — the team garrisons the area rather than
 * reverting. The leash radius is reused as the activation radius (no separate
 * knob); a unit that can't reach the exact tile (occupied/walled) still flips to
 * `engageLocal` once it's within that band — "the nearest cell it can hold."
 */
const leashAtNearest: FocusTileResolution = {
  directive: (unit, _world, tile) =>
    chebyshev(unit.position, tile) <= OBJECTIVE.rangedLeashCells ? 'engageLocal' : 'pursue',
  resolvedByArrival: () => false,
};

const RESOLUTIONS: Record<FocusTileResolutionKey, FocusTileResolution> = {
  disallow,
  clearOnArrival,
  leashAtNearest,
};

/** O3 — the resolution strategy for `key` (mirrors `getTargetingStrategy`). Lets
 *  tests exercise a specific strategy directly without mutating the shipped
 *  config; the sim itself always goes through `active()`. */
export function getFocusTileResolution(key: FocusTileResolutionKey): FocusTileResolution {
  return RESOLUTIONS[key];
}

/** The live strategy (config-selected). Read each call so a hot-reloaded
 *  `config/objective.json` takes effect without a sim restart. */
function active(): FocusTileResolution {
  return RESOLUTIONS[OBJECTIVE.focusTileResolution];
}

/** O3 — this unit's per-tick behavior under a TILE focus (see strategy docs). */
export function focusTileDirective(unit: Unit, world: World, tile: GridCoord): FocusTileDirective {
  return active().directive(unit, world, tile);
}

/** O3 — should the World revert `team`'s TILE focus to `atWill` now? */
export function focusTileResolvedByArrival(
  team: ObjectiveTeam,
  tile: GridCoord,
  world: World,
): boolean {
  return active().resolvedByArrival(team, tile, world);
}
