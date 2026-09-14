/**
 * 97a — THE TOOLTIP (Round 7 §97): one component, ONE live element, the
 * terminal plate. Replaces the native `title=` — hover-only, delayed,
 * unstyled, dead on touch and keyboard (the Round 7 kickoff audit: 20
 * sites, four of them the only place a fact was written).
 *
 * `attachTooltip(el, content, opts)` registers a trigger; the content is a
 * string or a LAZY getter (string | Node) resolved at every open, so a site
 * whose words are live (the HUD's pause label) attaches once. The host is
 * one `.tooltip` in the ui root (`installTooltipHost`, Game-owned,
 * page-lifetime like the chrome column), `role="tooltip"`; while open the
 * trigger carries `aria-describedby` to it.
 *
 * ROUTES (the spec's four, the §97 kickoff calls B + D):
 *   hover   — mouse/pen `pointerenter`, HOVER_DELAY_MS (no delay inside
 *             WARM_MS of the last close: sweeping a row of buttons reads
 *             like one tooltip moving); `pointerleave` closes unless pinned.
 *   focus   — `focus` on the trigger when `:focus-visible` holds (keyboard
 *             focus; a mouse click or a tap that focuses a button shows
 *             nothing); `blur` closes, pinned or not (focus-out is a gate).
 *   touch   — `touch: 'tap'` (the default; the non-interactive text sites):
 *             a tap TOGGLES it. `touch: 'press'` (the controls, whose tap
 *             must keep acting): a LONG-PRESS of PRESS_MS opens it PINNED and
 *             the trailing click is swallowed (a window-capture listener),
 *             Android's own long-press `contextmenu` is suppressed while the
 *             press is armed. `touch: 'none'` — the enemy compact card, whose
 *             contextmenu is already the focus objective (the §100 note).
 *   key     — `toggleTooltipKey()` (97b binds `showTooltip`): with one open,
 *             pin it (a pointer user parks the hover) or, pinned, close it;
 *             with none open, open PINNED for the focused trigger, else the
 *             hovered one.
 * CLOSES: Esc (window capture — the first Esc takes the tooltip, the next
 * the modal under it), pointer-leave (unpinned), focus-out, a pointerdown
 * outside the trigger (pinned / tap-opened), the trigger leaving the
 * document or losing its box (a rAF poll while open, which also follows a
 * trigger that moves — a card shifting when a unit dies).
 *
 * POSITION: `position: fixed`, above the trigger's center, FLIPPED below
 * when the top would clip, clamped inside the viewport, the caret kept on
 * the trigger's center — the layout never shifts (the box is out of flow).
 * The math is `placeTooltip`, pure and pinned in tooltip.test.ts; the
 * gestures + the fade are eyeball-only per TESTING.
 *
 * No prose lives here; every site's words go through `t()` at its touch.
 */

import { prefersReducedMotion } from './lossFx';

/** Hover: the wait before a tooltip opens (a sweep across a row must not
 *  flash each one). */
export const HOVER_DELAY_MS = 150;
/** Hover: inside this window after a close, the next opens with no delay. */
export const WARM_MS = 300;
/** Touch: the hold that opens a control's tooltip. */
export const PRESS_MS = 450;
/** Touch: a pointer that moves this far cancels the hold (a scroll, a drag). */
export const PRESS_SLOP_PX = 8;
/** The opacity fade (mirrors `.tooltip` in ui.css). */
export const TOOLTIP_FADE_MS = 120;
/** Space between the trigger's edge and the box. */
export const GAP_PX = 8;
/** The box never comes closer than this to the viewport's edge. */
export const MARGIN_PX = 8;
/** The caret stays this far inside the box's ends when the box is clamped. */
export const CARET_INSET_PX = 12;

export type TooltipContent = string | (() => string | Node);

export interface TooltipOptions {
  /** The touch route: `tap` toggles (text sites, the default); `press` is a
   *  long-press that swallows the click (controls); `none` (hover / focus /
   *  key only). */
  readonly touch?: 'tap' | 'press' | 'none';
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly side: 'above' | 'below';
  /** The caret's x INSIDE the box (its tip points at the trigger's center). */
  readonly caretX: number;
}

