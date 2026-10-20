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
import { claimantOf, unitAt } from '../../sim/occupancy';
import { tileDef } from '../../sim/TileGrid';
import type { TrafficScript } from '../TrafficScriptDriver';
import { jamRead, livingUnits, opposingTeam, rallyCells } from '../sensors';

/** Trigger: the team's jammed fraction (54c — fires at the human's ~0.25–0.29
 *  command levels, silent on labyrinth's 0.03 background).
 *  ⚠ 0.2 is CONFIRMED, not provisional — do not re-tune it off cell reads
 *  (the 55c2 sweep, worklog §55c2): 0.25/0.30 fixed the four WATCHED cells
 *  (boss to the unjam-silent 17.3, junction 16.3, labyrinth deaths 14→10)
 *  and the natural-run probe then exposed a distribution-wide collapse
 *  (29.2% → 15.8% at 0.30; icebergs −13 / quarry −11 / corridors −11 /
 *  isthmus −10 per-wave) — unjam at 0.2 quietly carries most layouts, and
 *  the gauntlet's corridors cell was merely the only witness. A contact
 *  gate was also tried and falsified (corridors' win is partly mid-fight
 *  re-sorting; alpha-funnel regressed). The boss/junction mid-fight-rally
 *  cost stays as a MEASURED ACCEPTED residual — a trigger-shaped fix
 *  cannot separate it from the global value (both directions measured). */
export const UNJAM_MIN_FRACTION = 0.2;

/** Regroup-tile search radius around the jammed cluster's centroid. */
const UNJAM_RALLY_RADIUS = 6;

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
 * The regroup tile: a `rallyCells` cell of the jammed units within
 * `UNJAM_RALLY_RADIUS`, which keeps a rally out of artillery reach (the
 * post-54g amendment, user-approved: the attribution A/B put the whole
 * artillery-funnel +1.7 / junction +1.7 residual on regrouping under ranged
 * fire — a retreat that eats catapult/champion shots the passive bot never
 * takes; worklog §54g/§54e-amendment). Scored by open neighbors DESC →
 * centroid distance ASC → row-major. Null when nothing qualifies — under
 * total fire coverage the null action stands (wait it out; never fall back
 * through the barrage).
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
 * 57g.4 — the propose-regardless nominator: the CONFIRMED 0.2 trigger
 * threshold (which stays untouched on the `evaluate` path) is a go/no-go
 * call the rollout arbitrates under audition; any jammed unit at all makes
 * a regroup geometrically meaningful. Same purity contract as `evaluate`.
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
