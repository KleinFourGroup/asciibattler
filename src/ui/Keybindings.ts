/**
 * J3 — the runtime keybinding registry (the rebindable-hotkey plumbing).
 *
 * A page-lifetime holder for the action → `KeyboardEvent.code` map, seeded from
 * `config/keybindings.json` defaults. Owned by `Game`, threaded through
 * `SceneContext`, so a rebind PERSISTS across scene swaps the way `playback`
 * does. Since 116b the player's rebinds are a setting (`keys`, src/settings):
 * the game hands the stored overrides to `setOverrides` at boot and on every
 * change, and the rebind surface is a caller of the rules below.
 *
 * Dispatch is DOM-free: `handleKeyDown` takes a minimal event so it's
 * node-testable (the suite runs without a DOM); `Game` attaches it to the real
 * `window` once. Because dispatch resolves the bound code LIVE on each keydown,
 * a rebind re-routes every subscriber with no re-subscription.
 *
 * THE RULES (116b), pure functions so the rebind surface and the stored
 * overrides go through the same ones:
 *  - One key, one action. Binding a key another action holds SWAPS the two:
 *    the other action takes this one's old key, so every action stays bound
 *    and no key fires two (`withRebind`).
 *  - Enter, Tab and Escape can't be bound (`RESERVED_CODES`): they are every
 *    control's own keys (activate, walk, close; DESIGN §Input accessibility).
 *    Neither can a modifier or a lock key on its own (`isBindable`, 116e):
 *    Ctrl, Alt or Meta would never fire under the modifier rule below, and
 *    Shift is half of Shift+Tab and of `?`.
 *  - What is stored is the difference from the defaults (`overridesOf`), and
 *    stored overrides resolve through the swap rule in the registry's action
 *    order (`resolveBindings`), so a stored set that names one key twice, an
 *    action this build doesn't have, or a reserved key still resolves to one
 *    key per action.
 *  - A keydown with Ctrl, Alt or Meta held fires no hotkey: Ctrl+F is the
 *    browser's find, not Focus. Shift passes, since `?` is Shift+Slash.
 *  - A keydown in a text field fires no hotkey (`isTextEntry`): the key is
 *    the field's, and a hotkey that took it would also swallow the character.
 *  - While the registry is suspended (`suspend`, 116d) no key fires a hotkey:
 *    the settings modal holds the battle behind it, so a key pressed there
 *    must not pause, speed up or order that battle.
 *  - A rebind row waiting for its key reads each keydown through
 *    `captureVerdict` (116e), which keeps the rules above: a chord is still
 *    the browser's, and a key no action can take is never bound.
 *
 * Lifetimes split cleanly: the registry (codes + the window listener) is
 * page-lifetime; the `on(...)` HANDLERS are battle-scoped (the HUD subscribes on
 * mount, unsubscribes on dispose), so a hotkey does nothing outside a battle —
 * exactly the pre-J3 behavior where the listener only existed during a battle.
 */

import { KEYBINDING_DEFAULTS, KEYBIND_ACTIONS, type KeybindAction } from '../config/keybindings';

/** The slice of `KeyboardEvent` dispatch needs — kept minimal so tests can pass
 *  a plain object (no DOM). A real `KeyboardEvent` satisfies it. */
export interface KeyLike {
  readonly code: string;
  readonly repeat: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  /** What the key was pressed in. A real event's is its `EventTarget`. */
  readonly target?: unknown;
  preventDefault(): void;
}

type Handler = () => void;

/** Every action's key. */
export type Bindings = Readonly<Record<KeybindAction, string>>;

/** Every control's own keys, which no action can take. */
export const RESERVED_CODES: readonly string[] = ['Enter', 'NumpadEnter', 'Tab', 'Escape'];

/** The keys that are held with another key, or that switch a lock. */
const MODIFIER_CODES: readonly string[] = [
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'NumLock',
  'ScrollLock',
];

/** Whether an action can take this key: not a reserved key, not a modifier
 *  or a lock on its own, and a key the browser could name. */
export function isBindable(code: string): boolean {
  if (code.length === 0 || code === 'Unidentified') return false; // i18n-ok: a KeyboardEvent.code value
  return !RESERVED_CODES.includes(code) && !MODIFIER_CODES.includes(code);
}

/**
 * What a keydown is to a rebind row that is waiting for its key (116e):
 *  - `pass`: a chord (Ctrl, Alt or Meta held, which is also how each of
 *    those reads on its own keydown). It is the browser's, as it is for a
 *    hotkey, and the row goes on waiting.
 *  - `walk`: Tab. The wait is called off and focus moves on, so the keyboard
 *    is never held in a row.
 *  - `cancel`: Enter or Escape. The wait is called off and the key does
 *    nothing else: it neither presses the row again nor closes the modal.
 *  - `swallow`: an auto-repeat, or a key no action can take (Shift alone).
 *    Nothing happens and the row goes on waiting.
 *  - `bind`: the row's action takes the key.
 */
export type CaptureVerdict = 'pass' | 'walk' | 'cancel' | 'swallow' | 'bind';

export function captureVerdict(e: KeyLike): CaptureVerdict {
  if (e.ctrlKey === true || e.altKey === true || e.metaKey === true) return 'pass';
  if (e.code === 'Tab') return 'walk';
  if (e.repeat) return 'swallow';
  if (RESERVED_CODES.includes(e.code)) return 'cancel';
  return isBindable(e.code) ? 'bind' : 'swallow';
}

