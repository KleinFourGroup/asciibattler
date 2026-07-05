import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';
import type { ObjectiveTarget } from './objective';
import { hasLineOfSight } from './LineOfSight';
import { SIM } from '../config/sim';
import { UNIT_DEFS, isDestructibleNeutral, isAutoTargetNeutral } from '../config/units';
import { OBJECTIVE } from '../config/objective';
import { getTargetingStrategy } from './targetingStrategies';
import { focusTileDirective } from './focusTile';
import { behaviorFlags } from './statusBehavior';
import { buildMovementContext, routeToward } from './movement';
import {
  footprintOf,
  footprintCells,
  unitDistance,
  cellUnitDistance,
  cellsOccupiedBy,
  distanceBetween,
} from './occupancy';

/**
 * Pick the best living enemy of `unit` according to its targeting strategy
 * (`unit.targeting`, resolved at spawn from the archetype). The default
 * `nearest` strategy reproduces the historical pick exactly (nearest by
 * Chebyshev, ties to lower HP then lower id); the rogue's `weakest` strategy
 * targets the squishiest enemy. Returning null is a normal outcome — the
 * caller (Step 3.5 movement, Step 3.7 attacks) treats it as "no target, idle
 * this tick."
 *
 * Pure function: same `(unit, world.units)` always yields the same answer.
 * This stays the raw pick; E5's target *stickiness* layers on top via
 * `updateTarget` / `currentTarget`.
 */
export function findTarget(unit: Unit, world: World): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;

  for (const candidate of world.units) {
    if (candidate.team === unit.team) continue;
    // Neutrals (walls, environment entities) are never enemies — they sit
    // on the grid as blockers but are not valid attack targets.
    if (candidate.team === 'neutral') continue;
    if (candidate.currentHp <= 0) continue;

    if (best === null || strategy.compare(candidate, best, unit, world) < 0) {
      best = candidate;
    }
  }
  return best;
}

/**
 * E5 — target stickiness. Called once per free unit by the selector
 * (`World.tick`, before behaviors poll) so the re-target decision and its
 * `outOfLosTicks` counter advance exactly once per tick — never twice from
 * MovementBehavior + AbilityBehavior both resolving a target.
 *
 * A committed unit keeps its target until one of:
 *   (a) the target died / vanished / is no longer a valid enemy → re-pick
 *       via the unit's strategy immediately;
 *   (b) the strategy's fresh pick is a markedly better target than the
 *       current one (`strategy.shouldRetarget`) — for `nearest`, "markedly
 *       closer" (`SIM.retargetCloserRatio`); `weakest` never switches off a
 *       live mark;
 *   (c) (ranged only) the target has been out of line-of-sight for
 *       `SIM.rangedRetargetLosTicks` — stop chasing a target hiding behind
 *       a wall and re-pick.
 *
 * Neutrals (walls/half-cover) never target, so they short-circuit.
 */
export function updateTarget(unit: Unit, world: World): void {
  if (unit.team === 'neutral') return;

  // 28 — a BEHAVIOR status hijacks target acquisition, preempting the team
  // objective entirely (a confused / blinded unit's AI is overridden — it no
  // longer follows orders). Resolved off the unit's effects (def-resolve), so it
  // adds no serialized state. Checked before the objective branches below.
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

  // O1 — the acting team's steering objective drives its units' target choice.
  // `atWill` (the default + J1's no-objective) falls through to the standard
  // path below, byte-identical to pre-O1 (the fuzz baseline unmoved); `engage`
  // routes to the Phase-J preemption logic. The enemy team is fixed at `atWill`,
  // so enemy AI is unchanged. (O2/O3 add `hold`/`focus` branches here.)
  const objective = world.objectiveFor(unit.team);
  if (objective.mode === 'engage') {
    updateObjectiveTarget(unit, world, objective.target);
    return;
  }
  if (objective.mode === 'hold') {
    // O2 — act in place: target the best enemy ALREADY within attack range. The
    // unit never repositions to close (`MovementBehavior` abstains under hold),
    // so an out-of-range enemy is simply ignored → null = idle. Re-picked each
    // tick so an enemy entering range is engaged (the permitted in-place
    // retaliation switch); the deterministic strategy pick handles tie-breaks.
    const inRange = findInRangeEnemy(unit, world);
    unit.targetId = inRange ? inRange.id : null;
    unit.outOfLosTicks = 0;
    return;
  }
  if (objective.mode === 'focus') {
    // O3 — the full-preempt objective (see `updateFocusTarget`).
    updateFocusTarget(unit, world, objective.target);
    return;
  }

  // `atWill` (the default + J1's no-objective): the standard sticky-target path.
  updateTargetDefault(unit, world);
}

