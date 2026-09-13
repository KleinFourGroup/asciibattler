/**
 * 96.5b2 — THE LOSS FX: the orb + the shake (Round 7 §96.5, the live pool
 * bar; the kickoff's design, user-signed). Every loss event (the model in
 * src/run/chipRule.ts) is delivered as an ORB that flies from the causing
 * unit's HUD card to the gauge that pays and lands on the fill's leading
 * edge — the ghost grows, the gauge pulses and (by policy) the view shakes
 * ON THE LANDING, so the eye follows the cause to the effect (the
 * Mechabellum health-bar projectile, in our terminal idiom: a `●` glyph in
 * the paying side's hue with a glow, sized by the amount). Under
 * `prefers-reduced-motion` nothing flies and nothing shakes: the ghost
 * ticks at the event, as 96.5b1 shipped it.
 *
 * All timings and thresholds are UI constants — tune from the playtest.
 * DOM-only, eyeball-verified (the TESTING policy); the Web Animations API
 * does the motion so nothing here ticks.
 */

export type PoolSideName = 'player' | 'enemy';

/** The orb's flight, card → gauge (wall-clock; fast-forward never shortens it). */
export const ORB_FLIGHT_MS = 400;
/** The backstop's margin past the flight before a stalled orb lands on the clock. */
export const ORB_LANDING_GRACE_MS = 100;
/** The end sequence's launch stagger (one orb per standing survivor). */
export const SURVIVOR_STAGGER_MS = 120;
/** The beat after the last landing before the ghost commits. */
export const SETTLE_MS = 250;

/** The shake: fires on a landing, scaled by the loss as a fraction of the
 *  pool max — nothing below SHAKE_MIN_FRACTION (2 of 40: a one-point
 *  Mercenary never rattles the screen), SHAKE_MIN_PX at the threshold up
 *  to SHAKE_MAX_PX at SHAKE_MAX_FRACTION and above. */
export const SHAKE_MS = 220;
export const SHAKE_MIN_FRACTION = 0.05;
export const SHAKE_MAX_FRACTION = 0.15;
export const SHAKE_MIN_PX = 2;
export const SHAKE_MAX_PX = 6;

/**
 * THE SHAKE POLICY — which pool's losses shake the view. `player` is the
 * shipped read (a shake means "you got hurt"); `enemy` is the user's
 * floated hypothesis (a shake marks something you ACHIEVED), left as a
 * seam for a future A/B — flip it live with the dev key (Ctrl+Alt+K,
 * src/dev/devKeys.ts) or here. A settings toggle is Round 8's.
 */
export type ShakePolicy = 'player' | 'enemy' | 'both' | 'none';
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

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches // i18n-ok — a media query
    : false;
}

export interface Point {
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
 * both) on a slight arc, then remove it. Mounts into `mount` (the #ui page
 * mount: `position: fixed`, above the HUD panes, below the modals).
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
  // The wall-clock BACKSTOP: a Web Animation advances with the document's
  // rendering loop, so a throttled background tab (or a headless pane —
  // the §96 zero-rAF trap, met again here: the animation sat at 50 ms with
  // `visibilityState` "visible" and even a programmatic finish() never
  // fired its event) would strand the orb — and with it the settle promise
  // Game's outro waits on. The landing therefore fires at the FIRST of the
  // animation's finish and this timer; `finish` is idempotent, so the
  // normal path is unchanged and a stalled one lands on the clock.
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
 * 96.5b2-post — THE LANDING CUE's scale (the user's playtest note: the
 * shake can't be judged without a sound, and the sound should grow with
 * the loss). Two dials off the loss's fraction of the pool max, both
 * saturating at SHAKE_MAX_FRACTION (the shake's ceiling, so the ear and
 * the eye peak together): `gain` from CUE_GAIN_MIN at a zero loss up to 1
 * (× the key's table volume), and `rate` from 1 down to CUE_RATE_MIN —
 * a lower playback rate deepens the pitch AND lengthens the sample, so a
 * big loss lands as a slow low thump and a small one as a light tick.
 * Pure; the HUD passes the result to `AudioPlayer.play('moraleloss', …)`.
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
 * Shake the VIEW — the canvas and the #ui mount together (siblings under
 * body; the #scanlines glass stays still, so the picture moves behind the
 * CRT). A decaying jitter over SHAKE_MS; the policy check is the caller's.
 */
export function shakeView(amount: number, max: number): void {
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
