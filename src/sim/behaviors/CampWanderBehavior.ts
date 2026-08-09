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
 * §75f — the camp member's locomotion, behavior slot 0 from `spawnCampUnit`
 * (replacing the 75c placeholder `createMovementBehavior`; camp-ness can't
 * ride the catalog's `movementBehavior` value because a camp bandit shares
 * the enemy bandit's def — the 75c landing note). Two modes:
 *
 *   HOSTILE — `currentTarget` resolves an admissible mark (the §75e
 *     `hostileCandidate` gate scoped acquisition to the factions the camp is
 *     hostile to) → DELEGATE to the standard `MovementBehavior` engagement
 *     protocol wholesale: pursuit, firing cells, kiting, panic/frozen
 *     statuses, the §44 wait — camps fight exactly like combatants. A
 *     pursuing member may leave the leash (the leash bounds IDLING, not
 *     retaliation — the camps.ts doc). A support-archetype camp member
 *     deliberately gets the same charger delegate: the healer protocol
 *     trails a faction army's centroid and heals `team`-mates — which for
 *     'neutral' would include walls — so camp content ships charger-only.
 *
 *   PASSIVE — the leash-filtered wander. Per eligible poll (free, move off
 *     cooldown, not status-rooted) roll `SIM.campWanderChancePerTick` (the
 *     loader-derived per-tick threshold of the per-second author knob — a
 *     failed roll sets no cooldown, so eligible polls repeat every tick;
 *     the 75j verdicts caught the tick-rate coupling) on the presence-gated
 *     `campRng` and take one uniform step among the free in-leash neighbor
 *     cells. Standing ON the camp's anchor tile skips the
 *     chance gate entirely — vacating the drip portal ASAP is what keeps the
 *     pending queue flowing (the 75c "drip cadence IS the tile vacating"
 *     fact; the vacate-≤N-ticks exit invariant pins it). A member displaced
 *     BEYOND the leash (shove/knockback) self-heals: its candidate set
 *     becomes the neighbors that strictly reduce distance to the anchor.
 *
 * RNG discipline: every draw rides `world.campRng` (never `rng`/`combatRng`
 * — stream separation), and camp units only exist on camp-bearing worlds, so
 * fuzz byte-identity on camp-free layouts holds structurally. Draw shape per
 * eligible poll: 1 chance roll (skipped on the anchor) + 1 pick (skipped for
 * a singleton candidate set — the #111 zero-draw rule). The standing
 * NO-RNG-IN-MOVEMENT doctrine (§43–46) governs faction pathing symmetry;
 * camp idle wander on its own stream is the kickoff shape-lock's signed
 * exception (the cut line names `campRng`).
 *
 * Wander steps are single-cell (`unit.position` neighbors): every shipped
 * camp archetype is a 1×1 combatant def; a multi-tile camp body would need a
 * footprint-aware candidate scan (the 75c N×N note — first real multi-tile
 * combatant pays it).
 */
export class CampWanderBehavior implements Behavior {
  static readonly kind = 'camp';
  readonly kind = CampWanderBehavior.kind;

  /** The hostile-mode delegate — stateless, so one shared instance. */
  private readonly engage = new MovementBehavior();

  proposeAction(unit: Unit, world: World): ActionProposal | null {
    if (currentTarget(unit, world) !== null) {
      return this.engage.proposeAction(unit, world);
    }

    // Passive wander. Status roots (frozen) suppress it; the delegate above
    // handles its own flags.
    if (behaviorFlags(unit.effects).preventsMove) return null;
    const camp = unit.campId !== null ? world.campById(unit.campId) : undefined;
    const rng = world.campRng;
    if (camp === undefined || rng === null) return null;
    // Move on cooldown → no proposal AND no draw, so the chance reads as
    // per-ELIGIBLE-poll and the stream isn't burned on locked-out ticks.
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
 * The free neighbor cells a passive wander may step onto: in-bounds, finite
 * tile cost, unoccupied AND unclaimed (the same strict commit gate as the
 * drip's placement scan — gotcha #113's rule, softened for nobody), and
 * inside the leash — or, when the unit is already OUTSIDE the leash,
 * strictly closer to the anchor (the self-healing walk-back). Fixed
 * `NEIGHBORS` expansion order keeps the set (and thus the uniform pick)
 * deterministic.
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
