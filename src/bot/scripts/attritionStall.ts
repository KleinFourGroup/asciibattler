/**
 * Attrition stall, the last script in priority: opportunism last. A
 * human's move on a burning enemy is to refuse the engagement and let the
 * fire do the work, and they hold by rallying short, never by `hold`. The
 * trigger is enemies carrying damaging DoTs (`STALL_MIN_ENEMY_DOTS`)
 * while we hold the power (`STALL_MIN_POWER_DELTA`), with the armies not
 * yet in contact (`armiesInContact` false): refusing an engagement is only
 * coherent before it exists. Without the contact gate the stall fired
 * mid-brawl, where the signature reads true in the background, and pulled
 * the unengaged rear out of a live fight, worse than passive play. Once
 * contact is made, the bot fights.
 *
 * The hazard deferral: the stall returns null whenever any hazard cell is
 * on the map, since terrain in play is terrain-edge hold's, one behavior
 * to one owner. Stalling on a hazard map was measured to lose twice: held
 * at a distance, the team froze at spawn while the enemies' burns ran out
 * on their approach; deferring only to a hazard between the armies still
 * let the crossers' burns run out after the crossing. So the stall acts on
 * damage over time with no terrain in play (poison, statuses on hit),
 * which its tests pin, and a patch of mud in a corner of an otherwise open
 * map turns it off, the known cost.
 *
 * Proposal: `engage` on a stand-off tile, a `rallyCells` cell of our own
 * army within `STALL_RALLY_RADIUS`: back or sideways, never forward, and
 * out of artillery reach. Scored nearest the centroid first, then farthest
 * from the nearest enemy: refusal is standing still, not walking away.
 * Taking the cell farthest from the enemy first made every re-issue back
 * the team off again, a retreat under pursuit that strung the units out to
 * be picked off. Engage's targeting keeps the front already fighting in
 * its fight, so the stall stops only the unengaged from feeding themselves
 * in. The release is the driver's null action, once the DoTs expire or the
 * power advantage flips.
 *
 * Deterministic and state-only: pure reads, row-major ties, no RNG.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import type { TrafficScript } from '../TrafficScriptDriver';
import {
  armiesInContact,
  attritionRead,
  hazardCellList,
  livingUnits,
  opposingTeam,
  rallyCells,
  type RallyCell,
} from '../sensors';

/** Trigger: the fewest enemies carrying a damaging DoT (the human's stall
 *  battles read about two in the background). */
export const STALL_MIN_ENEMY_DOTS = 1;

/** Trigger: the floor on our power minus the enemy's, so the stall acts
 *  only from strength (the human stalled at about +2; a boss battle's
 *  background of about −5 must stay out). */
export const STALL_MIN_POWER_DELTA = 0;

/** The stand-off search radius around our centroid: a bounded local
 *  back-off, never a march. The radius is the cap on retreat. */
const STALL_RALLY_RADIUS = 4;

/**
 * The stand-off tile (the header gives its rules), or null when nothing
 * qualifies: under total artillery coverage, or with no legal fall-back,
 * the null action stands and the team waits where it is.
 */
export function standOffCell(world: World, team: ObjectiveTeam): GridCoord | null {
  const own = livingUnits(world, team);
  const enemies = livingUnits(world, opposingTeam(team));
  // Nearest the centroid, then farthest from the enemy; the cells come
  // row-major, so the first of a tie is the row-major one.
  let best: RallyCell | null = null;
  for (const r of rallyCells(world, own, enemies, STALL_RALLY_RADIUS)) {
    if (
      best === null ||
      r.centroidDist < best.centroidDist ||
      (r.centroidDist === best.centroidDist && r.enemyDist > best.enemyDist)
    ) {
      best = r;
    }
  }
  return best?.cell ?? null;
}

/**
 * The audition nominator. It drops the DoT and power triggers and the
 * hazard deferral, which kept one owner per behavior for triggers that
 * cannot see each other: under the searcher the rollouts decide between
 * this and terrain-edge hold (identical proposals collapse into one), and
 * the burns running out, the deferral's reason, happen inside the
 * searcher's horizon, where the search sees them. It keeps the contact
 * gate: a stand-off mid-brawl means disengaging under fire, and its cost,
 * units strung out and picked off, falls partly past the horizon, where
 * the search cannot see it. The same purity as `evaluate`.
 */
export function nominateAttritionStall(world: World, team: ObjectiveTeam): TeamObjective | null {
  if (armiesInContact(world, team)) return null;
  const cell = standOffCell(world, team);
  if (cell === null) return null;
  return { mode: 'engage', target: { kind: 'tile', cell } };
}

export const attritionStall: TrafficScript = {
  id: 'attrition-stall',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const read = attritionRead(world, team);
    if (read.enemyDotCount < STALL_MIN_ENEMY_DOTS) return null;
    if (read.ownPower - read.enemyPower < STALL_MIN_POWER_DELTA) return null;
    if (armiesInContact(world, team)) return null; // the fight is joined: fight
    // The hazard deferral (the header): any terrain in play defers, by the
    // broad `hazardCellList` (every hazard kind), not the barrier read. Mud
    // is terrain, and a stall keyed on mud-poisoned enemies standing off
    // across a pond is the edge hold's puddle-edge failure from the other
    // side. The stall owns only the maps with no hazard.
    if (hazardCellList(world).length > 0) return null;
    const cell = standOffCell(world, team);
    if (cell === null) return null;
    return { mode: 'engage', target: { kind: 'tile', cell } };
  },
};