/** Where the box goes for a trigger: above its center; below when the top
 *  would clip; when neither side fits, the side with more room, clamped.
 *  x is clamped to the margins and the caret slides to stay on the trigger. */
export function placeTooltip(
  trigger: Rect,
  tip: Size,
  viewport: Size,
  gap = GAP_PX,
  margin = MARGIN_PX,
  caretInset = CARET_INSET_PX,
): Placement {
  const roomAbove = trigger.y - margin;
  const roomBelow = viewport.h - (trigger.y + trigger.h) - margin;
  const need = tip.h + gap;
  let side: 'above' | 'below';
  if (roomAbove >= need) side = 'above';
  else if (roomBelow >= need) side = 'below';
  else side = roomAbove >= roomBelow ? 'above' : 'below';

  let y = side === 'above' ? trigger.y - gap - tip.h : trigger.y + trigger.h + gap;
  y = clamp(y, margin, Math.max(margin, viewport.h - margin - tip.h));

  const center = trigger.x + trigger.w / 2;
  const x = clamp(center - tip.w / 2, margin, Math.max(margin, viewport.w - margin - tip.w));
  const caretX = clamp(center - x, Math.min(caretInset, tip.w / 2), Math.max(tip.w - caretInset, tip.w / 2));
  return { x, y, side, caretX };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── the one host + the live state ─────────────────────────────────────────

interface Entry {
  readonly el: HTMLElement;
  readonly content: TooltipContent;
  readonly touch: NonNullable<TooltipOptions['touch']>;
}

const HOST_ID = 'tooltip';

let host: HTMLDivElement | null = null;
let body: HTMLDivElement | null = null;
let caret: HTMLDivElement | null = null;
const entries = new WeakMap<HTMLElement, Entry>();

/** The open tooltip's trigger, or null. */
let current: Entry | null = null;
/** Pinned = survives pointer-leave (the key, a long-press). */
let pinned = false;
let hovered: Entry | null = null;
let hoverTimer: number | null = null;
let hideTimer: number | null = null;
let lastCloseAt = -Infinity;
let poll: number | null = null;
let lastRect = '';
/** Set by a fired long-press: the click that follows the release is eaten. */
let swallowClickFor: HTMLElement | null = null;

/** Game calls this once: the host mounts into the ui root and the window
 *  listeners (Esc · outside pointerdown · the click swallow) attach. */
export function installTooltipHost(mount: HTMLElement): HTMLDivElement {
  if (host !== null) return host;
  host = document.createElement('div');
  host.className = 'tooltip';
  host.id = HOST_ID;
  host.setAttribute('role', 'tooltip');
  host.hidden = true;
  if (prefersReducedMotion()) host.classList.add('is-still');
  body = document.createElement('div');
  body.className = 'tooltip__body';
  caret = document.createElement('div');
  caret.className = 'tooltip__caret';
  host.append(body, caret);
  mount.appendChild(host);

  window.addEventListener('keydown', onWindowKeyDown, true);
  window.addEventListener('pointerdown', onWindowPointerDown, true);
  window.addEventListener('click', onWindowClick, true);
  return host;
}

/** A tooltip that ends in a keyboard hint — `text [key]`, the key in the
 *  amber `.tooltip__kbd` accent. Both parts may be thunks so a live label
 *  (pause ↔ resume) or a rebound key is read at every open; the brackets
 *  are glyphs, outside the locale value. */
export function keyedTooltip(text: string | (() => string), key: string | (() => string)): () => Node {
  return () => {
    const frag = document.createDocumentFragment();
    frag.append(typeof text === 'function' ? text() : text, ' ');
    const kbd = document.createElement('span');
    kbd.className = 'tooltip__kbd';
    kbd.textContent = `[${typeof key === 'function' ? key() : key}]`;
    frag.appendChild(kbd);
    return frag;
  };
}

/** Register `el` as a trigger. Returns the detach (closes it if open). */
export function attachTooltip(el: HTMLElement, content: TooltipContent, opts: TooltipOptions = {}): () => void {
  const entry: Entry = { el, content, touch: opts.touch ?? 'tap' };
  entries.set(el, entry);
  if (entry.touch !== 'none') el.dataset['tooltipTouch'] = entry.touch;

  let focusHeld = false;
  // ── hover (mouse / pen) ──
  const onEnter = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    hovered = entry;
    if (current === entry) return;
    cancelHover();
    const warm = performance.now() - lastCloseAt < WARM_MS || current !== null;
    if (warm) open(entry, false);
    else hoverTimer = window.setTimeout(() => open(entry, false), HOVER_DELAY_MS);
  };
  const onLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    if (hovered === entry) hovered = null;
    cancelHover();
    if (current === entry && !pinned && !focusHeld) close();
  };
  // ── keyboard focus ──
  const onFocus = (): void => {
    if (!isFocusVisible(el)) return;
    focusHeld = true;
    open(entry, false);
  };
  const onBlur = (): void => {
    focusHeld = false;
    if (current === entry) close();
  };
  // ── touch ──
  let pressTimer: number | null = null;
  let pressX = 0;
  let pressY = 0;
  let lastPointerType = '';
  const cancelPress = (): void => {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
  };
  const onDown = (e: PointerEvent): void => {
    lastPointerType = e.pointerType;
    if (e.pointerType !== 'touch' || entry.touch !== 'press') return;
    pressX = e.clientX;
    pressY = e.clientY;
    cancelPress();
    pressTimer = window.setTimeout(() => {
      pressTimer = null;
      swallowClickFor = el;
      open(entry, true);
    }, PRESS_MS);
  };
  const onMove = (e: PointerEvent): void => {
    if (pressTimer === null) return;
    if (Math.abs(e.clientX - pressX) > PRESS_SLOP_PX || Math.abs(e.clientY - pressY) > PRESS_SLOP_PX) cancelPress();
  };
  const onUp = (): void => {
    cancelPress();
    // The click that follows a fired press arrives in this same input task;
    // a release with no click (a drag away) must not leave the swallow armed
    // for a later, real tap.
    if (swallowClickFor === el) {
      window.setTimeout(() => {
        if (swallowClickFor === el) swallowClickFor = null;
      }, 0);
    }
  };
  const onContextMenu = (e: Event): void => {
    // Android raises its own long-press contextmenu; while a press is armed
    // or just fired, that menu is ours to suppress.
    if (pressTimer !== null || swallowClickFor === el) e.preventDefault();
  };
  const onClick = (): void => {
    if (lastPointerType === 'touch' && entry.touch === 'tap') {
      if (current === entry) close();
      else open(entry, true);
      return;
    }
    // A mouse click may change the words (pause ↔ resume): re-read after
    // the site's own handler has run.
    if (current === entry) window.setTimeout(() => refreshTooltip(el), 0);
  };

  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('focus', onFocus);
  el.addEventListener('blur', onBlur);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('contextmenu', onContextMenu);
  el.addEventListener('click', onClick);

  return () => {
    if (current === entry) close();
    if (hovered === entry) hovered = null;
    cancelPress();
    entries.delete(el);
    delete el.dataset['tooltipTouch'];
    el.removeEventListener('pointerenter', onEnter);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('focus', onFocus);
    el.removeEventListener('blur', onBlur);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('contextmenu', onContextMenu);
    el.removeEventListener('click', onClick);
  };
}

