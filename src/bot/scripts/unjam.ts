/**
 * Unjam, second in priority. A human on a jam falls back, re-sorts and
 * re-engages. In the battles where jams form, the jammed fraction read
 * 0.25 to 0.29 at the human's commands, against 0.03 in the background of
 * the labyrinth, so a trigger at 0.2 fires at the human's level and stays
 * silent walking the slow maze, where random orders bleed. The known
 * limit: where a human prevents a jam, a reactive trigger cannot see a jam
 * that is never allowed to form.
 *
 * Proposal: `engage` on a regroup tile (`regroupCell`): an open cell near
 * the jammed cluster, no nearer the enemy (equal is allowed, so a jam at
 * the map's edge can still rally sideways), with the most elbow room.
 * Engage's targeting does the surgical part: units already fighting keep
 * their fight, so the front never leaves the line, and only the
 * unengaged, the jammed rear, walk to the rally and re-sort. The re-engage
 * is the driver's null action once the jam reads clear: the trigger drops,
 * the order is cleared after the dwell, and default pursuit resumes.
 *
 * Deterministic and state-only: pure reads, row-major ties, no RNG.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { claimantOf, unitAt } from '../../sim/occupancy';
import { tileDef } from '../../sim/TileGrid';
import type { TrafficScript } from '../TrafficScriptDriver';
import { jamRead, livingUnits, opposingTeam, rallyCells } from '../sensors';

/** Trigger: the team's jammed fraction (the header gives the reading).
 *  0.2 is confirmed: do not re-tune it off a few battles' reads. 0.25 and
 *  0.30 mended the four battles watched, and the natural runs then
 *  collapsed (29.2 % to 15.8 % at 0.30, the losses spread across the
 *  layouts): unjam at 0.2 quietly carries most of them. A contact gate was
 *  tried and made it worse, since part of its value is re-sorting
 *  mid-fight. Its cost mid-fight in the boss and junction battles is
 *  measured and accepted: no trigger-shaped fix separates it from the
 *  gain, measured both ways. */
export const UNJAM_MIN_FRACTION = 0.2;

/** The regroup tile's search radius around the jammed cluster's centroid. */
const UNJAM_RALLY_RADIUS = 6;

/** The free, passable 8-neighbors of a cell: a rally cell's room to
 *  re-sort. */
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
 * The regroup tile: a `rallyCells` cell of the jammed units within
 * `UNJAM_RALLY_RADIUS`, which keeps a rally out of artillery reach, since
 * a regroup under ranged fire took shots the passive bot never takes.
 * Scored by the most open neighbors, then the nearest the centroid, then
 * row-major. Null when nothing qualifies: under total fire coverage the
 * null action stands, and the team waits rather than falls back through
 * the barrage.
 */
export function regroupCell(
  world: World,
  team: ObjectiveTeam,
  jammedIds: readonly number[],
): GridCoord | null {
  const jammed = livingUnits(world, team).filter((u) => jammedIds.includes(u.id));
  const enemies = livingUnits(world, opposingTeam(team));
  // The cells come row-major, so the first of a tie is the row-major one.
  let best: GridCoord | null = null;
  let bestOpen = -1;
  let bestCentroidDist = Infinity;
  for (const { cell, centroidDist } of rallyCells(world, jammed, enemies, UNJAM_RALLY_RADIUS)) {
    const open = openNeighbors(world, cell);
    if (
      best === null ||
      open > bestOpen ||
      (open === bestOpen && centroidDist < bestCentroidDist)
    ) {
      bestOpen = open;
      bestCentroidDist = centroidDist;
      best = cell;
    }
  }
  return best;
}

/**
 * The audition nominator: the 0.2 threshold, which `evaluate` keeps as it
 * is, is a go/no-go call the rollouts make under the searcher, and any
 * jammed unit makes a regroup meaningful. The same purity as `evaluate`.
 */
export function nominateUnjam(world: World, team: ObjectiveTeam): TeamObjective | null {
  const jam = jamRead(world, team);
  if (jam.jammedUnitIds.length === 0) return null;
  const cell = regroupCell(world, team, jam.jammedUnitIds);
  if (cell === null) return null;
  return { mode: 'engage', target: { kind: 'tile', cell } };
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