/**
 * The default ("at-will") target update: the E5 STICKY hostile pick, then the
 * §40b rubble auto-target OVERLAY. Factored out of `updateTarget` so the
 * `focus`/`disallow` fallback (O3) reuses the exact same logic.
 */
function updateTargetDefault(unit: Unit, world: World): void {
  updateStickyTarget(unit, world);
  applyRubbleAutoTarget(unit, world);
}

/**
 * E5's sticky hostile pick — byte-identical to the pre-§40b inline body (the O3
 * fallback used it directly). Sets `unit.targetId` to the strategy's committed
 * enemy (or null); the §40b overlay may then redirect a WALLED-OFF unit onto a
 * blocking rubble.
 */
function updateStickyTarget(unit: Unit, world: World): void {
  const committed = unit.targetId !== null ? world.findUnit(unit.targetId) : undefined;
  const valid =
    committed !== undefined &&
    committed.team !== unit.team &&
    committed.team !== 'neutral' &&
    committed.currentHp > 0;

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

  // (c) drop a target we've been unable to see for too long — §38c: the ranged
  // `=== 'ranged'` special-case became the `UnitDef.retargetOnLosLoss` capability
  // flag (read at call time off the catalog). §38d — a NEUTRAL unit (wall /
  // half-cover) never seeks a target and is absent from the COMBATANT catalog, so
  // the optional chain short-circuits false (the removed sentinel guard's value).
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
 * §40b — the rubble AUTO-TARGET overlay, applied after the sticky hostile pick. A
 * unit whose committed hostile it CANNOT REACH (walled off by rubble) redirects:
 * first to any hostile it CAN reach (a reachable hostile always outranks rubble —
 * the locked priority), else to the nearest approachable auto-target rubble — the
 * "deny access until destroyed" loop. Leaves the sticky pick untouched when the
 * target is reachable (the common case) or nothing chippable is in reach.
 *
 * GATED on the board actually holding an auto-target rubble: absent (every shipped
 * map + all fuzz layouts), this is a no-op → byte-identical (the fuzz baseline
 * holds). The reachability probes (`findPath`) then run only for a unit that can't
 * reach its committed target AND has rubble on the board — a rare, bounded subset —
 * so a normal tick pays only the cheap presence scan. (A per-tick flood-fill would
 * amortize the probes if a heavy rubble map ever needs it — a §41 perf note.)
 */
function applyRubbleAutoTarget(unit: Unit, world: World): void {
  if (!worldHasAutoTargetRubble(world)) return;
  const committed = unit.targetId !== null ? world.findUnit(unit.targetId) : undefined;
  // Committed to a hostile it can reach → keep the sticky pick (the common case).
  if (committed !== undefined && committed.team !== 'neutral' && canReach(unit, world, committed)) {
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

/** §40b — does the board hold a living auto-target rubble? The cheap gate every
 *  tick pays before any reachability probe; false on every shipped map + fuzz
 *  layout (→ the overlay is a no-op, byte-identical). */
function worldHasAutoTargetRubble(world: World): boolean {
  for (const u of world.units) {
    if (u.team === 'neutral' && u.currentHp > 0 && isAutoTargetNeutral(u.archetype)) return true;
  }
  return false;
}

/**
 * §40b — can `unit` get within attack range of `target`? True when already in range,
 * else when `findPath` finds a route toward it (the target soft-excluded so the path
 * may end on its cell, exactly as the MovementBehavior approach does). Reuses the
 * real pathing (same blockers/costs) so "reachable" never diverges from how the unit
 * actually moves.
 */
function canReach(unit: Unit, world: World, target: Unit): boolean {
  if (unitDistance(unit, target) <= unit.derived.attackRange) return true;
  const ctx = buildMovementContext(unit, world, { excludeUnitId: target.id });
  return routeToward(unit.position, target.position, ctx, world, false, footprintOf(unit)).length > 0;
}

/**
 * §40b — the strategy-best hostile `unit` can actually REACH (path to within attack
 * range), or null when it's walled off from every hostile. Ranked by the unit's own
 * targeting strategy so `weakest` still prefers the squishiest among the reachable.
 */
function nearestReachableHostile(unit: Unit, world: World): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;
  for (const c of world.units) {
    if (c.team === unit.team || c.team === 'neutral' || c.currentHp <= 0) continue;
    if (!canReach(unit, world, c)) continue;
    if (best === null || strategy.compare(c, best, unit, world) < 0) best = c;
  }
  return best;
}

/**
 * §40b — the nearest (body-to-body) auto-target rubble `unit` can APPROACH: reach a
 * cell within attack range of its footprint. Rubble is a HARD path-blocker, so
 * approachability is a bestEffort route toward its corner whose closest-reachable end
 * lands within strike range of the body (the J3 rally-approach shape). Nearest-first,
 * with a distance guard so the (expensive) approach probe runs only on improving
 * candidates.
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

/** §40b — can `unit` reach a cell within attack range of the hard-blocker `rubble`'s
 *  body? Already-adjacent short-circuits; else a bestEffort route toward the corner
 *  whose reachable end is body-adjacent. */
function canApproach(unit: Unit, world: World, rubble: Unit): boolean {
  if (unitDistance(unit, rubble) <= unit.derived.attackRange) return true;
  const ctx = buildMovementContext(unit, world);
  const path = routeToward(unit.position, rubble.position, ctx, world, true, footprintOf(unit));
  if (path.length === 0) return false;
  // 44-pre-b promoted this file's private `minCellToBody` into
  // `occupancy.cellUnitDistance` (same math, shared home) — deduped here.
  return cellUnitDistance(path[path.length - 1]!, rubble) <= unit.derived.attackRange;
}

/**
 * §40e — resolve a `neutral`-kind objective target's unitId to a committable
 * `targetId`: the id when it's still a LIVING DESTRUCTIBLE neutral (rubble / a
 * destructible wall or cover), else null. Shared by the focus + engage pursue
 * branches so a manual "demolish this" order is admitted identically. Mirrors the
 * `enemy`-target validity check, but for the neutral team + the §40b HP-presence
 * destructibility gate — an indestructible (hp-less) wall is never a valid
 * target, so a stray click on one reverts to atWill rather than pinning the team.
 */
function validDestructibleNeutralTarget(world: World, unitId: number): number | null {
  const t = world.findUnit(unitId);
  return t !== undefined &&
    t.team === 'neutral' &&
    t.currentHp > 0 &&
    isDestructibleNeutral(t.archetype)
    ? t.id
    : null;
}

/**
 * O3 — target selection under a `focus` objective. Focus COMPLETELY PREEMPTS:
 * the unit abandons any current fight and ignores every enemy except the focus
 * — it eats hits from non-focused attackers (no retaliation break-off, by
 * design; that's the point of a force-focus). The two preemption branches
 * `updateObjectiveTarget` has for `engage` are deliberately SKIPPED here.
 *
 *   - ENEMY focus → commit straight to that unit (a beeline; the path-to-target
 *     logic in MovementBehavior drives the approach, the strike abilities fire
 *     when in range). Reverted World-side to `atWill` on the target's death.
 *   - NEUTRAL focus (§40e) → commit straight to a DESTRUCTIBLE neutral (rubble /
 *     a destructible wall or cover) — the manual "demolish this obstacle" order,
 *     which by design OVERRIDES the reachable-hostile priority (that's what focus
 *     is for). Same beeline shape as an enemy focus; reverted World-side to
 *     `atWill` when the neutral is destroyed/reaped.
 *   - TILE focus → defer to the switchable `focusTileResolution` strategy
 *     (`focusTile.ts`): `pursue` (targetId null → MovementBehavior beelines to
 *     the rally cell), `engageLocal` (the unit has arrived near the tile → act
 *     exactly like `engage{tile}`), or `atWill` (the `disallow` fallback —
 *     default targeting; the team reverts to atWill at the World boundary the
 *     same tick regardless).
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
    return;
  }
  if (target.kind === 'neutral') {
    // §40e — a manual focus on a DESTRUCTIBLE neutral (rubble / a destructible
    // wall or cover) commits straight to it, exactly like an enemy focus: the
    // unit abandons its fight and beelines to demolish it. `currentTarget` honors
    // the committed destructible neutral (§40b) so the strike fires, and
    // MovementBehavior's neutral branch drives the bestEffort approach around the
    // hard blocker. An indestructible or dead neutral → null (World reverts the
    // objective to atWill the same tick).
    unit.targetId = validDestructibleNeutralTarget(world, target.unitId);
    unit.outOfLosTicks = 0;
    return;
  }
  switch (focusTileDirective(unit, world, target.cell)) {
    case 'engageLocal':
      // Arrived near the tile — engage locally, exactly like `engage{tile}`.
      updateObjectiveTarget(unit, world, target);
      return;
    case 'atWill':
      updateTargetDefault(unit, world);
      return;
    case 'pursue':
    default:
      // Beeline to the tile, ignore every enemy en route.
      unit.targetId = null;
      unit.outOfLosTicks = 0;
      return;
  }
}

/**
 * J1 — target selection for a unit under an `engage` objective (the acting
 * team's `TeamObjective.target`; O1 generalized this off the player-only
 * gating). The Phase-J preemption rules, in priority order:
 *
 *   1. ENGAGED → not preempted. A unit with a valid committed target inside its
 *      engage radius keeps fighting; the objective doesn't yank it off. (It may
 *      still switch to a markedly-better engageable enemy via the strategy's
 *      `shouldRetarget`, the same anti-thrash margin as the default path.)
 *   2. EN ROUTE → an engageable enemy preempts the objective. "Engageable" =
 *      within the leash-capped engage radius, OR retaliation (see
 *      `objectiveEngages`). Picked with the unit's own targeting strategy.
 *   3. PURSUE the objective. An `enemy` objective becomes the target (so the
 *      unit paths toward + attacks it; auto-cleared World-side on its death). A
 *      `tile` objective leaves `targetId` null → `MovementBehavior` walks toward
 *      the cell and the strike abilities abstain (`currentTarget` returns null).
 *
 * Mutates `unit.targetId` / `outOfLosTicks` exactly like the default
 * `updateTarget`, so it stays the once-per-tick authority on the sticky target.
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
    const objValid =
      objEnemy !== undefined && objEnemy.team === 'enemy' && objEnemy.currentHp > 0;
    unit.targetId = objValid ? objEnemy.id : null;
  } else if (target.kind === 'neutral') {
    // §40e — pursue a DESTRUCTIBLE neutral (rubble / a destructible wall). Unlike
    // focus, engage still let an engageable hostile preempt above (steps 1–2);
    // with none engageable, the unit commits to demolishing the obstacle.
    unit.targetId = validDestructibleNeutralTarget(world, target.unitId);
  } else {
    // Tile objective: no enemy target; MovementBehavior paths toward the cell.
    unit.targetId = null;
  }
  unit.outOfLosTicks = 0;
}

/**
 * J1 — the best ENGAGEABLE enemy of a player `unit` under an objective, ranked
 * by the unit's targeting strategy (so `weakest` still prefers the squishiest
 * among the engageable set). The eligible set is `findTarget`'s, further
 * filtered by `objectiveEngages` — only enemies the unit may break off the
 * objective for. Returns null when nothing is engageable (→ pursue the
 * objective).
 */
function findEngageableEnemy(unit: Unit, world: World): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;
  for (const candidate of world.units) {
    if (candidate.team === unit.team) continue;
    if (candidate.team === 'neutral') continue;
    if (candidate.currentHp <= 0) continue;
    if (!objectiveEngages(unit, candidate)) continue;
    if (best === null || strategy.compare(candidate, best, unit, world) < 0) {
      best = candidate;
    }
  }
  return best;
}

/**
 * O2 — the best enemy within a Chebyshev `range` of `unit`, ranked by the unit's
 * targeting strategy. `findTarget` with a hard range filter and no leash /
 * retaliation nuance — pure "in reach or not." Two callers:
 *   - O2 hold-mode (default `range = derived.attackRange`): a held unit acts on
 *     what's in strike reach and never moves to close.
 *   - 28 blind (`range = acquisitionRange`): a blinded unit only acquires a foe
 *     inside its crippled sight, else idles.
 * Returns null when nothing is in reach. Deterministic (the strategy tie-break;
 * no RNG).
 */
function findInRangeEnemy(
  unit: Unit,
  world: World,
  range: number = unit.derived.attackRange,
): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  let best: Unit | null = null;
  for (const candidate of world.units) {
    if (candidate.team === unit.team) continue;
    if (candidate.team === 'neutral') continue;
    if (candidate.currentHp <= 0) continue;
    // 44-pre-c — footprint distance (byte-identical today: neutrals are
    // excluded above, and every combatant is 1×1; the honest measure the
    // moment a multi-tile combatant ships).
    if (unitDistance(unit, candidate) > range) continue;
    if (best === null || strategy.compare(candidate, best, unit, world) < 0) {
      best = candidate;
    }
  }
  return best;
}

