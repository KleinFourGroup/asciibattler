import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';
import type { ActionProposal } from './Action';
import { MoveAction } from './actions/MoveAction';
import { SwapAction } from './actions/SwapAction';
import { waitProposal } from './actions/WaitAction';
import { findPath } from './Pathfinding';
import {
  GROUND,
  cellKey,
  cellsOccupiedBy,
  claimEtas,
  distanceBetween,
  footprintOf,
  vacancyEtaOf,
} from './occupancy';
import { SIM } from '../config/sim';
import { emitMoveDecision } from './moveDecision';

/**
 * J2 — the shared movement primitive + the movement-intent seam.
 *
 * Before J2 the "decide a goal → find the route → take a step" logic was
 * tangled inside `MovementBehavior.proposeAction` (and copy-pasted, leaf for
 * leaf, into `SupportMovementBehavior`). This module factors it into three
 * layers so the future gap-closer (Phase N's rogue dash — "move toward X now,
 * ignoring the normal goal-cell logic") can ride the SAME pathing without a
 * rewrite, and so caching can later attach behind a single pure boundary:
 *
 *   WANT  — a `MovementIntent` (preference-ordered goals + how far to commit).
 *           Each consumer builds its own: `MovementBehavior` (firing-cell →
 *           target-cell, or a rally tile), a dash (an adjacency cell, maxCells
 *           = dash range). This is the seam.
 *   ROUTE — `routeToward` = the pure `findPath` wrapper. **Caching, when it
 *           lands (deferred — pathing is measured-cheap), attaches HERE**, so
 *           it never touches a consumer.
 *   MOVE  — `advance` turns an intent into a one-tick `MoveAction`: a normal
 *           one-cell step (with the E5.B sidestep) at `maxCells: 1`, or a
 *           multi-cell leap at `maxCells: N`.
 *
 * Everything stays byte-identical to pre-J2 at `maxCells: 1` (same goal order,
 * same `findPath`, same sidestep), so no fuzz re-baseline. The `maxCells > 1`
 * branch is the dash hook; no shipped ability uses it yet (N1 adds the
 * `DashAbility`), but it is exercised by `movement.test.ts` so the seam is
 * proven to serve it, not merely notional.
 */

/**
 * The soft-block graph a unit paths over this tick — built once and shared by
 * every goal attempt in an `advance` call.
 *
 *   - `pathBlockers` — neutral-team units (walls + half-cover): HARD blockers
 *     for `findPath`, exactly as terrain.
 *   - `otherUnitCells` — every OTHER non-neutral unit's cell (keyed), minus an
 *     optional `excludeUnitId`. These are SOFT cells (high cost via the
 *     CostFn) and also the step-collision set. The pursued target is excluded
 *     (so a path onto its cell always exists, and the in-range abstain stops
 *     the unit a cell short); a tile/dash goal excludes nothing.
 *   - `occupied` — EVERY other unit's cell (all teams, neutrals included): the
 *     sidestep occupancy set, so a sidestep never lands on a filled square.
 *   - `vacatingEta` / `claimed` / `stepTicks` — §45a: the vacancy-aware COST
 *     inputs (see `PathCostContext`). Route-selection only — the commit-time
 *     sets above stay strict, so softening a cost can never soften a collision
 *     check (gotcha #113's placement rule is untouched).
 */
export interface MovementContext extends PathCostContext {
  readonly pathBlockers: GridCoord[];
  readonly otherUnitCells: Set<string>;
  readonly occupied: Set<string>;
}

/**
 * §45a — what the vacancy-aware `costAt` needs to price a soft-blocked cell.
 * `buildMovementContext` embeds it in the combat `MovementContext`; the
 * healer's bespoke `stepToward` builds a lightweight literal. The route
 * ORIGIN (the arrival-window anchor) is passed per-call, not carried here —
 * it's `routeToward`'s `from`.
 */
