/**
 * 100c1 — THE PRESSABLE HELPER: the button contract for a control that
 * cannot be a `<button>`. The cards (hand · recruit · picker · enemy
 * compact — 100c2) carry INTERACTIVE CHILDREN (the 97d tab-stop chips, the
 * stat rows' tooltip sites), and interactive content inside a `<button>` is
 * invalid HTML — both engines break the children's focus. So a card stays
 * a `<div>` and this helper gives it what a button has: `role="button"`, a
 * tab stop, and Enter / Space → the element's own `click`, so the existing
 * click listeners fire unchanged and mouse, touch and keyboard run ONE
 * code path. A leaf control with no interactive children (a map node, the
 * cache chip — 100c1) is a real `<button>` and never needs this.
 *
 * THE SPACE RULE (the §100 kickoff, user-signed): in a battle the
 * registry's hotkeys WIN over a focused control — Space is `togglePause`
 * while a handler is live. The Keybindings sink sits on `window`, i.e.
 * AFTER this element's listener in the bubble, and `preventDefault`s
 * exactly when it fires; so Space's activation is DEFERRED past the whole
 * dispatch (`setTimeout 0` — a microtask checkpoint runs between the
 * listeners of a UA-dispatched event, so a microtask would read too early)
 * and then reads the sink's verdict: prevented → the game took the key, no
 * click. Enter is bound to nothing (pressable.test.ts pins it against
 * config/keybindings.json) and activates at once. Out of battle no handler
 * is live, so Space activates like a native button's. The page never
 * scrolls (a fixed layout), so Space needs no preventDefault of its own —
 * which is what keeps the verdict readable.
 *
 * Only a keydown TARGETED at the element counts: a 97d chip inside a card
 * is its own tab stop, and Enter on it must not fire the card.
 *
 * Consumers (100c2): the pre-turn hand cards (a toggle while a redraw is
 * active — `pressed`), the recruit cards, the picker cards (a toggle), the
 * enemy compact cards in battle (where the Space rule bites).
 */

export type PressableActivation = 'now' | 'deferred' | null;

/** The pure key rule (pinned): Enter activates now; Space activates after
 *  the dispatch unless a hotkey claimed it; auto-repeat and every other key
 *  do nothing. `key` is `KeyboardEvent.key`. */
export function pressableActivation(key: string, repeat: boolean): PressableActivation {
  if (repeat) return null;
  if (key === 'Enter') return 'now';
  if (key === ' ') return 'deferred';
  return null;
}

export interface PressableOptions {
  /** A TOGGLE's initial `aria-pressed` (the hand-swap and picker cards'
   *  `is-selected`, 100c2). The site that flips the class flips the
   *  attribute beside it — one line, no handle to thread. */
  readonly pressed?: boolean;
}

export function pressable(el: HTMLElement, opts: PressableOptions = {}): void {
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  if (opts.pressed !== undefined) el.setAttribute('aria-pressed', String(opts.pressed));
  el.addEventListener('keydown', (e) => {
    if (e.target !== el) return;
    const when = pressableActivation(e.key, e.repeat);
    if (when === null) return;
    if (when === 'now') {
      e.preventDefault();
      el.click();
      return;
    }
    window.setTimeout(() => {
      if (!e.defaultPrevented && el.isConnected) el.click();
    }, 0);
  });
}
