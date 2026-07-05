import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';
import type { ActionProposal } from './Action';
import { MoveAction } from './actions/MoveAction';
import { findPath } from './Pathfinding';
import {
  GROUND,
  cellKey,
  cellsOccupiedBy,
  claimedCells,
  distanceBetween,
  footprintOf,
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
 */
export interface MovementContext {
  readonly pathBlockers: GridCoord[];
  readonly otherUnitCells: Set<string>;
  readonly occupied: Set<string>;
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
  for (const u of world.units) {
    if (u.id === unit.id) continue;
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
      }
    }
  }
  // §36a — a cell CLAIMED by another in-flight mover is blocked-for-pathing just
  // like an occupied cell (occupied OR claimed): fold it into BOTH the soft-cost
  // set (so A* routes around it) and the sidestep occupancy set (so a sidestep
  // never lands on it). Skip the building unit's own claims — it may step into
  // what it reserved. Inert today (no persistent claims on the instant model);
  // load-bearing once §36b defers the position flip and a claim outlives its tick.
  for (const key of claimedCells(world, GROUND, { excludeId: unit.id })) {
    occupied.add(key);
    otherUnitCells.add(key);
  }
  return { pathBlockers, otherUnitCells, occupied };
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
    (c) => costAt(c, world, ctx.otherUnitCells),
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
 * on a step, and on a full abstain `queue` when ANY goal attempt was blocked
 * by a unit (a route existed; a body was in the way) vs `no_route` when none
 * was. Emits nothing on an empty goal list (the caller owns that decision —
 * the Qb#3 `pinned` shape), so the one-decision-per-poll invariant holds.
 */
export function advance(unit: Unit, world: World, intent: MovementIntent): ActionProposal | null {
  const ctx = buildMovementContext(unit, world, { excludeUnitId: intent.excludeUnitId });
  const from = unit.position;
  const baseTicks = unit.derived.moveCooldownTicks;
  const footprint = footprintOf(unit); // §39b — path a wider body through wider gaps.
  let sawBlocked = false;
  for (const goal of intent.goals) {
    const outcome = stepAlongRoute(from, goal, ctx, world, intent, baseTicks, footprint);
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
 * §42a — a goal attempt's outcome. `blocked` = a route existed but a unit
 * stood in the way and no sidestep committed (the aggregate `queue` signal);
 * `no_route` = A* found nothing (or the unit already sits on the goal). The
 * step kinds feed the `unit:moveDecision` record in `advance`.
 */
type StepOutcome =
  | { proposal: ActionProposal; kind: 'advance' | 'sidestep' }
  | 'blocked'
  | 'no_route';

/**
 * One A* route toward `goal`, then commit the step(s) per `intent.maxCells`:
 *
 *   - `maxCells <= 1` (the default step): take `path[1]`. If that cell is
 *     occupied by another unit, try a perpendicular E5.B sidestep toward
 *     `approachToward` before giving up (unless `sidestepWhenBlocked` is
 *     false). Byte-identical to pre-J2 `MovementBehavior`/tile pursuit.
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
  const path = routeToward(from, goal, ctx, world, intent.bestEffort ?? false, footprint);
  if (path.length < 2) return 'no_route';

  if (intent.maxCells <= 1) {
    const to = path[1]!;
    if (ctx.otherUnitCells.has(key(to))) {
      if (intent.sidestepWhenBlocked === false) return 'blocked';
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
 * E5.B — one-cell perpendicular sidestep toward `target`, used when the
 * A*-chosen next step is occupied by another unit. Considers exactly the two
 * cells perpendicular to the unit→target direction (per the E5 decision point:
 * 2 candidates, not 3 — back-step-forward is what the cost gradient already
 * does). Keeps only in-bounds, finite-cost, unoccupied cells, and returns the
 * one closest to the target (Chebyshev). Returns null when neither is viable,
 * so the caller abstains and corridor queueing still emerges.
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
 * Penalty added (on top of tile cost) for routing through a cell occupied by
 * another *unit* (ally or non-target enemy) — the soft-block knob. A* detours
 * around an occupied cell only when the detour costs less than the penalty,
 * and routes *through* it (→ step-collision abstain / E5.B sidestep)
 * otherwise. Walls + half-cover never reach here (hard `blockers` in
 * `findPath`). Stays finite and >= 0 so total cost stays >= 1 and the
 * Chebyshev heuristic stays admissible (gotcha #34). Tunable in
 * `config/sim.json`.
 */
export function costAt(c: GridCoord, world: World, occupied: ReadonlySet<string>): number {
  const tileCost = world.tileGrid.costAt(c);
  if (!isFinite(tileCost)) return tileCost;
  if (occupied.has(key(c))) return tileCost + SIM.occupiedCellPenalty;
  return tileCost;
}

// §35 — `key`/`chebyshev` now live in the occupancy core (`cellKey`/
// `distanceBetween`); re-exported here so the movement consumers
// (MovementBehavior, SupportMovementBehavior, the propose tests) keep their
// existing imports while the single definition lives in one place.
export const key = cellKey;
export const chebyshev = distanceBetween;
