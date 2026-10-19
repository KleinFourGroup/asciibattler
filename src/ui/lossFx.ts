/**
 * The loss fx: the orb and the shake. Every loss event (the model in
 * src/run/chipRule.ts) is delivered as an orb that flies from the causing
 * unit's HUD card to the gauge that pays and lands on the fill's leading
 * edge: the ghost grows, the gauge pulses and, by policy, the view shakes on
 * the landing, so the eye follows the cause to the effect. The orb is a `●`
 * in the paying side's hue with a glow, sized by the amount. Under reduced
 * motion (src/render/motion.ts) nothing flies and nothing shakes, and the
 * ghost grows at the event. The flight's gate is the caller's
 * (`HUD.deliver`); the shake's is on `shakeView` itself, since the landing
 * runs on both branches.
 *
 * The timings and thresholds are UI constants, tuned by play. The pure
 * dials (the shake's size, the cue, the orb's size, the policy) are pinned
 * in lossFx.test.ts, and the motion is checked by eye. The Web Animations
 * API does the motion, so nothing here ticks.
 */

import { reducedMotion } from '../render/motion';

type PoolSideName = 'player' | 'enemy';

/** The orb's flight, card → gauge (wall-clock; fast-forward never shortens it). */
const ORB_FLIGHT_MS = 400;
/** The backstop's margin past the flight before a stalled orb lands on the clock. */
const ORB_LANDING_GRACE_MS = 100;
/** The end sequence's launch stagger (one orb per standing survivor). */
export const SURVIVOR_STAGGER_MS = 120;
/** The beat after the last landing before the ghost commits. */
export const SETTLE_MS = 250;

/** The shake: it fires on a landing, scaled by the loss as a fraction of the
 *  pool's max. Nothing below SHAKE_MIN_FRACTION (2 of the player's 40, so a
 *  one-power death never shakes), SHAKE_MIN_PX at the threshold, up to
 *  SHAKE_MAX_PX at SHAKE_MAX_FRACTION and above. */
const SHAKE_MS = 220;
export const SHAKE_MIN_FRACTION = 0.05;
export const SHAKE_MAX_FRACTION = 0.15;
export const SHAKE_MIN_PX = 2;
export const SHAKE_MAX_PX = 6;

/**
 * The shake policy: which pool's losses shake the view. `player`, the
 * default, reads a shake as "you got hurt"; `enemy` reads it as something
 * you achieved. It is the Shake setting (src/settings/settings.ts, which
 * Game applies through `setShakePolicy`), and the dev chord Ctrl+Alt+K
 * cycles it live (src/dev/devKeys.ts).
 */
type ShakePolicy = 'player' | 'enemy' | 'both' | 'none';
const SHAKE_POLICIES: readonly ShakePolicy[] = ['player', 'enemy', 'both', 'none'];
let shakePolicy: ShakePolicy = 'player';

export function getShakePolicy(): ShakePolicy {
  return shakePolicy;
}

export function setShakePolicy(policy: ShakePolicy): void {
  shakePolicy = policy;
}

/** The dev key's cycle: player → enemy → both → none → player. */
export function cycleShakePolicy(): ShakePolicy {
  const i = SHAKE_POLICIES.indexOf(shakePolicy);
  shakePolicy = SHAKE_POLICIES[(i + 1) % SHAKE_POLICIES.length]!;
  return shakePolicy;
}

