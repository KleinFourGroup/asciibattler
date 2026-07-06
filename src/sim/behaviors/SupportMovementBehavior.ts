import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { SwapAction } from '../actions/SwapAction';
import { findTarget, lowestWoundedAlly, currentTarget } from '../Targeting';
import { findPath } from '../Pathfinding';
import { NEIGHBORS, awayStep, passable } from '../positioning';
import { GROUND, cellsOccupiedBy, footprintOf, occupiedCells } from '../occupancy';
import { SIM } from '../../config/sim';
// J2 — share the leaf pathing helpers with MovementBehavior (these were
// duplicated leaf-for-leaf). The healer's bespoke decision logic stays here.
import { costAt, moveProposal, stepDurationTicks, key, chebyshev } from '../movement';
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
 *  emitted, the caller names its own idle. */
function yieldSwap(unit: Unit, world: World, durationTicks: number): ActionProposal | null {
  const ally = blockedAlly(unit, world);
  if (ally === null) return null;
  emitMoveDecision(world, unit, 'yield_swap');
  return swapProposal(unit.position, ally.position, ally.id, durationTicks);
}

/**
 * The living ally (if any) for whom the healer is the *only* cell it can
 * advance through — i.e. the ally to swap places with. An adjacent ally `a`
 * qualifies when the healer's cell `h` is `a`'s single forward step toward its
 * target: stepping onto `h` brings `a` closer (in real path distance) to its
 * enemy, and every *other* available neighbour of `a` does not. That's the
 * "strictly blocking a boxed ally" condition (ROADMAP GP5): it fires in a
 * genuine chokepoint, not in open field where `a` always has another forward
 * cell. Returns the first such ally in `world.units` order (deterministic), or
 * null when the healer isn't strictly blocking anyone.
 *
 * "Forward" is measured by **grid path distance to the target**, NOT Chebyshev
 * — in a funnel layout the route to an enemy can run *away* from it in
 * straight-line terms (back through a gap, then around), so a Chebyshev test
 * mistakes the gap cell for a retreat and never fires. A BFS distance field
 * from the ally's target (over the static neutral-wall topology, computed once
 * per distinct target) gives the true "does stepping here get me closer"
 * answer for `h` and every neighbour in one sweep.
 *
 * Uses `currentTarget` (the ally's E5 sticky target) so the field is anchored
 * where `a` actually paths; a null target (no enemies) is skipped. The
 * "other forward cell" availability test runs against the NEUTRAL-INCLUSIVE
 * occupancy set — half-cover / walls are neutral *units*, not tiles, so
 * `passable` only rejects them when they're in `occupied`.
 */
function blockedAlly(unit: Unit, world: World): Unit | null {
  const h = unit.position;
  const hKey = key(h);
  // 44-pre-a — footprint-aware (the §35 set builder); corner-only, a rubble's
  // body cells read as open "other forward" cells. No behavior change expected:
  // the BFS `distanceField` walls are already footprint-correct and gate the
  // result.
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  const walls = neutralCells(world);
  const fields = new Map<number, Map<string, number>>(); // target id → dist field

  for (const a of world.units) {
    if (a.team !== unit.team) continue;
    if (a.id === unit.id) continue;
    if (a.currentHp <= 0) continue;
    if (chebyshev(a.position, h) !== 1) continue;

    const enemy = currentTarget(a, world);
    if (enemy === null) continue;
    let dist = fields.get(enemy.id);
    if (dist === undefined) {
      dist = distanceField(enemy.position, world, walls);
      fields.set(enemy.id, dist);
    }

    const aDist = dist.get(key(a.position));
    if (aDist === undefined) continue; // `a` can't reach its target at all
    const hDist = dist.get(hKey);
    // `h` must be a forward cell for `a` (stepping onto it advances it).
    if (hDist === undefined || hDist >= aDist) continue;

    // Does `a` have any OTHER available forward cell? If so, `h` isn't its
    // only way through → the healer isn't strictly blocking it.
    let hasOtherForward = false;
    for (const [dx, dy] of NEIGHBORS) {
      const n: GridCoord = { x: a.position.x + dx, y: a.position.y + dy };
      if (n.x === h.x && n.y === h.y) continue;
      if (!passable(n, world, occupied)) continue;
      const nDist = dist.get(key(n));
      if (nDist !== undefined && nDist < aDist) {
        hasOtherForward = true;
        break;
      }
    }
    if (!hasOtherForward) return a;
  }
  return null;
}

/**
 * BFS step-distance from `start` to every cell reachable over the static
 * navigable graph (in-bounds, finite tile cost, NOT a neutral/wall cell) —
 * 8-directional, uniform cost, fixed `NEIGHBORS` expansion order so the field
 * is deterministic. Units other than walls are treated as passable here: this
 * is the *topology* of the board (does a route exist through this cell), not a
 * live occupancy check — the caller layers the unoccupied test on top. Returns
 * a `key → distance` map; cells walled off from `start` are simply absent.
 */
function distanceField(start: GridCoord, world: World, walls: ReadonlySet<string>): Map<string, number> {
  const dist = new Map<string, number>();
  const startKey = key(start);
  if (!isNavigable(start, world, walls)) return dist;
  dist.set(startKey, 0);
  const queue: GridCoord[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const d = dist.get(key(c))! + 1;
    for (const [dx, dy] of NEIGHBORS) {
      const n: GridCoord = { x: c.x + dx, y: c.y + dy };
      const nKey = key(n);
      if (dist.has(nKey)) continue;
      if (!isNavigable(n, world, walls)) continue;
      dist.set(nKey, d);
      queue.push(n);
    }
  }
  return dist;
}

/** Set of neutral-unit (wall + half-cover) cell keys — the static blockers.
 *  43-pre — full footprints (`cellsOccupiedBy`): corner-only let the GP5.2
 *  navigable-snap accept a multi-tile rubble's body cell as a trail anchor. */
function neutralCells(world: World): Set<string> {
  const cells = new Set<string>();
  for (const u of world.units) {
    if (u.team === 'neutral') for (const c of cellsOccupiedBy(u)) cells.add(key(c));
  }
  return cells;
}

/** In-bounds, finite tile cost (excludes chasm), and not a neutral/wall cell. */
function isNavigable(c: GridCoord, world: World, walls: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  return !walls.has(key(c));
}

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

/**
 * GP5 #5 — the swap proposal: the healer (`from`) trades cells with the boxed
 * ally at `to` (`otherId`). Same timing shape as a move (score 1, single
 * `impact` lockout for the move-cooldown window); the exchange itself is
 * atomic in `SwapAction.start`.
 */
function swapProposal(
  from: GridCoord,
  to: GridCoord,
  otherId: number,
  durationTicks: number,
): ActionProposal {
  return {
    action: new SwapAction(from, to, otherId, durationTicks),
    score: 1,
    cooldown: durationTicks,
    phases: [{ phase: 'impact', ticks: durationTicks }],
  };
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
    for (const c of cellsOccupiedBy(u)) otherUnitCells.add(key(c));
  }

  const path = findPath(
    unit.position,
    goalPos,
    pathBlockers,
    world.gridW,
    world.gridH,
    (c) => costAt(c, world, otherUnitCells),
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