export interface PathCostContext {
  /** Soft-blocked cells (other units' bodies + in-flight claims). */
  readonly otherUnitCells: ReadonlySet<string>;
  /** Cell key → ticks until the occupant's in-flight move vacates it
   *  (`vacancyEtaOf`); absent = the occupant isn't going anywhere. */
  readonly vacatingEta: ReadonlyMap<string, number>;
  /** Cells CLAIMED as in-flight move destinations → the flip's ETA
   *  (`claimEtas`). A body materialises there at the flip; WHEN that lands
   *  relative to the pather's own arrival decides premium vs static. An
   *  `undefined` ETA = timing unknown — priced at the premium (conservative). */
  readonly claimed: ReadonlyMap<string, number | undefined>;
  /** The pather's own base step duration in ticks — the unit of the §45a
   *  vacancy window (`SIM.vacancyWindowOwnSteps` is expressed in these). */
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
  const otherUnitCells = new Set<string>();
  const occupied = new Set<string>();
  const vacatingEta = new Map<string, number>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    // §45a — a soft-blocked body mid-move AWAY prices by its vacancy ETA
    // (derived from its active action, never serialized). Neutrals never move
    // (hard blockers) and the pursued target is priced free, so only the
    // soft-cost branch consults it.
    const eta = u.team === 'neutral' || u.id === excludeUnitId ? undefined : vacancyEtaOf(u, world);
    // §35 — route each unit's cell touch through the occupancy footprint seam
    // (`cellsOccupiedBy`: one cell today, the N×N block once §39 fills it), so the
    // sidestep occupancy set + neutral path-blockers cover a multi-tile body for
    // free. Byte-identical at single-cell: each set gets exactly `u.position`.
    for (const c of cellsOccupiedBy(u)) {
      occupied.add(cellKey(c));
      if (u.team === 'neutral') {
        pathBlockers.push(c);
      } else if (u.id !== excludeUnitId) {
        otherUnitCells.add(cellKey(c));
        if (eta !== undefined) vacatingEta.set(cellKey(c), eta);
      }
    }
  }
  // §36a — a cell CLAIMED by another in-flight mover is blocked-for-pathing just
  // like an occupied cell (occupied OR claimed): fold it into BOTH the soft-cost
  // set (so A* routes around it) and the sidestep occupancy set (so a sidestep
  // never lands on it). Skip the building unit's own claims — it may step into
  // what it reserved. §45a carries each claim's flip ETA alongside: `costAt`
  // prices a convergence-window claim at the inbound premium and a long-done
  // flip as a mere future body.
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
 * The pure routing primitive: one A* search from `from` to `goal` over the
 * context's hard blockers + soft-cost graph. Returns `[from, …, goal]` or `[]`
 * when no route exists (the caller treats `[]` / a length-1 path as "no step").
 *
 * **This is the cache boundary.** A future per-unit memo or a shared-objective
 * flow-field substitutes for this call without any consumer change; today it
 * is a thin wrapper so the sim stays byte-identical and the recompute count
 * (`pathfindingStats`) measures the real A* load.
 */
export function routeToward(
  from: GridCoord,
  goal: GridCoord,
  ctx: MovementContext,
  world: World,
  // J3 — forwarded to `findPath`: an unreachable goal yields a path to the
  // closest reachable cell instead of `[]` (the tile-objective "as close as you
  // can" rally — keeps an unpathable rally cell from freezing the team).
  bestEffort = false,
  // §39b — the mover's footprint edge (N of its N×N body). Default 1 keeps every
  // single-cell mover byte-identical; a wider body needs the whole destination
  // block passable, so it paths through wide corridors but not narrow ones.
  footprint = 1,
): GridCoord[] {
  return findPath(
    from,
    goal,
    ctx.pathBlockers,
    world.gridW,
    world.gridH,
    (c) => costAt(c, world, ctx, from),
    bestEffort,
    footprint,
  );
}

/**
 * A unit's movement WANT for this tick — the seam every locomotion consumer
 * speaks.
 */
