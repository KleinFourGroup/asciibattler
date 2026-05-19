/**
 * Pure-random strategy: every choice is a uniform draw from the
 * available options. The "no information" baseline — every other
 * strategy should beat this on average, otherwise the strategy isn't
 * pulling its weight.
 */

import type { FuzzStrategy } from '../Strategy';
import type { RNG } from '../../../src/core/RNG';
import type { Run } from '../../../src/run/Run';
import type { UnitTemplate } from '../../../src/sim/Unit';

export class PureRandomStrategy implements FuzzStrategy {
  readonly name = 'pure-random';

  pickNextNode(frontier: readonly number[], _run: Run, rng: RNG): number {
    return rng.pick(frontier);
  }

  pickRecruit(offer: readonly UnitTemplate[], _run: Run, rng: RNG): number {
    return rng.int(0, offer.length - 1);
  }
}
