import type { Unit } from './Unit';
import type { World } from './World';
import { SIM } from '../config/sim';

/**
 * Per-archetype target-SELECTION policy. Each archetype declares a strategy
 * id in `config/archetypes.json`, validated against this registry at load
 * (mirrors `AbilityIdSchema` in `src/config/archetypes.ts`). The id is
 * resolved to a strategy at spawn and stashed on `Unit.targeting` — the same
 * resolve-at-spawn convention as `glyph` / `attackRange` / `abilities`, which
 * keeps the leaf `Targeting.ts` free of the archetype-config layer (no
 * config → registry → strikes → Targeting import cycle).
 *
 * A strategy is two pure decisions over a unit's *enemy* candidates:
 *   - `compare` ranks two candidates → drives the per-tick pick (`findTarget`).
 *   - `shouldRetarget` is the E5 stickiness switch → drives whether a still-
 *     valid committed target is abandoned for a fresher pick (`updateTarget`).
 *
 * Adding a strategy: implement the interface, add it to `STRATEGIES`. The
 * archetype-config schema picks the new id up automatically via
 * `knownTargetingIds()`.
 */
export interface TargetingStrategy {
  readonly id: string;
  /**
   * Comparator over two eligible enemy candidates of `unit`. Returns < 0 when
   * `candidate` is a better target than `best`, > 0 when worse, 0 when
   * indistinguishable. `findTarget` reduces the eligible-enemy set with this.
   * `world` is passed for future world-aware strategies (threat, LOS, …);
   * the current two ignore it.
   */
  compare(candidate: Unit, best: Unit, unit: Unit, world: World): number;
  /**
   * E5 target stickiness. Given a still-valid committed `current` target and
   * the strategy's freshly-picked `candidate` (already known to differ from
   * `current`), is the candidate enough of an upgrade to switch to? `nearest`
   * switches only when markedly closer; `weakest` never does (an assassin
   * holds its mark until it dies — rule (a) handles the on-death re-pick).
   */
  shouldRetarget(unit: Unit, current: Unit, candidate: Unit, world: World): boolean;
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The historical default: nearest living enemy, ties to lower `currentHp`,
 * then lower `id`. Extracted verbatim from the pre-strategy `findTarget` +
 * `updateTarget` rule (b), so every existing non-rogue unit is byte-identical.
 */
const nearest: TargetingStrategy = {
  id: 'nearest',
  compare(candidate, best, unit) {
    const cd = chebyshev(unit.position, candidate.position);
    const bd = chebyshev(unit.position, best.position);
    if (cd !== bd) return cd - bd;
    if (candidate.currentHp !== best.currentHp) return candidate.currentHp - best.currentHp;
    return candidate.id - best.id;
  },
  shouldRetarget(unit, current, candidate) {
    // Switch only when a rival is markedly closer than the commitment — the
    // anti-thrash margin E5 introduced.
    const curDist = chebyshev(unit.position, current.position);
    const nearDist = chebyshev(unit.position, candidate.position);
    return nearDist * SIM.retargetCloserRatio < curDist;
  },
};

/**
 * The rogue's assassin policy: the squishiest enemy (lowest `derived.maxHp` —
 * structural max HP, which for the melee/ranged enemy pool means the ranged
 * backline), ties to nearer, then lower `id`. Stays committed to its mark
 * until it dies (never distance-thrashes), so the fast, fragile rogue can
 * actually reach + delete the backline instead of chasing the front tank.
 */
const weakest: TargetingStrategy = {
  id: 'weakest',
  compare(candidate, best, unit) {
    if (candidate.derived.maxHp !== best.derived.maxHp) {
      return candidate.derived.maxHp - best.derived.maxHp;
    }
    const cd = chebyshev(unit.position, candidate.position);
    const bd = chebyshev(unit.position, best.position);
    if (cd !== bd) return cd - bd;
    return candidate.id - best.id;
  },
  shouldRetarget() {
    return false;
  },
};

const STRATEGIES: Record<string, TargetingStrategy> = {
  [nearest.id]: nearest,
  [weakest.id]: weakest,
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