/** Whether a loss to `target`'s pool shakes under the live policy. */
export function shakeAllowed(target: PoolSideName): boolean {
  return shakePolicy === 'both' || shakePolicy === target;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A launched orb: `done` resolves on landing OR cancellation (never
 *  rejects — a scene teardown mid-flight must not surface as an error);
 *  `cancel()` removes it at once. */
export interface OrbHandle {
  readonly done: Promise<void>;
  cancel(): void;
}

/** The orb's font-size for a loss of `amount` against a pool of `max`:
 *  a floor for a one-point loss, growing with the fraction, capped. */
export function orbSizePx(amount: number, max: number): number {
  const frac = max > 0 ? Math.max(0, Math.min(1, amount / max)) : 0;
  return Math.round(11 + 50 * frac);
}

/**
 * Fly one orb from `from` to `to` (viewport coordinates, the orb centered on
 * both) on a slight arc, then remove it. It mounts into `mount`, the #ui
 * page mount; the orb is `position: fixed`, above the HUD panes and below
 * the modals (ui.css `.loss-orb`).
 */
export function flyOrb(
  mount: HTMLElement,
  from: Point,
  to: Point,
  side: PoolSideName,
  amount: number,
  max: number,
): OrbHandle {
  const el = document.createElement('span');
  el.className = `loss-orb loss-orb--${side}`;
  el.textContent = '●';
  el.setAttribute('aria-hidden', 'true');
  el.style.fontSize = `${orbSizePx(amount, max)}px`;
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  mount.appendChild(el);

  // A quadratic arc: the control point sits off the chord's midpoint,
  // perpendicular, by a fraction of the flight length — enough to read as
  // a lob, never enough to leave the viewport.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bulge = Math.min(48, len * 0.18);
  const cx = dx / 2 + (-dy / len) * bulge;
  const cy = dy / 2 + (dx / len) * bulge;
  const STEPS = 10;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const u = 1 - t;
    const x = 2 * u * t * cx + t * t * dx;
    const y = 2 * u * t * cy + t * t * dy;
    frames.push({ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, offset: t }); // i18n-ok — a CSS transform
  }
  const anim = el.animate(frames, { duration: ORB_FLIGHT_MS, easing: 'ease-in', fill: 'forwards' });

  let settled = false;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const finish = (): void => {
    if (settled) return;
    settled = true;
    el.remove();
    resolveDone();
  };
  anim.onfinish = finish;
  anim.oncancel = finish;
  // The wall-clock backstop: a Web Animation advances with the document's
  // rendering loop, so a throttled background tab, or a headless pane that
  // runs no frames (where even a programmatic `finish()` fires no event),
  // would strand the orb, and with it the settle promise Game's outro waits
  // on. The landing fires at the first of the animation's finish and this
  // timer; `finish` is idempotent, so the normal path is unchanged and a
  // stalled orb lands on the clock.
  const backstop = window.setTimeout(finish, ORB_FLIGHT_MS + ORB_LANDING_GRACE_MS);
  return {
    done,
    cancel(): void {
      window.clearTimeout(backstop);
      anim.cancel(); // fires oncancel → finish
      finish();
    },
  };
}

/**
 * The landing cue's scale, which grows with the loss. Two dials off the
 * loss's fraction of the pool's max, both saturating at SHAKE_MAX_FRACTION,
 * the shake's ceiling, so the ear and the eye peak together: `gain` from
 * CUE_GAIN_MIN at a zero loss up to 1 (times the key's table volume), and
 * `rate` from 1 down to CUE_RATE_MIN. A lower playback rate deepens the
 * pitch and lengthens the sample, so a big loss lands as a slow low thump
 * and a small one as a light tick. Pure; the HUD passes the result to
 * `AudioPlayer.play('moraleloss', …)`.
 */
export const CUE_GAIN_MIN = 0.5;
export const CUE_RATE_MIN = 0.7;

export function lossCue(amount: number, max: number): { gain: number; rate: number } {
  const frac = max > 0 ? Math.max(0, Math.min(1, amount / max)) : 0;
  const t = Math.min(1, frac / SHAKE_MAX_FRACTION);
  return {
    gain: CUE_GAIN_MIN + (1 - CUE_GAIN_MIN) * t,
    rate: 1 - (1 - CUE_RATE_MIN) * t,
  };
}

/** The shake amplitude for a loss, or 0 below the threshold. */
export function shakePx(amount: number, max: number): number {
  const frac = max > 0 ? amount / max : 0;
  if (frac < SHAKE_MIN_FRACTION) return 0;
  const t = Math.min(1, (frac - SHAKE_MIN_FRACTION) / (SHAKE_MAX_FRACTION - SHAKE_MIN_FRACTION));
  return SHAKE_MIN_PX + (SHAKE_MAX_PX - SHAKE_MIN_PX) * t;
}

/**
 * Shake the view: the canvas and the #ui mount together (siblings under
 * body; the #scanlines glass stays still, so the picture moves behind the
 * CRT). A decaying jitter over SHAKE_MS. The policy check is the caller's
 * and the motion gate this function's: a shake is the loss fx's one
 * vestibular trigger, and the gate sits on the effect so no caller can
 * forget it.
 */
export function shakeView(amount: number, max: number): void {
  if (reducedMotion()) return;
  const px = shakePx(amount, max);
  if (px <= 0) return;
  const targets = [document.getElementById('game-canvas'), document.getElementById('ui')].filter(
    (el): el is HTMLElement => el !== null,
  );
  // A fixed jitter pattern (no randomness — the fx must not touch an RNG
  // and a deterministic wobble reads the same every time), decaying to rest.
  const pattern: readonly [number, number][] = [
    [1, -0.6],
    [-0.9, 0.5],
    [0.7, 0.8],
    [-0.5, -0.7],
    [0.3, 0.4],
    [-0.15, 0.1],
    [0, 0],
  ];
  const frames: Keyframe[] = pattern.map(([x, y], i) => {
    const decay = 1 - i / (pattern.length - 1);
    return {
      transform: `translate(${(x * px * decay).toFixed(2)}px, ${(y * px * decay).toFixed(2)}px)`, // i18n-ok — a CSS transform
      offset: i / (pattern.length - 1),
    };
  });
  for (const el of targets) el.animate(frames, { duration: SHAKE_MS, easing: 'linear' });
}

/** The viewport center of an element (the orb's launch point off a card). */
export function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
