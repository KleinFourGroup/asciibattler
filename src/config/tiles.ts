/**
 * Tile config, from `config/tiles.json`. A fire tile's burn and a healing
 * tile's mend are the `burn` and `rejuvenate` statuses' rates
 * (`config/statuses.json`), which the tile sustains on a unit standing on it.
 *
 * §37d — `applyStatusOnEnter` gates the tile→status APPLY direction (the
 * `TileDef.statusOnEnter` hook, fired by `World.applyTileEnterEffects` on a
 * move's logical commit). Today its only subject is the mud→poison trial
 * (USER-LOCKED default ON, easy to flip if a playtest dislikes it). The REMOVE
 * direction (water/deep_water → strip `burn`, `statusRemovedOnEnter`) is the
 * clearly-good inverse of fire→burn and is NOT gated — it's always on.
 */

import { z } from 'zod';
import tilesJson from '../../config/tiles.json';

const TilesSchema = z.object({
  /**
   * §37d — whether a tile's `statusOnEnter` (the mud→poison trial) is honoured
   * on enter. Gates only the APPLY direction; `statusRemovedOnEnter` is unaffected.
   */
  applyStatusOnEnter: z.boolean(),
});

export const TILES_CONFIG = TilesSchema.parse(tilesJson);
