import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { currentTarget } from '../Targeting';
import { SIM } from '../../config/sim';
import { hasLineOfSight } from '../LineOfSight';
import { nearestActingCell } from '../actingPosition';
import { minRangeForArchetype } from '../archetypes';
import { advance, chebyshev, type MovementIntent } from '../movement';

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
    // O2 — under a `hold` objective the unit NEVER repositions: it acts in place
    // (AbilityBehavior fires at whatever `updateTarget` left in range) but
    // proposes no movement, even to close distance or clear LOS for a shot. The
    // dash ability is independently gated off — `updateTarget`'s hold branch
    // only ever commits an in-range target (or none), so the dash's
    // "target beyond attackRange" trigger can't fire.
    if (world.objectiveFor(unit.team).mode === 'hold') return null;

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
      return null;
    }

    // LOS occluders for the in-range abstain + the firing-cell search: neutral
    // walls that block sight (half-cover is `blocksLineOfSight: false` — D6 —
    // so it path-blocks but doesn't break LOS). Path-blocking is handled inside
    // `advance` (all neutrals), so this set is LOS-only.
    const losBlockers: GridCoord[] = [];
    for (const u of world.units) {
      if (u.id === unit.id) continue;
      if (u.team === 'neutral' && u.blocksLineOfSight) losBlockers.push(u.position);
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
    const dist = chebyshev(unit.position, target.position);
    const inBand = dist >= minRange && dist <= unit.derived.attackRange;
    if (inBand && (ignoresLos || hasLineOfSight(unit.position, target.position, losBlockers))) {
      return null;
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
    goals.push(target.position);

    const intent: MovementIntent = {
      goals,
      approachToward: target.position,
      excludeUnitId: target.id,
      maxCells: 1,
    };
    return advance(unit, world, intent);
  }
}
