/**
 * J1 — objective-system tunables. Source of truth at `config/objective.json`.
 * Mirrors the `config/sim.json` pattern (A4: parse at module load, throw on
 * malformed JSON). Distances, not timings — passed through verbatim (no
 * `secondsToTicks` conversion).
 *
 *   rangedLeashCells — the "leash" radius (Chebyshev) a player unit pursuing
 *     the shared objective will break off within to engage an enemy. A unit's
 *     actual engage radius is `min(attackRange, rangedLeashCells)`, so this
 *     CAPS a long-range unit well below its full reach — an archer doesn't
 *     abandon the objective to plink every distant enemy (the ROADMAP §J1
 *     "upper limit") — while leaving melee (range 1) untouched. Beyond the
 *     leash, only RETALIATION (an enemy actively attacking the unit, within
 *     the unit's own attackRange) pulls it off the objective. Higher → unit is
 *     more easily distracted from the objective by nearby enemies.
 */

import { z } from 'zod';
import objectiveJson from '../../config/objective.json';

const ObjectiveSchema = z.object({
  rangedLeashCells: z.number().int().positive(),
});

const parsed = ObjectiveSchema.parse(objectiveJson);

export const OBJECTIVE = {
  rangedLeashCells: parsed.rangedLeashCells,
};
