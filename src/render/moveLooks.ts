/**
 * The looks of a unit moving itself: a leap's trail, the blink's vanishing
 * and appearing, the charge's rush and its hit. Pure, so the poses are
 * pinned headless (moveLooks.test.ts) and BattleRenderer only places what
 * they return.
 */

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** The blink's whole length, the cut: gone, then back on its landing. */
export const BLINK_SECONDS = 0.14;

export interface BlinkPose {
  /** Which cell the glyph stands on: where it started, or its landing. */
  readonly at: 'from' | 'to';
  readonly alpha: number;
}

/**
 * The blink's pose at `t` (0 to 1 over `BLINK_SECONDS`). It stands on one
 * cell or the other and never between, so it never slides through what it
 * crossed: gone at once and unseen for the first half, then on its landing
 * at its own size, fading in over the next quarter.
 */
export function blinkPose(t: number): BlinkPose {
  const u = clamp01(t);
  if (u < 0.5) return { at: 'from', alpha: 0 };
  return { at: 'to', alpha: u < 0.75 ? (u - 0.5) / 0.25 : 1 };
}

/**
 * What a moving unit leaves behind it as it goes: `ghost`, a fading copy of
 * its own glyph where it was; `dust`, a grey puff kicked up off the ground.
 * `count` marks are dropped at even steps of the slide, each where the
 * sprite then stands.
 */
export type TrailMark = 'ghost' | 'dust';

export interface TrailSpec {
  readonly mark: TrailMark;
  readonly count: number;
}

/** The dash's trail, which every leap leaves (the dash, the pounce): three
 *  afterimages. */
export const DASH_TRAIL: TrailSpec = { mark: 'ghost', count: 3 };

/**
 * The charge's rush, the gallop: slow off the mark and fastest as it
 * arrives (`in`), a puff of dust at each cell it runs. The slide's length is
 * the sim's (the cells at the push's rate); only its pace and trail are
 * the look's.
 */
export function chargeRush(cells: number): { readonly ease: 'in'; readonly trail: TrailSpec } {
  return { ease: 'in', trail: { mark: 'dust', count: Math.max(1, cells) } };
}

/** The charge's hit, as its blow lands: a ring of sparks off the foe and
 *  this small shake. */
export const CHARGE_HIT_SHAKE = { intensity: 0.06, durationSeconds: 0.2 } as const;

/** The fractions of a slide at which its `count` marks drop: even steps,
 *  the first a step in, none at the very start or end. */
export function trailFractions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));
}
