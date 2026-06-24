/**
 * Tile-effect rates for the `fire` and `healing` TileKinds, authored in
 * "HP per second" (gotcha #6). Source of truth at `config/tiles.json`; zod-
 * validated at module load (the A4 pattern — malformed JSON crashes loudly).
 *
 * 27d — these rates are now the AUTHORING source the `burn` / `rejuvenate`
 * statuses (`config/statuses.json`) match: a fire tile sustains `burn` and a
 * healing tile sustains `rejuvenate` (see `World.applyTileStatuses`), so the
 * actual HP change is the status's periodic DoT/HoT, routed through the single
 * `dealDamage` / HoT-clamp path. The D7.B per-tick `ticksPerDamage` cadence pass
 * is retired; the only consumer left is the §27c balance-proof, which asserts
 * `burn`'s per-second damage == `fire.damagePerSec` and `rejuvenate`'s ==
 * `healing.amountPerSec` (derived from config, never hardcoded).
 */

import { z } from 'zod';
import tilesJson from '../../config/tiles.json';

const TilesSchema = z.object({
  fire: z.object({
    /** HP/sec a unit standing on a fire tile takes (→ the `burn` DoT rate). */
    damagePerSec: z.number().positive(),
  }),
  healing: z.object({
    /** HP/sec a unit standing on a healing tile regains (→ the `rejuvenate` HoT rate). */
    amountPerSec: z.number().positive(),
  }),
});

/** Authored rates exposed for the balance-proof / debug overlays. */
export const TILES_CONFIG = TilesSchema.parse(tilesJson);
