/**
 * 54h — ATTRITION STALL: priority #5, the LAST script (opportunism last —
 * the §54 straw order). The introspected human move on stall-spiral is the
 * opposite-spawn burn cheese: refuse the engagement while the fire does the
 * work (10 rally tiles + 3 clears in the 53g session; never `hold` — the
 * human "holds" by rallying short, BALANCE §54c). 54c quantified the
 * signature: enemyDot bg ≈ 2.0 with powerΔ ≈ +2 — the enemy burning while
 * we hold a power advantage. Trigger = enemyDot ≥ 1 ∧ powerΔ ≥ 0, the
 * on-record shape — PLUS the contact gate (the 54h amendment, user-approved):
 * the armies must be genuinely disengaged (`armiesInContact` false).
 * "Refusing an engagement" is only coherent before the engagement exists —
 * the first cut fired mid-brawl on alpha-spiral (where the 54c table shows
 * the dot+powerΔ signature standing-true in BACKGROUND) and pulled the
 * unengaged rear out of an active fight: 7.3 → 9.3 pool, worse than the
 * passive 8.7 (worklog §54h). Once contact is made, the human fights;
 * so does the bot.
 *
 * Honest scope, on record: terrain-edge hold already captures most of the
 * stall value on this script's own showcase (stall-spiral reads 0.0 pool
 * since 54d — the edge rally IS the refusal), so the v1 goal is the generic
 * remainder — "never walk into a rotting army you already out-power" — and
 * the exit bar is prove-it-triggers + hurts-nowhere (54i arbitrates).
 *
 * THE HAZARD DEFERRAL (the 54h option-A lock, user-approved): the stall
 * returns null whenever ANY hazard cell exists on the map — terrain in
 * play is terrain-edge hold's domain wholesale, one behavior one owner.
 * The spot-check attribution earned this twice: (1) pre-contact stalling
 * AT DISTANCE on a hazard map froze the team at spawn, the enemies' burns
 * expired mid-approach, and stall-spiral leaked 2.0 pool the edge-hold
 * flow clears at 0.0 — while the same accidental overlap produced
 * fire-edge's 7.0→5.3 as a wider-radius edge-hold backstop; that −1.7 is
 * deliberately given back and banked as a 54i candidate with a clean home
 * (widening `EDGE_HOLD_APPROACH_STEPS`, 3 → ~5). (2) A first, narrower
 * "hazard BETWEEN the armies" deferral still leaked on fire-edge
 * (7.0→7.3, +9 deaths): in the post-crossing windows nothing reads
 * "between" anymore, but standing pat while the crossers' burns EXPIRE
 * wastes the finish — on a hazard map even the stall-positive-looking
 * windows act stall-negative (worklog §54h probes). What remains is the
 * script's actual premise — DoTs with NO terrain in play (poison, on-hit
 * statuses; content this board doesn't exercise, so the 11-cell spot-check
 * reads quartet-identical BY DESIGN and the trigger is pinned by tests).
 * On-record v1 cost: a corner mud patch on an otherwise-open map disables
 * the stall entirely — §55's scorer is the principled arbiter for that.
 *
 * Proposal: `engage` on a STAND-OFF tile — unjam's regroup shape, anchored
 * on the OWN-army centroid instead of a jam cluster: within
 * `STALL_RALLY_RADIUS` of the centroid, passable, non-hazard,
 * unoccupied/unclaimed, never closer to the nearest enemy than the centroid
 * already is (refuse, don't advance), and outside ARTILLERY reach (the
 * 54e-amendment lesson: only the siege line forbids its firing zone — an
 * all-reach filter turns a local refusal into a deep retreat march).
 * Scored: NEAREST the centroid first (stand pat — the second 54h lesson:
 * the first cut preferred the cell farthest from the enemy, and every
 * re-issue backed the team off again — continuous retreat under ronin
 * pursuit, units strung out and picked off in detail, alpha-spiral
 * 7.3 → 9.3/10.0 and stall-spiral deaths 11 → 19 regardless of the contact
 * gate; the human "holds by rallying SHORT", BALANCE §54c — refusal is
 * standing still, not walking away), then farthest from the nearest enemy,
 * then row-major. Engage's 3-step targeting keeps the already-engaged
 * front fighting — the stall only stops the unengaged from feeding
 * themselves in. Release = the driver's null action once the dots expire
 * or the power advantage flips.
 *
 * Deterministic + state-only: pure reads, lexicographic tie-breaks, no RNG.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { claimantOf, distanceBetween, unitAt } from '../../sim/occupancy';
import { tileDef } from '../../sim/TileGrid';
import type { TrafficScript } from '../TrafficScriptDriver';
import {
  ARTILLERY_REACH,
  armiesInContact,
  attritionRead,
  hazardCellList,
  isHazardKind,
  livingUnits,
  opposingTeam,
} from '../sensors';

/** Trigger: enemies carrying damaging DoTs (54c — stall-spiral bg 2.0;
 *  the ≥1 floor is the on-record shape). PROVISIONAL; 54i tunes. */
