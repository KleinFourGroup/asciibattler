/**
 * Post-victory unit-offer generation. Step 4.4; tuned at CHECKPOINT 6.
 *
 * Each offered unit is rolled independently (archetype uniformly, stats
 * inside that archetype's bounds). The one constraint: every offer of size
 * >= 2 contains at least one melee AND one ranged — purely independent
 * rolls would too often produce all-same-archetype offers, which feels
 * like a bad-luck choice rather than a real one.
 *
 * No floor / battle-count scaling on the offer: difficulty ramp lives on
 * the enemy side (see Run.ts).
 */

import type { RNG } from '../core/RNG';
import type { UnitTemplate } from '../sim/Unit';
import { rollUnit, type Archetype } from './../sim/archetypes';
import { RECRUITMENT } from '../config/recruitment';

export function rollOffer(
  rng: RNG,
  size: number = RECRUITMENT.defaultOfferSize,
): UnitTemplate[] {
  if (size <= 0) return [];
  if (size === 1) {
    return [rollUnit(rng.pick(['melee', 'ranged'] as const), rng)];
  }

  // Reserve one slot for a guaranteed melee and one for a guaranteed ranged.
  // The remaining slots roll archetype uniformly.
  const archetypes: Archetype[] = new Array(size).fill(null) as Archetype[];
  const meleeSlot = rng.int(0, size - 1);
  let rangedSlot = rng.int(0, size - 1);
  while (rangedSlot === meleeSlot) rangedSlot = rng.int(0, size - 1);
  archetypes[meleeSlot] = 'melee';
  archetypes[rangedSlot] = 'ranged';
  for (let i = 0; i < size; i++) {
    archetypes[i] ??= rng.pick(['melee', 'ranged'] as const);
  }

  return archetypes.map((a) => rollUnit(a, rng));
}
