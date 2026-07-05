import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { currentTarget, firingBandCell } from '../Targeting';
import { SIM } from '../../config/sim';
import { nearestActingCell } from '../actingPosition';
import {
  GROUND,
  cellsOccupiedBy,
  claimedDestinationOf,
  occupiedCells,
  unitDistance,
} from '../occupancy';
import { minRangeForArchetype } from '../archetypes';
import { advance, chebyshev, moveProposal, stepDurationTicks, key, type MovementIntent } from '../movement';
import { emitMoveDecision } from '../moveDecision';
import { retreatCell } from '../effects/reposition';
import { behaviorFlags } from '../statusBehavior';

/** The 8 grid neighbors, in a fixed order for deterministic wander selection. */
const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * Proposes a one-cell step toward the unit's current (E5-sticky) target when
 * out of attack range. Abstains (returns null) when no enemy exists, when the
 * unit is in range AND has line-of-sight, when no path to target exists, or
 * when the next step is blocked AND no sidestep is free. Score 1 (low);
 * AbilityBehavior scores 10 (via each ability) so the selector prefers
 * attacking over moving when both fire.
 *
 * J2 — this behavior is now a thin GOAL-SELECTION layer: it decides *where the
 * unit wants to be* (a preference-ordered `MovementIntent`) and hands it to the
 * shared `advance` (see [movement.ts](../movement.ts)), which owns the route +
 * step + E5.B sidestep. That seam is what lets Phase N's gap-closer reuse the
 * same pathing (a dash is the same intent with `maxCells > 1`). Behavior is
 * byte-identical to pre-J2: same goal order, same `findPath`, same sidestep.
 *
 * Goal selection (C1d follow-up; GP4 acting-cell refinement):
 *
 * 1. **Firing cell first, target cell as fallback.** A ranged unit
 *    (attackRange > 1) prefers the nearest cell it can actually shoot from —
 *    `nearestActingCell`: in range AND (for LOS-gated abilities) with line of
 *    sight — so it holds at standoff with a clear shot rather than creeping
 *    into melee, or sidesteps a wall that breaks LOS. The catapult
 *    (LOS-ignoring) uses the same search range-only. Melee (range 1) skips
 *    straight to target-cell pathing (an adjacent cell always has LOS).
 *
 *    The goal list ALWAYS ends with the target's own cell, so when the
 *    firing-cell approach can't produce a move — no firing cell reachable
 *    within the cap, OR the step toward one is blocked (a contested cell in a
 *    chokepoint) — `advance` falls through to charging the target and drains
 *    the chokepoint as a pre-GP4 unit would. This is the load-bearing
 *    anti-freeze guarantee; the earlier `pickGoalCellInRange` heuristic froze
 *    when its single in-range goal was a wall/ally (→ findPath []). The target
 *    is excluded from the soft-block set (`excludeUnitId`) so findPath always
 *    has a reachable goal; the in-range abstain stops the unit a cell short of
 *    actually stepping onto it.
 *
 * 2. **LOS-gated in-range abstain.** The "I'm in attack range, let
 *    AbilityBehavior fire" abstain also checks line-of-sight: a ranged unit in
 *    chebyshev range with a wall between it and target keeps pathing forward
 *    (one more step usually clears the wall) rather than freezing. EXCEPTION
 *    (E7.D): a unit carrying an LOS-ignoring ability (the catapult) abstains on
 *    range alone — it lobs over the wall, nothing to path around.
 *
 * Soft ally blocking, the E5.B sidestep, and the step-collision check all live
 * in `advance` now (shared with tile-objective pursuit and the future dash).
 */
