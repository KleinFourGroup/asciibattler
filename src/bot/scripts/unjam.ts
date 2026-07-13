/**
 * 54e — UNJAM: priority #2. The introspected human move on the jam cells is
 * "fall back → re-sort → re-engage" (spec §Rung 1); 54c quantified it:
 * jamFraction lifts 1.7–3× at the human's commands on the cells where jams
 * FORM (alpha-spiral 0.13→0.28, stall 0.16→0.29, fire-edge 0.17→0.25),
 * while labyrinth BACKGROUND sits at 0.03 — so a 0.2 trigger fires at the
 * human's intervention level and stays silent walking the slow maze (the
 * null-discipline read; random orders bleed 4.3 pool there, BALANCE
 * §53e.2). Known v1 under-fire, accepted on record: the corridors human
 * plays PREVENTIVELY (no jam lift, 0.13→0.13) — a reactive trigger can't
 * see a jam that's never allowed to form; revisit only if 54i demands.
 *
 * Proposal: `engage` on a REGROUP TILE — an open cell near the jammed
 * cluster, no closer to the enemy (the fall-back direction; ≥ not >, so a
 * map-edge jam can still rally laterally), maximizing elbow room. The
 * `engage` mode's 3-step targeting does the surgical part for free: units
 * already fighting HOLD their fight (the engaged front never abandons the
 * line); only the unengaged — exactly the jammed rear — walk to the rally
 * and re-sort. Re-engage = the driver's null-action release once the jam
 * reads clear (the trigger drops below threshold → clearObjective after
 * dwell → default pursuit resumes).
 *
 * Deterministic + state-only: pure reads, lexicographic tie-breaks, no RNG.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { claimantOf, distanceBetween, unitAt } from '../../sim/occupancy';
import { tileDef } from '../../sim/TileGrid';
import type { TrafficScript } from '../TrafficScriptDriver';
import { ARTILLERY_REACH, isHazardKind, jamRead, livingUnits, opposingTeam } from '../sensors';

/** Trigger: the team's jammed fraction (54c — fires at the human's ~0.25–0.29
 *  command levels, silent on labyrinth's 0.03 background). PROVISIONAL. */
export const UNJAM_MIN_FRACTION = 0.2;

/** Regroup-tile search radius around the jammed cluster's centroid. */
export const UNJAM_RALLY_RADIUS = 6;

/** Free passable 8-neighbors — the "room to re-sort" score of a rally cell. */
function openNeighbors(world: World, cell: GridCoord): number {
  let open = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const c = { x: cell.x + dx, y: cell.y + dy };
      if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) continue;
      if (!tileDef(world.tileGrid.kindAt(c)).passable) continue;
      if (unitAt(world, c) !== undefined || claimantOf(world, c) !== undefined) continue;
      open++;
    }
  }
  return open;
}

/**
 * The regroup tile: passable, non-hazard, unoccupied/unclaimed, within
 * `UNJAM_RALLY_RADIUS` of the jammed centroid, NO CLOSER to the nearest
 * enemy than the centroid is (fall back or lateral, never advance), and
 * OUTSIDE every enemy's attack range (the post-54g amendment, user-approved:
 * the attribution A/B put the whole artillery-funnel +1.7 / junction +1.7
 * residual on regrouping under ranged fire — a retreat that eats
 * catapult/champion shots the passive bot never takes; worklog §54g/§54e-
 * amendment). Scored by open neighbors DESC → centroid distance ASC →
 * row-major. Null when nothing qualifies — under total fire coverage the
 * null action stands (wait it out; never fall back through the barrage).
 */
export function regroupCell(
  world: World,
  team: ObjectiveTeam,
  jammedIds: readonly number[],
): GridCoord | null {
  const jammed = livingUnits(world, team).filter((u) => jammedIds.includes(u.id));
  const enemies = livingUnits(world, opposingTeam(team));
  if (jammed.length === 0 || enemies.length === 0) return null;

  const centroid = {
    x: Math.round(jammed.reduce((s, u) => s + u.position.x, 0) / jammed.length),
    y: Math.round(jammed.reduce((s, u) => s + u.position.y, 0) / jammed.length),
  };
  const minEnemyDist = (c: GridCoord) =>
    enemies.reduce((m, e) => Math.min(m, distanceBetween(c, e.position)), Infinity);
  const centroidEnemyDist = minEnemyDist(centroid);
  // The under-fire filter (post-54g amendment): a rally inside ARTILLERY
  // reach is a retreat that eats shots. Deliberately artillery-only
  // (`ARTILLERY_REACH`): the first cut counted EVERY enemy's reach, and
  // reach-3/5 coverage (bows, mages) pushed rallies out of the local area
  // entirely — corridors 3.0→4.3 (worse than passive), alpha-spiral
  // 7.3→10.7, +60% ticks: a local re-sort became a deep retreat march.
  // Melee/caster zones stay rally-able; only the siege line forbids its
  // firing zone.
  const underFire = (c: GridCoord) =>
    enemies.some(
      (e) =>
        e.derived.attackRange >= ARTILLERY_REACH &&
        distanceBetween(c, e.position) <= e.derived.attackRange,
    );

  let best: GridCoord | null = null;
  let bestOpen = -1;
  let bestCentroidDist = Infinity;
  for (let y = Math.max(0, centroid.y - UNJAM_RALLY_RADIUS); y <= Math.min(world.gridH - 1, centroid.y + UNJAM_RALLY_RADIUS); y++) {
    for (let x = Math.max(0, centroid.x - UNJAM_RALLY_RADIUS); x <= Math.min(world.gridW - 1, centroid.x + UNJAM_RALLY_RADIUS); x++) {
      const c = { x, y };
      if (distanceBetween(c, centroid) > UNJAM_RALLY_RADIUS) continue;
      const kind = world.tileGrid.kindAt(c);
      if (!tileDef(kind).passable || isHazardKind(kind)) continue;
      if (unitAt(world, c) !== undefined || claimantOf(world, c) !== undefined) continue;
      if (minEnemyDist(c) < centroidEnemyDist) continue; // never rally FORWARD
      if (underFire(c)) continue; // never rally under the barrage
      const open = openNeighbors(world, c);
      const centroidDist = distanceBetween(c, centroid);
      const better =
        open > bestOpen ||
        (open === bestOpen &&
          (centroidDist < bestCentroidDist ||
            (centroidDist === bestCentroidDist &&
              best !== null &&
              (c.y < best.y || (c.y === best.y && c.x < best.x)))));
      if (best === null || better) {
        bestOpen = open;
        bestCentroidDist = centroidDist;
        best = c;
      }
    }
  }
  return best;
}

export const unjam: TrafficScript = {
  id: 'unjam',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const jam = jamRead(world, team);
    if (jam.jamFraction < UNJAM_MIN_FRACTION) return null;
    const cell = regroupCell(world, team, jam.jammedUnitIds);
    if (cell === null) return null;
    return { mode: 'engage', target: { kind: 'tile', cell } };
  },
};