/** The `<input>` types that take no typed text; every other type does. */
const NON_TEXT_INPUT_TYPES: readonly string[] = [
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
];

/**
 * Whether a keydown's target takes typed text: a text `<input>`, a
 * `<textarea>`, or editable content. Read by shape, with no DOM class, so it
 * runs where there is no DOM. A slider or a checkbox is not text entry, and a
 * hotkey still wins over it (the Space rule, DESIGN §Input accessibility).
 */
export function isTextEntry(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const el = target as { tagName?: unknown; type?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !(typeof el.type === 'string' && NON_TEXT_INPUT_TYPES.includes(el.type));
}

/**
 * `bindings` with `action` on `code`. If another action held `code`, it takes
 * `action`'s old key. Null when no action can take `code` (`isBindable`).
 */
export function withRebind(bindings: Bindings, action: KeybindAction, code: string): Bindings | null {
  if (!isBindable(code)) return null;
  const next: Record<KeybindAction, string> = { ...bindings };
  const holder = KEYBIND_ACTIONS.find((other) => other !== action && bindings[other] === code);
  if (holder !== undefined) next[holder] = bindings[action];
  next[action] = code;
  return next;
}

/** The stored overrides over the defaults: every action's key, one key each. */
export function resolveBindings(defaults: Bindings, overrides: Readonly<Record<string, string>>): Bindings {
  let bindings = defaults;
  for (const action of KEYBIND_ACTIONS) {
    const code = overrides[action];
    if (typeof code !== 'string') continue;
    bindings = withRebind(bindings, action, code) ?? bindings;
  }
  return bindings;
}

/** What to store for `bindings`: the actions that are off their default. */
export function overridesOf(defaults: Bindings, bindings: Bindings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const action of KEYBIND_ACTIONS) {
    if (bindings[action] !== defaults[action]) out[action] = bindings[action];
  }
  return out;
}

export class Keybindings {
  private readonly defaults: Bindings;
  private codes: Map<KeybindAction, string>;
  private readonly handlers = new Map<KeybindAction, Set<Handler>>();
  private readonly changeListeners = new Set<Handler>();
  /** 116d — how many suspensions are live (`suspend`). */
  private suspensions = 0;

  constructor(defaults: Bindings = KEYBINDING_DEFAULTS) {
    this.defaults = defaults;
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

  /** Every action's key as it is now. */
  bindings(): Bindings {
    return Object.fromEntries(this.codes) as Record<KeybindAction, string>;
  }

  /** What to store for the bindings as they are now (`overridesOf`). */
  overrides(): Record<string, string> {
    return overridesOf(this.defaults, this.bindings());
  }

  /** What to store once `action` is on `code`, by the swap rule; null for a
   *  key no action can take. It changes nothing here: the rebind surface
   *  stores this, and the registry takes it back through `setOverrides`. */
  overridesWith(action: KeybindAction, code: string): Record<string, string> | null {
    const next = withRebind(this.bindings(), action, code);
    return next === null ? null : overridesOf(this.defaults, next);
  }

  /**
   * Rebind an action at runtime, by the swap rule. False for a reserved key,
   * with nothing changed. Subscribers re-route automatically (dispatch
   * resolves the code live per keydown), so nothing re-subscribes.
   */
  rebind(action: KeybindAction, code: string): boolean {
    const next = withRebind(this.bindings(), action, code);
    if (next === null) return false;
    this.replace(next);
    return true;
  }

  /** Take the stored overrides: the defaults with these over them
   *  (`resolveBindings`). An empty set is the defaults. */
  setOverrides(overrides: Readonly<Record<string, string>>): void {
    this.replace(resolveBindings(this.defaults, overrides));
  }

  /** Called after the bindings change, for a label that shows a key and is
   *  not rebuilt on its own. Returns the unsubscribe. */
  onChange(listener: Handler): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private replace(bindings: Bindings): void {
    this.codes = new Map(Object.entries(bindings) as Array<[KeybindAction, string]>);
    for (const listener of [...this.changeListeners]) listener();
  }

  /** 116d — fire no hotkey until the returned release is called.
   *  Suspensions count, and a release called twice releases once. */
  suspend(): () => void {
    this.suspensions++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.suspensions--;
    };
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
   *  one press = one fire, a press with Ctrl, Alt or Meta held, which is the
   *  browser's or the dev keys', a press in a text field, which is the
   *  field's, and every press while suspended; `preventDefault`s only when a
   *  bound action
   *  actually has a live subscriber, so unbound keys and out-of-battle presses
   *  fall through to the browser / other listeners untouched. Bound (arrow) so
   *  it survives being passed to `addEventListener` / `removeEventListener`. */
  readonly handleKeyDown = (e: KeyLike): void => {
    if (e.repeat) return;
    if (this.suspensions > 0) return;
    if (e.ctrlKey === true || e.altKey === true || e.metaKey === true) return;
    if (isTextEntry(e.target)) return;
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
 *  `"Digit2"` → `"2"`; any other code is its own name with its words apart
 *  (`"Space"`, `"ArrowUp"` → `"Arrow Up"`, `"Numpad1"` → `"Numpad 1"`), since
 *  a rebind (116e) can show any key. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3); // i18n-ok: a KeyboardEvent.code prefix
  if (code.startsWith('Digit')) return code.slice(5); // i18n-ok: a KeyboardEvent.code prefix
  if (code === 'Slash') return '/'; // 97b — the tooltip key's default: the `?` key reads as its face
  return code.replace(/([a-z])([A-Z0-9])/g, '$1 $2');
}
