import type { GridCoord } from '../core/types';
import { distanceBetween } from '../core/grid';
import { isInertNeutral, type Unit } from './Unit';
import type { World } from './World';
import type { ActionProposal } from './Action';
import { MoveAction } from './actions/MoveAction';
import { SwapAction, isSwappablePartner } from './actions/SwapAction';
import { waitProposal } from './actions/WaitAction';
import { findPath } from './Pathfinding';
import {
  GROUND,
  cellIndex,
  cellKey,
  cellsOccupiedBy,
  claimEtas,
  footprintOf,
  vacancyEtaOf,
} from './occupancy';
import { SIM } from '../config/sim';
import { emitMoveDecision } from './moveDecision';

/**
 * The shared movement primitive, in three layers:
 *
 * - want — a `MovementIntent`: goals in order of preference. Each consumer
 *   builds its own (`positioning.ts`' firing cell then the target's cell, a
 *   rally tile, the dash's target).
 * - route — `routeToward`, one A* search over this tick's blockers and
 *   costs, the same for every consumer.
 * - move — `advance` turns an intent into this tick's proposal, a one-cell
 *   step; the dash lands through `leapLanding`, up to its reach along the
 *   route.
 */

/**
 * What a unit paths over this tick, built once and shared by every goal an
 * `advance` call tries.
 *
 * - `pathBlockers` — inert neutrals (walls, half cover, rubble): hard
 *   blockers for `findPath`, as terrain is. An active neutral, a camp
 *   member, is a mobile body and goes in `otherUnitCells`.
 * - `otherUnitCells` — every other mobile unit's cells and every other
 *   unit's claimed destination, less `excludeUnitId`: the soft cells
 *   `costAt` prices, and the set a step's collision check reads. The
 *   pursued target is left out, so a path onto its cell exists and the
 *   in-range abstain stops the unit a cell short; a tile goal and the dash
 *   leave out nothing.
 * - `occupied` — every other unit's cells, neutrals included, and the
 *   claims: the cells a sidestep may not land on.
 * - `vacatingEta`, `claimed`, `stepTicks` — the pricing inputs
 *   (`PathCostContext`). They choose the route only; the sets above stay
 *   strict, so a cheaper price never loosens a collision check (gotcha
 *   #113).
 */
interface MovementContext extends PathCostContext {
  readonly pathBlockers: GridCoord[];
  readonly otherUnitCells: Set<number>;
  readonly occupied: Set<number>;
}

/**
 * What `costAt` needs to price a soft cell. `buildMovementContext` embeds it
 * in a `MovementContext`; the healer's `stepToward` builds its own. The
 * route's origin, which anchors the arrival estimate, is `costAt`'s `from`.
 */
interface PathCostContext {
  // Keyed by the packed cell index (`cellIndex`), not an "x,y" string:
  // `costAt` reads these once per A* expansion, the hottest lookups a battle
  // makes.
  /** Soft cells: other units' bodies and claims. */
  readonly otherUnitCells: ReadonlySet<number>;
  /** Cell → ticks until its occupant's move vacates it (`vacancyEtaOf`);
   *  absent when the occupant is not leaving. */
  readonly vacatingEta: ReadonlyMap<number, number>;
  /** Claimed cell → ticks to the claimant's flip (`claimEtas`), when a body
   *  appears there; whether that falls before the pather arrives sets the
   *  price. `undefined`, the timing unknown, prices at the premium. */
  readonly claimed: ReadonlyMap<number, number | undefined>;
  /** The pather's base step in ticks, the unit `SIM.vacancyWindowOwnSteps`
   *  counts in. */
  readonly stepTicks: number;
}

