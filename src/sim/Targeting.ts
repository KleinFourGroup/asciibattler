import { isInertNeutral, type Unit } from './Unit';
import type { World } from './World';
import type { ObjectiveTarget } from './objective';
import { hasLineOfSight } from './LineOfSight';
import { SIM } from '../config/sim';
import { UNIT_DEFS, isDestructibleNeutral, isAutoTargetNeutral } from '../config/units';
import { getTargetingStrategy } from './targetingStrategies';
import { behaviorFlags } from './statusBehavior';
import { buildMovementContext, chebyshev, costAt, routeToward } from './movement';
import { findPath } from './Pathfinding';
import { collectLosBlockers } from './positioning';
import { cellIndex, cellsOccupiedBy, footprintOf, unitDistance, cellUnitDistance } from './occupancy';

/**
 * The best hostile of `unit` (`hostileCandidate`) by its targeting strategy
 * (`unit.targeting`, from the archetype; `targetingStrategies.ts`). Null is
 * a normal outcome: no target, and the unit idles this tick.
 *
 * Pure: the same `(unit, world.units)` always yields the same answer. This
 * is the raw pick; stickiness sits on top (`updateTarget`,
 * `currentTarget`).
 */
export function findTarget(unit: Unit, world: World): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;

  for (const candidate of world.units) {
    if (!hostileCandidate(unit, candidate, world)) continue;

    if (best === null || strategy.compare(candidate, best, unit, world) < 0) {
      best = candidate;
    }
  }
  return best;
}

/**
 * The one admit rule every hostile scan runs (`findTarget`, the sticky
 * check, the engage, in-range and reachable scans, `MovementBehavior`'s
 * flee anchor): may `unit` treat `candidate` as a combat hostile?
 *
 * - A combatant and a combatant: on opposing teams.
 * - A combatant and an active neutral: only once the candidate's camp is
 *   hostile to the seeker's team. A passive camp is scenery to targeting;
 *   a blow on a member (`World.dealDamage`) makes it hostile to the
 *   striker's team. An ordered target on a passive camp is honoured by
 *   `currentTarget`, not admitted here.
 * - An active neutral as the seeker: only the teams its camp is hostile to.
 * - Inert neutrals: never, either way.
 *
 * Camp against camp is out: hostility is per team, and a neutral's blow
 * marks nothing (`dealDamage`), so `'neutral'` never enters a camp's
 * `hostileTo`.
 */
export function hostileCandidate(unit: Unit, candidate: Unit, world: World): boolean {
  if (candidate.id === unit.id || candidate.currentHp <= 0) return false;
  if (unit.team === 'neutral') {
    // Only an active neutral seeks (inert scenery never targets), and only
    // the factions its camp has been marked hostile to.
    return (
      unit.campId !== null &&
      candidate.team !== 'neutral' &&
      world.campHostileTo(unit.campId, candidate.team)
    );
  }
  if (candidate.team === unit.team) return false;
  if (candidate.team === 'neutral') {
    return candidate.campId !== null && world.campHostileTo(candidate.campId, unit.team);
  }
  return true;
}

/**
 * Target stickiness. Called once per free unit by `World.tick`, before the
 * behaviours poll, so the re-target decision and `outOfLosTicks` move once a
 * tick, never twice from two behaviours resolving a target.
 *
 * A committed unit keeps its target until one of:
 *   (a) the target is dead, gone or no longer a valid hostile: re-pick by
 *       the unit's strategy at once;
 *   (b) the strategy's fresh pick is markedly better
 *       (`strategy.shouldRetarget`): for `nearest`, markedly closer
 *       (`SIM.retargetCloserRatio`);
 *   (c) for an archetype with `retargetOnLosLoss`, the target has been out
 *       of line of sight for `SIM.rangedRetargetLosTicks`: stop chasing a
 *       target behind a wall and re-pick.
 *
 * Inert neutrals and passive camp members never target and return at once.
 */
