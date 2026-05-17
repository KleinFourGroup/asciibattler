/**
 * Post-victory unit-offer generation. Step 4.4.
 *
 * Each offered unit is rolled independently: pick an archetype uniformly,
 * then roll stats inside that archetype's bounds. No scaling by floor /
 * battle count for MVP (per CHECKPOINT 6 the user may want to revisit
 * difficulty scaling — keeping the offer-roll flat is the no-decision
 * default).
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit, type Archetype } from './../sim/archetypes';

const ARCHETYPES: readonly Archetype[] = ['melee', 'ranged'] as const;
const DEFAULT_OFFER_SIZE = 3;

export function rollOffer(rng: RNG, size: number = DEFAULT_OFFER_SIZE): UnitTemplate[] {
  const offer: UnitTemplate[] = [];
  for (let i = 0; i < size; i++) {
    const archetype = rng.pick(ARCHETYPES);
    offer.push(rollUnit(archetype, rng));
  }
  return offer;
}