export function buildMovementContext(
  unit: Unit,
  world: World,
  // `number | undefined` (not just optional) so `advance` can forward an
  // intent's optional `excludeUnitId` under exactOptionalPropertyTypes.
  opts?: { excludeUnitId?: number | undefined },
): MovementContext {
  const excludeUnitId = opts?.excludeUnitId;
  const pathBlockers: GridCoord[] = [];
  const otherUnitCells = new Set<number>();
  const occupied = new Set<number>();
  const vacatingEta = new Map<number, number>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    // A body moving away is priced by its vacancy ETA, derived from its action
    // and never serialized. An inert neutral never moves and the pursued
    // target is free, so neither needs one; an active neutral moves, and gets
    // one.
    const eta =
      isInertNeutral(u) || u.id === excludeUnitId ? undefined : vacancyEtaOf(u, world);
    // Every cell of the body (`cellsOccupiedBy`): rubble spans up to 3×3.
    for (const c of cellsOccupiedBy(u)) {
      const idx = cellIndex(c, world.gridW);
      occupied.add(idx);
      if (isInertNeutral(u)) {
        pathBlockers.push(c);
      } else if (u.id !== excludeUnitId) {
        otherUnitCells.add(idx);
        if (eta !== undefined) vacatingEta.set(idx, eta);
      }
    }
  }
  // A cell another mover has claimed blocks as a body does: it goes in the soft
  // set, so A* prices it, and in `occupied`, so a sidestep never lands on it.
  // The unit's own claims are skipped, since it may step into what it
  // reserved. Each claim carries its flip's ETA, by which `costAt` prices it
  // at the inbound premium or as a body standing there.
  const claimed = claimEtas(world, GROUND, { excludeId: unit.id });
  for (const key of claimed.keys()) {
    occupied.add(key);
    otherUnitCells.add(key);
  }
  return {
    pathBlockers,
    otherUnitCells,
    occupied,
    vacatingEta,
    claimed,
    stepTicks: unit.derived.moveCooldownTicks,
  };
}

/**
 * The routing primitive: one A* search from `from` to `goal` over the
 * context's hard blockers and soft costs. Returns `[from, …, goal]`, or `[]`
 * when there is no route; a caller reads `[]` or a one-cell path as no step.
 * There is no cache: every call is a search, and `pathfindingStats` counts
 * them.
 */
export function routeToward(
  from: GridCoord,
  goal: GridCoord,
  ctx: MovementContext,
  world: World,
  // An unreachable goal yields a path to the closest reachable cell instead
  // of `[]`, so a rally on a walled-off cell does not freeze the team.
  bestEffort = false,
  // The mover's footprint edge (N of its N×N body): a wider body needs the
  // whole block passable at each step, so it fits wide corridors only.
  footprint = 1,
): GridCoord[] {
  return findPath(
    from,
    goal,
    ctx.pathBlockers,
    world.gridW,
    world.gridH,
    (x, y) => costAt(x, y, world, ctx, from),
    bestEffort,
    footprint,
  );
}

/** A unit's movement for this tick, as every locomotion consumer states it. */
export interface MovementIntent {
  /**
   * Goals in order of preference; the first that yields a step wins. The
   * fallback is what keeps a unit from freezing: a ranged unit prefers its
   * firing cell and falls back to the target's cell when that approach
   * cannot step, so a contested firing cell never strands it. Don't
   * collapse this to one goal.
   */
  readonly goals: readonly GridCoord[];
  /**
   * What a sidestep leans toward when the forward cell is occupied: the
   * enemy or the rally cell, the place the unit is going rather than the
   * goal being tried.
   */
  readonly approachToward: GridCoord;
  /**
   * The mobile unit left out of the soft cells: the pursued target, a camp
   * member included. Inert scenery is a hard blocker and can't be left out.
   * Undefined leaves out nothing.
   */
  readonly excludeUnitId?: number;
  /**
   * Route to the closest reachable cell when a goal is unreachable, instead
   * of abstaining. A rally and a rubble approach set it, so a wall on the
   * goal does not freeze the unit; a chase leaves it off, so a walled-off
   * target is abstained on. Default false.
   */
  readonly bestEffort?: boolean;
}

/**
 * Turn a `MovementIntent` into this tick's proposal, or null to abstain: the
 * first goal that yields a step wins. Its proposals score 1, below every
 * ability that proposes.
 *
 * Emits the poll's `unit:moveDecision`: the step's kind (`advance`,
 * `sidestep`, `wait`, `swap_through`), or on an abstain `queue` when a body
 * stood on any goal's route and `no_route` when none did. An empty goal list
 * emits nothing, since its caller records that decision (the kiter's
 * `pinned`), so a poll records one decision.
 */
export function advance(unit: Unit, world: World, intent: MovementIntent): ActionProposal | null {
  const ctx = buildMovementContext(unit, world, { excludeUnitId: intent.excludeUnitId });
  const from = unit.position;
  const baseTicks = unit.derived.moveCooldownTicks;
  const footprint = footprintOf(unit); // the route fits the body's width
  let sawBlocked = false;
  for (const goal of intent.goals) {
    const outcome = stepAlongRoute(unit, from, goal, ctx, world, intent, baseTicks, footprint);
    if (outcome === 'no_route') continue;
    if (outcome === 'blocked') {
      sawBlocked = true;
      continue;
    }
    emitMoveDecision(world, unit, outcome.kind);
    return outcome.proposal;
  }
  if (intent.goals.length > 0) {
    emitMoveDecision(world, unit, sawBlocked ? 'queue' : 'no_route');
  }
  return null;
}