export const STALL_MIN_ENEMY_DOTS = 1;

/** Trigger: ownPower − enemyPower floor — stall only from strength (the
 *  human's stall sat at powerΔ ≈ +2; the boss cell's −5 bg must stay out). */
export const STALL_MIN_POWER_DELTA = 0;

/** Stand-off search radius around the own-army centroid — a bounded local
 *  back-off, never a march (the radius IS the anti-retreat structural cap). */
export const STALL_RALLY_RADIUS = 4;

/**
 * The stand-off tile (see the header for the full contract). Null when
 * nothing qualifies — under total artillery coverage or with no legal
 * fall-back the null action stands (wait it out where we are).
 */
export function standOffCell(world: World, team: ObjectiveTeam): GridCoord | null {
  const own = livingUnits(world, team);
  const enemies = livingUnits(world, opposingTeam(team));
  if (own.length === 0 || enemies.length === 0) return null;

  const centroid = {
    x: Math.round(own.reduce((s, u) => s + u.position.x, 0) / own.length),
    y: Math.round(own.reduce((s, u) => s + u.position.y, 0) / own.length),
  };
  const minEnemyDist = (c: GridCoord) =>
    enemies.reduce((m, e) => Math.min(m, distanceBetween(c, e.position)), Infinity);
  const centroidEnemyDist = minEnemyDist(centroid);
  // Artillery-only under-fire filter (the 54e-amendment contract, shared
  // classification via ARTILLERY_REACH): a stand-off inside the siege line's
  // firing zone is a refusal that still eats shots.
  const underFire = (c: GridCoord) =>
    enemies.some(
      (e) =>
        e.derived.attackRange >= ARTILLERY_REACH &&
        distanceBetween(c, e.position) <= e.derived.attackRange,
    );

  let best: GridCoord | null = null;
  let bestCentroidDist = Infinity;
  let bestEnemyDist = -1;
  const y0 = Math.max(0, centroid.y - STALL_RALLY_RADIUS);
  const y1 = Math.min(world.gridH - 1, centroid.y + STALL_RALLY_RADIUS);
  const x0 = Math.max(0, centroid.x - STALL_RALLY_RADIUS);
  const x1 = Math.min(world.gridW - 1, centroid.x + STALL_RALLY_RADIUS);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = { x, y };
      if (distanceBetween(c, centroid) > STALL_RALLY_RADIUS) continue;
      const kind = world.tileGrid.kindAt(c);
      if (!tileDef(kind).passable || isHazardKind(kind)) continue;
      if (unitAt(world, c) !== undefined || claimantOf(world, c) !== undefined) continue;
      const enemyDist = minEnemyDist(c);
      if (enemyDist < centroidEnemyDist) continue; // refuse, never advance
      if (underFire(c)) continue; // never stand off inside the siege zone
      const centroidDist = distanceBetween(c, centroid);
      const better =
        centroidDist < bestCentroidDist ||
        (centroidDist === bestCentroidDist &&
          (enemyDist > bestEnemyDist ||
            (enemyDist === bestEnemyDist &&
              best !== null &&
              (c.y < best.y || (c.y === best.y && c.x < best.x)))));
      if (best === null || better) {
        bestCentroidDist = centroidDist;
        bestEnemyDist = enemyDist;
        best = c;
      }
    }
  }
  return best;
}

export const attritionStall: TrafficScript = {
  id: 'attrition-stall',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const read = attritionRead(world, team);
    if (read.enemyDotCount < STALL_MIN_ENEMY_DOTS) return null;
    if (read.ownPower - read.enemyPower < STALL_MIN_POWER_DELTA) return null;
    if (armiesInContact(world, team)) return null; // the fight is joined — fight
    // The hazard deferral (see the header): ANY terrain in play defers —
    // deliberately the BROAD `hazardCellList` (all hazard kinds), not 55a's
    // barrier read: mud IS terrain, and a stall keyed on mud-poisoned
    // enemies standing off across a pond is exactly the §55-pre pathology
    // from the other direction. The stall owns only hazard-FREE maps.
    if (hazardCellList(world).length > 0) return null;
    const cell = standOffCell(world, team);
    if (cell === null) return null;
    return { mode: 'engage', target: { kind: 'tile', cell } };
  },
};
