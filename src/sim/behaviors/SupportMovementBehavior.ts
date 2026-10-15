import { isInertNeutral, type Behavior, type Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { findTarget, lowestWoundedAlly } from '../Targeting';
import { findPath } from '../Pathfinding';
import { NEIGHBORS, awayStep } from '../positioning';
import {
  GROUND,
  cellIndex,
  cellsOccupiedBy,
  claimEtas,
  footprintOf,
  occupiedCells,
  vacancyEtaOf,
} from '../occupancy';
import { SIM } from '../../config/sim';
import { costAt, moveProposal, swapProposal, stepDurationTicks, key, chebyshev } from '../movement';
import { blockedAlly, neutralCells, isNavigable } from '../blockedAlly';
import { isSwappablePartner } from '../actions/SwapAction';
import { emitMoveDecision, type MoveDecisionKind } from '../moveDecision';
import { waitProposal } from '../actions/WaitAction';

/**
 * The healer's movement, in place of `MovementBehavior`, which charges the
 * nearest enemy, the wrong thing for a support. The healer never seeks a
 * fight: it keeps allies in heal range and retreats when threatened. Wired by
 * `movementBehavior: "support"` (`behaviors/registry.ts`); the heal itself is
 * `AbilityBehavior`'s (`heal_ally`, priority 10), so this proposes only what
 * a ready heal outranks.
 *
 * Each poll, the first that applies:
 *
 *   1. A wounded ally (the healer included) is in heal range: hold, a wait.
 *      A ready heal outranks it; on cooldown ticks the wait wins and
 *      resolves within the tick. Allies in heal range: heal or idle, don't
 *      retreat.
 *   2. Else the nearest enemy is within `SIM.healerPanicRangeCells`: retreat
 *      one cell directly away, at score 5, above a move and below the heal.
 *      The kite comes from the healer's move cadence against the enemy's
 *      approach.
 *   3. Else a wounded ally is out of range: step toward the nearest (score
 *      1) to bring it into range.
 *   4. Else trail the centroid of the living allies, stepping whenever it is
 *      more than `SIM.healerFollowGapCells` away (score 1), so it stays mid
 *      formation; nothing when within the gap or with no living ally. The
 *      centroid, not the nearest ally at full heal range, makes the follow a
 *      smooth trail rather than a stand-then-lurch: it drifts as the army
 *      advances, and it lags the front, so the healer settles behind the
 *      fighters rather than following a charger into melee.
 *
 * Pathing is `findPath` over `costAt`'s prices, as combat movement's:
 * inert neutrals block, other units and claims are soft cells, so the
 * healer routes round its own line and never deadlocks. A step onto an
 * occupied cell is refused, and the healer queues.
 *
 * The yield: wherever the healer would otherwise hold or abstain (step 1's
 * hold, a boxed retreat, a blocked step, in formation), it first asks
 * whether it sits on the one cell a boxed ally needs (`blockedAlly`), and if
 * so swaps with that ally (`yieldSwap`, score 1). Otherwise a healer parked
 * on a one-wide gap out-heals the enemy's chip damage forever while the
 * column behind can't pass. A ready heal still wins, so the healer moves off
 * the gap only on its cooldown ticks.
 */
export class SupportMovementBehavior implements Behavior {
  static readonly kind = 'support_movement';
  readonly kind = SupportMovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const healRange = unit.derived.attackRange;
    const durationTicks = unit.derived.moveCooldownTicks;

    // 1. A wounded ally (the healer included) is healable: hold in heal range
    //    with a wait, unless the healer blocks a boxed ally at a choke (the
    //    yield). A ready heal still wins.
    if (lowestWoundedAlly(unit, world, healRange) !== null) {
      const swap = yieldSwap(unit, world, durationTicks);
      if (swap !== null) return swap;
      emitMoveDecision(world, unit, 'wait');
      return waitProposal();
    }

    // 2. Panic-retreat from a too-close enemy.
    const enemy = findTarget(unit, world);
    if (
      enemy !== null &&
      chebyshev(unit.position, enemy.position) <= SIM.healerPanicRangeCells
    ) {
      const away = stepAwayFrom(unit, enemy.position, world);
      if (away !== null) {
        emitMoveDecision(world, unit, 'retreat');
        return moveProposal(unit.position, away, stepDurationTicks(world, away, durationTicks), 5);
      }
      // Boxed against the enemy with no retreat cell: don't idle on a choke,
      // try the yield. This path matters most: a healer wedged in a one-wide
      // gap near the front is always within panic range, `stepAwayFrom`
      // returns null, and idling here strands the column behind it.
      return yieldChokepoint(unit, world, durationTicks, 'boxed');
    }

    // 3. Approach the nearest wounded ally that's out of range.
    const wounded = nearestAlly(unit, world, (c) => c.currentHp < c.derived.maxHp);
    if (wounded !== null) {
      const to = stepToward(unit, wounded.position, world);
      if (typeof to !== 'string') {
        emitMoveDecision(world, unit, 'advance');
        return moveProposal(unit.position, to, stepDurationTicks(world, to, durationTicks), 1);
      }
      return yieldChokepoint(unit, world, durationTicks, to === 'blocked' ? 'queue' : 'no_route');
    }

    // 4. Trail the centroid of living allies to stay tucked in formation.
    const rawAnchor = alliesCentroidCell(unit, world);
    if (rawAnchor !== null) {
      // The rounded centroid can land on an impassable cell (a wall or cover
      // between allies, a chasm); snap to the nearest navigable cell, so
      // `stepToward` gets a goal it can reach rather than no path.
      const anchor = snapToNavigable(rawAnchor, world);
      if (chebyshev(unit.position, anchor) > SIM.healerFollowGapCells) {
        const to = stepToward(unit, anchor, world);
        if (typeof to !== 'string') {
          emitMoveDecision(world, unit, 'advance');
          return moveProposal(unit.position, to, stepDurationTicks(world, to, durationTicks), 1);
        }
        // The trail step is blocked (an ally in a one-wide row wants to pass
        // the other way): try the yield, swapping the boxed ally past rather
        // than idling in its way. A swap sends the healer to the rear; a step
        // forward off the gap would put it at the head of the column.
        return yieldChokepoint(unit, world, durationTicks, to === 'blocked' ? 'queue' : 'no_route');
      }
    }

    // No wounded ally, no threat, in formation or alone: idle, unless the
    // healer blocks a boxed ally at a choke (the yield).
    return yieldChokepoint(unit, world, durationTicks, 'no_goal');
  }
}