export interface MovementIntent {
  /**
   * Preference-ordered destinations; the first that yields a step wins. The
   * fallback chain is the load-bearing anti-freeze guarantee — e.g. a ranged
   * unit prefers its firing cell but FALLS BACK to charging the target's cell
   * when the firing approach can't step, so a contested standoff cell never
   * strands it. Do NOT collapse this to a single goal (that reintroduces the
   * retired `pickGoalCellInRange` freeze — see GOTCHAS / MovementBehavior).
   */
  readonly goals: readonly GridCoord[];
  /**
   * The cell a sidestep biases toward when the immediate forward step is
   * occupied (the enemy / the rally cell) — usually the conceptual
   * destination, NOT necessarily the current goal candidate.
   */
  readonly approachToward: GridCoord;
  /**
   * Non-neutral unit excluded from the soft-block set (the pursued target).
   * Undefined → exclude nothing (tile pursuit / a dash to an empty cell).
   */
  readonly excludeUnitId?: number;
  /**
   * Cells to advance along the route this action: `1` = a normal step (with
   * the E5.B sidestep on an occupied forward cell); `> 1` = a dash/leap (walk
   * up to N cells along the route, stopping before the first occupied cell, no
   * sidestep). N1's gap-closer rides the `> 1` path.
   */
  readonly maxCells: number;
  /**
   * J3 — route to the CLOSEST reachable cell when a goal is unreachable, rather
   * than abstaining. The tile-objective rally sets this (a wall on the rally
   * cell must not freeze the team); enemy-chasing leaves it off so a genuinely
   * blocked target still abstains as before. Defaults to false.
   */
  readonly bestEffort?: boolean;
  /**
   * Whether a `maxCells: 1` step may sidestep when the forward cell is
   * occupied. Defaults to `true` (MovementBehavior + tile pursuit). A future
   * consumer that wants strict queueing can pass `false`.
   */
  readonly sidestepWhenBlocked?: boolean;
}

/**
 * Turn a `MovementIntent` into this tick's `MoveAction`, or null to abstain.
 * Iterates the goal preference list and returns the first goal that produces a
 * step; abstains only when none do. Score 1 (low) so `AbilityBehavior`
 * (score 10) always wins when an attack is also available.
 *
 * §42a — emits the poll's mechanical `unit:moveDecision`: `advance`/`sidestep`
 * on a step, `wait` on §45b's ETA-gated queue-in-lane proposal, and on a full
 * abstain `queue` when ANY goal attempt was blocked by a unit (a route
 * existed; a body was in the way — and its drain ETA, if any, missed the
 * §45b gate) vs `no_route` when none was. Emits nothing on an empty goal
 * list (the caller owns that decision — the Qb#3 `pinned` shape), so the
 * one-decision-per-poll invariant holds.
 */
