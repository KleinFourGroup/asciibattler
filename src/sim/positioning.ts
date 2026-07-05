/**
 * §44a — positioning: the WHERE knowledge of the engagement protocol, extracted
 * from MovementBehavior + SupportMovementBehavior (a behavior-NEUTRAL
 * relocation; world bytes unchanged). The behaviors keep the DECISION plumbing
 * — what to propose, which `MoveDecisionKind` to emit — and consult this module
 * for everything spatial: the firing band, the LOS gate, the minRange kite, the
 * acting-cell goal list, and the shared leaf step primitives.
 *
 * ## The engagement-positioning protocol (carved from MovementBehavior's docs)
 *
 * A unit engaging a committed target resolves its movement in this order
 * (`engagementDirective`):
 *
 * 1. **Hold when in the firing band.** The band test is the SHARED
 *    footprint-aware predicate (`firingBandCell`, 44-pre-c) — in
 *    `[minRange, attackRange]` of, and (for LOS-gated abilities) with a clear
 *    line to, ANY cell of the target's body. It is checked against the
 *    target's logical position AND its §36b claimed destination (the target is
 *    ARRIVING into the band — hold for it rather than sidestepping around its
 *    reservation, the corridor kite-pin the claim would otherwise trip). The
 *    strike gates (`effects/propose.ts`) fire through the SAME predicate:
 *    the hold and the strike must agree about "in range" or the GP4/Qb#3
 *    freeze class returns (hold says in-band, strike says out-of-range →
 *    deadlock). EXCEPTION (E7.D): a unit carrying an LOS-ignoring ability
 *    (the catapult) holds on range alone — it lobs over walls, nothing to
 *    path around; LOS-gated units keep pathing for a clear shot instead of
 *    freezing behind a wall.
 *
 * 2. **A committed rubble (destructible neutral) is approached bestEffort.**
 *    §40b — rubble is a HARD path-blocker (`excludeUnitId` softens only
 *    non-neutral cells), so the unit routes AS CLOSE AS POSSIBLE toward its
 *    corner — the J3 tile-rally shape — and the in-band hold above fires the
 *    strike the moment the unit is body-adjacent (true since 44-pre-c).
 *
 * 3. **Firing cell first, target cell as fallback.** A ranged unit
 *    (attackRange > 1) prefers the nearest cell it can actually shoot from —
 *    `nearestActingCell`: in the band AND (for LOS-gated abilities) with line
 *    of sight — so it holds at standoff with a clear shot rather than creeping
 *    into melee, or sidesteps a wall that breaks LOS. The goal list ALWAYS
 *    ends with the target's own cell, so when the firing-cell approach can't
 *    produce a move — no firing cell reachable within the cap, OR the step
 *    toward one is blocked (a contested cell in a chokepoint) — `advance`
 *    falls through to charging the target and drains the chokepoint. This is
 *    the load-bearing anti-freeze guarantee; the earlier `pickGoalCellInRange`
 *    heuristic froze when its single in-range goal was a wall/ally
 *    (→ findPath []). The target is excluded from the soft-block set
 *    (`excludeUnitId`) so findPath always has a reachable goal; the in-band
 *    hold stops the unit a cell short of actually stepping onto it.
 *
 * 4. **The minRange kite (O4/Qb#3).** Too CLOSE (body distance inside
 *    minRange) the target-cell fallback is OMITTED: it is the opposite of the
 *    kite's intent, and with the retreat blocked (a corridor pin: walls kill
 *    the sidestep, an ally fills the back-step) it would walk the kiter
 *    straight ONTO the soft-excluded target's cell — a same-cell overlap. A
 *    pinned kiter (no reachable firing cell either) yields an EMPTY goal list
 *    → the behavior abstains/queues rather than charging.
 *
 * Distances are footprint-aware throughout (44-pre-c): `unitDistance`
 * body-to-body for the kite decision, `firingBandCell` per body cell for the
 * band. LOS occluders cover multi-tile bodies whole (43-pre-b).
 */