export class MovementBehavior implements Behavior {
  static readonly kind = 'movement';
  readonly kind = MovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    // 28 — a BEHAVIOR status overrides locomotion before any objective / pursuit
    // logic (a frozen/panicking/blinded unit ignores orders). Resolved off the
    // unit's effects (def-resolve), so no serialized state.
    const behavior = behaviorFlags(unit.effects);
    if (behavior.preventsMove) {
      emitMoveDecision(world, unit, 'frozen'); // rooted.
      return null;
    }
    if (behavior.movement === 'flee') {
      // Panic. §42a — `boxed` covers both no-retreat-cell and the degenerate
      // no-threat case (see MoveDecisionKind docs).
      const flee = proposeFlee(unit, world);
      emitMoveDecision(world, unit, flee === null ? 'boxed' : 'flee');
      return flee;
    }
    if (behavior.movement === 'wander') {
      // Blind.
      const wander = proposeWander(unit, world);
      emitMoveDecision(world, unit, wander === null ? 'boxed' : 'wander');
      return wander;
    }

    // O2 — under a `hold` objective the unit NEVER repositions: it acts in place
    // (AbilityBehavior fires at whatever `updateTarget` left in range) but
    // proposes no movement, even to close distance or clear LOS for a shot. The
    // dash ability is independently gated off — `updateTarget`'s hold branch
    // only ever commits an in-range target (or none), so the dash's
    // "target beyond attackRange" trigger can't fire.
    if (world.objectiveFor(unit.team).mode === 'hold') {
      emitMoveDecision(world, unit, 'hold_objective');
      return null;
    }

    const target = currentTarget(unit, world);
    if (target === null) {
      // J1 — no enemy to engage. A unit under an `engage` TILE objective
      // advances toward the rally cell (an attractor — "as close as it can",
      // excluding nothing so it clusters near an occupied cell); otherwise idle.
      // An `enemy` objective never reaches here: `updateTarget` commits the unit
      // to the objective enemy, so `target` is non-null and the path-to-target
      // logic below drives the approach. (O1 reads the acting unit's team
      // objective; the enemy team is `atWill`, so this stays player-only today.)
      //
      // O3 — a `focus` TILE objective routes here identically when the unit has
      // no committed target: `pursue` (beelining to the tile) leaves targetId
      // null, and `engageLocal` with no enemy near the tile also leaves it null
      // → both walk to the rally cell. The strategy choice lives entirely in
      // `Targeting.updateFocusTarget` (it sets targetId); movement just reacts.
      const objective = world.objectiveFor(unit.team);
      if (
        (objective.mode === 'engage' || objective.mode === 'focus') &&
        objective.target.kind === 'tile'
      ) {
        // J3 — bestEffort so an UNREACHABLE rally cell (a wall, or a walled-off
        // region) routes the unit AS CLOSE AS IT CAN rather than abstaining. A
        // single unreachable goal → findPath [] → no step is exactly the
        // pickGoalCellInRange freeze; here the whole team would idle (the
        // objective also suppresses the nearest-enemy fallback). Right-clicking
        // a wall is the reported trigger.
        return advance(unit, world, {
          goals: [objective.target.cell],
          approachToward: objective.target.cell,
          maxCells: 1,
          bestEffort: true,
        });
      }
      emitMoveDecision(world, unit, 'no_goal'); // no enemy, no rally → idle.
      return null;
    }

    // LOS occluders for the in-range abstain + the firing-cell search: neutral
    // walls that block sight (half-cover is `blocksLineOfSight: false` — D6 —
    // so it path-blocks but doesn't break LOS). Path-blocking is handled inside
    // `advance` (all neutrals), so this set is LOS-only.
    // 43-pre-b — the WHOLE footprint (`cellsOccupiedBy`), not just the §39
    // corner: corner-only, a multi-tile rubble's body cells were transparent
    // to the in-band hold (the unit held a "shot" the gate then fired through
    // the body — both sides corner-blind together).
    const losBlockers: GridCoord[] = [];
    for (const u of world.units) {
      if (u.id === unit.id) continue;
      if (u.team === 'neutral' && u.blocksLineOfSight) losBlockers.push(...cellsOccupiedBy(u));
    }