/**
 * The yield, where the healer would otherwise abstain. When it sits on the
 * one cell a boxed ally needs to advance through (`blockedAlly`), it swaps
 * with that ally: the ally takes the healer's cell, a step toward its target,
 * and the healer moves back onto the ally's.
 *
 * A swap rather than a step aside, because the jams are one cell wide, with
 * no cell beside to step into. Stepping forward off the gap puts the healer
 * at the head of the column, into the next choke, to block again; the swap
 * sends the support to the rear and the fighter forward, and the jam drains.
 * `SwapAction` says why the exchange is one write.
 *
 * Null, and an idle, when the healer strictly blocks no one. Score 1: a
 * ready heal still wins, so the swap fires on the heal's cooldown ticks,
 * the ticks a jam would otherwise waste.
 *
 * Every abstain the healer makes comes through here, so this is where the
 * poll's `unit:moveDecision` lands: `yield_swap` when the swap fires, else
 * the caller's `abstainKind`, naming why the healer idles (boxed, a blocked
 * or unroutable step, in formation). Step 1's hold calls `yieldSwap`
 * directly, since it proposes a wait rather than abstaining.
 */
function yieldChokepoint(
  unit: Unit,
  world: World,
  durationTicks: number,
  abstainKind: MoveDecisionKind,
): ActionProposal | null {
  const swap = yieldSwap(unit, world, durationTicks);
  if (swap !== null) return swap;
  emitMoveDecision(world, unit, abstainKind);
  return null;
}

/** The yield's swap: the proposal, with its `yield_swap` record, when the
 *  healer strictly blocks a boxed ally, else null with no record, and the
 *  caller names its own idle. The detector is `blockedAlly.ts`; any
 *  swappable ally qualifies, whatever its role. */
function yieldSwap(unit: Unit, world: World, durationTicks: number): ActionProposal | null {
  const ally = blockedAlly(unit, world, (a) => isSwappablePartner(a, world));
  if (ally === null) return null;
  emitMoveDecision(world, unit, 'yield_swap');
  return swapProposal(unit.position, ally.position, ally.id, durationTicks);
}

/**
 * The nearest cell to `cell` the healer can path to (`isNavigable`: in
 * bounds, of finite tile cost, not an inert neutral's).
 * `alliesCentroidCell` gives a rounded average that can land on an
 * impassable cell between allies, and a path to it is empty, so the healer
 * would stall instead of trailing. A breadth-first search out from `cell`
 * (the fixed `NEIGHBORS` order; the first navigable cell of the nearest ring
 * wins) over the whole grid, so it finds open ground even from inside a
 * cluster of walls. `cell` itself when it is navigable, or when the board
 * has no navigable cell.
 */
function snapToNavigable(cell: GridCoord, world: World): GridCoord {
  const walls = neutralCells(world);
  if (isNavigable(cell, world, walls)) return cell;
  const visited = new Set<string>([key(cell)]);
  const queue: GridCoord[] = [cell];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    for (const [dx, dy] of NEIGHBORS) {
      const n: GridCoord = { x: c.x + dx, y: c.y + dy };
      const nKey = key(n);
      if (visited.has(nKey)) continue;
      visited.add(nKey);
      if (n.x < 0 || n.y < 0 || n.x >= world.gridW || n.y >= world.gridH) continue;
      if (isNavigable(n, world, walls)) return n;
      queue.push(n);
    }
  }
  return cell;
}

