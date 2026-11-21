/**
 * The looks of a unit moving itself: the dash's trail, the blink's vanishing
 * and appearing, the charge's rush and its hit. Each look has two arms for
 * the user to judge in play, switched together by the board panel's `move`
 * dial, a dev seam that goes when the arms are signed; the renderer reads
 * `moveArm()` as each move begins. Pure, so the poses are pinned headless
 * (moveLooks.test.ts) and BattleRenderer only places what they return.
 */

export type MoveArm = 'a' | 'b';

let arm: MoveArm = 'a';

/** The board panel's `move` dial. */
export function setMoveArm(next: MoveArm): void {
  arm = next;
}

export function moveArm(): MoveArm {
  return arm;
}

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** The blink's whole length, by arm: the fold out and in, or the cut. */
export const BLINK_SECONDS: Readonly<Record<MoveArm, number>> = { a: 0.3, b: 0.14 };

export interface BlinkPose {
  /** Which cell the glyph stands on: where it started, or its landing. */
  readonly at: 'from' | 'to';
  /** The sprite's size multiplier (1 = the unit's own). */
  readonly size: number;
  readonly alpha: number;
}

/**
 * The blink's pose at `t` (0 to 1 over `BLINK_SECONDS[arm]`). It stands on
 * one cell or the other and never between, so it never slides through what
 * it crossed. Arm `a`, the fold: the glyph shrinks to a point where it stood
 * over the first 40 %, then grows from a point on its landing. Arm `b`, the
 * cut: gone at once and unseen for the first half, then on its landing at
 * full size, fading in over the next quarter.
 */
export function blinkPose(a: MoveArm, t: number): BlinkPose {
  const u = clamp01(t);
  if (a === 'a') {
    if (u < 0.4) {
      const k = u / 0.4;
      return { at: 'from', size: 1 - k * k, alpha: 1 };
    }
    const k = (u - 0.4) / 0.6;
    return { at: 'to', size: 1 - (1 - k) * (1 - k), alpha: 1 };
  }
  if (u < 0.5) return { at: 'from', size: 1, alpha: 0 };
  return { at: 'to', size: 1, alpha: u < 0.75 ? (u - 0.5) / 0.25 : 1 };
}

/**
 * What a moving unit leaves behind it as it goes: `ghost`, a fading copy of
 * its own glyph where it was; `mote`, a small spark that drifts back along
 * its path; `dust`, a grey puff kicked up off the ground. `count` marks are
 * dropped at even steps of the slide, each where the sprite then stands.
 */
export type TrailMark = 'ghost' | 'mote' | 'dust';

export interface TrailSpec {
  readonly mark: TrailMark;
  readonly count: number;
}

/** The dash's trail: arm `a` three afterimages, arm `b` a streak of motes. */
export function dashTrail(a: MoveArm): TrailSpec {
  return a === 'a' ? { mark: 'ghost', count: 3 } : { mark: 'mote', count: 8 };
}

/**
 * The charge's rush. Arm `a`, the gallop: slow off the mark and fastest as
 * it arrives, a puff of dust at each cell it runs. Arm `b`, the lance: an
 * even rush with the dash's afterimages. The slide's length is the sim's
 * (the cells at the push's rate); only its pace and its trail differ.
 */
export function chargeRush(a: MoveArm, cells: number): { readonly ease: 'in' | 'linear'; readonly trail: TrailSpec } {
  return a === 'a'
    ? { ease: 'in', trail: { mark: 'dust', count: Math.max(1, cells) } }
    : { ease: 'linear', trail: { mark: 'ghost', count: 3 } };
}

/**
 * The charge's hit, on the foe as the blow lands. Arm `a`: a ring of sparks
 * bursting off the foe and a small shake. Arm `b`: a flash on the foe and a
 * harder shake, no sparks.
 */
export function chargeHit(a: MoveArm): {
  readonly sparks: boolean;
  readonly flash: boolean;
  readonly shake: { readonly intensity: number; readonly durationSeconds: number };
} {
  return a === 'a'
    ? { sparks: true, flash: false, shake: { intensity: 0.06, durationSeconds: 0.2 } }
    : { sparks: false, flash: true, shake: { intensity: 0.12, durationSeconds: 0.28 } };
}

/** The fractions of a slide at which its `count` marks drop: even steps,
 *  the first a step in, none at the very start or end. */
export function trailFractions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));
}