/**
 * The landing cell of a leap (the dash), or null to abstain. It returns a
 * cell, not a proposal, because a dash's cooldown is far longer than its
 * motion, where `moveProposal`'s cooldown is the move's duration; the dash's
 * proposal is built in `effects/propose.ts` (`proposeSelfMove`). Routes
 * toward the first goal with a path and walks up to `maxCells` cells along
 * it, landing on the furthest cell before the first occupied one; when even
 * the first is occupied it tries the next goal. Leave the pursued enemy soft
 * (no `excludeUnitId`), so a dash at it lands a cell short.
 */
export function leapLanding(
  unit: Unit,
  world: World,
  intent: MovementIntent,
  maxCells: number,
): GridCoord | null {
  const ctx = buildMovementContext(unit, world, { excludeUnitId: intent.excludeUnitId });
  const from = unit.position;
  const footprint = footprintOf(unit); // the route fits the body's width
  for (const goal of intent.goals) {
    const path = routeToward(from, goal, ctx, world, intent.bestEffort ?? false, footprint);
    if (path.length < 2) continue;
    const limit = Math.min(maxCells, path.length - 1);
    let landing: GridCoord | null = null;
    for (let i = 1; i <= limit; i++) {
      const c = path[i]!;
      if (ctx.otherUnitCells.has(cellIndex(c, world.gridW))) break;
      landing = c;
    }
    if (landing !== null) return landing;
  }
  return null;
}

/**
 * The route choice that keeps a unit from flickering between lanes: a
 * stable route against the live one.
 *
 * Short-lived costs steer the router: a claim or a body about to leave
 * appears, the best route moves to a parallel lane, the cost clears a step or
 * two later and the best route moves back, and the unit has stepped sideways
 * for nothing. So:
 *
 * - The stable route is the same A* with the short-lived costs stripped:
 *   bodies leaving and claims flipping within `stableRouteHorizonOwnSteps`
 *   of the pather's own steps. Slower traffic stays priced, as furniture.
 *   It is derived from the world's state alone, so nothing is serialized
 *   and a restored world chooses the same.
 * - The live route is `costAt`'s full pricing.
 * - When their first steps agree, or nothing short-lived is in play (one
 *   search), the live route is taken. When they differ, the live route is
 *   taken only if it is cheaper under live pricing by more than
 *   `routeSwitchMargin`; otherwise the unit keeps the stable lane, and the
 *   step's wait, sidestep or queue deals with whatever stands in it.
 *
 * Only the first step is compared, since the choice is made again every
 * poll. The leap (`leapLanding`) and the healer's `stepToward` take the live
 * route alone.
 */
function chooseRoute(
  from: GridCoord,
  goal: GridCoord,
  ctx: MovementContext,
  world: World,
  bestEffort: boolean,
  footprint: number,
): GridCoord[] {
  const live = routeToward(from, goal, ctx, world, bestEffort, footprint);
  if (live.length < 2) return live;
  // A gate that skips the second search, on a straight first step or on the
  // short-lived costs' distance, skips real suppressions too; don't add one.
  const stable = stableContext(ctx);
  if (stable === null) return live; // nothing short-lived: live is stable
  const stablePath = findPath(
    from,
    goal,
    ctx.pathBlockers,
    world.gridW,
    world.gridH,
    (x, y) => costAt(x, y, world, stable, from),
    bestEffort,
    footprint,
  );
  if (stablePath.length < 2) return live;
  const sameFirstStep =
    stablePath[1]!.x === live[1]!.x && stablePath[1]!.y === live[1]!.y;
  if (sameFirstStep) return live;
  // Diverged: price BOTH under the live cost fn; live is optimal there, so
  // the difference is the transient advantage the detour buys.
  const advantage = pathCost(stablePath, ctx, world, from) - pathCost(live, ctx, world, from);
  return advantage > SIM.routeSwitchMargin ? live : stablePath;
}

