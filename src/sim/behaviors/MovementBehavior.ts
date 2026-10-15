import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { currentTarget, hostileCandidate } from '../Targeting';
import { NEIGHBORS, engagementDirective } from '../positioning';
import { minRangeForArchetype } from '../archetypes';
import { GROUND, footprintOf, occupiedCells } from '../occupancy';
import { SWAP_ACTION_ID, isSwappablePartner } from '../actions/SwapAction';
import { blockedAlly } from '../blockedAlly';
import {
  YIELD_SWAP_SCORE,
  advance,
  chebyshev,
  moveProposal,
  swapProposal,
  stepDurationTicks,
  key,
} from '../movement';
import { emitMoveDecision } from '../moveDecision';
import { waitProposal } from '../actions/WaitAction';
import { retreatCell } from '../effects/reposition';
import { behaviorFlags } from '../statusBehavior';

/**
 * Proposes a one-cell step toward the unit's current target when it is out
 * of reach, or a wait when it is in the firing band (with a line where one is
 * needed): the hold is a proposal the selector weighs. Abstains only when
 * there is nothing to propose: no target, no path, the next step blocked
 * with no sidestep free, or a status or objective forbidding a move. Its
 * proposals score 1, so an ability that proposes wins over a move or a wait.
 *
 * A thin decision layer: `positioning.ts` holds where to be (the firing band
 * and the line-of-sight gate, the approach to an inert target, the firing
 * cell then the target's cell, the kite; the protocol is documented there),
 * and `advance` (`movement.ts`) holds the route, the step and the sidestep.
 * What is left here is what to propose: the status flags (frozen, flee,
 * wander), the objectives (hold, a rally tile) and the positioning
 * directive, each mapped onto a proposal and a `MoveDecisionKind`. The dash
 * is an ability, and lands through `leapLanding`.
 */
