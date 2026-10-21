/**
 * Cohesion focus, fourth in priority: focus fire as a cohesion tool, with
 * artillery the one true assassination target. Doing nothing beat a
 * human's play on this script's own showcase, and careless steering
 * bleeds, so the trigger is tight: a true artillery piece, actually in
 * reach.
 *
 * Trigger: an enemy with a reach of at least `FOCUS_MIN_RANGE`, artillery
 * by capability rather than by name, within `FOCUS_MAX_DIST` of our
 * nearest unit (an assassination run, not a map crossing). Proposal:
 * `engage` on the target, not `focus`. The focus mode was measured worse
 * on every battle it touched: its full preemption walks the team through
 * waves and fire to reach the piece. Engage pursues the target but lets
 * engaged units keep their fights and lets nearby threats preempt, the
 * leashed pursuit a human uses to assassinate. The reach condition is also
 * the release: a target that retreats out of reach drops the trigger, and
 * the driver's null action ends the chase.
 *
 * Among the candidates the target is the longest reach, then the nearest,
 * then the most wounded, then the lowest id.
 */

import type { World } from '../../sim/World';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import type { TrafficScript } from '../TrafficScriptDriver';
import { ARTILLERY_REACH, focusTargetFeatures, type FocusTargetFeature } from '../sensors';

/** The reach that reads as true artillery: the shared `ARTILLERY_REACH`
 *  (the catapult and the shaman, 6). A lower bar takes in every reach-5
 *  caster, and chasing mages behind a wall of champions was measured to
 *  cost a clear. The one true assassination target means the siege
 *  pieces, literally. */
export const FOCUS_MIN_RANGE = ARTILLERY_REACH;

/** Assassination reachability: the target's distance to our nearest unit. */
export const FOCUS_MAX_DIST = 6;

/** The header's ranking of the candidates, shared by `evaluate` and
 *  `nominate`. */
function bestTarget(candidates: readonly FocusTargetFeature[]): FocusTargetFeature {
  let best: FocusTargetFeature = candidates[0]!;
  for (const c of candidates) {
    const better =
      c.attackRange > best.attackRange ||
      (c.attackRange === best.attackRange &&
        (c.distToNearestOwn < best.distToNearestOwn ||
          (c.distToNearestOwn === best.distToNearestOwn &&
            (c.hpFraction < best.hpFraction ||
              (c.hpFraction === best.hpFraction && c.unitId < best.unitId)))));
    if (better) best = c;
  }
  return best;
}

/**
 * The audition nominator: `FOCUS_MAX_DIST` was both the go/no-go and the
 * release leash, and under the searcher both jobs are the null arm's, so
 * it nominates any true artillery piece on the field. The reach filter
 * stays: without it the script would nominate any enemy, which is a
 * different script. The same purity as `evaluate`.
 */
export function nominateCohesionFocus(world: World, team: ObjectiveTeam): TeamObjective | null {
  const candidates = focusTargetFeatures(world, team).filter(
    (f) => f.attackRange >= FOCUS_MIN_RANGE,
  );
  if (candidates.length === 0) return null;
  return { mode: 'engage', target: { kind: 'enemy', unitId: bestTarget(candidates).unitId } };
}

export const cohesionFocus: TrafficScript = {
  id: 'cohesion-focus',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const candidates = focusTargetFeatures(world, team).filter(
      (f) => f.attackRange >= FOCUS_MIN_RANGE && f.distToNearestOwn <= FOCUS_MAX_DIST,
    );
    if (candidates.length === 0) return null;
    return { mode: 'engage', target: { kind: 'enemy', unitId: bestTarget(candidates).unitId } };
  },
};