export function advance(unit: Unit, world: World, intent: MovementIntent): ActionProposal | null {
  const ctx = buildMovementContext(unit, world, { excludeUnitId: intent.excludeUnitId });
  const from = unit.position;
  const baseTicks = unit.derived.moveCooldownTicks;
  const footprint = footprintOf(unit); // §39b — path a wider body through wider gaps.
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
 * N1 — the landing cell for a multi-cell LEAP (the rogue dash), or null to
 * abstain. Mirrors `advance`'s goal-preference iteration but returns only the
 * destination cell, NOT a full proposal: a dash decouples its motion duration
 * from its (much longer) cooldown, so `DashAbility` builds the proposal itself
 * rather than routing through `moveProposal` (whose `cooldown == durationTicks`
 * invariant a dash breaks). Routes toward the first goal that yields a path,
 * then walks up to `intent.maxCells` cells along it, stopping before the first
 * cell occupied by another unit — the same conservative rule the `advance` leap
 * branch uses (the two share `walkAlongPath`). Leave the pursued enemy a
 * soft-blocker (no `excludeUnitId`) so a dash AT it lands the cell short.
 */
export function leapLanding(unit: Unit, world: World, intent: MovementIntent): GridCoord | null {
  const ctx = buildMovementContext(unit, world, { excludeUnitId: intent.excludeUnitId });
  const from = unit.position;
  const footprint = footprintOf(unit); // §39b — leap route respects the body's width.
  for (const goal of intent.goals) {
    const path = routeToward(from, goal, ctx, world, intent.bestEffort ?? false, footprint);
    if (path.length < 2) continue;
    const landing = walkAlongPath(path, intent.maxCells, ctx.otherUnitCells);
    if (landing !== null) return landing;
  }
  return null;
}

/**
 * Walk up to `maxCells` cells along an A* `path` (from `path[1]` onward),
 * stopping before the first cell occupied by another unit; returns the furthest
 * cell reached, or null when even `path[1]` is occupied. Shared by the `advance`
 * leap branch and `leapLanding` so the two can't drift.
 */
function walkAlongPath(
  path: readonly GridCoord[],
  maxCells: number,
  otherUnitCells: ReadonlySet<string>,
): GridCoord | null {
  const limit = Math.min(maxCells, path.length - 1);
  let landing: GridCoord | null = null;
  for (let i = 1; i <= limit; i++) {
    const c = path[i]!;
    if (otherUnitCells.has(key(c))) break;
    landing = c;
  }
  return landing;
}

/**
 * §45c — the anti-flicker route choice: stable incumbent vs live challenger.
 *
 * The flip-flop the §45c-pre trace attributed (25% of flips; 33–39% on
 * endlessCorridors) is TRANSIENT cost noise steering the router: a claim or a
 * soon-vacating body appears, the optimum flips to a parallel lane, the
 * transient resolves within a step or two, the optimum flips back — and the
 * unit has crabbed laterally for nothing. The cure the resolved §45c decision
 * allows (derive-don't-cache — nothing serialized, nothing to lose on a
 * snapshot resume):
 *
 *   - The **stable route** — the same A* with short-horizon transients
 *     STRIPPED (bodies/claims whose flip ETA is within
 *     `stableRouteHorizonOwnSteps` of the pather's own step; §45c-pre's
 *     counterfactual probe, promoted to the decision rule). Long-horizon
 *     traffic (a glacially-vacating blocker) stays priced — it's furniture.
 *     This is the derivable INCUMBENT: recomputable identically from
 *     serialized state on any resume.
 *   - The **live route** — today's full §45a pricing, the CHALLENGER.
 *   - When their FIRST STEPS agree (or no transient exists at all — the
 *     quiet-world fast path, one search, byte-identical to pre-§45c), the
 *     live route proceeds as before. When they diverge, the live detour is
 *     followed only if its advantage under live pricing exceeds
 *     `routeSwitchMargin`; otherwise the unit holds the stable lane and the
 *     §45b step machinery (wait / progress-guarded sidestep / queue) handles
 *     whatever is actually standing there.
 *
 * Only the first step is compared — the choice is re-derived every poll, so
 * later divergence is next poll's question. The dash/leap (`leapLanding`) and
 * the healer's `stepToward` stay live-only: no flip evidence was measured
 * there (§45c-pre traced combat comps), and scope stays tight.
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
  // (Two perf gates were tried here and REJECTED at the §45c keyboard, both
  // measured to skip REAL suppressions: a straight-first-step fast path cost
  // corridor(6)'s crab-to-lane-hold conversion + a chunk of endless osc, and
  // a transient-distance gate pruned A* only on the cheap map whose flicker
  // this phase exists to kill, while a maze's transients are always near so
  // the expensive labyrinth searches ran anyway. The fuzz wall-time growth
  // that motivated them was measured to be CONTENT — deeper greedy runs —
  // not compute; the fuzz budgets carry it, per the 43a precedent.)
  const stable = stableContext(ctx);
  if (stable === null) return live; // no short-horizon transients — live IS stable.
  const stablePath = findPath(
    from,
    goal,
    ctx.pathBlockers,
    world.gridW,
    world.gridH,
    (c) => costAt(c, world, stable, from),
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
 * §45c — the stable-incumbent cost context: `ctx` with every short-horizon
 * transient stripped (cost 0 — the cell will clear around one own-step from
 * now, so for ROUTE choice it's noise). Long-horizon vacating bodies stay
 * soft-blocked (their `vacatingEta` entry is dropped, so they price at the
 * static tier); long-horizon / underivable claims keep their tier. Returns
 * null when nothing qualifies — the caller then skips the second search
 * entirely (the quiet-world fast path). COMMIT-time sets are untouched: this
 * context exists only inside the stable `costAt` closure.
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
  const strippedCells: string[] = [];
  for (const [cell, eta] of ctx.vacatingEta) {
    if (eta <= horizon) strippedCells.push(cell);
  }
  const strippedClaims: string[] = [];
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

/** §45c — a path's total entry cost under the LIVE pricing (cells 1..end). */
function pathCost(
  path: readonly GridCoord[],
  ctx: MovementContext,
  world: World,
  from: GridCoord,
): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += costAt(path[i]!, world, ctx, from);
  return sum;
}