export function updateTarget(unit: Unit, world: World): void {
  if (unit.team === 'neutral') {
    // An active neutral whose camp is hostile to someone acquires targets:
    // `objectiveFor('neutral')` is always `atWill`, so it takes the default
    // sticky path below, and `hostileCandidate` keeps its picks to the teams
    // its camp is hostile to.
    const camp = unit.campId !== null ? world.campById(unit.campId) : undefined;
    if (camp === undefined || camp.hostileTo.size === 0) return;
  }

  // A behaviour status takes over acquisition ahead of the team's objective:
  // a confused or blinded unit no longer follows orders. Read off the unit's
  // effects, so it adds no serialized state.
  const behavior = behaviorFlags(unit.effects);
  if (behavior.targeting === 'random') {
    updateConfusedTarget(unit, world, behavior.acquisitionRange);
    return;
  }
  if (behavior.acquisitionRange !== null) {
    // blind — acquire only the nearest enemy inside the capped reach (else idle).
    const inRange = findInRangeEnemy(unit, world, behavior.acquisitionRange);
    unit.targetId = inRange ? inRange.id : null;
    unit.outOfLosTicks = 0;
    return;
  }

  // The acting team's objective drives its units' target choice (the modes:
  // `objective.ts`). `atWill` takes the default path at the end.
  const objective = world.objectiveFor(unit.team);
  if (objective.mode === 'engage') {
    updateObjectiveTarget(unit, world, objective.target);
    return;
  }
  if (objective.mode === 'hold') {
    // Act in place: the best hostile already within attack range. The unit
    // never moves to close (`MovementBehavior` abstains under hold), so an
    // enemy out of range is ignored, and null idles. Picked again each tick,
    // so an enemy entering range is engaged.
    const inRange = findInRangeEnemy(unit, world);
    unit.targetId = inRange ? inRange.id : null;
    unit.outOfLosTicks = 0;
    return;
  }
  if (objective.mode === 'focus') {
    updateFocusTarget(unit, world, objective.target);
    return;
  }

  updateTargetDefault(unit, world);
}

/**
 * The `atWill` target update: the sticky hostile pick, then the rubble
 * overlay.
 */
function updateTargetDefault(unit: Unit, world: World): void {
  updateStickyTarget(unit, world);
  applyRubbleAutoTarget(unit, world);
}

/**
 * The sticky hostile pick: sets `unit.targetId` to the strategy's committed
 * hostile, or null. The rubble overlay may then redirect a walled-off unit
 * onto a blocking rubble.
 */
function updateStickyTarget(unit: Unit, world: World): void {
  const committed = unit.targetId !== null ? world.findUnit(unit.targetId) : undefined;
  // The check is the admit rule: a living hostile camp member is as sticky as
  // a living enemy, since a camp's hostility is never cleared in a battle.
  const valid = committed !== undefined && hostileCandidate(unit, committed, world);

  if (!valid) {
    // (a) no valid commitment → take the strategy's best pick.
    const pick = findTarget(unit, world);
    unit.targetId = pick ? pick.id : null;
    unit.outOfLosTicks = 0;
    return;
  }

  const current = committed;
  const strategy = getTargetingStrategy(unit.targeting);
  const candidate = findTarget(unit, world);

  // (c) drop a target unseen for too long. The flag is read off the catalog
  // at call time; a camp member is a combatant archetype and reads it as any
  // unit does, and scenery never gets here.
  if (UNIT_DEFS[unit.archetype]?.retargetOnLosLoss) {
    const visible = hasLineOfSight(unit.position, current.position, collectLosBlockers(world));
    if (visible) {
      unit.outOfLosTicks = 0;
    } else if (++unit.outOfLosTicks >= SIM.rangedRetargetLosTicks) {
      unit.outOfLosTicks = 0;
      if (candidate && candidate.id !== current.id) {
        unit.targetId = candidate.id;
        return;
      }
    }
  }

  // (b) switch only when the strategy says the fresh candidate is a markedly
  // better target than the current commitment.
  if (
    candidate &&
    candidate.id !== current.id &&
    strategy.shouldRetarget(unit, current, candidate, world)
  ) {
    unit.targetId = candidate.id;
    unit.outOfLosTicks = 0;
  }
}

