import type { Unit } from './Unit';
import type { World } from './World';
import { SIM } from '../config/sim';

/**
 * Per-archetype target-SELECTION policy. Each archetype declares a strategy
 * id in `config/units.json`, validated against this registry at load
 * (mirrors `AbilityIdSchema` in `src/config/units.ts`). The id is
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
 * §43b2 — the ALIGNMENT tie layer: the displacement's minor-axis magnitude
 * `min(|dx|, |dy|)`. Among equal-Chebyshev candidates (whose distance IS the
 * major axis), the smaller minor offset is the enemy most directly ahead /
 * beside — nearest the unit's own row-or-column axis of advance, with no
 * forward vector needed. Symmetric under both axis mirrors, x/y swap, and
 * 180° rotation, so neither team nor board side is preferred (the whole
 * point — see `nearest`).
 */
function minorAxisOffset(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The historical default: nearest living enemy, ties to lower `currentHp`,
 * then (§43b2) most ALIGNED (smallest minor-axis offset — the enemy nearest
 * the unit's own column/row of advance), then lower `id`. Extracted verbatim
 * from the pre-strategy `findTarget` + `updateTarget` rule (b); §43b2
 * inserted the alignment layer because resolving the distance+HP tie
 * straight to lowest id = SPAWN order = the leftmost opponent — the measured
 * openField funnel (all 8 units probed committing to the same flank, the
 * fixture's residual ±1 drift after 43a). The id layer stays as the
 * deterministic last resort, but now only decides true mirror pairs (equal
 * distance, equal HP, equal alignment). The E5 stickiness (`shouldRetarget`)
 * is deliberately untouched — only the tie among fresh equal-distance picks
 * moved.
 */
const nearest: TargetingStrategy = {
  id: 'nearest',
  compare(candidate, best, unit) {
    const cd = chebyshev(unit.position, candidate.position);
    const bd = chebyshev(unit.position, best.position);
    if (cd !== bd) return cd - bd;
    if (candidate.currentHp !== best.currentHp) return candidate.currentHp - best.currentHp;
    const ca = minorAxisOffset(unit.position, candidate.position);
    const ba = minorAxisOffset(unit.position, best.position);
    if (ca !== ba) return ca - ba;
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
 *
 * §43b2 note — this chain's own distance-tie still resolves to lowest id
 * (= leftmost spawn), the same residual `nearest` had. DELIBERATELY left:
 * the user-locked 43b2 slot covers the `nearest` strategy, and no §42
 * instrument can see `weakest` (no rogue in the harness rosters) — an
 * unmeasured change here would be doctrine, not data. If a rogue-flank bias
 * ever reads in a playtest, insert the same `minorAxisOffset` layer before
 * the id and measure it then.
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