    // E7.D — a unit whose engagement ability ignores LOS (the catapult's arcing
    // shot) abstains on range alone: no point creeping forward to clear a wall
    // it lobs over. LOS-gated units keep the `inBand && hasLOS` abstain so a
    // wall makes them path for a clear shot instead of freezing.
    const ignoresLos = unit.abilities.some((a) => a.ignoresLineOfSight === true);
    // O4 — abstain only when the target is in the firing BAND [minRange,
    // attackRange]. Too FAR → close in (below); too CLOSE (inside minRange) →
    // DON'T abstain, fall through and KITE out to the band. `minRange 0` (every
    // weapon pre-O4-values, all melee, heal) → `inBand === inRange`, so this is
    // byte-identical until the value commit sets a floor.
    const minRange = minRangeForArchetype(unit.archetype);
    // 44-pre-c — footprint distance (body-to-body), matching the strike gate's
    // measure: too-close/too-far (the kite decision below) is judged against a
    // multi-tile target's BODY, not its §39 corner. 1×1 targets byte-identical.
    const dist = unitDistance(unit, target);
    // The firing-band + LOS test against the target's body anchored at `at`
    // (its logical position, or its §36b claimed destination). 44-pre-c — the
    // SHARED footprint-aware predicate (`firingBandCell`), the same gate
    // `effects/propose.ts` fires strikes through: the hold and the strike must
    // agree about "in range" or the GP4/Qb#3 freeze class returns (hold says
    // in-band, strike says out-of-range → deadlock). A melee unit flush against
    // a 3×3 rubble's far side now holds and strikes the body instead of walking
    // around to the corner.
    const inFiringBand = (at: GridCoord): boolean =>
      firingBandCell(
        unit.position,
        target,
        at,
        minRange,
        unit.derived.attackRange,
        ignoresLos ? null : losBlockers,
      ) !== undefined;
    // §36b — abstain (hold + let AbilityBehavior fire) when in the band against
    // the target's logical position (strike it NOW) OR its in-flight CLAIMED
    // destination (the target is ARRIVING into the band — hold for it rather than
    // sidestepping around its reservation, the corridor kite-pin the claim would
    // otherwise trip). The attack itself still lands only once the target's
    // LOGICAL position is in range (the §36 lock); this is a locomotion-only
    // "wait for the arrival" so the pursuer doesn't thrash a cell short.
    const targetClaim = claimedDestinationOf(world, target.id);
    if (inFiringBand(target.position) || (targetClaim !== undefined && inFiringBand(targetClaim))) {
      emitMoveDecision(world, unit, 'hold_band'); // in position — let the ability fire.
      return null;
    }

    // §40b — a committed rubble (destructible neutral) is a HARD path-blocker:
    // `excludeUnitId` softens only NON-neutral cells, so the unit can't route ONTO
    // the rubble's corner. Route AS CLOSE AS POSSIBLE (bestEffort) toward it — the
    // J3 tile-rally shape — and the in-range abstain above fires the strike the
    // moment the unit is body-adjacent (TRUE since 44-pre-c: the hold and the
    // strike both measure the footprint band; corner-only, this comment overstated
    // and units walked around the body to its corner). Reached only when the
    // auto-target hook committed to rubble (target selection prefers a reachable
    // hostile).
    if (target.team === 'neutral') {
      return advance(unit, world, {
        goals: [target.position],
        approachToward: target.position,
        maxCells: 1,
        bestEffort: true,
      });
    }

    // Goal preference: firing cell (ranged only, when reachable) then the
    // target's own cell. `advance` tries them in order and falls back to the
    // target — the anti-freeze guarantee. O4 — the firing cell must sit in the
    // BAND, so a too-close unit's nearest acting cell is a standoff a step BACK
    // (the kite), not its current (too-close) cell.
    const goals: GridCoord[] = [];
    if (unit.derived.attackRange > 1) {
      const firingCell = nearestActingCell(
        unit.position,
        target.position,
        unit.derived.attackRange,
        SIM.actingCellSearchSlack,
        world,
        ignoresLos ? null : losBlockers,
        minRange,
      );
      if (firingCell !== null) goals.push(firingCell);
    }
    // The target's own cell is the APPROACH anti-freeze fallback (too-far →
    // charge in; the in-range abstain then stops the unit a cell short, the
    // target being soft-excluded from the collision set so findPath always has a
    // goal). Qb#3 — when KITING (too close, inside minRange) that fallback is the
    // opposite of the intent, and with the retreat blocked (a corridor pin: walls
    // kill the sidestep, an ally fills the back-step) it would walk the kiter
    // straight ONTO the soft-excluded target's cell — a same-cell overlap. So
    // omit it when too close: a pinned kiter abstains/queues rather than charging.
    // (`dist >= minRange` is always true for melee [minRange 0] and the too-far
    // approach, so this is byte-identical except the blocked-kiter case.)
    if (dist >= minRange) goals.push(target.position);