/**
 * The rubble overlay, after the sticky hostile pick. A unit that cannot reach
 * its committed hostile (walled off by rubble) redirects: to a hostile it can
 * reach, since a reachable hostile always outranks rubble, else to the
 * nearest approachable auto-target rubble, which it breaks to get through.
 * The sticky pick stands when its target is reachable or nothing breakable
 * is in reach.
 *
 * Gated on the board holding a living auto-target rubble (shipped layouts
 * place rubble); without one it does nothing. With one, the
 * reachability probes (`findPath`) run only for a unit that cannot reach its
 * committed target, so a normal tick pays only the presence scan.
 */
function applyRubbleAutoTarget(unit: Unit, world: World): void {
  if (!worldHasAutoTargetRubble(world)) return;
  const committed = unit.targetId !== null ? world.findUnit(unit.targetId) : undefined;
  // Committed to a hostile it can reach: keep the sticky pick. The admit
  // rule holds a hostile camp member as it does an enemy; a committed rubble
  // fails it and falls through to the re-rank.
  if (committed !== undefined && hostileCandidate(unit, committed, world) && canReach(unit, world, committed)) {
    return;
  }
  // Unreachable hostile (or none) → a reachable hostile always outranks rubble.
  const reachable = nearestReachableHostile(unit, world);
  if (reachable !== null) {
    if (unit.targetId !== reachable.id) {
      unit.targetId = reachable.id;
      unit.outOfLosTicks = 0;
    }
    return;
  }
  // No hostile reachable at all → chip the nearest approachable rubble.
  const rubble = nearestApproachableRubble(unit, world);
  if (rubble !== null && unit.targetId !== rubble.id) {
    unit.targetId = rubble.id;
    unit.outOfLosTicks = 0;
  }
  // else: nothing reachable, nothing chippable → leave the sticky pick (idle).
}

/**
 * The rubble overlay's counterpart for an ordered target (engage's pursuit,
 * and focus, on a unit or a neutral). Those branches commit the ordered mark
 * again every tick and never reach the `atWill` overlay, so a mark walled off
 * behind rubble would freeze the unit (no path, no proposal). When the
 * committed mark is a mobile target (an enemy or a camp member) the unit
 * cannot reach, it redirects onto the rubble that gates its route
 * (`routeGateRubble`) and breaks it; the next tick's commit resumes the order
 * as soon as the way opens, so a corridor with several gates is broken one
 * gate at a time, nearest first. A null gate (sealed by walls that don't
 * break, or blocked by bodies rather than rubble) keeps the mark and idles,
 * since breaking rubble off the route helps neither.
 *
 * Unlike the overlay:
 * - no re-rank to a reachable hostile: engage's first two steps already
 *   preempt, and focus preempts nothing, as an order is an order;
 * - an inert committed neutral (a focus on rubble or a destructible wall)
 *   is left alone: movement approaches it already, and a re-rank would pull
 *   a deliberate focus on far rubble onto nearer rubble.
 *
 * Cost: the presence check every tick, and at most two A* searches
 * (`canReach` and the gate's), only for an ordered unit walled off.
 */
function applyOrderedRubbleFallback(unit: Unit, world: World): void {
  if (unit.targetId === null || !worldHasAutoTargetRubble(world)) return;
  const committed = world.findUnit(unit.targetId);
  if (committed === undefined || isInertNeutral(committed)) return;
  if (canReach(unit, world, committed)) return;
  const gate = routeGateRubble(unit, world, committed);
  if (gate !== null) {
    unit.targetId = gate.id;
    unit.outOfLosTicks = 0;
  }
}

