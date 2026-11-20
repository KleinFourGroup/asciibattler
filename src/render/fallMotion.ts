/**
 * A fallen unit's last motion, in place of a death's fade (`unit:fell`,
 * then its `unit:died`): the glyph leaves the board through the tile it
 * fell into. Pure, so its shape is pinned headless; the renderer drives it
 * per frame (BattleRenderer `updateFalls`).
 *
 * The slide has already carried the glyph down to the tile's surface (a
 * chasm's top sits deep, water's shallow), and the terrain's top face hides
 * what sinks below it, so a fall reads as going under that surface.
 *
 * - a chasm, the plunge: the glyph drops, quicker as it goes, as a weight
 *   falls, under the pit's floor before it fades.
 * - deep water, the splash: it drops under fast, in a burst of spray the
 *   renderer throws up around it (`spawnWaterSplash`).
 */

export type FallInto = 'chasm' | 'deep_water';

/** The glyph's offset and look at one point of its fall. */
export interface FallPose {
  /** World units added to the glyph's height, never above 0. */
  readonly dy: number;
  /** The sprite's size multiplier (1 = a unit glyph's). */
  readonly size: number;
  readonly alpha: number;
}

/** Each fall's length in seconds. */
export const FALL_SECONDS: Readonly<Record<FallInto, number>> = {
  chasm: 0.55,
  deep_water: 0.45,
};

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** The pose at `t`, 0 at the fall's start and 1 at its end. */
export function fallPose(into: FallInto, t: number): FallPose {
  const u = clamp01(t);
  if (into === 'chasm') {
    // Gravity's curve: slow off the edge, fast at the bottom; the glyph is
    // under the pit's floor well before the fade ends.
    return { dy: -2 * u * u, size: 1 - 0.3 * u, alpha: u < 0.7 ? 1 : (1 - u) / 0.3 };
  }
  return { dy: -1.2 * u * u, size: 1, alpha: u < 0.5 ? 1 : (1 - u) / 0.5 };
}
