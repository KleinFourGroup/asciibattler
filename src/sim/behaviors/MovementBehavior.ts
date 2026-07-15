import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { currentTarget } from '../Targeting';
import { NEIGHBORS, engagementDirective } from '../positioning';
import { minRangeForArchetype } from '../archetypes';
import { GROUND, footprintOf, occupiedCells } from '../occupancy';
import { SWAP_ACTION_ID } from '../actions/SwapAction';
import { advance, chebyshev, moveProposal, swapProposal, stepDurationTicks, key } from '../movement';
import { emitMoveDecision } from '../moveDecision';
import { waitProposal } from '../actions/WaitAction';
import { retreatCell } from '../effects/reposition';
import { behaviorFlags } from '../statusBehavior';

/**
 * Proposes a one-cell step toward the unit's current (E5-sticky) target when
 * out of attack range, or a first-class WAIT (§44b) when the unit is in the
 * firing band (with LOS where required) — the deliberate hold is a proposal
 * the selector weighs, no longer a silent abstain. Abstains (returns null)
 * only when there is genuinely nothing to propose: no enemy exists, no path
 * to target, the next step is blocked AND no sidestep is free, or a status /
 * objective forbids moving. Score 1 (low); AbilityBehavior scores 10 (via
 * each ability) so the selector prefers attacking over moving/waiting when
 * both fire.
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
      // no-threat case (see MoveDecisionKind docs). 56c — a boxed fleer first
      // tries the bubble-back swap (proposeFlee's fallback); the decision
      // record distinguishes it (`flee_swap`) so panic churn stays attributable.
      const flee = proposeFlee(unit, world);
      if (flee === null) {
        emitMoveDecision(world, unit, 'boxed');
        return null;
      }
      emitMoveDecision(world, unit, flee.action.id === SWAP_ACTION_ID ? 'flee_swap' : 'flee');
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
        // §44b — in position: a first-class WAIT proposal, not a bare null.
        // A ready ability (score 10) still outranks it; on cooldown ticks the
        // wait wins and resolves within the tick (no world-state trace).
        emitMoveDecision(world, unit, 'wait');
        return waitProposal();
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
 * tie-broken toward open space). 56c — when boxed (`retreatCell` null: no FREE
 * cell increases distance), fall through to the bubble-back swap before
 * cowering in place. Abstains when no enemy exists or nothing qualifies.
 * Score 1, like every move.
 */
function proposeFlee(unit: Unit, world: World): ActionProposal | null {
  const threat = nearestEnemy(unit, world);
  if (threat === null) return null;
  const dest = retreatCell(unit, threat.position, world);
  if (dest === null) return fleeSwapProposal(unit, threat.position, world);
  return moveProposal(
    unit.position,
    dest,
    stepDurationTicks(world, dest, unit.derived.moveCooldownTicks),
  );
}

/**
 * 56c — the flee-swap (the shape-locked user heuristic, worklog §56): a BOXED
 * fleeing unit bubbles backward by swapping with an adjacent ally standing
 * STRICTLY farther from the threat. The exchange is mutually agreeable — the
 * fleer gains distance, the displaced FIGHTER is handed a step toward the
 * enemy it already wanted — which is exactly why the two eligibility gates
 * are load-bearing:
 *
 *   - **Partner not itself fleeing** — two panickers ping-pong (each swap
 *     hands the partner a step toward the threat it also fears).
 *   - **Partner not support** — a healer displaced into panic range
 *     immediately retreats back through the fleer (same churn), and the
 *     healer's yielding already lives in its GP5 `blockedAlly` machinery.
 *     Kind literal (module cycle — see `swapThroughProposal`'s twin note).
 *
 * Plus the structural gates shared with 56b: idle partner only (the 56a
 * doctrine), friendly, footprint-1 both sides. Candidate choice is
 * deterministic: greatest distance-from-threat wins, ties to the fixed
 * `NEIGHBORS` scan order (no RNG in movement — the standing ban).
 */
function fleeSwapProposal(
  unit: Unit,
  threatPos: GridCoord,
  world: World,
): ActionProposal | null {
  if (footprintOf(unit) !== 1) return null;
  let best: Unit | null = null;
  let bestDist = chebyshev(unit.position, threatPos); // must STRICTLY gain distance
  for (const [dx, dy] of NEIGHBORS) {
    const c: GridCoord = { x: unit.position.x + dx, y: unit.position.y + dy };
    const d = chebyshev(c, threatPos);
    if (d <= bestDist) continue;
    const partner = world.units.find(
      (u) => u.id !== unit.id && u.currentHp > 0 && u.position.x === c.x && u.position.y === c.y,
    );
    if (partner === undefined) continue;
    if (partner.team !== unit.team) continue; // never swap with an enemy (or a wall)
    if (partner.activeAction !== null) continue; // 56a: idle partners only
    if (footprintOf(partner) !== 1) continue;
    if (behaviorFlags(partner.effects).movement === 'flee') continue; // panicker pairs ping-pong
    if (partner.behaviors.some((b) => b.kind === 'support_movement')) continue; // GP5 owns the healer
    best = partner;
    bestDist = d;
  }
  if (best === null) return null;
  return swapProposal(
    unit.position,
    best.position,
    best.id,
    stepDurationTicks(world, best.position, unit.derived.moveCooldownTicks),
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
