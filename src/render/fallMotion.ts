/**
 * A fallen unit's last motion, in place of a death's fade (`unit:fell`,
 * then its `unit:died`): the glyph leaves the board through the tile it
 * fell into. Pure, so the shape of each arm is pinned headless; the
 * renderer drives it per frame (BattleRenderer `updateFalls`).
 *
 * The slide has already carried the glyph down to the tile's surface (a
 * chasm's top sits deep, water's shallow), and the terrain's top face hides
 * what sinks below it, so a fall reads as going under that surface.
 *
 * Two arms each, a taste call the user makes in play, switched by the
 * board panel's `fall` dial (src/dev/boardPanel):
 * - a chasm, `a` the plunge: the glyph drops, quicker as it goes, as a
 *   weight falls; `b` the fall away: it shrinks toward a point as if
 *   seen falling away from the camera, barely sinking.
 * - deep water, `a` the sink: the glyph settles under slowly, fading, with
 *   a slow ripple; `b` the splash: it drops under fast in a burst of spray.
 */

export type FallInto = 'chasm' | 'deep_water';
export type FallArm = 'a' | 'b';

/** The glyph's offset and look at one point of its fall. */
export interface FallPose {
  /** World units added to the glyph's height, never above 0. */
  readonly dy: number;
  /** The sprite's size multiplier (1 = a unit glyph's). */
  readonly size: number;
  readonly alpha: number;
}

/** Each arm's length in seconds. */
export const FALL_SECONDS: Readonly<Record<FallInto, Readonly<Record<FallArm, number>>>> = {
  chasm: { a: 0.55, b: 0.7 },
  deep_water: { a: 0.9, b: 0.45 },
};

/** The arm a fall is drawn with until the stop signs one: the board panel's
 *  `fall` dial sets it (`setFallArm`), a dev seam that goes with the dial. */
let currentArm: FallArm = 'a';
export function setFallArm(arm: FallArm): void {
  currentArm = arm;
}
export function fallArm(): FallArm {
  return currentArm;
}

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** The pose at `t`, 0 at the fall's start and 1 at its end. */
export function fallPose(into: FallInto, arm: FallArm, t: number): FallPose {
  const u = clamp01(t);
  if (into === 'chasm') {
    if (arm === 'a') {
      // Gravity's curve: slow off the edge, fast at the bottom; the glyph is
      // under the pit's floor well before the fade ends.
      return { dy: -2 * u * u, size: 1 - 0.3 * u, alpha: u < 0.7 ? 1 : (1 - u) / 0.3 };
    }
    return { dy: -0.3 * u, size: Math.pow(1 - u, 1.5), alpha: 1 - u * u * u };
  }
  if (arm === 'a') {
    const eased = 1 - (1 - u) * (1 - u);
    return { dy: -1 * eased, size: 1, alpha: 1 - u };
  }
  return { dy: -1.2 * u * u, size: 1, alpha: u < 0.5 ? 1 : (1 - u) / 0.5 };
}