    // §42a — the Qb#3 pinned-kiter shape: too close (inside minRange, so the
    // target-cell fallback is off) AND no reachable firing cell. `advance([])`
    // would return null without emitting, so the decision is named here.
    // Byte-identical: the empty-goal advance was already a guaranteed abstain.
    if (goals.length === 0) {
      emitMoveDecision(world, unit, 'pinned');
      return null;
    }

    const intent: MovementIntent = {
      goals,
      approachToward: target.position,
      excludeUnitId: target.id,
      maxCells: 1,
    };
    return advance(unit, world, intent);
  }
}

/**
 * 28 — panic FLEE: a one-cell step that STRICTLY increases distance from the
 * nearest enemy, reusing the gambit's `retreatCell` primitive (away-from-anchor,
 * tie-broken toward open space). Abstains when no enemy exists or the unit is
 * boxed in (`retreatCell` null → cower in place). Score 1, like every move.
 */
function proposeFlee(unit: Unit, world: World): ActionProposal | null {
  const threat = nearestEnemy(unit, world);
  if (threat === null) return null;
  const dest = retreatCell(unit, threat.position, world);
  if (dest === null) return null;
  return moveProposal(
    unit.position,
    dest,
    stepDurationTicks(world, dest, unit.derived.moveCooldownTicks),
  );
}

/**
 * 28 — blind WANDER: a one-cell step to a uniformly random passable, unoccupied
 * neighbor (rolled on `combatRng`, where movement / targeting rolls live).
 * Abstains when every neighbor is blocked. The selector still prefers an attack
 * (score 10) over this wander (score 1), so a blinded unit adjacent to a foe
 * strikes it and only wanders when it has nothing in reach.
 */
function proposeWander(unit: Unit, world: World): ActionProposal | null {
  // 44-pre-a — the WHOLE footprint (the §35 set builder), not just the §39
  // corner: corner-only, a multi-tile rubble's body cells read as free and the
  // wander could roll a doomed step onto one — §35b's destination gate then
  // aborts it (no overlap), but the unit wastes its tick on `unit:moveAborted`
  // instead of wandering. Claims are deliberately NOT folded here: this ships
  // as a MoveAction proposal, so `destinationBlocked` (occupied-OR-claimed)
  // re-validates at execution — unlike `retreatCell`'s instant effect
  // reposition, which bypasses the selector gate and must fold claims itself.
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  const free: GridCoord[] = [];
  for (const [dx, dy] of NEIGHBORS) {
    const c: GridCoord = { x: unit.position.x + dx, y: unit.position.y + dy };
    if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) continue;
    if (!isFinite(world.tileGrid.costAt(c))) continue;
    if (occupied.has(key(c))) continue;
    free.push(c);
  }
  if (free.length === 0) return null;
  const dest = free[Math.floor(world.combatRng.next() * free.length)]!;
  return moveProposal(
    unit.position,
    dest,
    stepDurationTicks(world, dest, unit.derived.moveCooldownTicks),
  );
}

/**
 * The nearest living enemy (opposing, non-neutral) by Chebyshev — the panic-flee
 * anchor. Ties resolve to the first in `world.units` order (stable id order), so
 * the pick is deterministic. Distinct from `Targeting.findTarget` (which honors
 * the unit's strategy): a panicking unit flees the CLOSEST threat, not the one
 * its strategy would mark.
 */
function nearestEnemy(unit: Unit, world: World): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const candidate of world.units) {
    if (candidate.team === unit.team) continue;
    if (candidate.team === 'neutral') continue;
    if (candidate.currentHp <= 0) continue;
    const d = chebyshev(unit.position, candidate.position);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}
