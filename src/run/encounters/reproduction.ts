/**
 * U3 — the **reproduction encounter**: a code-built `Encounter` that re-creates
 * today's random swarm as closely as the authored model allows, so the encounter
 * swap can land behind a single faithful fight before the catalog exists (V).
 *
 * It is built in CODE, not authored in `config/encounters.json`, on purpose: it
 * reads the LIVE `DIFFICULTY`/`HEALTH`/`DECK` so it stays a faithful balance
 * ANCHOR through Phase X's sweeps (which mutate those config objects in-process)
 * — a baked JSON copy would freeze today's numbers and drift the moment the band
 * is retuned.
 *
 * **Faithfulness to `rollEnemyWave`** (ROADMAP §U3 — "feel like today, NOT
 * byte-identical"):
 *  - `levelBudget: mean × budgetFactor`. The `mean` budget is `factor ×
 *    centralLevel × handSize = factor × playerTeamLevel` (the established
 *    difficulty basis), so this reproduces `enemyBudgetFor`'s
 *    `budgetFactor × playerTeamLevel` exactly (`budgetOffset` is 0, `minBudget`
 *    1 ≈ the resolver's own ≥-1-per-unit floor).
 *  - `count: hand × swarmMaxMultiplier`. AUTHORED (deterministic), so it drops
 *    `rollEnemyWave`'s random count draw AND its `count ≤ budget` bound — the
 *    user-accepted divergence (retuned at X; with the current 1.25 × 1.5 band the
 *    Hop-1 effect is minor since budget ≈ count there).
 *  - units: `bandit` (melee fodder) at weight `1 − archerRatio`, `ranged` at
 *    weight `archerRatio` — the `enemyArcherRatio` split. Uniform LEVEL weights,
 *    so the per-instance spread reduces to `distributeBudget`'s even split.
 *  - a `forever` loop of that one wave → a fresh roll every turn, as today.
 */

import { DIFFICULTY } from '../../config/difficulty';
import { HEALTH } from '../../config/health';
import type { Encounter } from '../../config/encounters';
import type { WaveSpec } from './wave';

/** The reserved id of the U3 reproduction encounter (persisted in the snapshot;
 *  `Run.fromJSON` re-synthesizes the encounter from it). */
export const REPRODUCTION_ENCOUNTER_ID = 'reproduction';

/**
 * Build the reproduction encounter from the live balance config. Called fresh in
 * `Run.beginEncounter` (and `fromJSON`) so it always reflects the current
 * `DIFFICULTY`/`HEALTH` — the property that keeps it tracking the band.
 */
export function reproductionEncounter(): Encounter {
  const wave: WaveSpec = {
    // mean × budgetFactor === budgetFactor × playerTeamLevel (see header).
    levelBudget: { kind: 'mean', factor: DIFFICULTY.budgetFactor },
    // hand × swarmMaxMultiplier — today's swarm cap (count basis = fielded hand).
    count: { kind: 'hand', factor: DIFFICULTY.swarmMaxMultiplier },
    units: [
      {
        archetype: 'bandit',
        count: { kind: 'weight', weight: 1 - DIFFICULTY.enemyArcherRatio },
        level: { kind: 'weight', weight: 1 },
      },
      {
        archetype: 'ranged',
        count: { kind: 'weight', weight: DIFFICULTY.enemyArcherRatio },
        level: { kind: 'weight', weight: 1 },
      },
    ],
  };
  return {
    id: REPRODUCTION_ENCOUNTER_ID,
    name: 'Brigands',
    description: 'A roving band of brigands — the everyday hostiles of the road.',
    healthPool: HEALTH.enemyHealthMax,
    kind: 'normal',
    waves: [{ kind: 'loop', body: [{ kind: 'wave', spec: wave }], repeat: 'forever' }],
  };
}
