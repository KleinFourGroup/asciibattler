import type { Unit } from './Unit';
import type { World } from './World';
import type { GridCoord } from '../core/types';
import { hasLineOfSight } from './LineOfSight';
import { SIM } from '../config/sim';

/**
 * Pick the nearest living enemy of `unit`. Ties on Chebyshev distance go to
 * the lower-HP candidate; ties on HP go to the lower id. Returning null is
 * a normal outcome — the caller (Step 3.5 movement, Step 3.7 attacks) treats
 * it as "no target, idle this tick."
 *
 * Pure function: same `(unit, world.units)` always yields the same answer.
 * This stays the raw nearest-enemy pick; E5's target *stickiness* layers on
 * top via `updateTarget` / `currentTarget`.
 */
export function findTarget(unit: Unit, world: World): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;

  for (const candidate of world.units) {
    if (candidate.team === unit.team) continue;
    // Neutrals (walls, environment entities) are never enemies — they sit
    // on the grid as blockers but are not valid attack targets.
    if (candidate.team === 'neutral') continue;
    if (candidate.currentHp <= 0) continue;

    const dist = chebyshev(unit.position, candidate.position);
    if (best === null || isBetter(candidate, dist, best, bestDist)) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function isBetter(
  candidate: Unit,
  candidateDist: number,
  best: Unit,
  bestDist: number,
): boolean {
  if (candidateDist !== bestDist) return candidateDist < bestDist;
  if (candidate.currentHp !== best.currentHp) return candidate.currentHp < best.currentHp;
  return candidate.id < best.id;
}

/**
 * E5 — target stickiness. Called once per free unit by the selector
 * (`World.tick`, before behaviors poll) so the re-target decision and its
 * `outOfLosTicks` counter advance exactly once per tick — never twice from
 * MovementBehavior + AbilityBehavior both resolving a target.
 *
 * A committed unit keeps its target until one of:
 *   (a) the target died / vanished / is no longer a valid enemy → re-pick
 *       the nearest enemy immediately;
 *   (b) another enemy is at least `SIM.retargetCloserRatio`x closer than
 *       the current one — the "a much better opportunity opened up" switch;
 *   (c) (ranged only) the target has been out of line-of-sight for
 *       `SIM.rangedRetargetLosTicks` — stop chasing a target hiding behind
 *       a wall and re-pick.
 *
 * Neutrals (walls/half-cover) never target, so they short-circuit.
 */
export function updateTarget(unit: Unit, world: World): void {
  if (unit.team === 'neutral') return;

  const committed = unit.targetId !== null ? world.findUnit(unit.targetId) : undefined;
  const valid =
    committed !== undefined &&
    committed.team !== unit.team &&
    committed.team !== 'neutral' &&
    committed.currentHp > 0;

  if (!valid) {
    // (a) no valid commitment → take the nearest enemy.
    const nearest = findTarget(unit, world);
    unit.targetId = nearest ? nearest.id : null;
    unit.outOfLosTicks = 0;
    return;
  }

  const current = committed;
  const nearest = findTarget(unit, world);

  // (c) ranged: drop a target we've been unable to see for too long.
  if (unit.archetype === 'ranged') {
    const visible = hasLineOfSight(unit.position, current.position, collectLosBlockers(world));
    if (visible) {
      unit.outOfLosTicks = 0;
    } else if (++unit.outOfLosTicks >= SIM.rangedRetargetLosTicks) {
      unit.outOfLosTicks = 0;
      if (nearest && nearest.id !== current.id) {
        unit.targetId = nearest.id;
        return;
      }
    }
  }

  // (b) switch only when a rival is markedly closer than the current target.
  if (nearest && nearest.id !== current.id) {
    const curDist = chebyshev(unit.position, current.position);
    const nearDist = chebyshev(unit.position, nearest.position);
    if (nearDist * SIM.retargetCloserRatio < curDist) {
      unit.targetId = nearest.id;
      unit.outOfLosTicks = 0;
    }
  }
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
  return findTarget(unit, world);
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