import type { GridCoord } from '../core/types';
import type { Unit } from './Unit';
import type { World } from './World';
import type { MovementIntent } from './movement';
// ⚠ NO import from './archetypes' here — this module is evaluated INSIDE the
// `config/units` module-eval cycle (config/units → abilities/registry → the
// effects layer → here), and archetypes.ts does EVAL-time catalog reads
// (`CONFIGS = UNIT_DEFS`, `ALL_ARCHETYPES`) that explode mid-cycle (gotcha
// #114's module-eval cousin). That is why `engagementDirective` takes
// `minRange` as a PARAMETER instead of calling `minRangeForArchetype` itself —
// the behaviors (outside the cycle) resolve it.
import { SIM } from '../config/sim';
import { hasLineOfSight } from './LineOfSight';
import { nearestActingCell } from './actingPosition';
import {
  cellKey,
  cellsOccupiedBy,
  claimedDestinationOf,
  distanceBetween,
  footprintCells,
  footprintOf,
  unitDistance,
} from './occupancy';

/** The 8 grid neighbors, in a fixed order for deterministic candidate scans —
 *  THE shared copy (was triplicated across MovementBehavior /
 *  SupportMovementBehavior / effects/reposition). */
export const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * Neutral units (walls, rubble) whose `blocksLineOfSight` is true — the
 * LOS-occluder pool shared by the ranged re-target check (`Targeting`), the
 * strike abilities' shot gate (`effects/propose.ts`), and the movement hold.
 * Half-cover (`blocksLineOfSight: false`) is deliberately excluded: it blocks
 * movement but not sight (D6). 43-pre-b — the WHOLE footprint
 * (`cellsOccupiedBy`), not just the §39 corner: corner-only, shots passed
 * through a multi-tile rubble's body.
 */
export function collectLosBlockers(world: World): GridCoord[] {
  const blockers: GridCoord[] = [];
  for (const u of world.units) {
    if (u.team === 'neutral' && u.blocksLineOfSight) blockers.push(...cellsOccupiedBy(u));
  }
  return blockers;
}

/**
 * E4 — half-cover positions: neutral units whose `blocksLineOfSight` is `false`.
 * Symmetric to `collectLosBlockers` but for the OTHER half of the neutral-team
 * population. A shot that crosses one lands at `LEVELING.halfCoverDamageMult`.
 * 43-pre-b — full footprints, same class as `collectLosBlockers` (pure
 * future-proofing: no shipped multi-tile def has `blocksLineOfSight: false`).
 */
export function collectHalfCoverPositions(world: World): GridCoord[] {
  const out: GridCoord[] = [];
  for (const u of world.units) {
    if (u.team === 'neutral' && !u.blocksLineOfSight) out.push(...cellsOccupiedBy(u));
  }
  return out;
}

/**
 * 44-pre-c — THE shared firing-band + LOS gate, footprint-aware: the first cell
 * of `target`'s body (anchored at `anchor` — its logical position, or its §36b
 * claimed destination for the movement hold's arriving-target case) that sits in
 * `[minRange, maxRange]` of `from` AND — unless `losBlockers` is null (an
 * LOS-ignoring lob, E7.D) — has a clear Bresenham line from `from`. Returns
 * `undefined` when no body cell qualifies.
 *
 * This ONE predicate is what keeps the strike gates (`effects/propose.ts`) and
 * the movement hold (`engagementDirective` above) in agreement — the GP4/Qb#3
 * freeze class IS the two layers disagreeing about "in range", so any future
 * range-gate must route through here rather than re-deriving the test. For a
 * 1×1 target this is exactly the old corner test (band first, then LOS),
 * byte-identical for the whole combatant roster. Against a multi-tile body the
 * ∃-cell shape matters: a melee unit flush against the FAR side of a 3×3 rubble
 * is in band via the near body cell (adjacent ray — endpoints are never
 * blockers), even though the ray to the §39 corner would thread the body.
 * `losBlockers` may include the target's own footprint (it does, for rubble —
 * `collectLosBlockers` collects all neutrals); self-occlusion of FAR body cells
 * is correct, the near visible cell carries the gate.
 */
