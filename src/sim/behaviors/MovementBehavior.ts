import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { currentTarget } from '../Targeting';
import { NEIGHBORS, engagementDirective } from '../positioning';
import { minRangeForArchetype } from '../archetypes';
import { GROUND, occupiedCells } from '../occupancy';
import { advance, chebyshev, moveProposal, stepDurationTicks, key } from '../movement';
import { emitMoveDecision } from '../moveDecision';
import { retreatCell } from '../effects/reposition';
import { behaviorFlags } from '../statusBehavior';

/**
 * Proposes a one-cell step toward the unit's current (E5-sticky) target when
 * out of attack range. Abstains (returns null) when no enemy exists, when the
 * unit is in the firing band (with LOS where required), when no path to target
 * exists, or when the next step is blocked AND no sidestep is free. Score 1
 * (low); AbilityBehavior scores 10 (via each ability) so the selector prefers
 * attacking over moving when both fire.
 *
 * §44a — this behavior is a thin DECISION layer over two extracted seams:
 * [positioning.ts](../positioning.ts) owns the WHERE knowledge (the firing
 * band + LOS gate, the §40b rubble approach, the firing-cell/target goal list,
 * the minRange kite — the full engagement protocol is documented THERE), and
 * `advance` ([movement.ts](../movement.ts)) owns the route + step + E5.B
 * sidestep. What remains here is what to PROPOSE: mapping status flags
 * (frozen/flee/wander), objectives (hold/tile-rally), and the positioning
 * directive onto proposals + `MoveDecisionKind`s. The J2 seam is unchanged —
 * a dash is the same intent with `maxCells > 1`.
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

    // §44a — the WHERE knowledge lives in positioning.ts (the engagement
    // protocol: firing-band hold [incl. the §36b arriving-claim case], the
    // §40b rubble bestEffort approach, the firing-cell/target goal list, the
    // O4/Qb#3 minRange kite). This behavior just maps the directive onto a
    // proposal + its `MoveDecisionKind`. The minRange is resolved HERE:
    // positioning.ts must not import archetypes.ts (a module-eval cycle —
    // see its import note).
    const directive = engagementDirective(unit, world, target, minRangeForArchetype(unit.archetype));
    switch (directive.kind) {
      case 'hold':
        emitMoveDecision(world, unit, 'hold_band'); // in position — let the ability fire.
        return null;
      case 'pinned':
        // §42a — the Qb#3 pinned-kiter shape: too close (the charge fallback
        // off) AND no reachable firing cell. `advance([])` would return null
        // without emitting, so the decision is named here.
        emitMoveDecision(world, unit, 'pinned');
        return null;
      case 'approach':
        return advance(unit, world, directive.intent);
    }
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
