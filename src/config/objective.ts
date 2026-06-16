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
 *
 *   focusTileResolution (O3) — the strategy for a `focus` objective whose
 *     target is a TILE (not an enemy). The brief wants all three switchable so
 *     playtest can A/B; they live as one keyed resolver (`src/sim/focusTile.ts`),
 *     this knob selects which is live:
 *       - `disallow` — a tile focus is rejected (the team reverts to `atWill`
 *         at once); only an enemy focus is honored. Simplest, least control.
 *       - `clearOnArrival` — units beeline to the tile ignoring enemies; once
 *         any team unit reaches it, the team focus reverts to `atWill`.
 *       - `leashAtNearest` (DEFAULT) — units beeline to the tile, then once
 *         within `rangedLeashCells` of it adopt the standard engage leash THERE
 *         (engage nearby enemies, persist). Most intuitive (the brief's lean).
 */

import { z } from 'zod';
import objectiveJson from '../../config/objective.json';

/** O3 — the switchable focus-tile resolution strategy keys (see `focusTile.ts`). */
export const FOCUS_TILE_RESOLUTIONS = ['disallow', 'clearOnArrival', 'leashAtNearest'] as const;
export type FocusTileResolutionKey = (typeof FOCUS_TILE_RESOLUTIONS)[number];

const ObjectiveSchema = z.object({
  rangedLeashCells: z.number().int().positive(),
  focusTileResolution: z.enum(FOCUS_TILE_RESOLUTIONS),
});

const parsed = ObjectiveSchema.parse(objectiveJson);

export const OBJECTIVE = {
  rangedLeashCells: parsed.rangedLeashCells,
  focusTileResolution: parsed.focusTileResolution,
};
