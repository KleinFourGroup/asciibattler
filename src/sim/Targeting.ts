import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';
import type { ObjectiveTarget } from './objective';
import { hasLineOfSight } from './LineOfSight';
import { SIM } from '../config/sim';
import { OBJECTIVE } from '../config/objective';
import { getTargetingStrategy } from './targetingStrategies';
import { focusTileDirective } from './focusTile';
import { behaviorFlags } from './statusBehavior';

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
 * The default ("at-will") sticky-target selection — E5's stickiness, factored
 * out of `updateTarget` so the `focus`/`disallow` fallback (O3) can reuse the
 * exact same logic. Byte-identical to the pre-O3 inline body.
 */
function updateTargetDefault(unit: Unit, world: World): void {
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
 * O3 — target selection under a `focus` objective. Focus COMPLETELY PREEMPTS:
 * the unit abandons any current fight and ignores every enemy except the focus
 * — it eats hits from non-focused attackers (no retaliation break-off, by
 * design; that's the point of a force-focus). The two preemption branches
 * `updateObjectiveTarget` has for `engage` are deliberately SKIPPED here.
 *
 *   - ENEMY focus → commit straight to that unit (a beeline; the path-to-target
 *     logic in MovementBehavior drives the approach, the strike abilities fire
 *     when in range). Reverted World-side to `atWill` on the target's death.
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
    if (chebyshev(unit.position, candidate.position) > range) continue;
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
    if (
      t !== undefined &&
      t.currentHp > 0 &&
      t.team !== 'neutral' &&
      (confused || t.team !== unit.team)
    ) {
      return t;
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
    if (u.team === 'neutral' && u.blocksLineOfSight) blockers.push(u.position);
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
    if (u.team === 'neutral' && !u.blocksLineOfSight) out.push(u.position);
  }
  return out;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