/**
 * What the gate's search adds for each auto-target rubble body cell. Any
 * finite value finds a gate, since every route there crosses rubble (one
 * without would have made `canReach` true); the premium breaks ties between
 * gated routes, preferring one far gate to several near ones, as each gate
 * is a whole fight to break. It is above every soft-cell penalty
 * (`config/sim.json`), so a queue of bodies never prices above an extra
 * gate, and finite and at least 0 (gotcha #34). A code constant, not a
 * dial: it breaks routing ties and moves no balance.
 */
const RUBBLE_ROUTE_CHIP_COST = 25;

/**
 * The auto-target rubble that gates `unit`'s way to `target`, or null when
 * none does. One A* over the unit's movement context (the same soft costs,
 * claims and terrain, `target` left out as `canReach` leaves it), with
 * auto-target rubble lifted from the hard blockers and its body cells
 * priced at the premium; the first rubble cell on the route names the gate.
 * First on the route is what resolves a corridor with two gates: the near
 * one is broken, the search runs again, and the next becomes first.
 *
 * Null in two cases, both keeping the ordered mark rather than breaking
 * rubble off the route:
 * - no route even through rubble: the target is sealed by walls or terrain
 *   that don't break;
 * - a route with no rubble on it: bodies are in the way, not rubble, and
 *   queueing resolves it.
 */
function routeGateRubble(unit: Unit, world: World, target: Unit): Unit | null {
  // Packed cell indices (`cellIndex`), as the `CostFn` reads them.
  const rubbleByCell = new Map<number, Unit>();
  for (const r of world.units) {
    if (r.team !== 'neutral' || r.currentHp <= 0 || !isAutoTargetNeutral(r.archetype)) continue;
    for (const c of cellsOccupiedBy(r)) rubbleByCell.set(cellIndex(c, world.gridW), r);
  }
  if (rubbleByCell.size === 0) return null;
  const ctx = buildMovementContext(unit, world, { excludeUnitId: target.id });
  const permeableBlockers = ctx.pathBlockers.filter(
    (c) => !rubbleByCell.has(cellIndex(c, world.gridW)),
  );
  const route = findPath(
    unit.position,
    target.position,
    permeableBlockers,
    world.gridW,
    world.gridH,
    // Rubble cells were hard blockers (never priced); lifted, they carry only
    // tile cost — the premium is what makes a gate expensive but crossable.
    (x, y) =>
      costAt(x, y, world, ctx, unit.position) +
      (rubbleByCell.has(y * world.gridW + x) ? RUBBLE_ROUTE_CHIP_COST : 0),
    false,
    footprintOf(unit),
  );
  for (const c of route) {
    const gate = rubbleByCell.get(cellIndex(c, world.gridW));
    if (gate !== undefined) return gate;
  }
  return null;
}

/** Does the board hold a living auto-target rubble? The cheap check every tick
 *  pays before any reachability probe. */
function worldHasAutoTargetRubble(world: World): boolean {
  for (const u of world.units) {
    if (u.team === 'neutral' && u.currentHp > 0 && isAutoTargetNeutral(u.archetype)) return true;
  }
  return false;
}

/**
 * Can `unit` get within attack range of `target`? True when already in range,
 * else when there is a route to it (the target left out of the soft cells so
 * the path may end on its cell, as the approach in `positioning.ts` leaves
 * it). The real pathing, the same blockers and costs, so "reachable" never
 * parts from how the unit moves.
 */
function canReach(unit: Unit, world: World, target: Unit): boolean {
  if (unitDistance(unit, target) <= unit.derived.attackRange) return true;
  const ctx = buildMovementContext(unit, world, { excludeUnitId: target.id });
  return routeToward(unit.position, target.position, ctx, world, false, footprintOf(unit)).length > 0;
}

/**
 * The strategy's best hostile `unit` can reach (`canReach`), or null when it
 * is walled off from every hostile. Ranked by the unit's own strategy.
 */