export class MovementBehavior implements Behavior {
  static readonly kind = 'movement';
  readonly kind = MovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    // A behaviour status overrides movement ahead of any objective or pursuit:
    // a frozen, panicking or blinded unit ignores orders. Read off the unit's
    // effects, so no serialized state.
    const behavior = behaviorFlags(unit.effects);
    if (behavior.preventsMove) {
      emitMoveDecision(world, unit, 'frozen'); // rooted.
      return null;
    }
    if (behavior.movement === 'flee') {
      // Panic. `boxed` covers no retreat cell and no threat at all. A boxed
      // fleer first tries the swap back (`proposeFlee`), recorded as
      // `flee_swap`, so panic churn can be told apart.
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

    // Under a `hold` objective the unit never moves: it acts in place
    // (`AbilityBehavior` fires at whatever `updateTarget` left in range) and
    // proposes no move, not even to close or to clear a line for a shot. The
    // dash is off too: the hold commits only a target in range, or none, and
    // the dash abstains on a target within reach.
    if (world.objectiveFor(unit.team).mode === 'hold') {
      emitMoveDecision(world, unit, 'hold_objective');
      return null;
    }

    // The ranged yield, the blocker's half of the swap: before its own
    // engagement, a ranged unit asks whether it strictly blocks a boxed melee
    // teammate (`blockedAlly`) and, if so, proposes the swap at
    // `YIELD_SWAP_SCORE`, above its own attack, since an attacker whose
    // recovery fills its cadence attacks again at every poll and a lower
    // yield would never win. The archer skips one attack to let the
    // swordsman through. This covers the blocker's busy windows; the mover's
    // swap-through (`movement.ts`) takes an idle blocker at once. It comes
    // after the statuses (a panicking archer flees, it doesn't hold doors)
    // and after the hold, which forbids every move, a yield included.
    if (unit.derived.attackRange > 1 && footprintOf(unit) === 1) {
      const yieldSwap = yieldToBlockedMelee(unit, world);
      if (yieldSwap !== null) {
        emitMoveDecision(world, unit, 'yield_swap');
        return yieldSwap;
      }
    }

    const target = currentTarget(unit, world);
    if (target === null) {
      // No target. A unit under an `engage` or `focus` objective on a tile
      // goes toward the rally cell, as close as it can, leaving nothing out
      // of the soft cells, so it clusters near an occupied cell; otherwise it
      // idles. A unit or neutral objective doesn't reach here while its
      // target lives: `updateTarget` commits the unit to it. Only a player's
      // order sets a tile. Whether a tile focus leaves the target null (far
      // from the tile, or near it with no hostile in the engage radius) is
      // `Targeting.updateFocusTarget`'s; movement only reacts.
      const objective = world.objectiveFor(unit.team);
      if (
        (objective.mode === 'engage' || objective.mode === 'focus') &&
        objective.target.kind === 'tile'
      ) {
        // Best effort, so a rally cell no route reaches (a wall, a walled-off
        // region) brings the unit as close as it can rather than abstaining.
        // Otherwise one unreachable goal gives no step, and the whole team
        // would idle, since the objective also turns off the fallback to the
        // nearest enemy. A rally on a wall is the case.
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

    // Where to be is `positioning.ts`'s (the band, the approach to an inert
    // target, the goals, the kite); this maps its directive onto a proposal
    // and a `MoveDecisionKind`. The minimum range is resolved here, since
    // positioning.ts must not import archetypes.ts (its import note).
    const directive = engagementDirective(unit, world, target, minRangeForArchetype(unit.archetype));
    switch (directive.kind) {
      case 'hold':
        // In position: a wait. A ready ability outranks it; on cooldown ticks
        // the wait wins and resolves within the tick, leaving no state.
        emitMoveDecision(world, unit, 'wait');
        return waitProposal();
      case 'pinned':
        // The pinned kiter: too close, the charge left out, and no reachable
        // firing cell. `advance` with no goals would return null and emit
        // nothing, so the decision is named here.
        emitMoveDecision(world, unit, 'pinned');
        return null;
      case 'approach':
        return advance(unit, world, directive.intent);
    }
  }
}

/**
 * The ranged unit's yield: the swap proposal when it strictly blocks a boxed
 * melee teammate, else null. A cheap check (is any friendly melee unit
 * adjacent?) runs before the detector's search, so the usual case, no one
 * adjacent, costs one scan of the units. Eligible: melee only, by the role
 * order, which keeps a pair from swapping back; swappable
 * (`isSwappablePartner`); and one cell.
 */
function yieldToBlockedMelee(unit: Unit, world: World): ActionProposal | null {
  let adjacentMelee = false;
  for (const u of world.units) {
    if (u.team !== unit.team || u.id === unit.id || u.currentHp <= 0) continue;
    if (u.derived.attackRange > 1) continue;
    if (chebyshev(u.position, unit.position) !== 1) continue;
    adjacentMelee = true;
    break;
  }
  if (!adjacentMelee) return null;
  const ally = blockedAlly(
    unit,
    world,
    (a) =>
      a.derived.attackRange <= 1 && footprintOf(a) === 1 && isSwappablePartner(a, world),
  );
  if (ally === null) return null;
  return swapProposal(
    unit.position,
    ally.position,
    ally.id,
    stepDurationTicks(world, ally.position, unit.derived.moveCooldownTicks),
    YIELD_SWAP_SCORE,
  );
}

/**
 * The panic flee: a one-cell step that strictly increases the distance from
 * the nearest hostile, by `retreatCell` (the effects' retreat; away from the
 * anchor, ties toward open space). When boxed in (no free cell farther),
 * the swap back is tried before cowering in place. Abstains when there is
 * no hostile or nothing qualifies. Score 1, as every move.
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
 * The flee swap: a boxed-in fleeing unit moves back by swapping with an
 * adjacent ally standing strictly farther from the threat. Both gain: the
 * fleer gets distance, and the displaced fighter a step toward the enemy it
 * wanted, which is why the two partner checks matter:
 *
 *   - Not fleeing itself: two panicking units ping-pong, each swap handing
 *     the other a step toward the threat it also fears.
 *   - Not a support: a healer pushed into panic range retreats straight back
 *     through the fleer, the same churn, and it yields by its own rule
 *     (`blockedAlly.ts`). Matched by kind, as `roleEligibleBlocker` matches
 *     it.
 *
 * And the swap's shared checks: the partner swappable (`isSwappablePartner`,
 * between actions and not reserved), friendly, one cell on both sides. The
 * pick is deterministic: the greatest distance from the threat, ties to the
 * fixed `NEIGHBORS` order.
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
    if (!isSwappablePartner(partner, world)) continue; // between actions, unreserved
    if (footprintOf(partner) !== 1) continue;
    if (behaviorFlags(partner.effects).movement === 'flee') continue; // panicker pairs ping-pong
    if (partner.behaviors.some((b) => b.kind === 'support_movement')) continue; // the healer yields by its own rule
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
 * The blind wander: a one-cell step to a uniformly random passable,
 * unoccupied neighbour, rolled on `combatRng`. Abstains when every
 * neighbour is blocked. An ability that
 * proposes outranks the wander (score 1), so a blinded unit strikes what is
 * in reach and wanders only when nothing is (but see `currentTarget`'s
 * fallback, which reaches past the blindness under `atWill`).
 */
function proposeWander(unit: Unit, world: World): ActionProposal | null {
  // Every cell of a body, so a rubble's body cells don't read as free; a
  // step onto one would be aborted at execution and the tick spent on
  // `unit:moveAborted`. Claims are left out: this is a move proposal, and
  // `World.destinationBlocked` checks occupied or claimed as it runs, where
  // `retreatCell`'s instant reposition skips that check and folds claims in
  // itself.
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
 * The nearest living hostile by Chebyshev, the flee's anchor. Ties go to the
 * first in `world.units` order, so the pick is deterministic. Not
 * `Targeting.findTarget`, which follows the unit's strategy: a panicking unit
 * flees the closest threat, not its mark. The admit rule
 * (`hostileCandidate`) makes a hostile camp member a threat too, and a
 * panicking camp member flees the teams its camp fights.
 */
function nearestEnemy(unit: Unit, world: World): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const candidate of world.units) {
    if (!hostileCandidate(unit, candidate, world)) continue;
    const d = chebyshev(unit.position, candidate.position);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}
