/**
 * J3 — the runtime keybinding registry (the rebindable-hotkey plumbing).
 *
 * A page-lifetime holder for the action → `KeyboardEvent.code` map, seeded from
 * `config/keybindings.json` defaults. Owned by `Game`, threaded through
 * `SceneContext`, so a rebind PERSISTS across scene swaps the way `playback`
 * does. The design goal (the user's J3 call): get the plumbing in for an
 * eventual in-game rebind screen NOW, but only read config defaults this round —
 * the screen, when it lands, is just a caller of `rebind`.
 *
 * Dispatch is DOM-free: `handleKeyDown` takes a minimal event so it's
 * node-testable (the suite runs without a DOM); `Game` attaches it to the real
 * `window` once. Because dispatch resolves the bound code LIVE on each keydown,
 * a `rebind` re-routes every subscriber with no re-subscription — that's what
 * makes the future rebind screen a one-line call.
 *
 * Lifetimes split cleanly: the registry (codes + the window listener) is
 * page-lifetime; the `on(...)` HANDLERS are battle-scoped (the HUD subscribes on
 * mount, unsubscribes on dispose), so a hotkey does nothing outside a battle —
 * exactly the pre-J3 behavior where the listener only existed during a battle.
 */

import { KEYBINDING_DEFAULTS, type KeybindAction } from '../config/keybindings';

/** The slice of `KeyboardEvent` dispatch needs — kept minimal so tests can pass
 *  a plain object (no DOM). A real `KeyboardEvent` satisfies it. */
export interface KeyLike {
  readonly code: string;
  readonly repeat: boolean;
  preventDefault(): void;
}

type Handler = () => void;

export class Keybindings {
  private readonly codes: Map<KeybindAction, string>;
  private readonly handlers = new Map<KeybindAction, Set<Handler>>();

  constructor(defaults: Readonly<Record<KeybindAction, string>> = KEYBINDING_DEFAULTS) {
    this.codes = new Map(Object.entries(defaults) as Array<[KeybindAction, string]>);
  }

  /** The `KeyboardEvent.code` currently bound to an action. */
  codeFor(action: KeybindAction): string {
    const code = this.codes.get(action);
    if (code === undefined) throw new Error(`Keybindings: no binding for action "${action}"`);
    return code;
  }

  /** Human-readable label for an action's key, e.g. `"KeyF"` → `"F"`. For
   *  button tooltips so the displayed shortcut tracks a rebind. */
  labelFor(action: KeybindAction): string {
    return keyLabel(this.codeFor(action));
  }

  /** Reverse lookup: which action (if any) the given `KeyboardEvent.code`
   *  triggers. Null when the key is unbound. */
  actionFor(code: string): KeybindAction | null {
    for (const [action, bound] of this.codes) {
      if (bound === code) return action;
    }
    return null;
  }

  /** Rebind an action at runtime — the seam a future in-game rebind screen
   *  calls. Subscribers re-route automatically (dispatch resolves the code live
   *  per keydown), so nothing re-subscribes. */
  rebind(action: KeybindAction, code: string): void {
    this.codes.set(action, code);
  }

  /** Subscribe a handler to an action; returns an unsubscribe. Multiple
   *  handlers per action are allowed (each battle-scoped consumer adds its
   *  own + tears it down on dispose). */
  on(action: KeybindAction, handler: Handler): () => void {
    let set = this.handlers.get(action);
    if (!set) {
      set = new Set();
      this.handlers.set(action, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /** The single keydown sink (Game binds it to `window`). Skips auto-repeat so
   *  one press = one fire; `preventDefault`s only when a bound action actually
   *  has a live subscriber, so unbound keys and out-of-battle presses fall
   *  through to the browser / other listeners untouched. Bound (arrow) so it
   *  survives being passed to `addEventListener` / `removeEventListener`. */
  readonly handleKeyDown = (e: KeyLike): void => {
    if (e.repeat) return;
    const action = this.actionFor(e.code);
    if (!action) return;
    const set = this.handlers.get(action);
    if (!set || set.size === 0) return;
    e.preventDefault();
    // Copy so a handler that unsubscribes mid-dispatch can't mutate the live set.
    for (const handler of [...set]) handler();
  };
}

/** `KeyboardEvent.code` → a compact display label: `"KeyF"` → `"F"`,
 *  `"Digit2"` → `"2"`; anything else (e.g. `"Space"`, `"Escape"`) passes
 *  through verbatim. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
