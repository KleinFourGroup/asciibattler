/**
 * D7.B: tile-effect knobs for the `fire` and `healing` TileKinds.
 * Source of truth at `config/tiles.json`. Rates are authored in
 * "HP per second" per gotcha #6 — `secondsToTicks` would round to a
 * tick count, but for tile effects we want the inverse: how many ticks
 * between effect events. Conversion runs at module load alongside zod
 * validation (the A4 pattern — malformed JSON crashes loudly at boot).
 *
 * Cadence model is global (gotcha #77 — see HANDOFF.md): every Nth
 * world tick, all units standing on an effect tile of the matching
 * kind take 1 HP of damage / heal. No per-unit accumulator — keeps
 * the snapshot shape and per-tick state pristine.
 */

import { z } from 'zod';
import tilesJson from '../../config/tiles.json';
import { TICK_RATE } from '../config';

const TilesSchema = z.object({
  fire: z.object({
    /** Authored as HP/sec. Converted to `ticksPerDamage` at parse time. */
    damagePerSec: z.number().positive(),
  }),
  healing: z.object({
    /** Authored as HP/sec. Converted to `ticksPerHeal` at parse time. */
    amountPerSec: z.number().positive(),
  }),
});

const PARSED = TilesSchema.parse(tilesJson);

/**
 * Ticks between consecutive fire-damage events. At `damagePerSec = 2`
 * and `TICK_RATE = 10`, this is 5 ticks. `Math.max(1, ...)` guards
 * against absurd rates (>= TICK_RATE per sec) that would round to 0
 * — a 0-tick cadence would apply damage every tick, faster than the
 * authored rate suggests.
 */
export const FIRE_TICKS_PER_DAMAGE: number = Math.max(
  1,
  Math.round(TICK_RATE / PARSED.fire.damagePerSec),
);

/** Ticks between consecutive healing events. Default 10 ticks (= 1 HP/sec). */
export const HEALING_TICKS_PER_HEAL: number = Math.max(
  1,
  Math.round(TICK_RATE / PARSED.healing.amountPerSec),
);

/** Authored rates exposed for tests / debug overlays. */
export const TILES_CONFIG = PARSED;
