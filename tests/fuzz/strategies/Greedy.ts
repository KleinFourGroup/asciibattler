/**
 * Greedy strategy: recruits prefer the archetype with the lowest current
 * count, breaking ties randomly. Map-node choice stays random — the
 * underlying NodeMap doesn't carry per-node difficulty hints today, so
 * any heuristic would be speculative until C6 adds tile / encounter
 * variation. Update this when we have something to weigh.
 *
 * The expected effect at MVP scope: greedy keeps team composition
 * balanced (3M+2R → +R, then +M, etc.) instead of stacking one archetype
 * — should yield better win rates if balance is meaningful, and similar
 * win rates if archetype mix doesn't matter much at this depth. Either
 * outcome is data we want.
 */

import type { FuzzStrategy } from '../Strategy';
import type { RNG } from '../../../src/core/RNG';
import type { Run } from '../../../src/run/Run';
import type { UnitTemplate } from '../../../src/sim/Unit';
import { ALL_ARCHETYPES, type Archetype } from '../../../src/sim/archetypes';

export class GreedyStrategy implements FuzzStrategy {
  readonly name = 'greedy';

  pickNextNode(frontier: readonly number[], _run: Run, rng: RNG): number {
    return rng.pick(frontier);
  }

  pickRecruit(offer: readonly UnitTemplate[], run: Run, rng: RNG): number {
    const counts = countByArchetype(run.team);
    let bestIdx = 0;
    let bestCount = Infinity;
    const ties: number[] = [];
    for (let i = 0; i < offer.length; i++) {
      const c = counts[offer[i]!.archetype];
      if (c < bestCount) {
        bestCount = c;
        bestIdx = i;
        ties.length = 0;
        ties.push(i);
      } else if (c === bestCount) {
        ties.push(i);
      }
    }
    return ties.length > 1 ? rng.pick(ties) : bestIdx;
  }
}

function countByArchetype(team: readonly UnitTemplate[]): Record<Archetype, number> {
  // Initialize every archetype to 0 (F1 widened the recruit pool past
  // melee/ranged) so a new-archetype offer reads a real 0, not undefined.
  const counts = Object.fromEntries(ALL_ARCHETYPES.map((a) => [a, 0])) as Record<
    Archetype,
    number
  >;
  for (const t of team) counts[t.archetype]++;
  return counts;
}
