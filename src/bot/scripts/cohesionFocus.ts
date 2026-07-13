/**
 * 54g — COHESION FOCUS: priority #4. The introspected edge (spec §Rung 1):
 * "focus fire mainly as a COHESION tool — catapults the one true
 * assassination target." 54c confirms the shape (7/10 focus-river commands
 * were enemy-targeted engages) — but the 53g NULL-ACTION finding cuts the
 * other way on this script's own showcase: the passive bot BEATS the human
 * on focus-river (0.0 vs 3.3), and careless steering bleeds (the random
 * arm: 6.3 river, 4.3 labyrinth). So the trigger is deliberately TIGHT —
 * a true artillery piece, actually reachable — and the honest v1 goal is
 * "fires only where assassination is the play, hurts nowhere" (54i
 * arbitrates; artillery-funnel + river are the regression gates).
 *
 * Trigger: an enemy with reach ≥ `FOCUS_MIN_RANGE` (artillery by CAPABILITY,
 * not by name — archetype-blind per the graceful-degradation doctrine)
 * within `FOCUS_MAX_DIST` of our nearest unit (an assassination run, not a
 * map crossing). Proposal: **`engage` on the target, NOT `focus`** — the
 * first draft proposed the focus mode and the attribution A/B convicted it
 * on every cell it touched (junction +4.0 pool & a lost clear, artillery
 * +1.0, fire-edge +1.4 — worklog §54g): the full-preempt beeline walks the
 * team through waves/fire to reach the piece. The human's own mix was the
 * tell — 3 focus commands in 197; their assassination tool is the LEASHED
 * `engage:enemy` (12/15 junction, 16/27 artillery), which pursues the
 * target but lets engaged units keep their fights and nearby threats
 * preempt. The reachability condition doubles as the release leash: a
 * target that retreats out of reach drops the trigger and the driver's
 * null action ends the chase — the restraint the human applies by hand.
 *
 * The one-true-target rule among candidates: longest reach, then nearest,
 * then most wounded, then lowest id — deterministic.
 */

import type { World } from '../../sim/World';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import type { TrafficScript } from '../TrafficScriptDriver';
import { focusTargetFeatures, type FocusTargetFeature } from '../sensors';

/** Reach that reads as TRUE artillery — catapult/shaman class (6). The
 *  first draft used 4, which swept in every reach-5 caster: chasing mages
 *  behind the junction champion wall cost +4.0 pool and a lost clear
 *  (attribution A/B, worklog §54g). "The one true assassination target"
 *  means the siege pieces, literally. */
export const FOCUS_MIN_RANGE = 6;

/** Assassination reachability: the target's distance to our nearest unit. */
export const FOCUS_MAX_DIST = 6;

export const cohesionFocus: TrafficScript = {
  id: 'cohesion-focus',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const candidates = focusTargetFeatures(world, team).filter(
      (f) => f.attackRange >= FOCUS_MIN_RANGE && f.distToNearestOwn <= FOCUS_MAX_DIST,
    );
    if (candidates.length === 0) return null;
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
    return { mode: 'engage', target: { kind: 'enemy', unitId: best.unitId } };
  },
};