/** Re-resolve the content of an OPEN tooltip on `el` (a no-op otherwise) —
 *  for a site whose words changed under an open tooltip. */
export function refreshTooltip(el: HTMLElement): void {
  if (current === null || current.el !== el) return;
  render(current);
  position(current);
}

/** The key (97b): pin the open one, close a pinned one, or open pinned for
 *  the focused — else the hovered — trigger. */
export function toggleTooltipKey(): void {
  if (current !== null) {
    if (pinned) close();
    else pinned = true;
    return;
  }
  const target = focusedEntry() ?? hovered;
  if (target !== null) open(target, true);
}

/** Close whatever is open (a scene swap, a modal opening). */
export function closeTooltip(): void {
  close();
}

/** The open trigger, for probes and tests of the wiring. */
export function openTooltipTrigger(): HTMLElement | null {
  return current?.el ?? null;
}

// ── internals ──────────────────────────────────────────────────────────────

function open(entry: Entry, pin: boolean): void {
  if (host === null || body === null) return;
  cancelHover();
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (current !== null && current !== entry) current.el.removeAttribute('aria-describedby');
  current = entry;
  pinned = pin;
  render(entry);
  host.hidden = false;
  entry.el.setAttribute('aria-describedby', HOST_ID);
  position(entry);
  // Two frames: the first commits the un-hidden opacity:0 paint, the second
  // flips the class so the transition runs (the fade.ts rule).
  requestAnimationFrame(() => {
    if (current === entry) host?.classList.add('is-visible');
  });
  if (poll === null) poll = requestAnimationFrame(follow);
}

