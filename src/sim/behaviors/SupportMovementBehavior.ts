import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { findTarget, lowestWoundedAlly } from '../Targeting';
import { findPath } from '../Pathfinding';
import { NEIGHBORS, awayStep } from '../positioning';
import {
  GROUND,
  cellsOccupiedBy,
  claimEtas,
  footprintOf,
  occupiedCells,
  vacancyEtaOf,
} from '../occupancy';
import { SIM } from '../../config/sim';
// J2 — share the leaf pathing helpers with MovementBehavior (these were
// duplicated leaf-for-leaf). The healer's bespoke decision logic stays here.
import { costAt, moveProposal, swapProposal, stepDurationTicks, key, chebyshev } from '../movement';
// 56c2 — the GP5 strictly-blocking detector, extracted to a shared home
// (the ranged yield asks the same question); the healer supplies its own
// eligibility (any swappable ally — its GP5 semantics, unchanged).
import { blockedAlly, neutralCells, isNavigable } from '../blockedAlly';
import { isSwappablePartner } from '../actions/SwapAction';
import { emitMoveDecision, type MoveDecisionKind } from '../moveDecision';
import { waitProposal } from '../actions/WaitAction';

/**
 * E7.B — the healer's movement, replacing the default `MovementBehavior`
 * (which charges the nearest *enemy* — exactly wrong for a support unit).
 * The healer never seeks combat; it positions to keep allies in heal range
 * and flees when threatened with nobody to heal. Assigned per-archetype in
 * `World.spawnUnit`; the heal itself rides on `AbilityBehavior` (the
 * `heal_ally` ability, score 10), so this behavior only fires when no heal
 * is available this tick.
 *
 * Per-tick decision (highest applicable wins; `heal_ally` at 10 outranks
 * everything here, so a healable ally in range always pre-empts movement):
 *
 *   1. A wounded ally (incl. self) is already in heal range → hold: a
 *      first-class WAIT proposal (§44b). `heal_ally` fires on ready ticks
 *      (score 10 beats the wait's 1); on cooldown ticks the wait wins and
 *      resolves within the tick — matches the ROADMAP E7 rule "allies in
 *      healing range → heal/idle, don't retreat."
 *   2. Else the nearest enemy is within `SIM.healerPanicRangeCells` →
 *      PANIC-RETREAT one cell directly away (score 5 — the ROADMAP value,
 *      above movement, below the heal). The kite emerges from the healer's
 *      `mobility` (move cadence) vs. the enemy's re-approach — the same
 *      kiting idea the rogue gets from its gambit, but movement-driven here.
 *   3. Else a wounded ally exists but is out of range → step toward the
 *      nearest one (score 1) to bring it into heal range.
 *   4. Else trail the CENTROID of its living allies, stepping whenever it's
 *      more than `SIM.healerFollowGapCells` from that point (score 1), so it
 *      stays tucked mid-formation; abstain once inside the gap or if it has
 *      no living allies. Anchoring on the centroid (not the nearest ally, at
 *      the full heal range) is what makes the follow read as a smooth trail
 *      rather than a static-then-lurch: the centroid drifts continuously as
 *      the army advances, and it lags the front line so the healer settles
 *      behind the fighters rather than hugging a charger into melee.
 *
 * Pathing reuses `findPath` with the same soft-block model as
 * `MovementBehavior`: neutrals (walls) are hard blockers, other units are
 * high-cost cells (`SIM.occupiedCellPenalty`) so the healer routes around
 * its own line but never deadlocks. A step onto a currently-occupied cell
 * is refused (abstain → natural queueing).
 *
 * GP5 #5 — the YIELD RULE overrides the two *idle* outcomes above (step 1's
 * "wounded ally in range" and the step-4 "in formation / alone" fallthrough).
 * Whenever the healer would otherwise hold, it first checks whether it's
 * sitting on the one chokepoint cell a boxed ally needs to traverse
 * (`blocksAnyAlly`); if so it steps off (`vacateCell`, score 1). This clears
 * the GP4-exposed deadlock where a healer parks on a 1-wide gap and out-heals
 * an enemy's chip damage forever while the column can't get past it. The heal
 * itself still wins on ready ticks — `heal_ally` scores 10 vs. the yield's 1 —
 * so the healer only shuffles off the gap on its heal-cooldown ticks.
 */