/**
 * §42a — a goal attempt's outcome. `blocked` = a route existed but a unit
 * stood in the way and no sidestep committed (the aggregate `queue` signal);
 * `no_route` = A* found nothing (or the unit already sits on the goal). The
 * step kinds feed the `unit:moveDecision` record in `advance`. §45b adds
 * `wait` — a first-class queue-in-lane proposal, returned like a step (it
 * consumes the poll; the goal fallback chain finds a step, not a different
 * queue).
 */
type StepOutcome =
  | { proposal: ActionProposal; kind: 'advance' | 'sidestep' | 'wait' | 'swap_through' }
  | 'blocked'
  | 'no_route';

/**
 * One A* route toward `goal`, then commit the step(s) per `intent.maxCells`:
 *
 *   - `maxCells <= 1` (the default step): take `path[1]`. If that cell is
 *     occupied by another unit: **§45b first asks whether the blocker is
 *     already leaving** — when its vacancy ETA is within
 *     `waitForVacancyOwnSteps` of the mover's own steps, propose a
 *     first-class WAIT (queue in lane; the crab-walk dies here). Only
 *     otherwise try the perpendicular E5.B sidestep toward `approachToward`
 *     before giving up (unless `sidestepWhenBlocked` is false — the wait
 *     gate fires for strict-queue consumers too; it IS queueing). A static
 *     body or a claim has no derivable drain ETA and behaves exactly
 *     pre-§45b.
 *   - `maxCells > 1` (a dash/leap): walk along the route from `path[1]`, taking
 *     cells until one is occupied or the cap/goal is reached; land on the
 *     furthest reachable cell. No sidestep — a leap doesn't crab sideways.
 *     (Exact leap-over-occupant semantics are N1's call; the conservative
 *     stop-before-occupied default keeps the seam safe meanwhile.)
 *
 * Returns a failure kind (not a proposal) when no route exists or no cell can
 * be committed — the caller (`advance`) keeps trying later goals either way,
 * exactly as the pre-§42a `null` did.
 */
function stepAlongRoute(
  // 56b — the acting unit, for the swap-through probe (team / role / id).
  // Everything else still flows through the extracted params so the routing
  // layers below stay unit-agnostic.
  unit: Unit,
  from: GridCoord,
  goal: GridCoord,
  ctx: MovementContext,
  world: World,
  intent: MovementIntent,
  baseTicks: number,
  // §39b — the mover's footprint edge, forwarded to the A* passability check. The
  // step-COMMIT collision + sidestep below stay single-cell (`to`/`side`): a
  // multi-tile MOVER doesn't exist yet (§40's rubble is static), so widening the
  // commit-time occupancy check rides the same seam whenever one ships.
  footprint = 1,
): StepOutcome {
  // §45c — the anti-flicker route choice (stable incumbent vs live challenger)
  // replaces the bare live search; identical single-search behavior on any
  // poll without short-horizon transients in play.
  const path = chooseRoute(from, goal, ctx, world, intent.bestEffort ?? false, footprint);
  if (path.length < 2) return 'no_route';

  if (intent.maxCells <= 1) {
    const to = path[1]!;
    if (ctx.otherUnitCells.has(key(to))) {
      // §45b — the ETA-gated wait-vs-sidestep. The forward cell's occupant is
      // mid-move away and will free it within the gate: queue for it (a
      // deliberate, selector-visible hold — §44b's WaitAction) instead of
      // crabbing perpendicular. Re-decided fresh every poll: if the blocker
      // stalls (its move ends, ETA gone), the gate fails next tick and the
      // pre-§45b sidestep/queue behavior resumes — no freeze. Claims never
      // reach here (`vacatingEta` holds body cells only; waiting for an
      // ARRIVING body means waiting for it to arrive AND leave — not
      // derivable from one in-flight action).
      const eta = ctx.vacatingEta.get(key(to));
      if (eta !== undefined && eta <= SIM.waitForVacancyOwnSteps * ctx.stepTicks) {
        return { proposal: waitProposal(), kind: 'wait' };
      }
      if (intent.sidestepWhenBlocked === false) return 'blocked';
      const side = sidestep(from, intent.approachToward, world, ctx.occupied);
      if (side !== null) {
        return {
          proposal: moveProposal(from, side, stepDurationTicks(world, side, baseTicks)),
          kind: 'sidestep',
        };
      }
      // 56b — the LAST-RESORT swap-through (wait and sidestep both failed →
      // corridor-shaped by construction). A blocked melee passes an idle
      // friendly ranged blocker via the GP5 atomic swap; the role order
      // (melee through ranged, never the reverse) is the anti-oscillation.
      const swap = swapThroughProposal(unit, to, world, baseTicks);
      return swap === null ? 'blocked' : { proposal: swap, kind: 'swap_through' };
    }
    return {
      proposal: moveProposal(from, to, stepDurationTicks(world, to, baseTicks)),
      kind: 'advance',
    };
  }

  // Dash/leap: furthest unoccupied cell within the step cap along the route.
  // M6 — the leap keeps base cadence (no per-tile wade scaling): a dash's
  // terrain interaction is N1's call and `stepDurationTicks` is a normal-step
  // property. N1 — the walk is shared with `leapLanding` via `walkAlongPath`
  // (DashAbility computes a landing without a full proposal, since a dash's
  // cooldown is decoupled from its motion duration).
  const landing = walkAlongPath(path, intent.maxCells, ctx.otherUnitCells);
  return landing === null
    ? 'blocked'
    : { proposal: moveProposal(from, landing, baseTicks), kind: 'advance' };
}