function close(): void {
  if (host === null || current === null) return;
  const was = current;
  current = null;
  pinned = false;
  lastCloseAt = performance.now();
  was.el.removeAttribute('aria-describedby');
  host.classList.remove('is-visible');
  hideTimer = window.setTimeout(() => {
    hideTimer = null;
    if (current === null && host !== null) host.hidden = true;
  }, TOOLTIP_FADE_MS);
  if (poll !== null) {
    cancelAnimationFrame(poll);
    poll = null;
  }
}

function render(entry: Entry): void {
  if (body === null) return;
  const c = typeof entry.content === 'function' ? entry.content() : entry.content;
  if (typeof c === 'string') body.textContent = c;
  else body.replaceChildren(c);
}

function position(entry: Entry): void {
  if (host === null || caret === null) return;
  const r = entry.el.getBoundingClientRect();
  const p = placeTooltip(
    { x: r.left, y: r.top, w: r.width, h: r.height },
    { w: host.offsetWidth, h: host.offsetHeight },
    { w: window.innerWidth, h: window.innerHeight },
  );
  host.style.left = `${Math.round(p.x)}px`;
  host.style.top = `${Math.round(p.y)}px`;
  host.dataset['side'] = p.side;
  caret.style.left = `${Math.round(p.caretX)}px`;
  lastRect = `${r.left},${r.top},${r.width},${r.height}`;
}

/** While open: close on a trigger that left the document or lost its box;
 *  re-position on one that moved. */
function follow(): void {
  poll = null;
  if (current === null) return;
  const el = current.el;
  const r = el.getBoundingClientRect();
  if (!el.isConnected || (r.width === 0 && r.height === 0)) {
    close();
    return;
  }
  const key = `${r.left},${r.top},${r.width},${r.height}`;
  if (key !== lastRect) position(current);
  poll = requestAnimationFrame(follow);
}

function cancelHover(): void {
  if (hoverTimer !== null) {
    window.clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function focusedEntry(): Entry | null {
  for (let n = document.activeElement; n instanceof HTMLElement; n = n.parentElement) {
    const e = entries.get(n);
    if (e !== undefined) return e;
  }
  return null;
}

function isFocusVisible(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

function onWindowKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || current === null) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  close();
}

function onWindowPointerDown(e: PointerEvent): void {
  if (current === null || host === null) return;
  const t = e.target;
  if (t instanceof Node && (current.el.contains(t) || host.contains(t))) return;
  // A press / tap / key-pinned tooltip waits for a pointerdown elsewhere; a
  // hover-opened one is already leaving on pointerleave.
  close();
}

function onWindowClick(e: MouseEvent): void {
  if (swallowClickFor === null) return;
  const el = swallowClickFor;
  swallowClickFor = null;
  if (e.target instanceof Node && el.contains(e.target)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}