export class SupportMovementBehavior implements Behavior {
  static readonly kind = 'support_movement';
  readonly kind = SupportMovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const healRange = unit.derived.attackRange;
    const durationTicks = unit.derived.moveCooldownTicks;

    // 1. A wounded ally (self included) is already healable → hold in heal
    //    range, UNLESS the healer is blocking a boxed ally off a chokepoint
    //    (GP5 #5 yield rule). §44b — the hold is a first-class WAIT proposal
    //    (a ready `heal_ally` at 10 still wins), no longer a bare null.
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
      // Boxed against the enemy with no retreat cell → don't idle ON a
      // chokepoint. Fall through to the yield rule. This is the load-bearing
      // path for the GP4 deadlock: a healer wedged at a 1-wide gap near the
      // front line is always within panic range, so `stepAwayFrom` returns null
      // and the pre-GP5 code idled here, stranding the column behind it.
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
      // GP5.2 #4 — the rounded centroid can land on an impassable cell (a
      // wall / half-cover between allies, a chasm); snap to the nearest
      // navigable tile so `stepToward` gets a reachable goal instead of
      // findPath()→[] and stalling.
      const anchor = snapToNavigable(rawAnchor, world);
      if (chebyshev(unit.position, anchor) > SIM.healerFollowGapCells) {
        const to = stepToward(unit, anchor, world);
        if (typeof to !== 'string') {
          emitMoveDecision(world, unit, 'advance');
          return moveProposal(unit.position, to, stepDurationTicks(world, to, durationTicks), 1);
        }
        // Trail step blocked (an ally in a 1-wide row wants to pass the other
        // way) → fall through to the yield: swap the boxed ally past us rather
        // than idling in its way. With a *swap* (not a forward vacate) this is
        // safe — the healer goes to the rear, not leading the column.
        return yieldChokepoint(unit, world, durationTicks, to === 'blocked' ? 'queue' : 'no_route');
      }
    }

    // No wounded ally, no threat, already in formation (or alone) → idle,
    // UNLESS blocking a boxed ally off a chokepoint (GP5 #5 yield rule).
    return yieldChokepoint(unit, world, durationTicks, 'no_goal');
  }
}

/**
 * GP5 #5 — the yield move. When the healer would otherwise idle/hold AND it
 * sits on the one cell a boxed ally needs to advance through (`blockedAlly`),
 * it SWAPS places with that ally: the ally takes the healer's cell (a step
 * forward toward its target) and the healer retreats onto the ally's cell.
 *
 * A swap rather than a step-aside because the deadlock layouts are 1-wide —
 * there is no lateral cell to vacate to (a `nearestActingCell`-style sidestep
 * fails, which is exactly why the column deadlocked). Stepping the healer
 * *forward* off the gap (the obvious vacate) just makes it lead the column
 * into the next bottleneck and re-block; swapping sends the support to the
 * rear where it belongs and advances the fighter, draining the jam. See
 * `SwapAction` for why the exchange has to be atomic.
 *
 * Returns null (→ idle) when the healer isn't strictly blocking anyone. Score
 * 1: a ready heal (`heal_ally`, score 10) still wins, so the swap only fires
 * on heal-cooldown ticks — exactly the ticks the deadlock would otherwise burn.
 *
 * §42a — every healer idle path funnels through the yield check, so this is
 * where the poll's `unit:moveDecision` lands: `yield_swap` when the swap
 * fires, else the caller-supplied `abstainKind` naming WHY the healer is
 * idling (boxed / blocked approach / in formation). §44b split the swap probe
 * out as `yieldSwap` so the in-heal-range hold (step 1) can fall through to a
 * first-class WAIT proposal instead of this wrapper's bare-null abstain.
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

/** The GP5 #5 swap probe: the proposal (+ its `yield_swap` decision record)
 *  when the healer is strictly blocking a boxed ally, else null — no decision
 *  emitted, the caller names its own idle. 56c2 — the detector lives in
 *  [blockedAlly.ts](../blockedAlly.ts); the healer's eligibility is any
 *  swappable ally (role-blind, its original GP5 semantics). */
