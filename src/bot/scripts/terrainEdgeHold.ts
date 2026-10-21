/**
 * Terrain-edge hold, first in priority: safety first. Pathfinding prices
 * `fire` at the floor cost (a surface effect, not an obstacle), so default
 * pursuit walks the team straight through the burn. A human rallies short
 * of the hazard instead and lets the enemy do the crossing: they arrive
 * burning and are shot at the edge. On a fire map the trigger stands true
 * all battle, so the script's value is its proposal, the tile short of the
 * fire, not the trigger's timing.
 *
 * Proposal: `engage` on the best edge tile, a passable non-hazard neighbor
 * of the barrier frontier (`isBarrierHazard`), on our side of it (nearer
 * our approaching units than their enemies), closest to the enemy.
 * `engage`, not `hold` or `focus`: its targeting keeps the units fighting
 * anything that crosses to them while they wait, as the human played it.
 *
 * Deterministic and state-only: pure reads, row-major ties, no RNG. The
 * edge tile can drift as the enemy moves; the trigger driver's dwell paces
 * a re-issue.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { distanceBetween } from '../../core/grid';
import { tileDef } from '../../sim/TileGrid';
import type { TrafficScript } from '../TrafficScriptDriver';
import {
  barrierCellList,
  isBarrierHazard,
  isHazardKind,
  livingUnits,
  opposingTeam,
  unitsApproachingHazard,
} from '../sensors';

/** The sensor's approach window, in Chebyshev steps: the window the
 *  human's commands were mined in. */
export const EDGE_HOLD_APPROACH_STEPS = 3;

/** Trigger: this many units must be walking into the hazard before a
 *  team-wide rally earns its place over the null action. The human's
 *  commands came at about 3.9 on the fire maps; 2 stays below that without
 *  firing on a lone stray. */
export const EDGE_HOLD_MIN_UNITS = 2;

/**
 * The best edge-hold tile, or null when there is none: among the passable
 * non-hazard 8-neighbors of the barrier cells, strictly on our side
 * (Chebyshev-nearer an approaching unit than any enemy; a tie is refused,
 * since ties leak through diagonal corners), the one closest to the enemy,
 * as far forward as the fire allows; then the one nearest our approaching
 * units, a rally amid the team rather than at a far corner of the
 * frontier; then row-major.
 *
 * Known limits: the side test is Chebyshev, not path-based, and the pather
 * prices fire at the floor cost, so a route to a safe rally can still cross
 * fire in a convoluted layout (a strip's end-around is fine; a spiral's
 * interior may not be). The fix would be the sim's pathing, which the bot
 * does not change.
 */
export function edgeHoldCell(
  world: World,
  team: ObjectiveTeam,
  approachingIds: readonly number[],
): GridCoord | null {
  const enemies = livingUnits(world, opposingTeam(team));
  const approaching = livingUnits(world, team).filter((u) => approachingIds.includes(u.id));
  if (enemies.length === 0 || approaching.length === 0) return null;

  const minDist = (cell: GridCoord, units: readonly { position: GridCoord }[]) =>
    units.reduce((m, u) => Math.min(m, distanceBetween(cell, u.position)), Infinity);

  let best: GridCoord | null = null;
  let bestEnemyDist = Infinity;
  let bestOwnDist = Infinity;
  const seen = new Set<string>();
  // The frontier is the barrier frontier (fire, damage every tick). An
  // on-enter hazard (mud) is a toll booth, not a wall: rallies at puddle
  // edges lost runs that passive play, walking through, won. The standing
  // check below keeps the broad `isHazardKind`, since holding the line
  // while soaking poison is still bad.
  for (const h of barrierCellList(world)) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const c = { x: h.x + dx, y: h.y + dy };
        const key = `${c.x},${c.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) continue;
        const kind = world.tileGrid.kindAt(c);
        if (isHazardKind(kind) || !tileDef(kind).passable) continue;
        const ownDist = minDist(c, approaching);
        const enemyDist = minDist(c, enemies);
        // Strictly our side: a Chebyshev tie leaks through a diagonal
        // corner, where a far-side cell ties our units' distance and then
        // wins on enemy proximity (`terrainEdgeHold.test.ts`'s fire wall).
        if (ownDist >= enemyDist) continue;
        const better =
          enemyDist < bestEnemyDist ||
          (enemyDist === bestEnemyDist &&
            (ownDist < bestOwnDist ||
              (ownDist === bestOwnDist &&
                best !== null &&
                (c.y < best.y || (c.y === best.y && c.x < best.x)))));
        if (best === null || better) {
          bestEnemyDist = enemyDist;
          bestOwnDist = ownDist;
          best = c;
        }
      }
    }
  }
  return best;
}

/**
 * The audition nominator: the go/no-go thresholds, the two-unit floor and
 * the prey gate, are the null arm's under the searcher. What remains is
 * the geometry: an approaching unit to anchor the side test, and an edge
 * cell that exists. The same purity as `evaluate`.
 */
export function nominateTerrainEdgeHold(
  world: World,
  team: ObjectiveTeam,
): TeamObjective | null {
  const approaching = unitsApproachingHazard(world, team, EDGE_HOLD_APPROACH_STEPS);
  if (approaching.length === 0) return null;
  const cell = edgeHoldCell(world, team, approaching);
  if (cell === null) return null;
  return { mode: 'engage', target: { kind: 'tile', cell } };
}

export const terrainEdgeHold: TrafficScript = {
  id: 'terrain-edge-hold',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const approaching = unitsApproachingHazard(world, team, EDGE_HOLD_APPROACH_STEPS);
    if (approaching.length < EDGE_HOLD_MIN_UNITS) return null;
    // The prey condition: holding an edge nobody is crossing in force is a
    // stall, not a defense. Against enemies that flee, strays flitting near
    // the fire kept a one-unit read alive while the army held an edge
    // nobody honored, and lost where passive play won. Prey is the enemies
    // approaching the barrier from their side (the same sensor and window,
    // for their team) plus those already standing on it (a crosser's own
    // cell is its nearest hazard, so the between test misses it), and the
    // count must reach EDGE_HOLD_MIN_UNITS, as our own trigger does: rally
    // two or more only when two or more are coming. Below that the script
    // returns null and default pursuit goes on, which is what wins against
    // enemies that camp or flee.
    const enemies = livingUnits(world, opposingTeam(team));
    const preyCount =
      unitsApproachingHazard(world, opposingTeam(team), EDGE_HOLD_APPROACH_STEPS).length +
      enemies.filter((u) => isBarrierHazard(world.tileGrid.kindAt(u.position))).length;
    if (preyCount < EDGE_HOLD_MIN_UNITS) return null;
    const cell = edgeHoldCell(world, team, approaching);
    if (cell === null) return null;
    return { mode: 'engage', target: { kind: 'tile', cell } };
  },
};