function nearestReachableHostile(unit: Unit, world: World): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;
  for (const c of world.units) {
    if (!hostileCandidate(unit, c, world)) continue;
    if (!canReach(unit, world, c)) continue;
    if (best === null || strategy.compare(c, best, unit, world) < 0) best = c;
  }
  return best;
}

/**
 * The nearest auto-target rubble (body to body) `unit` can approach: reach a
 * cell within attack range of its footprint. Rubble is a hard blocker, so
 * approachable means a best-effort route toward its corner whose closest
 * reachable end is within strike range of the body. Nearest first, so the
 * costly approach probe runs only on a candidate nearer than the best.
 */
function nearestApproachableRubble(unit: Unit, world: World): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const r of world.units) {
    if (r.team !== 'neutral' || r.currentHp <= 0 || !isAutoTargetNeutral(r.archetype)) continue;
    const d = unitDistance(unit, r);
    if (d >= bestDist) continue;
    if (!canApproach(unit, world, r)) continue;
    best = r;
    bestDist = d;
  }
  return best;
}

/** Can `unit` reach a cell within attack range of `rubble`'s body? True when
 *  already in range; else a best-effort route toward the corner whose
 *  reachable end is within range of the body. */
function canApproach(unit: Unit, world: World, rubble: Unit): boolean {
  if (unitDistance(unit, rubble) <= unit.derived.attackRange) return true;
  const ctx = buildMovementContext(unit, world);
  const path = routeToward(unit.position, rubble.position, ctx, world, true, footprintOf(unit));
  if (path.length === 0) return false;
  return cellUnitDistance(path[path.length - 1]!, rubble) <= unit.derived.attackRange;
}

/**
 * A `neutral` objective target's unit id as a `targetId` to commit: the id
 * while it is a living destructible neutral (rubble, a destructible wall or
 * cover) or a living camp member (an order on a camp, hostile or not: the
 * ordered blow is what makes it hostile), else null. The focus and engage
 * pursuits admit an order by it, and `World.clearResolvedObjectives` keeps
 * one by it. An indestructible wall, with no hp, is never valid, so a stray
 * click on one reverts to `atWill` rather than pinning the team.
 */
export function validNeutralObjectiveTarget(world: World, unitId: number): number | null {
  const t = world.findUnit(unitId);
  return t !== undefined &&
    t.team === 'neutral' &&
    t.currentHp > 0 &&
    (isDestructibleNeutral(t.archetype) || t.campId !== null)
    ? t.id
    : null;
}

/**
 * Target selection under a `focus` objective, which preempts whole: the unit
 * leaves its fight and ignores every hostile but the focus, taking hits from
 * the rest without breaking off, which is what a focus is for. The two
 * preemption steps `updateObjectiveTarget` takes for `engage` are skipped.
 *
 * - A unit focus commits straight to that unit; the movement drives the
 *   approach and the abilities fire in range. The objective reverts to
 *   `atWill` when the target dies (`World.clearResolvedObjectives`).
 * - A neutral focus commits straight to a destructible neutral or a camp
 *   member (`validNeutralObjectiveTarget`), over any reachable hostile.
 *   Reverted to `atWill` when it is gone.
 * - A tile focus: beyond `SIM.rangedLeashCells` of the tile, `targetId` is
 *   null and the unit goes straight for the rally cell; within it, it acts
 *   as `engage` on the tile.
 */
