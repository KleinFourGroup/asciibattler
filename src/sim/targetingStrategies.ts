import type { Unit } from './Unit';
import type { World } from './World';
// `config/units` calls `knownTargetingIds()` while it loads, so nothing
// imported here may reach `config/units`: a path back is an import cycle, and
// a test file that loads this module first fails (gotcha #114).
import { SIM } from '../config/sim';
import { distanceBetween } from '../core/grid';

/**
 * The per-archetype target-selection policy. Each archetype names a strategy
 * id in `config/units.json`, checked against this registry at load
 * (`knownTargetingIds`, in `src/config/units.ts`). The id is set on
 * `Unit.targeting` at spawn, and `Targeting.ts` looks its strategy up here
 * at each pick.
 *
 * A strategy is two pure decisions over a unit's hostile candidates:
 *   - `compare` ranks two candidates, for the pick (`findTarget`);
 *   - `shouldRetarget` decides whether a still-valid committed target is
 *     left for a fresh pick (`updateTarget`).
 *
 * Adding a strategy: implement the interface and add it to `STRATEGIES`; the
 * archetype schema takes the new id through `knownTargetingIds()`.
 */
interface TargetingStrategy {
  readonly id: string;
  /**
   * Compares two eligible candidates of `unit`: below 0 when `candidate` is
   * the better target than `best`, above 0 when worse, 0 when neither is.
   * `findTarget` reduces the eligible set with it. `nearest` does not read
   * `world`.
   */
  compare(candidate: Unit, best: Unit, unit: Unit, world: World): number;
  /**
   * Stickiness: given a still-valid committed `current` and the strategy's
   * fresh `candidate` (known to differ from it), is the candidate upgrade
   * enough to switch to? `nearest` switches only when markedly closer.
   */
  shouldRetarget(unit: Unit, current: Unit, candidate: Unit, world: World): boolean;
}

/**
 * The alignment tie: the displacement's minor axis, `min(|dx|, |dy|)`.
 * Among candidates at equal Chebyshev distance (which is the major axis),
 * the smaller minor offset is the enemy most directly ahead or beside,
 * nearest the unit's own row or column, with no forward vector needed.
 * Symmetric under both mirrors, the x/y swap and the 180° rotation, so
 * neither team nor side of the board is preferred (see `nearest`).
 */
function minorAxisOffset(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The default, and every shipped archetype's: the nearest hostile, ties to
 * lower `currentHp`, then the most aligned (`minorAxisOffset`, the enemy
 * nearest the unit's own row or column), then lower `id`. Without the
 * alignment tie, a tie on distance and HP goes to the lowest id, which is
 * spawn order, the leftmost opponent, and a whole team commits to one flank;
 * the id now decides only true mirror pairs.
 */
const nearest: TargetingStrategy = {
  id: 'nearest',
  compare(candidate, best, unit) {
    const cd = distanceBetween(unit.position, candidate.position);
    const bd = distanceBetween(unit.position, best.position);
    if (cd !== bd) return cd - bd;
    if (candidate.currentHp !== best.currentHp) return candidate.currentHp - best.currentHp;
    const ca = minorAxisOffset(unit.position, candidate.position);
    const ba = minorAxisOffset(unit.position, best.position);
    if (ca !== ba) return ca - ba;
    return candidate.id - best.id;
  },
  shouldRetarget(unit, current, candidate) {
    // Switch only when a rival is markedly closer than the commitment, so a
    // unit doesn't thrash between two near targets.
    const curDist = distanceBetween(unit.position, current.position);
    const nearDist = distanceBetween(unit.position, candidate.position);
    return nearDist * SIM.retargetCloserRatio < curDist;
  },
};

const STRATEGIES: Record<string, TargetingStrategy> = {
  [nearest.id]: nearest,
};

export function getTargetingStrategy(id: string): TargetingStrategy {
  const strategy = STRATEGIES[id];
  if (!strategy) {
    throw new Error(`getTargetingStrategy: no strategy registered for targeting id '${id}'`);
  }
  return strategy;
}

export function knownTargetingIds(): readonly string[] {
  return Object.keys(STRATEGIES);
}