/**
 * 56b — the swap-through eligibility probe: the proposal for a blocked mover
 * to pass the unit on its forward cell `to` via the GP5 atomic SwapAction, or
 * null when the pair doesn't qualify. The rule set (shape-locked 2026-07-15,
 * worklog §56):
 *
 *   - **Role order** — only a MELEE mover (attackRange 1) may initiate, and
 *     only a RANGED blocker (attackRange > 1) yields. Antisymmetry is the
 *     whole anti-oscillation story: swaps flow one direction in the role
 *     relation, so a pair can never swap twice — no hysteresis, no state.
 *     Backward displacement is neutral-to-good for every ranged archetype
 *     (a minRange kiter WANTS the extra cell), and a displaced-out-of-band
 *     archer re-enters as the passer marches on (the band loss is transient
 *     — the user's §56 design-round read; an in-band eligibility check was
 *     REJECTED for excluding the canonical max-range corridor jam).
 *   - **Idle partners only** (`activeAction === null`) — the 56a doctrine: a
 *     mid-move partner is corruption, a mid-anything partner is next poll's
 *     swap. SwapAction's no-op branch backstops the post-rehydrate path.
 *   - **Friendly only** — enemies are fought, not passed. (Symmetric: enemy
 *     melee passes enemy ranged through this same probe.)
 *   - **No supports** — the healer reads as ranged (heal range IS its
 *     attackRange) but yields on its own terms via the GP5 `blockedAlly`
 *     machinery; kind literal because importing SupportMovementBehavior here
 *     is a module cycle (it imports this file).
 *   - **Single-cell bodies both sides** — SwapAction exchanges two positions;
 *     a multi-tile participant has no defined exchange yet (§39b).
 *
 * Speed-order (melee passing slower melee) was considered and DEFERRED to
 * playtest at the shape-lock — the solo-dart worry; don't add it here without
 * that evidence.
 */
function swapThroughProposal(
  unit: Unit,
  to: GridCoord,
  world: World,
  baseTicks: number,
): ActionProposal | null {
  if (unit.derived.attackRange > 1) return null; // role order: melee initiates
  if (footprintOf(unit) !== 1) return null;
  // The forward cell can be soft-blocked by a CLAIM with no body on it —
  // world.units position scan naturally yields no partner there.
  const blocker = world.units.find(
    (u) => u.id !== unit.id && u.currentHp > 0 && u.position.x === to.x && u.position.y === to.y,
  );
  if (blocker === undefined) return null;
  if (blocker.team !== unit.team) return null; // fought, not passed
  if (blocker.activeAction !== null) return null; // 56a: idle partners only
  if (footprintOf(blocker) !== 1) return null;
  if (blocker.derived.attackRange <= 1) return null; // role order: ranged yields
  if (blocker.behaviors.some((b) => b.kind === 'support_movement')) return null; // GP5 owns the healer
  return swapProposal(unit.position, to, blocker.id, stepDurationTicks(world, to, baseTicks));
}