/**
 * The stable route's costs: `ctx` with every short-lived cost stripped, a
 * body leaving or a claim flipping within the horizon priced as an empty
 * cell. A body leaving later stays soft, priced as one standing (its
 * `vacatingEta` entry is dropped); a later or unknown claim keeps its tier.
 * Null when nothing qualifies, and the caller skips the second search. The
 * collision sets are untouched: only the stable route's `costAt` reads this.
 */
const stableContextMemo = new WeakMap<MovementContext, PathCostContext | null>();

function stableContext(ctx: MovementContext): PathCostContext | null {
  // One build per poll, not per goal attempt — a pure function of the ctx,
  // memoized on it (WeakMap: no retention beyond the poll's context object).
  const memo = stableContextMemo.get(ctx);
  if (memo !== undefined) return memo;
  const built = buildStableContext(ctx);
  stableContextMemo.set(ctx, built);
  return built;
}

function buildStableContext(ctx: MovementContext): PathCostContext | null {
  const horizon = SIM.stableRouteHorizonOwnSteps * ctx.stepTicks;
  const strippedCells: number[] = [];
  for (const [cell, eta] of ctx.vacatingEta) {
    if (eta <= horizon) strippedCells.push(cell);
  }
  const strippedClaims: number[] = [];
  for (const [cell, eta] of ctx.claimed) {
    if (eta !== undefined && eta <= horizon) strippedClaims.push(cell);
  }
  if (strippedCells.length === 0 && strippedClaims.length === 0) return null;
  const otherUnitCells = new Set(ctx.otherUnitCells);
  for (const c of strippedCells) otherUnitCells.delete(c);
  const claimed = new Map(ctx.claimed);
  for (const c of strippedClaims) {
    otherUnitCells.delete(c);
    claimed.delete(c);
  }
  return { otherUnitCells, vacatingEta: new Map(), claimed, stepTicks: ctx.stepTicks };
}

/** A path's entry cost under the live pricing, from cell 1 to the end. */
function pathCost(
  path: readonly GridCoord[],
  ctx: MovementContext,
  world: World,
  from: GridCoord,
): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += costAt(path[i]!.x, path[i]!.y, world, ctx, from);
  return sum;
}

/**
 * One goal's outcome. `blocked`: a route existed but a body stood in the way
 * and nothing committed (the abstain's `queue`); `no_route`: A* found none,
 * or the unit stands on the goal. A step's kind feeds `advance`'s
 * `unit:moveDecision`. A wait is returned as a step is: it takes the poll,
 * and the goals after it are not tried.
 */
type StepOutcome =
  | { proposal: ActionProposal; kind: 'advance' | 'sidestep' | 'wait' | 'swap_through' }
  | 'blocked'
  | 'no_route';

/**
 * One route toward `goal`, then a step: take `path[1]`. When another unit
 * holds it: if that body leaves within `SIM.waitForVacancyOwnSteps` of the
 * mover's own steps, wait for it in lane; else if it is a friendly ranged
 * unit to swap through (`roleEligibleBlocker`), swap or queue; else
 * sidestep toward `approachToward`. A body not leaving, or a claim, has no
 * ETA to wait on.
 *
 * Returns a failure kind when there is no route or nothing can be
 * committed; `advance` goes on to its next goal either way.
 */