function yieldSwap(unit: Unit, world: World, durationTicks: number): ActionProposal | null {
  const ally = blockedAlly(unit, world, (a) => isSwappablePartner(a, world));
  if (ally === null) return null;
  emitMoveDecision(world, unit, 'yield_swap');
  return swapProposal(unit.position, ally.position, ally.id, durationTicks);
}

// (GP5's blockedAlly detector + its BFS helpers moved to
// [blockedAlly.ts](../blockedAlly.ts) at 56c2 — the ranged yield shares them.)

/**
 * GP5.2 #4 — the nearest cell to `cell` the healer can actually path to
 * (navigable = in-bounds, finite tile cost, not a neutral/wall).
 * `alliesCentroidCell` returns a rounded average that can land on an
 * impassable tile *between* allies; pathing to it returns `[]` and the healer
 * stalls instead of trailing. BFS outward from `cell` (fixed `NEIGHBORS`
 * order, first navigable at the minimum ring wins → deterministic), flooding
 * through the bounded grid so it still finds open ground when `cell` sits
 * inside a wall cluster. Returns `cell` unchanged when it's already navigable
 * (the common case) or as a fallback if the board has no navigable cell.
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

// (GP5 #5's swapProposal moved to movement.ts at 56b — one definition serves
// both proposers: this yield and the blocked-cascade swap-through probe.)

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
 * One A* step toward `goalPos`, or a failure kind when no path exists
 * (`'no_route'`) or the next cell is occupied (`'blocked'` — abstain →
 * queue; §42a splits the two so the decision record can tell a queueing
 * healer from a walled-off one). Neutrals hard-block; other units are
 * soft-cost. The occupant of the goal cell is un-blocked so a path to an
 * ally's own cell is reachable — the caller never actually steps onto it
 * (it stops once in heal range / once the ally is healable).
 */
function stepToward(
  unit: Unit,
  goalPos: GridCoord,
  world: World,
): GridCoord | 'blocked' | 'no_route' {
  const pathBlockers: GridCoord[] = [];
  const otherUnitCells = new Set<string>();
  const vacatingEta = new Map<string, number>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    // 43-pre — the WHOLE footprint (`cellsOccupiedBy`), not just the §39
    // corner: a corner-only blocker set routed the healer THROUGH (and onto)
    // a multi-tile rubble's body cells. Combatants are footprint-1 today, so
    // their branch is byte-identical.
    if (u.team === 'neutral') {
      pathBlockers.push(...cellsOccupiedBy(u));
      continue;
    }
    if (u.position.x === goalPos.x && u.position.y === goalPos.y) continue;
    // §45a — the healer prices vacancy the same way combat movement does
    // (one costAt doctrine): a body mid-move away is a cheap cell, not a wall.
    const eta = vacancyEtaOf(u, world);
    for (const c of cellsOccupiedBy(u)) {
      otherUnitCells.add(key(c));
      if (eta !== undefined) vacatingEta.set(key(c), eta);
    }
  }
  // §45a — claims reach the healer's COST context only (inbound premium), NOT
  // its commit set below: the step-commit / abstain semantics stay exactly
  // pre-§45a (§35b's occupied-OR-claimed execution gate still re-validates a
  // stale destination), so this changes which routes the healer prefers, never
  // what it may step onto.
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
    (c) => costAt(c, world, cost, unit.position),
    false,
    footprintOf(unit), // §39b — the support mover honors its body width too.
  );
  if (path.length < 2) return 'no_route';
  const to = path[1]!;
  if (otherUnitCells.has(key(to))) return 'blocked';
  return to;
}

/**
 * One cell directly away from `enemyPos` — the healer's panic step, on the
 * shared `positioning.awayStep` geometry (§44a; the gambit's `retreatCell` is
 * the other twin — the occupancy-set choice stays at each caller). 44-pre-a —
 * the WHOLE-footprint set (a rubble's body cells are occupied, not just its
 * §39 corner); claims deliberately NOT folded: this ships as a MoveAction
 * proposal, so §35b's `destinationBlocked` (occupied-OR-claimed) re-validates
 * at execution — unlike the gambit's instant effect reposition, which must
 * fold claims itself. Returns null when boxed in (caller then holds).
 */
function stepAwayFrom(unit: Unit, enemyPos: GridCoord, world: World): GridCoord | null {
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  return awayStep(unit.position, enemyPos, world, occupied);
}

