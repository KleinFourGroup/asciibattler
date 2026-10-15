/**
 * Positioning: where a unit should be against its target. The behaviours keep
 * the decision (what to propose, which `MoveDecisionKind` to emit) and ask
 * this module everything spatial: the firing band, the line-of-sight gate,
 * the minimum-range kite, the acting-cell goals, and the shared step
 * primitives.
 *
 * ## The engagement protocol
 *
 * A unit engaging a committed target resolves its movement in this order
 * (`engagementDirective`):
 *
 * 1. Hold in the firing band. The band test is the shared predicate
 *    `firingBandCell`: in `[minRange, attackRange]` of, and for a
 *    sight-gated ability with a clear line to, any cell of the target's
 *    body. It is checked against the target's position and against its
 *    claimed destination, so a target arriving into the band is waited for
 *    rather than stepped around. The abilities' strike gates
 *    (`effects/propose.ts`, `EffectAction`) test through the same predicate:
 *    the hold and the strike must agree about "in range", or a unit holds
 *    in band while its strike says out of range, and freezes. A unit with a
 *    sight-ignoring ability (the catapult) holds on range alone, as it lobs
 *    over walls; a sight-gated unit keeps moving for a clear shot instead of
 *    freezing behind a wall.
 *
 * 2. Approach an inert target (rubble, a destructible wall or cover) best
 *    effort. It is a hard blocker (`excludeUnitId` softens only a mobile
 *    unit), so the unit routes as close as it can toward its corner, and the
 *    hold above fires the strike once the unit is within reach of the body.
 *
 * 3. The firing cell first, the target's cell as the fallback. A ranged
 *    unit (attack range above 1) prefers the nearest cell it can shoot from
 *    (`nearestActingCell`: in band and, if sight-gated, with a line), so it
 *    holds at standoff with a clear shot rather than creeping into melee, or
 *    steps round a wall that breaks the line. The goals always end with the
 *    target's own cell, so when the firing cell yields no step (none
 *    reachable within the search, or the step to it blocked at a choke)
 *    `advance` falls through to charging, and the choke drains; a single
 *    goal that is a wall or an ally freezes the unit. The target is left
 *    out of the soft cells (`excludeUnitId`), so a path to its cell exists,
 *    and the hold stops the unit a cell short of it.
 *
 * 4. The minimum-range kite. Too close (body distance inside the minimum
 *    range), the target's cell is left out of the goals: charging is the
 *    opposite of a kite, and with the retreat blocked (walls stop the
 *    sidestep, an ally fills the cell behind) it would walk the kiter onto
 *    the excluded target's own cell. A pinned kiter, with no reachable
 *    firing cell either, gets no goals, and the behaviour abstains.
 *
 * Distances are body to body throughout: `unitDistance` for the kite,
 * `firingBandCell` per body cell for the band. Line-of-sight occluders cover
 * a large body whole.
 */

import type { GridCoord } from '../core/types';
import { isInertNeutral, type Unit } from './Unit';
import type { World } from './World';
import type { MovementIntent } from './movement';
// No import from './archetypes' here: this module is evaluated inside the
// `config/units` cycle (config/units → abilities/registry → the effects layer
// → here), and archetypes.ts reads the catalog at evaluation
// (`CONFIGS = UNIT_DEFS`, `ALL_ARCHETYPES`), which fails mid-cycle (gotcha
// #114). So `engagementDirective` takes `minRange` as a parameter, and the
// behaviours, outside the cycle, resolve it.
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

/** The eight grid neighbours, in a fixed order, so a candidate scan is
 *  deterministic. The one copy. */
export const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * Neutral units whose `blocksLineOfSight` is true (walls, rubble), every cell
 * of a body: the occluders the re-target check (`Targeting`) and the
 * abilities' shot gates (`effects/propose.ts`, `EffectAction`) read, and the
 * set `engagementDirective` builds for the hold. Half cover
 * (`blocksLineOfSight: false`) blocks movement and not sight.
 *
 * Camp members are included on purpose: a unit spawns with
 * `blocksLineOfSight` true by default, so a camp member's body occludes a
 * shot as rubble does. A ray's endpoints never block, so a hostile camp
 * member can still be shot; its body shadows only the cells behind it.
 */
export function collectLosBlockers(world: World): GridCoord[] {
  const blockers: GridCoord[] = [];
  for (const u of world.units) {
    if (u.team === 'neutral' && u.blocksLineOfSight) blockers.push(...cellsOccupiedBy(u));
  }
  return blockers;
}