function updateFocusTarget(unit: Unit, world: World, target: ObjectiveTarget): void {
  if (target.kind === 'enemy') {
    const objEnemy = world.findUnit(target.unitId);
    const valid =
      objEnemy !== undefined &&
      objEnemy.team !== unit.team &&
      objEnemy.team !== 'neutral' &&
      objEnemy.currentHp > 0;
    unit.targetId = valid ? objEnemy.id : null;
    unit.outOfLosTicks = 0;
    applyOrderedRubbleFallback(unit, world);
    return;
  }
  if (target.kind === 'neutral') {
    // Committed straight to it, as a unit focus is. `currentTarget` honours a
    // committed destructible or camp member, so the strike fires, and the
    // movement approaches an inert one best-effort, around the hard blocker
    // (`positioning.ts`). An invalid one gives null, and the objective
    // reverts to `atWill` at the top of a tick, before the units step
    // (`World.clearResolvedObjectives`).
    unit.targetId = validNeutralObjectiveTarget(world, target.unitId);
    unit.outOfLosTicks = 0;
    // A focused camp member behind rubble gets the break too; the fallback
    // leaves a focus on rubble or a wall as it is.
    applyOrderedRubbleFallback(unit, world);
    return;
  }
  // A tile focus persists (the team garrisons the area). The band, not the
  // exact tile, switches a unit to engaging, so one that can't reach the tile
  // (occupied or walled) still holds the nearest cell it can.
  if (chebyshev(unit.position, target.cell) <= SIM.rangedLeashCells) {
    updateObjectiveTarget(unit, world, target);
    return;
  }
  unit.targetId = null;
  unit.outOfLosTicks = 0;
}

/**
 * Target selection under an `engage` objective (the acting team's, a
 * player's order or the enemy's camp pull), in order:
 *
 *   1. Engaged: not preempted. A unit with a valid committed enemy inside
 *      its engage radius keeps fighting; the objective doesn't pull it off.
 *      It may still switch to a markedly better engageable hostile by its
 *      strategy's `shouldRetarget`, as the default path does.
 *   2. On the way: an engageable hostile preempts the objective (within the
 *      leashed engage radius, or retaliating: `objectiveEngages`), picked by
 *      the unit's strategy.
 *   3. Pursue the objective. A unit or neutral target becomes the target,
 *      so the unit paths to it and attacks; the objective reverts when it is
 *      gone. A tile leaves `targetId` null: the movement walks to the cell
 *      and the abilities abstain (`currentTarget` returns null).
 *
 * Sets `unit.targetId` and `outOfLosTicks` as the default path does, so
 * `updateTarget` stays the once-a-tick authority on the target.
 */
function updateObjectiveTarget(unit: Unit, world: World, target: ObjectiveTarget): void {
  const strategy = getTargetingStrategy(unit.targeting);
  const committed = unit.targetId !== null ? world.findUnit(unit.targetId) : undefined;
  const committedValid =
    committed !== undefined &&
    committed.team !== unit.team &&
    committed.team !== 'neutral' &&
    committed.currentHp > 0;

  // 1. Engaged: hold the fight, allow only a markedly-better engageable switch.
  if (committedValid && objectiveEngages(unit, committed)) {
    const candidate = findEngageableEnemy(unit, world);
    if (
      candidate &&
      candidate.id !== committed.id &&
      strategy.shouldRetarget(unit, committed, candidate, world)
    ) {
      unit.targetId = candidate.id;
      unit.outOfLosTicks = 0;
    }
    return;
  }

  // 2. Not engaged: a nearby (or retaliating) enemy preempts the objective.
  const engageable = findEngageableEnemy(unit, world);
  if (engageable) {
    if (unit.targetId !== engageable.id) {
      unit.targetId = engageable.id;
      unit.outOfLosTicks = 0;
    }
    return;
  }

  // 3. Pursue the objective itself.
  if (target.kind === 'enemy') {
    const objEnemy = world.findUnit(target.unitId);
    // Relative to the unit's team, as the focus branch's check is.
    const objValid =
      objEnemy !== undefined &&
      objEnemy.team !== unit.team &&
      objEnemy.team !== 'neutral' &&
      objEnemy.currentHp > 0;
    unit.targetId = objValid ? objEnemy.id : null;
  } else if (target.kind === 'neutral') {
    // A destructible neutral or a camp member. Unlike focus, engage let an
    // engageable hostile preempt above; with none, the unit commits to it.
    unit.targetId = validNeutralObjectiveTarget(world, target.unitId);
  } else {
    // A tile: no target; the movement paths toward the cell.
    unit.targetId = null;
  }
  unit.outOfLosTicks = 0;
  // An unreachable ordered mark falls back to breaking the gate rubble; a tile
  // has no mark, and the fallback does nothing.
  applyOrderedRubbleFallback(unit, world);
}

