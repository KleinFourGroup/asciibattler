import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';
import type { ObjectiveTarget } from './objective';
import { hasLineOfSight } from './LineOfSight';
import { SIM } from '../config/sim';
import { OBJECTIVE } from '../config/objective';
import { getTargetingStrategy } from './targetingStrategies';

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

  // (c) ranged: drop a target we've been unable to see for too long.
  if (unit.archetype === 'ranged') {
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
 * O2 — the best enemy ALREADY within `unit`'s strike reach
 * (`derived.attackRange`, Chebyshev), ranked by the unit's targeting strategy.
 * The hold-mode pick: a held unit acts on what's in reach and nothing else (it
 * never moves to close), so this is `findTarget` with a hard range filter and
 * no leash/retaliation nuance — pure "in my range or not." Returns null when
 * no enemy is in reach (→ the held unit idles). Deterministic (the strategy's
 * tie-break; no RNG).
 */
function findInRangeEnemy(unit: Unit, world: World): Unit | null {
  const strategy = getTargetingStrategy(unit.targeting);
  const range = unit.derived.attackRange;
  let best: Unit | null = null;
  for (const candidate of world.units) {
    if (candidate.team === unit.team) continue;
    if (candidate.team === 'neutral') continue;
    if (candidate.currentHp <= 0) continue;
    if (chebyshev(unit.position, candidate.position) > range) continue;
    if (best === null || strategy.compare(candidate, best, unit, world) < 0) {
      best = candidate;
    }
  }
  return best;
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
  if (unit.targetId !== null) {
    const t = world.findUnit(unit.targetId);
    if (t !== undefined && t.team !== unit.team && t.team !== 'neutral' && t.currentHp > 0) {
      return t;
    }
  }
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
    if (u.team === 'neutral' && u.blocksLineOfSight) blockers.push(u.position);
  }
  return blockers;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