/**
 * The shared firing-band and line-of-sight gate: the first cell of `target`'s
 * body (anchored at `anchor`, its position, or its claimed destination for
 * the hold on an arriving target) within `[minRange, maxRange]` of `from`
 * and, unless `losBlockers` is null (a sight-ignoring lob), with a clear
 * Bresenham line from `from`. Undefined when no body cell qualifies.
 *
 * This one predicate keeps the strike gates (`effects/propose.ts`,
 * `EffectAction`) and the hold (`engagementDirective`) in agreement: a unit
 * freezes when the two disagree about "in range", so a new range gate goes
 * through here rather than testing again. Against a large body, any cell
 * counts: a melee unit flush against the far side of a 3×3 rubble is in band
 * through the cell beside it (an adjacent ray; endpoints never block), though
 * the ray to the corner would cross the body. `losBlockers` may hold the
 * target's own cells (it does for rubble, since `collectLosBlockers` takes
 * every opaque neutral); its far cells are hidden behind its near ones,
 * which is right, and the near visible cell passes the gate.
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

/** Whether the unit carries a sight-ignoring ability (the catapult's arcing
 *  shot, `raise_dead`): its band tests run on range alone. */
function unitIgnoresLos(unit: Unit): boolean {
  return unit.abilities.some((a) => a.ignoresLineOfSight === true);
}

/**
 * The engagement directive — what the positioning protocol says a unit should
 * do about its committed target this poll (the WHERE half of the decision; the
 * behavior maps it onto proposals + `MoveDecisionKind`s):
 *
 *   - `hold` — in the firing band (step 1): stay, and let the ability fire.
 *   - `approach` — path by the carried `MovementIntent` (steps 2 and 3): the
 *     best-effort approach to an inert target, or the firing cell then the
 *     target's cell.
 *   - `pinned` — the pinned kiter (step 4): too close, no reachable firing
 *     cell, and no charge; nothing to do but abstain.
 */
type EngagementDirective =
  | { kind: 'hold' }
  | { kind: 'approach'; intent: MovementIntent }
  | { kind: 'pinned' };

/**
 * The protocol (steps 1 to 4 above) for `unit` against its committed
 * `target`. Spatial only: no events, proposals or cooldowns, and the same
 * inputs always give the same directive. `minRange` is the unit's firing
 * floor (`minRangeForArchetype`), passed by the caller, since this module
 * must not import it (the note at the imports).
 */
export function engagementDirective(
  unit: Unit,
  world: World,
  target: Unit,
  minRange: number,
): EngagementDirective {
  // The occluders for the hold and the firing-cell search, every cell of a
  // body; blocking movement is `advance`'s, so this set is for sight only. It
  // is `collectLosBlockers` less the unit itself, which only a camp member
  // could be, and a ray's start never blocks anyway.
  const losBlockers: GridCoord[] = [];
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    if (u.team === 'neutral' && u.blocksLineOfSight) losBlockers.push(...cellsOccupiedBy(u));
  }

  const ignoresLos = unitIgnoresLos(unit);
  // Hold only in the band [minRange, attackRange]. Too far: close in. Too
  // close: don't hold; fall through and kite out to the band. Body to body,
  // the strike gate's measure.
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
  // Hold in the band of the target's position (strike it now) or of its
  // claimed destination (it is arriving). The strike still lands only once
  // the target's position is in range; this hold only waits for the arrival,
  // so the pursuer doesn't thrash a cell short.
  const targetClaim = claimedDestinationOf(world, target.id);
  if (inFiringBand(target.position) || (targetClaim !== undefined && inFiringBand(targetClaim))) {
    return { kind: 'hold' };
  }

  // Step 2, an inert target only: a camp member is a mobile target and gets
  // the firing-cell and kite steps below, so a ranged unit kites a hostile
  // bandit rather than charging its corner as it would rubble's.
  if (isInertNeutral(target)) {
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

  // Step 3: the firing cell (ranged only, when one is found), then the
  // target's own cell; step 4: the kite leaves the charge out.
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
  // (`dist >= minRange` always holds for melee, at minimum range 0, and for a
  // unit too far, so the charge is left out only for the kiter too close.)
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

/** In bounds, of finite tile cost, and not in `occupied`, the caller's key
 *  set: whether claims are in it is the caller's choice. The one copy of the
 *  step's passability test. */
export function passable(c: GridCoord, world: World, occupied: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  if (occupied.has(cellKey(c))) return false;
  return true;
}

/** How many of `c`'s 8 neighbors are `passable` — the open-space tie-breaker
 *  the retreat step prefers (back away toward room, not into a pocket). */
function countOpenNeighbors(
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
 * The one-cell retreat: the neighbour of `from` that strictly increases the
 * Chebyshev distance from `anchor` (a step sideways or closer is no
 * retreat), ties toward open space (`countOpenNeighbors`), then the fixed
 * `NEIGHBORS` order. Null when boxed in (a corner, a one-wide corridor), and
 * the caller holds. Pure, given the occupied set.
 *
 * Shared by `effects/reposition.retreatCell` (the effect's retreat and the
 * flee; it folds claims into its set, since an effect's reposition is
 * instant and skips the selector's destination check) and the healer's
 * `stepAwayFrom` in `SupportMovementBehavior` (occupancy only, since its
 * move is checked as it runs). Each caller chooses its set; only the
 * geometry is here.
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
