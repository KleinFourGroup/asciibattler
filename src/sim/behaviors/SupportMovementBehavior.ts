import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { MoveAction } from '../actions/MoveAction';
import { findTarget, lowestWoundedAlly } from '../Targeting';
import { findPath } from '../Pathfinding';
import { SIM } from '../../config/sim';

/**
 * E7.B — the healer's movement, replacing the default `MovementBehavior`
 * (which charges the nearest *enemy* — exactly wrong for a support unit).
 * The healer never seeks combat; it positions to keep allies in heal range
 * and flees when threatened with nobody to heal. Assigned per-archetype in
 * `World.spawnUnit`; the heal itself rides on `AbilityBehavior` (the
 * `heal_ally` ability, score 10), so this behavior only fires when no heal
 * is available this tick.
 *
 * Per-tick decision (highest applicable wins; `heal_ally` at 10 outranks
 * everything here, so a healable ally in range always pre-empts movement):
 *
 *   1. A wounded ally (incl. self) is already in heal range → abstain
 *      (null). Hold position and let `heal_ally` fire, or wait out its
 *      cooldown — matches the ROADMAP E7 rule "allies in healing range →
 *      heal/idle, don't retreat."
 *   2. Else the nearest enemy is within `SIM.healerPanicRangeCells` →
 *      PANIC-RETREAT one cell directly away (score 5 — the ROADMAP value,
 *      above movement, below the heal). The kite emerges from the healer's
 *      `speed` vs. the enemy's re-approach, same engine as the rogue.
 *   3. Else a wounded ally exists but is out of range → step toward the
 *      nearest one (score 1) to bring it into heal range.
 *   4. Else trail the CENTROID of its living allies, stepping whenever it's
 *      more than `SIM.healerFollowGapCells` from that point (score 1), so it
 *      stays tucked mid-formation; abstain once inside the gap or if it has
 *      no living allies. Anchoring on the centroid (not the nearest ally, at
 *      the full heal range) is what makes the follow read as a smooth trail
 *      rather than a static-then-lurch: the centroid drifts continuously as
 *      the army advances, and it lags the front line so the healer settles
 *      behind the fighters rather than hugging a charger into melee.
 *
 * Pathing reuses `findPath` with the same soft-block model as
 * `MovementBehavior`: neutrals (walls) are hard blockers, other units are
 * high-cost cells (`SIM.occupiedCellPenalty`) so the healer routes around
 * its own line but never deadlocks. A step onto a currently-occupied cell
 * is refused (abstain → natural queueing).
 */
export class SupportMovementBehavior implements Behavior {
  static readonly kind = 'support_movement';
  readonly kind = SupportMovementBehavior.kind;

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    const healRange = unit.derived.attackRange;

    // 1. A wounded ally (self included) is already healable → idle.
    if (lowestWoundedAlly(unit, world, healRange) !== null) return null;

    const durationTicks = unit.derived.moveCooldownTicks;

    // 2. Panic-retreat from a too-close enemy.
    const enemy = findTarget(unit, world);
    if (
      enemy !== null &&
      chebyshev(unit.position, enemy.position) <= SIM.healerPanicRangeCells
    ) {
      const away = stepAwayFrom(unit, enemy.position, world);
      return away === null ? null : moveProposal(unit.position, away, durationTicks, 5);
    }

    // 3. Approach the nearest wounded ally that's out of range.
    const wounded = nearestAlly(unit, world, (c) => c.currentHp < c.derived.maxHp);
    if (wounded !== null) {
      const to = stepToward(unit, wounded.position, world);
      return to === null ? null : moveProposal(unit.position, to, durationTicks, 1);
    }

    // 4. Trail the centroid of living allies to stay tucked in formation.
    const anchor = alliesCentroidCell(unit, world);
    if (anchor !== null && chebyshev(unit.position, anchor) > SIM.healerFollowGapCells) {
      const to = stepToward(unit, anchor, world);
      return to === null ? null : moveProposal(unit.position, to, durationTicks, 1);
    }

    // No wounded ally, no threat, already in formation (or alone) → idle.
    return null;
  }
}

function moveProposal(
  from: GridCoord,
  to: GridCoord,
  durationTicks: number,
  score: number,
): ActionProposal {
  return {
    action: new MoveAction(from, to, durationTicks),
    score,
    cooldown: durationTicks,
    duration: durationTicks,
  };
}