/**
 * Nearest living ally of `unit` (same team, excluding the unit itself)
 * matching `predicate`. Chebyshev distance; ties go to the lower id for
 * determinism. Self is excluded because these are *movement* targets — a
 * healer never walks toward its own cell (a wounded self is handled by the
 * in-range heal in step 1).
 */
function nearestAlly(
  unit: Unit,
  world: World,
  predicate: (c: Unit) => boolean,
): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const c of world.units) {
    if (c.team !== unit.team) continue;
    if (c.id === unit.id) continue;
    if (c.currentHp <= 0) continue;
    if (!predicate(c)) continue;
    const d = chebyshev(unit.position, c.position);
    if (best === null || d < bestDist || (d === bestDist && c.id < best.id)) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Cell-rounded centroid (average position) of `unit`'s living allies,
 * EXCLUDING the unit itself so its own position never anchors the point to
 * where it already stands. Returns null when the unit has no living allies.
 * Used as the healer's formation anchor: trailing the centroid keeps it
 * mid-pack and tracks the army's advance smoothly.
 */
function alliesCentroidCell(unit: Unit, world: World): GridCoord | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const c of world.units) {
    if (c.team !== unit.team) continue;
    if (c.id === unit.id) continue;
    if (c.currentHp <= 0) continue;
    sx += c.position.x;
    sy += c.position.y;
    n++;
  }
  if (n === 0) return null;
  return { x: Math.round(sx / n), y: Math.round(sy / n) };
}

/**
 * One route step toward `goalPos`, or a failure kind: `'no_route'` when no
 * path exists, `'blocked'` when the next cell is occupied (an abstain, and
 * the healer queues). The two are apart so the decision record tells a
 * queueing healer from a walled-off one. Inert neutrals block; other units,
 * camp members included, are soft cells. The goal cell's occupant is left
 * out, so a path to an ally's own cell exists; the healer never steps onto
 * it, as it stops once in heal range.
 */
function stepToward(
  unit: Unit,
  goalPos: GridCoord,
  world: World,
): GridCoord | 'blocked' | 'no_route' {
  // Packed cell indices (`cellIndex`), as `PathCostContext` holds.
  const pathBlockers: GridCoord[] = [];
  const otherUnitCells = new Set<number>();
  const vacatingEta = new Map<number, number>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    // Every cell of a body, so the healer never routes through or onto a
    // rubble's body. Only inert neutrals block; a camp member is a mobile
    // body and soft, as `buildMovementContext` splits them.
    if (isInertNeutral(u)) {
      pathBlockers.push(...cellsOccupiedBy(u));
      continue;
    }
    if (u.position.x === goalPos.x && u.position.y === goalPos.y) continue;
    // Vacancy priced as combat movement prices it (`costAt`): a body moving
    // away is a cheap cell, not a wall.
    const eta = vacancyEtaOf(u, world);
    for (const c of cellsOccupiedBy(u)) {
      const idx = cellIndex(c, world.gridW);
      otherUnitCells.add(idx);
      if (eta !== undefined) vacatingEta.set(idx, eta);
    }
  }
  // Claims enter the healer's costs only (the inbound premium), not the
  // commit check below, which tests bodies; a stale destination is caught as
  // the move runs (`World.destinationBlocked`, occupied or claimed). So a
  // claim changes which route the healer prefers, never what it may step
  // onto.
  const cost = {
    otherUnitCells,
    vacatingEta,
    claimed: claimEtas(world, GROUND, { excludeId: unit.id }),
    stepTicks: unit.derived.moveCooldownTicks,
  };

  const path = findPath(
    unit.position,
    goalPos,
    pathBlockers,
    world.gridW,
    world.gridH,
    (x, y) => costAt(x, y, world, cost, unit.position),
    false,
    footprintOf(unit), // the route fits the body's width
  );
  if (path.length < 2) return 'no_route';
  const to = path[1]!;
  if (otherUnitCells.has(cellIndex(to, world.gridW))) return 'blocked';
  return to;
}

/**
 * One cell directly away from `enemyPos`, the healer's panic step, by
 * `positioning.awayStep` (`effects/reposition.retreatCell` shares it; each
 * chooses its set). Every cell of a body is occupied. Claims are left out:
 * this is a move proposal, and `World.destinationBlocked` checks occupied or
 * claimed as it runs, where the effects' instant reposition must fold claims
 * in itself. Null when boxed in.
 */
function stepAwayFrom(unit: Unit, enemyPos: GridCoord, world: World): GridCoord | null {
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  return awayStep(unit.position, enemyPos, world, occupied);
}

