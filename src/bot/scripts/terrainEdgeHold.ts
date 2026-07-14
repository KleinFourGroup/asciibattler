/**
 * 54d — TERRAIN-EDGE HOLD: the first traffic script (priority #1 — safety
 * first), targeting the round's cleanest number (fire-edge: human 0.0 pool
 * damage vs bot 10.7, BALANCE §53g).
 *
 * What kills the bot on fire maps: pathfinding prices `fire` at cost 1
 * (D7.B — surface effect, not obstacle), so default pursuit walks the team
 * straight through the burn. What the human does instead (54c: 15 of 18
 * fire-edge commands are `engage:tile`): RALLY SHORT of the hazard and let
 * the enemy do the crossing — they arrive burning, you shoot them at the
 * edge. The 54c table also shows the trigger is a STANDING condition on
 * fire maps (`hazardApproach` bg ≈ 3.9 all battle), so this script's value
 * is the PROPOSAL — the computed pre-hazard edge tile — not trigger timing.
 *
 * Proposal: `engage` on the best edge tile — a passable, non-hazard
 * neighbor of the hazard frontier, on OUR side of it (nearer our
 * approaching units than their enemies), closest to the enemy. `engage`
 * (not `hold`/`focus`) is deliberate: its 3-step targeting keeps units
 * fighting anything that crosses to us while they wait (the human's shape;
 * they used `hold` 3 times in 197 commands).
 *
 * Deterministic + state-only (the §54 locks): pure reads, lexicographic
 * tie-breaks, no RNG. The edge tile can drift as the enemy moves — the
 * driver's min-dwell paces any re-issue (the accepted churn model, 54a).
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { distanceBetween } from '../../sim/occupancy';
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

/** The sensor's approach window (Chebyshev steps) — the 54c mining window. */
export const EDGE_HOLD_APPROACH_STEPS = 3;

/** Trigger threshold: this many units must be walking into the hazard before
 *  a team-wide rally earns its slot over the null action (54c: at-command
 *  mean ≈ 3.9 on the fire cells; 2 keeps the trigger comfortably below the
 *  human's level without firing on a lone stray). PROVISIONAL — 54i is the
 *  arbiter. */
export const EDGE_HOLD_MIN_UNITS = 2;

/**
 * The best edge-hold tile, or null when no candidate exists: among passable
 * non-hazard 8-neighbors of hazard cells, STRICTLY on our side (Chebyshev-
 * nearer to an approaching unit than to any enemy; ties rejected — they
 * leak through diagonal corners), the one closest to the enemy — the human's "as far forward as the fire allows" — then
 * nearest our own approaching units (rally amid the team, not at a distant
 * corner of the frontier), then row-major for determinism.
 *
 * Known limits, on record (v1; 54i measures): the side test is Chebyshev,
 * not path-based, and A* prices fire at cost 1 — a route TO a safe rally
 * can still cross fire in convoluted geometry (a strip's end-around is
 * fine; a spiral's interior may not be). Deliberately not fixed by
 * touching pathing costs — sim behavior is out of §54's scope.
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
  // 55a — the frontier is the BARRIER frontier (fire-class, sustained
  // per-tick damage); an on-enter hazard (mud) is a toll booth, not a wall
  // (the §55-pre fetidPond finding: hazard-shaped rallies at puddle edges
  // cost −16.7% on that layout). The STANDING check below keeps the broad
  // `isHazardKind` — holding the line while soaking poison is still bad.
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
        // STRICTLY our side: Chebyshev ties leak through diagonal corners
        // (a far-side corner cell can tie our units' distance and then win
        // on enemy proximity — caught by the 54d wall-geometry test).
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

export const terrainEdgeHold: TrafficScript = {
  id: 'terrain-edge-hold',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const approaching = unitsApproachingHazard(world, team, EDGE_HOLD_APPROACH_STEPS);
    if (approaching.length < EDGE_HOLD_MIN_UNITS) return null;
    // 55c1 — the PREY condition (the §55b attribution): holding an edge
    // nobody is crossing IN FORCE is a stall, not a defense. The forced-
    // spiral isolate read 25.0% win / 4× cap-draws vs 52.5% passive; a
    // first ≥1-prey cut recovered only 27.5% because the true breaker is
    // NON-COMMITTAL enemies — the deserters encounter (fleers) lost 51%
    // vs passive's 21% and owned 10 of 13 cap-draws: strays flitting near
    // the fire kept a ≥1 read alive while the army held an edge nobody
    // honored. Prey = enemies approaching the barrier from their side
    // (same sensor, opposing team, same window) PLUS enemies already
    // standing ON it (a mid-crosser's own cell is its nearest hazard, so
    // the between-test misses it), and the count must reach
    // EDGE_HOLD_MIN_UNITS — symmetric with our own trigger: rally 2+
    // units only when 2+ of them are actually coming. Below that → null
    // → default pursuit (what the passive bot does, and wins with, on
    // camper/fleer maps).
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