export function firingBandCell(
  from: GridCoord,
  target: Unit,
  anchor: GridCoord,
  minRange: number,
  maxRange: number,
  losBlockers: readonly GridCoord[] | null,
): GridCoord | undefined {
  for (const c of footprintCells(anchor, footprintOf(target))) {
    const d = distanceBetween(from, c);
    if (d < minRange || d > maxRange) continue;
    if (losBlockers === null || hasLineOfSight(from, c, losBlockers)) return c;
  }
  return undefined;
}

/** E7.D — whether the unit carries an LOS-ignoring ability (the catapult's
 *  arcing shot): its band tests run on range alone. */
export function unitIgnoresLos(unit: Unit): boolean {
  return unit.abilities.some((a) => a.ignoresLineOfSight === true);
}

/**
 * The engagement directive — what the positioning protocol says a unit should
 * do about its committed target this poll (the WHERE half of the decision; the
 * behavior maps it onto proposals + `MoveDecisionKind`s):
 *
 *   - `hold`     — in the firing band (protocol step 1): stay put and let the
 *                  ability fire.
 *   - `approach` — path per the carried `MovementIntent` (steps 2–3): the
 *                  neutral bestEffort approach, or the firing-cell/target goal
 *                  list.
 *   - `pinned`   — the Qb#3 pinned-kiter shape (step 4): too close with no
 *                  reachable firing cell and the charge fallback off — nothing
 *                  sane to do but abstain/queue.
 */
export type EngagementDirective =
  | { kind: 'hold' }
  | { kind: 'approach'; intent: MovementIntent }
  | { kind: 'pinned' };

/**
 * Resolve the protocol (steps 1–4 in the module docs) for `unit` against its
 * committed `target`. Pure spatial knowledge — no events, no proposals, no
 * cooldowns; same inputs always yield the same directive. `minRange` is the
 * unit's O4 firing floor (`minRangeForArchetype(unit.archetype)`), passed by
 * the caller — see the import note at the top for why this module must not
 * resolve it itself.
 */
export function engagementDirective(
  unit: Unit,
  world: World,
  target: Unit,
  minRange: number,
): EngagementDirective {
  // LOS occluders for the in-band hold + the firing-cell search: neutral
  // walls that block sight (half-cover is `blocksLineOfSight: false` — D6 —
  // so it path-blocks but doesn't break LOS). Path-blocking is handled inside
  // `advance` (all neutrals), so this set is LOS-only.
  // 43-pre-b — the WHOLE footprint (`cellsOccupiedBy`), not just the §39
  // corner. (Equivalent to `collectLosBlockers` — the self-exclusion below can
  // never fire for a combatant — kept verbatim from the relocation.)
  const losBlockers: GridCoord[] = [];
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    if (u.team === 'neutral' && u.blocksLineOfSight) losBlockers.push(...cellsOccupiedBy(u));
  }

  const ignoresLos = unitIgnoresLos(unit);
  // O4 — hold only when the target is in the firing BAND [minRange,
  // attackRange]. Too FAR → close in. Too CLOSE (inside minRange) → DON'T
  // hold, fall through and KITE out to the band.
  // 44-pre-c — footprint distance (body-to-body), matching the strike gate's
  // measure: too-close/too-far is judged against a multi-tile target's BODY,
  // not its §39 corner. 1×1 targets byte-identical.
  const dist = unitDistance(unit, target);
  // The band test against the target's body anchored at `at` (protocol step 1).
  const inFiringBand = (at: GridCoord): boolean =>
    firingBandCell(
      unit.position,
      target,
      at,
      minRange,
      unit.derived.attackRange,
      ignoresLos ? null : losBlockers,
    ) !== undefined;
  // §36b — hold when in the band against the target's logical position (strike
  // it NOW) OR its in-flight CLAIMED destination (it is ARRIVING into the
  // band). The attack itself still lands only once the target's LOGICAL
  // position is in range (the §36 lock); this is a locomotion-only "wait for
  // the arrival" so the pursuer doesn't thrash a cell short.
  const targetClaim = claimedDestinationOf(world, target.id);
  if (inFiringBand(target.position) || (targetClaim !== undefined && inFiringBand(targetClaim))) {
    return { kind: 'hold' };
  }

  // Protocol step 2 — the §40b bestEffort rubble approach.
  if (target.team === 'neutral') {
    return {
      kind: 'approach',
      intent: {
        goals: [target.position],
        approachToward: target.position,
        maxCells: 1,
        bestEffort: true,
      },
    };
  }

  // Protocol step 3 — firing cell (ranged only, when reachable) then the
  // target's own cell; step 4 — the kite omits the charge fallback.
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
  // (`dist >= minRange` is always true for melee [minRange 0] and the too-far
  // approach, so the omission bites only for the blocked kiter — Qb#3.)
  if (dist >= minRange) goals.push(target.position);

  if (goals.length === 0) return { kind: 'pinned' };

  return {
    kind: 'approach',
    intent: {
      goals,
      approachToward: target.position,
      excludeUnitId: target.id,
      maxCells: 1,
    },
  };
}

