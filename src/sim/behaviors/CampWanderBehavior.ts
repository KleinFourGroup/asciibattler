import type { Behavior, Unit } from '../Unit';
import type { World } from '../World';
import type { GridCoord } from '../../core/types';
import type { ActionProposal } from '../Action';
import { currentTarget } from '../Targeting';
import { MovementBehavior } from './MovementBehavior';
import { moveProposal, stepDurationTicks, chebyshev } from '../movement';
import { isFree, claimantOf, cellsOccupiedBy } from '../occupancy';
import { NEIGHBORS } from '../positioning';
import { behaviorFlags } from '../statusBehavior';
import { getCamp } from '../../config/camps';
import { SIM } from '../../config/sim';

/**
 * A camp member's movement, the behaviour `World.spawnCampUnit` wires. Being
 * a camp member can't ride the catalog's `movementBehavior`, since a camp
 * bandit shares the enemy bandit's def. Two modes:
 *
 *   Hostile — `currentTarget` resolves a mark (`hostileCandidate` keeps the
 *     picks to the teams the camp is hostile to): hand the poll to
 *     `MovementBehavior` whole, the pursuit, firing cells, kite, statuses
 *     and waits, so a camp fights as combatants do. A pursuing member may
 *     leave the leash, which bounds idling, not fighting. A support
 *     archetype would get the same delegate, not the healer's protocol,
 *     which follows its team's army and heals its team, the neutral
 *     team's scenery included; no camp lists one.
 *
 *   Passive — the leashed wander. On each eligible poll (free, the move off
 *     cooldown, not rooted by a status) roll `SIM.campWanderChancePerTick`
 *     on `campRng` and take one uniform step among the free neighbours in
 *     the leash. The chance is per tick, derived by the loader from the
 *     per-second knob, since a failed roll sets no cooldown and the poll
 *     comes again next tick. On the camp's anchor the roll is skipped: the
 *     drip seats the next member there, so leaving it at once keeps the
 *     queue moving (`CampWanderBehavior.test.ts` holds how soon). A member
 *     outside the leash, after a pursuit, walks back: its candidates become
 *     the neighbours strictly nearer the anchor.
 *
 * Every draw is on `world.campRng`, never `rng` or `combatRng`, and a camp
 * member exists only on a board with camps, so a board without one draws
 * nothing here. Per eligible poll: one chance roll (none on the anchor) and
 * one pick (none for a single candidate, gotcha #111). Pathing draws no RNG,
 * which keeps the teams' movement symmetric; the camp's idle wander, on its
 * own stream, is a signed exception.
 *
 * A wander step is one cell from `unit.position`: every camp archetype is a
 * one-cell combatant. A larger camp body would need a candidate scan over
 * its whole block.
 */
export class CampWanderBehavior implements Behavior {
  static readonly kind = 'camp';
  readonly kind = CampWanderBehavior.kind;

  /** The hostile mode's delegate; it holds no state. */
  private readonly engage = new MovementBehavior();

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    if (currentTarget(unit, world) !== null) {
      return this.engage.proposeAction(unit, world);
    }

    // The passive wander. A status that roots (frozen) stops it; the delegate
    // above reads its own flags.
    if (behaviorFlags(unit.effects).preventsMove) return null;
    const camp = unit.campId !== null ? world.campById(unit.campId) : undefined;
    const rng = world.campRng;
    if (camp === undefined || rng === null) return null;
    // The move on cooldown: no proposal and no draw, so the chance is per
    // eligible poll and the stream is not spent on locked ticks.
    if ((unit.actionCooldowns.get('move') ?? 0) > 0) return null;

    const onAnchor = cellsOccupiedBy(unit).some(
      (c) => c.x === camp.anchor.x && c.y === camp.anchor.y,
    );
    if (!onAnchor && rng.next() >= SIM.campWanderChancePerTick) return null;

    const leash = getCamp(camp.defId)?.leashRadius ?? 0;
    const candidates = wanderCandidates(unit, world, camp.anchor, leash);
    if (candidates.length === 0) return null;
    const dest =
      candidates.length === 1
        ? candidates[0]!
        : candidates[Math.floor(rng.next() * candidates.length)]!;
    return moveProposal(
      unit.position,
      dest,
      stepDurationTicks(world, dest, unit.derived.moveCooldownTicks),
    );
  }
}

/**
 * The free neighbours a passive wander may step onto: in bounds, of finite
 * tile cost, unoccupied and unclaimed (the drip's placement test; gotcha
 * #113), and inside the leash, or, for a unit already outside it, strictly
 * nearer the anchor (the walk back). The fixed `NEIGHBORS` order keeps the
 * set, and so the pick, deterministic.
 */
function wanderCandidates(
  unit: Unit,
  world: World,
  anchor: GridCoord,
  leash: number,
): GridCoord[] {
  const fromDist = chebyshev(unit.position, anchor);
  const outsideLeash = fromDist > leash;
  const out: GridCoord[] = [];
  for (const [dx, dy] of NEIGHBORS) {
    const c = { x: unit.position.x + dx, y: unit.position.y + dy };
    if (c.x < 0 || c.y < 0 || c.x >= world.gridW || c.y >= world.gridH) continue;
    if (!isFinite(world.tileGrid.costAt(c))) continue;
    if (!isFree(world, c) || claimantOf(world, c) !== undefined) continue;
    const d = chebyshev(c, anchor);
    if (outsideLeash ? d < fromDist : d <= leash) out.push(c);
  }
  return out;
}