function stepAlongRoute(
  // The acting unit, for the swap-through check; the routing below reads
  // only the other parameters.
  unit: Unit,
  from: GridCoord,
  goal: GridCoord,
  ctx: MovementContext,
  world: World,
  intent: MovementIntent,
  baseTicks: number,
  // The mover's footprint edge, for A*'s passability. The collision check and
  // the sidestep below test one cell (`to`, `side`): every mover is one cell,
  // since only rubble is wider and it never moves. A wider mover would need
  // both widened.
  footprint = 1,
): StepOutcome {
  // The stable or the live route; one search when nothing short-lived is in
  // play.
  const path = chooseRoute(from, goal, ctx, world, intent.bestEffort ?? false, footprint);
  if (path.length < 2) return 'no_route';

  const to = path[1]!;
  if (ctx.otherUnitCells.has(cellIndex(to, world.gridW))) {
    // The occupant is moving away and frees the cell within the gate: wait
    // for it in lane (a `WaitAction` the selector sees) rather than step
    // sideways. Decided again every poll, so if the blocker stalls the gate
    // fails next tick and the swap, sidestep or queue below applies; nothing
    // freezes. A claim never reaches here: `vacatingEta` holds bodies only,
    // and waiting on an arriving body means waiting for it to arrive and
    // then leave, which one action does not tell.
    const eta = ctx.vacatingEta.get(cellIndex(to, world.gridW));
    if (eta !== undefined && eta <= SIM.waitForVacancyOwnSteps * ctx.stepTicks) {
      return { proposal: waitProposal(), kind: 'wait' };
    }
    // A friendly ranged unit that belongs behind this melee one is never
    // sidestepped: swap through it when it is between actions, else queue.
    // The abstain keeps the mover polling each tick, and the blocker's own
    // yield (`MovementBehavior`) covers its busy windows from the other
    // side. The swap comes before the sidestep because a sidestep at equal
    // distance succeeds without progress, locks the mover for a whole move,
    // and loops.
    const eligible = roleEligibleBlocker(unit, to, world);
    if (eligible !== null) {
      if (isSwappablePartner(eligible, world)) {
        return {
          proposal: swapProposal(
            unit.position,
            to,
            eligible.id,
            stepDurationTicks(world, to, baseTicks),
          ),
          kind: 'swap_through',
        };
      }
      return 'blocked';
    }
    const side = sidestep(from, intent.approachToward, world, ctx.occupied);
    return side === null
      ? 'blocked'
      : {
          proposal: moveProposal(from, side, stepDurationTicks(world, side, baseTicks)),
          kind: 'sidestep',
        };
  }
  return {
    proposal: moveProposal(from, to, stepDurationTicks(world, to, baseTicks)),
    kind: 'advance',
  };
}

/**
 * The static half of the swap-through rule: the unit on the mover's forward
 * cell `to` when the pair's roles qualify, else null.
 *
 * - Role order — only a melee mover (attack range 1) initiates, and only a
 *   ranged blocker (range above 1) yields. Swaps flow one way in the role
 *   order, so a pair can never swap back, with no state to keep. A cell
 *   back is neutral or better for a ranged unit (a kiter wants the
 *   distance), and one pushed out of its band comes back as the passer
 *   moves on. Don't require the blocker to stay in band: that excludes the
 *   jam this is for, an archer at full range in a corridor.
 * - Friendly only — enemies are fought, not passed. The enemy's melee
 *   passes the enemy's ranged by the same rule.
 * - No supports — the healer counts as ranged (its heal's range is its
 *   attack range) but yields by its own rule (`blockedAlly.ts`). Matched by
 *   kind, since importing `SupportMovementBehavior`, which imports this
 *   file, would be a cycle.
 * - One-cell bodies on both sides — `SwapAction` exchanges two positions.
 *
 * The dynamic half, `isSwappablePartner` (between actions, not reserved by
 * another swap), is the caller's: an eligible but busy blocker means queue,
 * not sidestep, and the blocker's own yield covers its busy windows at its
 * next poll (`MovementBehavior`).
 *
 * Melee passing slower melee is not a rule, since it risks a lone unit
 * darting ahead; don't add it without playtest evidence.
 */
function roleEligibleBlocker(unit: Unit, to: GridCoord, world: World): Unit | null {
  if (unit.derived.attackRange > 1) return null; // role order: melee initiates
  if (footprintOf(unit) !== 1) return null;
  // The forward cell may hold a claim and no body; the scan then finds no
  // partner.
  const blocker = world.units.find(
    (u) => u.id !== unit.id && u.currentHp > 0 && u.position.x === to.x && u.position.y === to.y,
  );
  if (blocker === undefined) return null;
  if (blocker.team !== unit.team) return null; // fought, not passed
  if (footprintOf(blocker) !== 1) return null;
  if (blocker.derived.attackRange <= 1) return null; // role order: ranged yields
  if (blocker.behaviors.some((b) => b.kind === 'support_movement')) return null; // the healer yields by its own rule
  return blocker;
}

/**
 * The ranged yield's selector score. An ability proposes at its
 * `def.priority` (10 at most in the shipped catalog; `rangedYield.test.ts`
 * holds every priority below this): an attacker whose recovery fills its
 * cadence has its next attack ready the moment its action ends, so a yield
 * at a move's score of 1 would never win the selector. An archer strictly
 * blocking a boxed melee teammate skips one attack to let it through. A
 * panicking unit never reaches the yield (the flee branch returns first),
 * so nothing scoring above an ability competes.
 */
export const YIELD_SWAP_SCORE = 12;