/**
 * GP5 #5 / 56b — the shared swap proposal: the actor trades cells with the
 * unit at `to` (`otherId`). Move-shaped timing (score 1; single `impact`
 * lockout for the full window — the exchange itself is atomic in
 * `SwapAction.start`, so there is no travel/flip split like `moveProposal`).
 * Only the actor pays the cooldown; the partner is merely relocated. Was
 * SupportMovementBehavior-local until 56b needed it for the mover-initiated
 * swap-through — one definition, two proposers (the healer's yield + the
 * blocked-cascade probe above).
 */
export function swapProposal(
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
 * E5.B — one-cell perpendicular sidestep toward `target`, used when the
 * A*-chosen next step is occupied by another unit. Considers exactly the two
 * cells perpendicular to the unit→target direction (per the E5 decision point:
 * 2 candidates, not 3 — back-step-forward is what the cost gradient already
 * does). Keeps only in-bounds, finite-cost, unoccupied cells THAT DO NOT LOSE
 * GROUND (§45b — Chebyshev to `target` <= standing still; on a pure-diagonal
 * approach both rotations are backward, so the sidestep abstains entirely),
 * and returns the one closest to the target. Returns null when neither is
 * viable, so the caller abstains and corridor queueing still emerges.
 *
 * §43b — the tie rule. When both rotations are viable AND equidistant (the
 * common case: any far-enough target ties), the winner is the rotation the
 * FROM cell's checkerboard parity prefers — NOT a fixed first-candidate
 * (which was body-framed: every unit always crabbed the same body side, the
 * shared-sign drift the §42c fixtures measured). Cell parity is stateless +
 * deterministic (no RNG — the standing movement ban), and self-decorrelates
 * on every axis that matters: adjacent cells in a column alternate sides, a
 * unit's own successive cardinal steps flip parity (so a crab-walk pair nets
 * zero instead of compounding), and the rule is invariant under the 180°
 * board rotation that relates the two teams on symmetric maps (W+H even), so
 * neither team gets a preferred side. Unit-id parity (the other candidate
 * rule) was measured and rejected: spawn-order ids hand a whole team one
 * parity whenever teams interleave (both §42b fixtures do exactly that), and
 * any odd roster keeps a residual bias. Non-ties are untouched — nearer
 * still wins.
 */