/**
 * Nearest living ally of `unit` (same team, excluding the unit itself)
 * matching `predicate`. Chebyshev distance; ties go to the lower id for
 * determinism. Self is excluded because these are *movement* targets — a
 * healer never walks toward its own cell (a wounded self is handled by the
 * in-range heal in step 1).
 */
function nearestAlly(
  unit: Unit,
  world: World,
  predicate: (c: Unit) => boolean,
): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const c of world.units) {
    if (c.team !== unit.team) continue;
    if (c.id === unit.id) continue;
    if (c.currentHp <= 0) continue;
    if (!predicate(c)) continue;
    const d = chebyshev(unit.position, c.position);
    if (best === null || d < bestDist || (d === bestDist && c.id < best.id)) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Cell-rounded centroid (average position) of `unit`'s living allies,
 * EXCLUDING the unit itself so its own position never anchors the point to
 * where it already stands. Returns null when the unit has no living allies.
 * Used as the healer's formation anchor: trailing the centroid keeps it
 * mid-pack and tracks the army's advance smoothly.
 */
function alliesCentroidCell(unit: Unit, world: World): GridCoord | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const c of world.units) {
    if (c.team !== unit.team) continue;
    if (c.id === unit.id) continue;
    if (c.currentHp <= 0) continue;
    sx += c.position.x;
    sy += c.position.y;
    n++;
  }
  if (n === 0) return null;
  return { x: Math.round(sx / n), y: Math.round(sy / n) };
}

/**
 * One A* step toward `goalPos`, or null when no path exists or the next
 * cell is occupied (abstain → queue). Neutrals hard-block; other units are
 * soft-cost. The occupant of the goal cell is un-blocked so a path to an
 * ally's own cell is reachable — the caller never actually steps onto it
 * (it stops once in heal range / once the ally is healable).
 */
function stepToward(unit: Unit, goalPos: GridCoord, world: World): GridCoord | null {
  const pathBlockers: GridCoord[] = [];
  const otherUnitCells = new Set<string>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    if (u.team === 'neutral') {
      pathBlockers.push(u.position);
      continue;
    }
    if (u.position.x === goalPos.x && u.position.y === goalPos.y) continue;
    otherUnitCells.add(key(u.position));
  }

  const path = findPath(
    unit.position,
    goalPos,
    pathBlockers,
    world.gridW,
    world.gridH,
    (c) => costAt(c, world, otherUnitCells),
  );
  if (path.length < 2) return null;
  const to = path[1]!;
  if (otherUnitCells.has(key(to))) return null;
  return to;
}

/**
 * One cell directly away from `enemyPos`: the passable, unoccupied neighbor
 * that strictly increases Chebyshev distance, ties broken toward open space
 * then fixed neighbor order. Returns null when boxed in (caller then holds).
 *
 * Mirrors `GambitStrikeAction.retreatCell` in shape, but retreats from the
 * nearest *enemy* (a movement choice) rather than from a just-struck target
 * (part of an action) — kept local rather than shared to avoid coupling the
 * two retreat semantics.
 */
function stepAwayFrom(unit: Unit, enemyPos: GridCoord, world: World): GridCoord | null {
  const occupied = new Set<string>();
  for (const u of world.units) {
    if (u.id === unit.id) continue;
    occupied.add(key(u.position));
  }

  const currentDist = chebyshev(unit.position, enemyPos);
  let best: GridCoord | null = null;
  let bestDist = -1;
  let bestOpenness = -1;
  for (const [dx, dy] of NEIGHBORS) {
    const c: GridCoord = { x: unit.position.x + dx, y: unit.position.y + dy };
    if (!passable(c, world, occupied)) continue;
    const dist = chebyshev(c, enemyPos);
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

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function countOpenNeighbors(c: GridCoord, world: World, occupied: ReadonlySet<string>): number {
  let n = 0;
  for (const [dx, dy] of NEIGHBORS) {
    if (passable({ x: c.x + dx, y: c.y + dy }, world, occupied)) n++;
  }
  return n;
}

function passable(c: GridCoord, world: World, occupied: ReadonlySet<string>): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) return false;
  if (!isFinite(world.tileGrid.costAt(c))) return false;
  if (occupied.has(key(c))) return false;
  return true;
}

function costAt(c: GridCoord, world: World, occupied: ReadonlySet<string>): number {
  const tileCost = world.tileGrid.costAt(c);
  if (!isFinite(tileCost)) return tileCost;
  if (occupied.has(key(c))) return tileCost + SIM.occupiedCellPenalty;
  return tileCost;
}

function key(c: GridCoord): string {
  return `${c.x},${c.y}`;
}

function chebyshev(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
