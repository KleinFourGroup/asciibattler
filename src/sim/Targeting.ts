import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';
import type { BattleObjective } from './objective';
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

  // J1 — the player team's shared objective steers ITS units' target choice
  // (enemy AI is unaffected). Gated on an active objective so the no-objective
  // path below is byte-identical to pre-J1 (and the fuzz baseline unmoved).
  const objective = world.objective;
  if (objective !== null && unit.team === 'player') {
    updateObjectiveTarget(unit, world, objective);
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
 * J1 — target selection for a PLAYER unit while a shared objective is active.
 * The Phase-J preemption rules, in priority order:
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
function updateObjectiveTarget(unit: Unit, world: World, objective: BattleObjective): void {
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
  if (objective.kind === 'enemy') {
    const objEnemy = world.findUnit(objective.unitId);
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
  // J1 — under an active objective, a player unit's null `targetId` is
  // DELIBERATE (set by `updateObjectiveTarget`: no engageable enemy, so it's
  // pursuing a tile objective or holding). Suppress the nearest-enemy fallback
  // here so it doesn't chase the whole map instead of honoring the objective.
  // The fallback otherwise stays for enemies, the no-objective case, and unit
  // tests that poll a behavior without a prior `updateTarget`.
  if (world.objective !== null && unit.team === 'player') return null;
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