/** In-bounds, finite tile cost, and not in `occupied` (the caller-built cell-key
 *  set — occupancy semantics, claims folded or not, are the CALLER's choice;
 *  see 44-pre-a). THE shared copy of the leaf passability test. */
export function passable(c: GridCoord, world: World, occupied: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  if (occupied.has(cellKey(c))) return false;
  return true;
}

/** How many of `c`'s 8 neighbors are `passable` — the open-space tie-breaker
 *  the retreat step prefers (back away toward room, not into a pocket). */
export function countOpenNeighbors(
  c: GridCoord,
  world: World,
  occupied: ReadonlySet<string>,
): number {
  let n = 0;
  for (const [dx, dy] of NEIGHBORS) {
    if (passable({ x: c.x + dx, y: c.y + dy }, world, occupied)) n++;
  }
  return n;
}

/**
 * The conservative one-cell retreat: the neighbor of `from` that STRICTLY
 * increases Chebyshev distance from `anchor` (a sideways / closer step never
 * reads as a "retreat"), tie-broken toward open space (`countOpenNeighbors`),
 * then fixed `NEIGHBORS` order for determinism. Null when boxed in (corner /
 * 1-wide corridor) — the caller then holds. Pure given the occupied set.
 *
 * THE shared core of the two retreat twins (was duplicated verbatim):
 * `effects/reposition.retreatCell` (the gambit dart-back — folds CLAIMS into
 * its set, its instant reposition bypasses the §35b selector gate) and
 * `SupportMovementBehavior.stepAwayFrom` (the healer panic step — plain
 * occupancy, its MoveAction proposal is §35b-guarded). The occupancy semantics
 * stay at the callers; only the geometry lives here.
 */
export function awayStep(
  from: GridCoord,
  anchor: GridCoord,
  world: World,
  occupied: ReadonlySet<string>,
): GridCoord | null {
  const currentDist = distanceBetween(from, anchor);
  let best: GridCoord | null = null;
  let bestDist = -1;
  let bestOpenness = -1;
  for (const [dx, dy] of NEIGHBORS) {
    const c: GridCoord = { x: from.x + dx, y: from.y + dy };
    if (!passable(c, world, occupied)) continue;
    const dist = distanceBetween(c, anchor);
    if (dist <= currentDist) continue;
    const openness = countOpenNeighbors(c, world, occupied);
    if (dist > bestDist || (dist === bestDist && openness > bestOpenness)) {
      best = c;
      bestDist = dist;
      bestOpenness = openness;
    }
  }
  return best;
}
