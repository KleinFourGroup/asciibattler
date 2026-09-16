/**
 * 99a — THE MOTION GATE (Round 7 §99, the reduced-motion seam; the kickoff's
 * call A, user-signed 2026-09-16). ONE module answers "is motion reduced?"
 * for every consumer: the JS reads `reducedMotion()`, the CSS keys its
 * reduced rules off the root attribute this module stamps
 * (`html[data-motion="reduced"]`, 99b) — so the Round 8 setting flips ONE
 * override and the whole surface follows without any seam being touched
 * again. The kickoff rejected a `@media (prefers-reduced-motion)` block for
 * the sheet: a media block cannot be flipped by a setting without every rule
 * being duplicated under a second selector.
 *
 * Resolution (pure, pinned in motion.test.ts): the override, when set, wins;
 * else the OS preference (`prefers-reduced-motion: reduce`). The attribute is
 * stamped at `installMotionGate()` (main.ts, before the Game constructs — no
 * screen renders un-gated), re-stamped on the query's `change` and on every
 * override set. `reducedMotion()` itself needs no install: the query is
 * created lazily, so a consumer that fires before boot (or under a harness
 * with no `matchMedia`) still resolves — to the OS, or to `false`.
 *
 * Lives in `render` because `render` never imports `ui` and `ui` imports
 * `render` freely; `fxRegistry` (99c) takes the gate's answer as an ARGUMENT
 * and stays pure data. The DOM stamp is eyeball-verified (the TESTING
 * policy) via Ctrl+Alt+R (src/dev/devKeys.ts), which cycles the override —
 * the preview pane cannot emulate the media query (the §96.5 rider).
 */

/** `null` = follow the OS; `true` / `false` = the setting's (or the dev key's) word. */
export type MotionOverride = boolean | null;

/** The root attribute the stylesheet keys off (`html[data-motion="reduced"]`). */
export const MOTION_ATTR = 'data-motion'; // i18n-ok — an attribute name
export const MOTION_REDUCED = 'reduced'; // i18n-ok — an attribute value
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'; // i18n-ok — a media query

/** The pure resolution: an override wins; else the OS preference. */
export function resolveReducedMotion(override: MotionOverride, osPrefers: boolean): boolean {
  return override ?? osPrefers;
}

let override: MotionOverride = null;
let query: MediaQueryList | null = null;
let installed = false;

function mediaQuery(): MediaQueryList | null {
  if (query === null && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    query = window.matchMedia(REDUCED_MOTION_QUERY);
  }
  return query;
}

/** The OS preference alone (the override ignored) — `false` with no `matchMedia`. */
export function osPrefersReducedMotion(): boolean {
  return mediaQuery()?.matches ?? false;
}

/** THE GATE — every motion consumer asks this. */
export function reducedMotion(): boolean {
  return resolveReducedMotion(override, osPrefersReducedMotion());
}

export function getReducedMotionOverride(): MotionOverride {
  return override;
}

/** Set (or clear, with `null`) the override; re-stamps the root. Returns the resolved gate. */
export function setReducedMotionOverride(value: MotionOverride): boolean {
  override = value;
  stampRoot();
  return reducedMotion();
}

/** The dev key's cycle: OS → reduced → full → OS. */
export function cycleReducedMotionOverride(): MotionOverride {
  const next: MotionOverride = override === null ? true : override ? false : null;
  setReducedMotionOverride(next);
  return next;
}

/** Stamp (or clear) the root attribute from the resolved gate. No-op without a document. */
export function stampRoot(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (reducedMotion()) root.setAttribute(MOTION_ATTR, MOTION_REDUCED);
  else root.removeAttribute(MOTION_ATTR);
}

/** Boot: stamp the root now and follow the OS preference live. Idempotent. */
export function installMotionGate(): void {
  stampRoot();
  if (installed) return;
  installed = true;
  mediaQuery()?.addEventListener('change', stampRoot);
}