/**
 * The best engageable hostile of `unit` under an objective, ranked by its
 * strategy: `findTarget`'s set, filtered by `objectiveEngages` to the
 * hostiles the unit may leave its objective for. Null when none is (and the
 * unit pursues the objective).
 */
function findEngageableEnemy(unit: Unit, world: World): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;
  for (const candidate of world.units) {
    // The admit rule: a hostile camp member inside the leash preempts as an
    // enemy does.
    if (!hostileCandidate(unit, candidate, world)) continue;
    if (!objectiveEngages(unit, candidate)) continue;
    if (best === null || strategy.compare(candidate, best, unit, world) < 0) {
      best = candidate;
    }
  }
  return best;
}

/**
 * The best hostile within `range` of `unit`, by body distance, ranked by its
 * strategy: `findTarget` with a hard range and no leash or retaliation. Two
 * callers:
 *   - hold (`range` defaults to `derived.attackRange`): a held unit acts on
 *     what is in strike reach and never moves to close;
 *   - blind (`range` is the status's `acquisitionRange`): a blinded unit
 *     acquires only inside its shortened sight, else idles.
 * Null when nothing is in reach. No RNG: the strategy breaks ties.
 */
function findInRangeEnemy(
  unit: Unit,
  world: World,
  range: number = unit.derived.attackRange,
): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;
  for (const candidate of world.units) {
    // The admit rule: a held or blinded unit acts on a hostile camp member
    // in reach as on an enemy.
    if (!hostileCandidate(unit, candidate, world)) continue;
    // The body distance; every admitted candidate is one cell, so it is the
    // cell distance.
    if (unitDistance(unit, candidate) > range) continue;
    if (best === null || strategy.compare(candidate, best, unit, world) < 0) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Target selection under confusion (`targeting: 'random'`): a uniformly
 * random living unit of any team, the unit's own included, or a camp member,
 * within the status's `radius` (Chebyshev; bounded, so confusion isn't
 * omniscient), the unit itself excluded. The any-team pick is the friendly
 * fire: `currentTarget` honours an ally mark under confusion, and the unit
 * strikes whatever it rolled. A confused caster's blast hits its own side
 * too (the interpreter). Rolls on `combatRng`; null, with no candidate in
 * the radius, idles. Candidates go in `world.units` order, so the roll is
 * deterministic from the seed.
 */
function updateConfusedTarget(unit: Unit, world: World, radius: number | null): void {
  const r = radius ?? Infinity;
  const candidates: Unit[] = [];
  for (const candidate of world.units) {
    if (candidate.id === unit.id) continue;
    // A camp member is in the pool whatever its camp's hostility: a confused
    // unit may strike a passive camp member, and the blow makes the camp
    // hostile (`World.dealDamage`). Inert scenery stays out.
    if (candidate.team === 'neutral' && candidate.campId === null) continue;
    if (candidate.currentHp <= 0) continue;
    if (chebyshev(unit.position, candidate.position) > r) continue;
    candidates.push(candidate);
  }
  unit.targetId =
    candidates.length === 0
      ? null
      : candidates[Math.floor(world.combatRng.next() * candidates.length)]!.id;
  unit.outOfLosTicks = 0;
}

/**
 * May `unit` break off its objective to engage `enemy`? Two gates:
 *
 *   - Proximity: within the engage radius `min(attackRange,
 *     rangedLeashCells)`. The `min` is the leash: a long-range unit's radius
 *     is capped, so an archer doesn't leave the objective to plink every
 *     distant enemy in reach, and melee (range 1) is unaffected.
 *   - Retaliation: the enemy is attacking this unit (committed to it and
 *     within its own range) and the unit can shoot back (within its own
 *     range). This lets a leashed archer defend itself against an attacker
 *     beyond the leash, the only way past the cap.
 *
 * Pure; no RNG. Chebyshev throughout, the grid's eight-way metric.
 */