/**
 * The shared swap proposal: the actor trades cells with the unit at `to`
 * (`otherId`). Shaped as a move: score 1 by default (the ranged yield passes
 * `YIELD_SWAP_SCORE`), and `moveProposal`'s timeline, travel, the exchange
 * at the flip (`SwapAction.applyEffect`), recovery. Only the actor pays the
 * cooldown; the partner is moved, and stays reserved until the flip
 * (`SwapAction`). Proposed by the mover's swap-through (`stepAlongRoute`),
 * the ranged yield and the flee swap (`MovementBehavior`), and the healer's
 * yield (`SupportMovementBehavior`).
 */
export function swapProposal(
  from: GridCoord,
  to: GridCoord,
  otherId: number,
  durationTicks: number,
  score = 1,
): ActionProposal {
  const flipOffset = Math.floor(durationTicks * SIM.moveFlipFraction);
  return {
    action: new SwapAction(from, to, otherId, durationTicks),
    score,
    cooldown: durationTicks,
    phases: [
      { phase: 'travel', ticks: flipOffset },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks - flipOffset },
    ],
  };
}

/**
 * A one-cell step perpendicular to the way to `target`, taken when the
 * route's next cell is occupied. Only the two perpendicular cells are
 * candidates; a step back and then forward is what the cost gradient
 * already does. A candidate must be in bounds, passable, unoccupied, and no
 * farther from `target` (Chebyshev) than standing still, so on a diagonal
 * approach, where both rotations step back, the sidestep abstains. The
 * nearer wins; null when neither qualifies, and the caller abstains, from
 * which corridor queueing emerges.
 *
 * A tie (the usual case: any far target ties) goes to the rotation the
 * from-cell's checkerboard parity picks, not a fixed side, which is
 * body-framed: every unit would crab the same way and the drift would
 * compound. Cell parity needs no state and draws no RNG, and it
 * decorrelates where it matters: cells next to each other in a column
 * alternate sides, a unit's own cardinal steps flip parity so two crab steps
 * net zero, and it is invariant under the 180° rotation that relates the
 * teams on a symmetric map (W + H even), so neither team has a favoured
 * side. Don't use the unit id's parity: spawn order gives a whole team one
 * parity when teams interleave, and an odd roster keeps a bias.
 */
export function sidestep(
  from: GridCoord,
  target: GridCoord,
  world: World,
  // Packed cell indices (`cellIndex`), as `MovementContext.occupied` holds.
  occupied: ReadonlySet<number>,
): GridCoord | null {
  const sx = Math.sign(target.x - from.x);
  const sy = Math.sign(target.y - from.y);
  // The toward-target direction rotated 90° clockwise / counter-clockwise
  // (screen frame: +y down). Parity 0 → CW gets the tie; parity 1 → CCW.
  const cw: GridCoord = { x: from.x - sy, y: from.y + sx };
  const ccw: GridCoord = { x: from.x + sy, y: from.y - sx };
  const candidates: GridCoord[] = (from.x + from.y) % 2 === 0 ? [cw, ccw] : [ccw, cw];
  let best: GridCoord | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) continue;
    if (!isFinite(world.tileGrid.costAt(c))) continue;
    if (occupied.has(cellIndex(c, world.gridW))) continue;
    const dist = chebyshev(c, target);
    // Never sidestep farther from the anchor than standing still: pairs of
    // such backward steps shuttle a unit in place. Sidesteps at equal
    // distance, the ones that free a corridor, stay; in place of a backward
    // step the unit queues, or waits when the blocker is leaving.
    if (dist > chebyshev(from, target)) continue;
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * The standard one-cell move proposal. A move is not instant:
 * `MoveAction.start` claims the destination and emits `unit:moved`, and the
 * unit's position stays at `from` until the flip. The timeline is `travel`,
 * a zero-length `impact` (where `MoveAction.applyEffect` sets the position to
 * `to` and releases the claim), then `recovery`. The flip falls at
 * `floor(durationTicks * SIM.moveFlipFraction)`, half the move as shipped,
 * so a slow unit reads as on its old cell for the first half; `floor` makes
 * a one-tick move instant. The unit is busy for the whole `durationTicks`.
 * Score 1 by default, the lowest a proposal takes; the healer's panic step
 * passes 5.
 */
