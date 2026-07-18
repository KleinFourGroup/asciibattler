/**
 * 54f — CHOKE HOLD: priority #3. Trigger + proposal both read
 * `armyMinCut` (sensors): the smallest set of free cells the enemy must
 * cross to reach us — the width-tolerant replacement for the articulation
 * scan that read ZERO on the ≥2-wide isthmus bridge (BALANCE §54c).
 *
 * Fires when the funnel trade is on: a small cut exists (≤ `CHOKE_MAX_CUT`),
 * the enemy group OUTNUMBERS it by `CHOKE_OUTNUMBER_FACTOR`× (many of them,
 * few tiles — the isthmus signature: the session's highest enemy counts,
 * 8–12 all-melee, and the only cell where the human used `hold` at all),
 * and the cut sits STRICTLY on our side (if they already hold the bridge,
 * walking into it is an assault, not a choke hold). Proposal: `engage` on
 * the cut's central cell — the team plugs the gap and engage's targeting
 * fights whatever steps through. Release = the driver's null action when
 * the conditions break (they crossed, thinned, or took the choke first).
 *
 * On record (54f design conversation): the HUMAN's isthmus play was
 * actually a terrain-advantage hold — engaging with the enemy still in
 * accuracy-penalized shallow water — not a geometric plug. The geometric
 * funnel stands on its own; the water's-edge variant is a documented
 * candidate EXTENSION of terrain-edge hold (generalize hazard → combat-
 * penalty tiles), deliberately unbuilt while choke-isthmus shows no damage
 * gap (0.0 across human and both bot arms). Worklog §54f.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { distanceBetween } from '../../sim/occupancy';
import type { TrafficScript } from '../TrafficScriptDriver';
import { armyMinCut, livingUnits, opposingTeam } from '../sensors';

/** Largest cut worth plugging (also the sensor's early-bail bound). */
export const CHOKE_MAX_CUT = 3;

/** The funnel trade: enemies must outnumber the cut by this factor. */
export const CHOKE_OUTNUMBER_FACTOR = 2;

/** The cut's central cell: nearest the cut centroid, row-major on ties. */
export function cutCenter(cut: readonly GridCoord[]): GridCoord {
  const cx = cut.reduce((s, c) => s + c.x, 0) / cut.length;
  const cy = cut.reduce((s, c) => s + c.y, 0) / cut.length;
  let best = cut[0]!;
  let bestD = Infinity;
  for (const c of cut) {
    const d = Math.max(Math.abs(c.x - cx), Math.abs(c.y - cy));
    if (d < bestD || (d === bestD && (c.y < best.y || (c.y === best.y && c.x < best.x)))) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** The geometric core shared by `evaluate` and `nominate`: a cut ≤
 *  `CHOKE_MAX_CUT` exists and its center sits STRICTLY on our side (the 54d
 *  diagonal-tie lesson applies here too) — without both there is no coherent
 *  "plug OUR choke" proposal at all. One `armyMinCut` computation serves
 *  both callers. */
function chokeRead(
  world: World,
  team: ObjectiveTeam,
): { cut: readonly GridCoord[]; proposal: TeamObjective } | null {
  const enemies = livingUnits(world, opposingTeam(team));
  const own = livingUnits(world, team);
  if (own.length === 0 || enemies.length === 0) return null;
  const cut = armyMinCut(world, team, CHOKE_MAX_CUT);
  if (cut === null) return null;
  const center = cutCenter(cut);
  const minDist = (units: readonly { position: GridCoord }[]) =>
    units.reduce((m, u) => Math.min(m, distanceBetween(center, u.position)), Infinity);
  if (minDist(own) >= minDist(enemies)) return null;
  return { cut, proposal: { mode: 'engage', target: { kind: 'tile', cell: center } } };
}

/**
 * 57g.4 — the propose-regardless nominator: the 2× outnumber "funnel trade"
 * is the go/no-go judgment the rollout arbitrates under audition; the
 * geometric core (cut exists, our side) is all that must hold. Same purity
 * contract as `evaluate`.
 */
export function nominateChokeHold(world: World, team: ObjectiveTeam): TeamObjective | null {
  return chokeRead(world, team)?.proposal ?? null;
}

export const chokeHold: TrafficScript = {
  id: 'choke-hold',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const enemies = livingUnits(world, opposingTeam(team));
    if (enemies.length < CHOKE_OUTNUMBER_FACTOR) return null;
    const read = chokeRead(world, team);
    if (read === null) return null;
    if (enemies.length < read.cut.length * CHOKE_OUTNUMBER_FACTOR) return null;
    return read.proposal;
  },
};