/**
 * 28 — target selection under CONFUSION (`targeting:'random'`). Picks a uniformly
 * random LIVING, non-neutral unit — of ANY team, INCLUDING the unit's own — within
 * the confusion acquisition `radius` (Chebyshev; bounded so confusion isn't
 * omniscient), excluding the unit itself. The any-team pick is the friendly-fire:
 * `currentTarget` honors an ally mark under confusion, and single-target damage
 * has no team check, so the confused unit simply strikes whatever it rolled. A
 * confused AoE additionally forces `affects:'all'` at fire time (see the
 * interpreter). Rolls on `combatRng` (where targeting rolls live); null = no
 * candidate in radius → idle. Candidates iterate in `world.units` order, so the
 * roll is deterministic given the seed.
 */
function updateConfusedTarget(unit: Unit, world: World, radius: number | null): void {
  const r = radius ?? Infinity;
  const candidates: Unit[] = [];
  for (const candidate of world.units) {
    if (candidate.id === unit.id) continue;
    if (candidate.team === 'neutral') continue;
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
 * J1 — may `unit` break off its objective to engage `enemy`? Two gates:
 *
 *   - PROXIMITY: within the engage radius `min(attackRange, rangedLeashCells)`.
 *     The `min` is the leash: a long-range unit's engage radius is CAPPED at
 *     `rangedLeashCells` so an archer doesn't abandon the objective to plink
 *     every distant enemy in reach, while melee (range 1) is unaffected.
 *   - RETALIATION: the enemy is actively attacking this unit (committed to it
 *     AND within its own attack range) and the unit can shoot back (within its
 *     own attack range). This is what lets a leashed archer defend itself
 *     against an attacker beyond the leash — the only escape hatch past the cap.
 *
 * Pure; no RNG. Chebyshev throughout (the grid's 8-dir metric).
 */
function objectiveEngages(unit: Unit, enemy: Unit): boolean {
  const d = chebyshev(unit.position, enemy.position);
  const leash = Math.min(unit.derived.attackRange, OBJECTIVE.rangedLeashCells);
  if (d <= leash) return true;
  // Retaliation: only past the leash, and only against a real attacker.
  return (
    enemy.targetId === unit.id &&
    d <= unit.derived.attackRange &&
    d <= enemy.derived.attackRange
  );
}

/**
 * E5 — the enemy a unit is acting against this tick: its sticky
 * `targetId` when that still resolves to a living enemy, else the nearest
 * enemy. Behaviors (MovementBehavior, the strike abilities) call this
 * instead of `findTarget` directly. The nearest-enemy fallback means a
 * behavior polled WITHOUT a prior `updateTarget` (e.g. a unit test calling
 * `proposeAction` straight) still gets a sensible target rather than
 * abstaining on a null commitment.
 */
export function currentTarget(unit: Unit, world: World): Unit | null {
  // 28 — a CONFUSED unit's mark may be an ALLY (`updateConfusedTarget` picks any
  // team). Honor any living non-neutral commitment, and NEVER fall back to the
  // normal enemy pick (that would silently "cure" the confusion); its mark is
  // re-rolled each tick, so a null here is a deliberate "no candidate → idle."
  const confused = behaviorFlags(unit.effects).targeting === 'random';
  if (unit.targetId !== null) {
    const t = world.findUnit(unit.targetId);
    if (t !== undefined && t.currentHp > 0) {
      // §40b — a committed DESTRUCTIBLE neutral (the rubble the auto-target hook
      // chose to chip) is honored so the strike + movement act on it; an
      // indestructible wall/half-cover never is. Otherwise the historical rule: a
      // living enemy (or, under confusion, any-team mark). A confused unit never
      // chips rubble — its mark is re-rolled among non-neutral units each tick.
      if (t.team === 'neutral') {
        if (!confused && isDestructibleNeutral(t.archetype)) return t;
      } else if (confused || t.team !== unit.team) {
        return t;
      }
    }
  }
  if (confused) return null;
  // O1 — under a non-`atWill` objective, a unit's null `targetId` is DELIBERATE
  // (set by `updateObjectiveTarget`: no engageable enemy, so it's pursuing a
  // tile objective). Suppress the nearest-enemy fallback here so it doesn't
  // chase the whole map instead of honoring the objective. The fallback
  // otherwise stays for `atWill` (the default + J1's no-objective case) and for
  // unit tests that poll a behavior without a prior `updateTarget`.
  if (world.objectiveFor(unit.team).mode !== 'atWill') return null;
  return findTarget(unit, world);
}

/**
 * E7.B — the healer's target pick: the lowest-HP *wounded* ally within
 * `range` (Chebyshev), INCLUDING the healer itself (per the E7.B design
 * call — a fragile solo healer can self-heal, so it sits in its own
 * ally pool). "Wounded" = `currentHp < maxHp`, so a full-HP ally is never
 * targeted (a 0-delta heal is wasted). No line-of-sight requirement — heal
 * is a magic support buff, not a shot (E7.B call), so a wall between healer
 * and ally doesn't block it. Ties on `currentHp` go to the lower id for
 * determinism; returns null when nobody in range is hurt.
 */
export function lowestWoundedAlly(unit: Unit, world: World, range: number): Unit | null {
  let best: Unit | null = null;
  for (const candidate of world.units) {
    // Same team only — this naturally excludes enemies AND neutral walls
    // (team 'neutral'), and naturally INCLUDES `unit` itself.
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

/**
 * Neutral units (walls, half-cover) whose `blocksLineOfSight` is true —
 * the LOS-occluder pool shared by the ranged re-target check here and the
 * strike abilities' shot gate. Half-cover (`blocksLineOfSight: false`) is
 * deliberately excluded: it blocks movement but not sight (D6).
 */
export function collectLosBlockers(world: World): GridCoord[] {
  const blockers: GridCoord[] = [];
  for (const u of world.units) {
    // 43-pre-b — the WHOLE footprint (`cellsOccupiedBy`), not just the §39
    // corner: corner-only, shots passed through a multi-tile rubble's body.
    if (u.team === 'neutral' && u.blocksLineOfSight) blockers.push(...cellsOccupiedBy(u));
  }
  return blockers;
}

/**
 * E4 — half-cover positions: neutral units whose `blocksLineOfSight` is `false`.
 * Symmetric to `collectLosBlockers` but for the OTHER half of the neutral-team
 * population. A shot that crosses one lands at `LEVELING.halfCoverDamageMult`.
 * Lives here (the LOS-collector home) so both the legacy strike propose path and
 * the Phase-Y3 `EffectAbility` propose bridge share one definition.
 */
export function collectHalfCoverPositions(world: World): GridCoord[] {
  const out: GridCoord[] = [];
  for (const u of world.units) {
    // 43-pre-b — full footprints, same class as `collectLosBlockers`. Pure
    // future-proofing today: no shipped multi-tile def has
    // `blocksLineOfSight: false` (only rubble_2x2/3x3 are multi-tile, both
    // LOS-blocking), so this is byte-identical until one exists.
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
 * the movement hold (`MovementBehavior.inFiringBand`) in agreement — the
 * GP4/Qb#3 freeze class IS the two layers disagreeing about "in range", so any
 * future range-gate must route through here rather than re-deriving the test.
 * For a 1×1 target this is exactly the old corner test (band first, then LOS),
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

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
