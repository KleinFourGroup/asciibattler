/**
 * Decision interface for headless run drivers. A strategy decides:
 *   - which frontier node to enter from the map screen, and
 *   - which recruit to take from the post-victory offer.
 *
 * Both methods receive a read-only view of the live `Run` so a strategy
 * can inspect team composition, current floor, etc. They must be pure
 * w.r.t. the supplied RNG — that's the determinism contract: same seed
 * + same strategy → same decisions every run. Strategies don't call
 * `run.dispatch`; the harness owns the channel and consumes returned
 * decisions.
 *
 * Future: a `pickBattleCommand` method will join these once C5 fills in
 * `WorldCommand`. Keeping the interface minimal now means harness code
 * doesn't carry a placeholder shape.
 */

import type { RNG } from '../../src/core/RNG';
import type { Run } from '../../src/run/Run';
import type { UnitTemplate } from '../../src/sim/Unit';

export interface FuzzStrategy {
  readonly name: string;
  pickNextNode(frontier: readonly number[], run: Run, rng: RNG): number;
  /**
   * Offer index to recruit, or `null` to PASS (H6b — decline the offer).
   * The harness dispatches `passRecruit` on `null`. Existing policies never
   * return `null`, so their draw sequences (and fuzz baselines) are unchanged.
   */
  pickRecruit(offer: readonly UnitTemplate[], run: Run, rng: RNG): number | null;
}