export function sidestep(
  from: GridCoord,
  target: GridCoord,
  world: World,
  occupied: ReadonlySet<string>,
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
    if (occupied.has(key(c))) continue;
    const dist = chebyshev(c, target);
    // §45b — the PROGRESS guard: never sidestep to a cell strictly FARTHER
    // from the approach anchor than standing still. A diagonal approach makes
    // one rotation a backward step (dist+1); pre-§45b it was taken whenever
    // the other rotation was blocked, and pairs of such steps are the
    // shuttle that kept riverFork's standoff oscillation at 0.92 through
    // every §43 tie fix (286 backtracks/300t, measured). Equal-distance
    // laterals — the sidesteps that actually unlock corridor flow — remain.
    // The honest alternative to a backward crab is the queue abstain (or
    // §45b's wait when the blocker's drain is derivable).
    if (dist > chebyshev(from, target)) continue;
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Build the standard single-step move proposal. §36b — the move is NON-INSTANT:
 * `MoveAction.start` (offset 0) claims the destination + emits `unit:moved`, but
 * the unit's LOGICAL position holds at `from` until the flip. The phase timeline
 * is `travel` (the in-transit window) → a 0-length `impact` boundary (where
 * `MoveAction.applyEffect` flips `position` to `to` and releases the claim) →
 * `recovery` (the post-flip lockout tail). The flip lands at offset `floor(
 * durationTicks * SIM.moveFlipFraction)` — 50%, so a slow unit reads as still
 * mostly on its prior tile for the first half. `floor` keeps a 1-tick move
 * instant (impact at offset 0) + byte-identical to the pre-§36b model. The unit
 * stays busy for the full `durationTicks` either way (Σ phase ticks). Score
 * defaults to 1 (movement is the lowest-priority proposal); callers that need a
 * higher movement priority (the healer's panic-retreat at 5) pass it.
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
 * M6 — water bog-down, the move-DURATION half. Scales a normal step's lockout +
 * render-lerp window by the TileGrid cost to ENTER `dest` (1 floor, 2 shallow
 * water), so a unit genuinely WADES at the cost-2 cadence. Until M6 the tile
 * cost only weighted A* route SELECTION (`costAt` → `findPath`), never how long
 * the step took — so a unit forced through water still crossed it at full
 * speed (the gap the playtest caught). Floor cost 1 → `base` unchanged
 * (byte-identical on water-free boards); water cost 2 → 2× the move cooldown. A
 * committed step destination is always passable, so the cost is finite. Rounded
 * to whole ticks. Pairs with the `World.applyDamage` precision penalty (the
 * "miss more" half) for the full "slow + miss more" water effect.
 */
export function stepDurationTicks(world: World, dest: GridCoord, base: number): number {
  return Math.round(base * world.tileGrid.costAt(dest));
}

/**
 * Penalty added (on top of tile cost) for routing through a soft-blocked cell
 * — the soft-block knob, §45a split into tiers by WHEN the cell will actually
 * hold a body at the pather's arrival (estimate: Chebyshev distance from
 * `from` × the pather's own step ticks; the window slack is
 * `vacancyWindowOwnSteps` more of those steps):
 *
 *   1. **Claimed, flip inside the window** (`inboundClaimPenalty`, > static) —
 *      an in-flight mover lands there right around when the pather would:
 *      the convergence-risk case, priced ABOVE a body (the §45 charter's
 *      "a claim into the unit's path"). Also the fallback when the flip ETA
 *      can't be derived (timing unknown = assume the worst).
 *   2. **Claimed, flip long done by arrival** (`occupiedCellPenalty`) — by
 *      then it's just a body standing there, today's flat +4. This is half of
 *      what lets a corridor column drain: the leader's NEXT cell no longer
 *      reads worse than the leader itself.
 *   3. **Vacating in time** (`vacatingCellPenalty`, near-zero) — the
 *      occupant's own in-flight move flips it vacant within the window. The
 *      other half of the corridor fix: the lane ahead is cheap because it's
 *      draining.
 *   4. **Static occupant** (`occupiedCellPenalty`) — a body with no in-flight
 *      move; the pre-§45a flat +4, unchanged.
 *
 * A* detours around a soft cell only when the detour costs less than its
 * penalty, and routes *through* it (→ step-collision abstain / E5.B sidestep /
 * §45b wait) otherwise. Route SELECTION only: the step-commit collision check
 * and the §35b execution gate stay strict whatever these dials say. Walls +
 * half-cover never reach here (hard `blockers` in `findPath`). Every tier
 * stays finite and >= 0 so total cost stays >= 1 and the Chebyshev heuristic
 * stays admissible (gotcha #34). All tiers + the window are tunable in
 * `config/sim.json`.
 *
 * The arrival estimate is a LOWER bound (real routes bend, terrain slows), so
 * it errs toward "I'll be there sooner than I will": the vacating discount
 * stays conservative near the pather, and the claim premium window stays wide.
 */
export function costAt(
  c: GridCoord,
  world: World,
  cost: PathCostContext,
  from: GridCoord,
): number {
  const tileCost = world.tileGrid.costAt(c);
  if (!isFinite(tileCost)) return tileCost;
  const k = key(c);
  const arrivalSteps = chebyshev(from, c);
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

// §35 — `key`/`chebyshev` now live in the occupancy core (`cellKey`/
// `distanceBetween`); re-exported here so the movement consumers
// (MovementBehavior, SupportMovementBehavior, the propose tests) keep their
// existing imports while the single definition lives in one place.
export const key = cellKey;
export const chebyshev = distanceBetween;