export function moveProposal(
  from: GridCoord,
  to: GridCoord,
  durationTicks: number,
  score = 1,
): ActionProposal {
  const flipOffset = Math.floor(durationTicks * SIM.moveFlipFraction);
  return {
    action: new MoveAction(from, to, durationTicks),
    score,
    cooldown: durationTicks,
    phases: [
      { phase: 'travel', ticks: flipOffset },
      { phase: 'impact', ticks: 0 },
      { phase: 'recovery', ticks: durationTicks - flipOffset },
    ],
  };
}

/**
 * A step's duration, its lockout and its render slide: the base scaled by
 * the tile cost of entering `dest` (`TILE_DEFS`' `cost`, 1 on floor),
 * rounded to whole ticks, so a unit wades as slowly as A* prices the tile.
 * A committed destination is passable, so the cost is finite. A tile's
 * to-hit modifiers are applied in `World.applyDamage`.
 */
export function stepDurationTicks(world: World, dest: GridCoord, base: number): number {
  return Math.round(base * world.tileGrid.costAt(dest));
}

/**
 * The cost of entering a cell: its tile cost, plus a penalty when the cell is
 * soft. The penalty's tier is set by when the cell will hold a body as the
 * pather arrives, estimated as the Chebyshev distance from `from` times the
 * pather's step ticks, with `SIM.vacancyWindowOwnSteps` more steps of slack:
 *
 * 1. Claimed, flipping inside the window (`inboundClaimPenalty`, above a
 *    body's): a mover lands there about when the pather would. Also the
 *    price when the flip's ETA is unknown.
 * 2. Claimed, flipped well before the arrival (`occupiedCellPenalty`): by
 *    then, a body standing there. This is half of what lets a corridor
 *    column drain: the leader's next cell reads no worse than the leader.
 * 3. Vacating in time (`vacatingCellPenalty`, near zero): the occupant's own
 *    move leaves it within the window. The other half: the lane ahead is
 *    cheap because it is draining.
 * 4. A body not moving (`occupiedCellPenalty`).
 *
 * A* goes around a soft cell only when the detour costs less than the
 * penalty, and otherwise through it, to the step's abstain, sidestep or
 * wait. The penalties choose routes only: the step's collision check and the
 * selector's destination check (`World.destinationBlocked`) stay strict.
 * Walls and half cover never reach here (`findPath`'s hard blockers). Every
 * penalty stays finite and at least 0, so a cell costs at least 1 and the
 * Chebyshev heuristic stays admissible (gotcha #34). The penalties and the
 * window are in `config/sim.json`.
 *
 * The arrival estimate is a lower bound (routes bend, terrain slows), so it
 * errs toward arriving early: the vacating discount stays conservative near
 * the pather, and the claim's premium window stays wide.
 */
export function costAt(
  // Bare (x, y), as the `CostFn` takes them: this runs once per footprint
  // cell per neighbour per A* expansion, so it allocates no coord or key.
  x: number,
  y: number,
  world: World,
  cost: PathCostContext,
  from: GridCoord,
): number {
  const tileCost = world.tileGrid.costAtXY(x, y);
  if (!isFinite(tileCost)) return tileCost;
  const k = y * world.gridW + x;
  const arrivalSteps = Math.max(Math.abs(from.x - x), Math.abs(from.y - y));
  if (cost.claimed.has(k)) {
    // Premium iff the flip lands at/after (arrival − k) own-steps — the pather
    // would reach the cell around (or before) the body materialises. A flip
    // safely done k+ steps before arrival is just a body by then (static tier).
    // Near cells (arrival <= k) are always premium: the RHS is <= 0.
    const flipEta = cost.claimed.get(k);
    const premium =
      flipEta === undefined ||
      flipEta >= (arrivalSteps - SIM.vacancyWindowOwnSteps) * cost.stepTicks;
    return tileCost + (premium ? SIM.inboundClaimPenalty : SIM.occupiedCellPenalty);
  }
  if (!cost.otherUnitCells.has(k)) return tileCost;
  const eta = cost.vacatingEta.get(k);
  if (eta !== undefined && eta <= (arrivalSteps + SIM.vacancyWindowOwnSteps) * cost.stepTicks) {
    return tileCost + SIM.vacatingCellPenalty;
  }
  return tileCost + SIM.occupiedCellPenalty;
}

// `cellKey` lives in `occupancy.ts` and `distanceBetween` in `core/grid.ts`;
// the movement modules import them from here under these names.
export const key = cellKey;
export const chebyshev = distanceBetween;