function objectiveEngages(unit: Unit, enemy: Unit): boolean {
  const d = chebyshev(unit.position, enemy.position);
  const leash = Math.min(unit.derived.attackRange, SIM.rangedLeashCells);
  if (d <= leash) return true;
  // Retaliation: only past the leash, and only against a real attacker.
  return (
    enemy.targetId === unit.id &&
    d <= unit.derived.attackRange &&
    d <= enemy.derived.attackRange
  );
}

/**
 * The unit a unit acts against this tick: its committed `targetId` while
 * that still resolves to a target it may act on, else `findTarget`'s pick
 * (under `atWill`). Behaviours (`MovementBehavior`, the abilities) call this,
 * not `findTarget`. The fallback means a behaviour polled with no
 * `updateTarget` before it (a test calling `proposeAction` directly) still
 * gets a target rather than abstaining. A blinded unit with nothing inside
 * its acquisition range takes the fallback too, so a blinded ranged unit
 * still strikes out to its attack range.
 */
export function currentTarget(unit: Unit, world: World): Unit | null {
  // A confused unit's mark may be an ally (`updateConfusedTarget` picks any
  // team). Honour a living commitment of any team, and never fall back to the
  // normal pick, which would cure the confusion; its mark is rolled again each
  // tick, so a null here means no candidate, and it idles.
  const confused = behaviorFlags(unit.effects).targeting === 'random';
  if (unit.targetId !== null) {
    const t = world.findUnit(unit.targetId);
    if (t !== undefined && t.currentHp > 0) {
      // A committed destructible neutral (rubble the overlay chose, an
      // ordered wall) is honoured, so the strike and the movement act on it;
      // an indestructible wall or cover never is. A committed camp member is
      // honoured whatever its camp's hostility: a commitment comes only from
      // the hostility-gated acquisition, the confusion roll, or an order on a
      // passive camp, and that ordered first blow must land, as it makes the
      // camp hostile. A confused unit never breaks rubble: its mark is rolled
      // among combatants and camp members.
      if (t.team === 'neutral') {
        if (t.campId !== null) return t;
        if (!confused && isDestructibleNeutral(t.archetype)) return t;
      } else if (confused || t.team !== unit.team) {
        return t;
      }
    }
  }
  if (confused) return null;
  // Under any objective but `atWill`, a null `targetId` is deliberate: a tile
  // pursued, nothing in a held unit's range, an ordered target gone. No
  // fallback, or the unit would chase the map instead of the objective.
  if (world.objectiveFor(unit.team).mode !== 'atWill') return null;
  return findTarget(unit, world);
}

/**
 * A heal's target (the `lowestHpAlly` selector): the lowest-HP wounded ally
 * within `range` (Chebyshev), the healer itself included, so a lone healer
 * can heal itself. Wounded is `currentHp < maxHp`, so a full ally is never
 * picked. No line of sight is needed: a heal is not a shot, and a wall
 * between healer and ally doesn't block it. Ties on `currentHp` go to the
 * lower id; null when nobody in range is hurt.
 */
export function lowestWoundedAlly(unit: Unit, world: World, range: number): Unit | null {
  let best: Unit | null = null;
  for (const candidate of world.units) {
    // Same team only: enemies and neutrals are out, and `unit` itself is in.
    if (candidate.team !== unit.team) continue;
    if (candidate.currentHp <= 0) continue;
    if (candidate.currentHp >= candidate.derived.maxHp) continue;
    if (chebyshev(unit.position, candidate.position) > range) continue;
    if (
      best === null ||
      candidate.currentHp < best.currentHp ||
      (candidate.currentHp === best.currentHp && candidate.id < best.id)
    ) {
      best = candidate;
    }
  }
  return best;
}
