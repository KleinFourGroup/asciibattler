import { describe, it, expect, vi } from 'vitest';
import {
  Keybindings,
  RESERVED_CODES,
  captureVerdict,
  isBindable,
  isTextEntry,
  keyLabel,
  overridesOf,
  resolveBindings,
  withRebind,
  type KeyLike,
} from './Keybindings';
import { KEYBIND_ACTIONS, type KeybindAction } from '../config/keybindings';

// Mechanic test — explicit literal bindings, never the shipped config (the
// balance-proof rule's converse: primitive/mechanic tests pin literals). The
// one config-derived check is the coverage guard below, which iterates
// KEYBIND_ACTIONS so a new action is covered the moment it's added.

const DEFAULTS: Record<KeybindAction, string> = {
  speedHalf: 'Digit0',
  speed1: 'Digit1',
  speed2: 'Digit2',
  speed3: 'Digit3',
  togglePause: 'Space',
  engageObjective: 'KeyE',
  focusObjective: 'KeyF',
  holdObjective: 'KeyH',
  stopObjective: 'KeyT',
  toggleSectorMap: 'KeyM',
  showTooltip: 'Slash',
};

/**
 * A minimal keydown stand-in (no DOM) plus its spied `preventDefault`. The spy
 * is cast into the `KeyLike` event (vitest's `Mock` type isn't structurally a
 * `() => void`), and returned separately so assertions get the real Mock.
 */
function keyEvent(
  code: string,
  repeat = false,
): { event: KeyLike; preventDefault: ReturnType<typeof vi.fn> } {
  const preventDefault = vi.fn();
  return {
    event: { code, repeat, preventDefault: preventDefault as unknown as () => void },
    preventDefault,
  };
}

describe('Keybindings', () => {
  it('resolves the code bound to each action', () => {
    const kb = new Keybindings(DEFAULTS);
    expect(kb.codeFor('speed2')).toBe('Digit2');
    expect(kb.codeFor('togglePause')).toBe('Space');
    expect(kb.codeFor('engageObjective')).toBe('KeyE');
    expect(kb.codeFor('stopObjective')).toBe('KeyT');
  });

  it('reverse-maps a code to its action, or null when unbound', () => {
    const kb = new Keybindings(DEFAULTS);
    expect(kb.actionFor('KeyE')).toBe('engageObjective');
    expect(kb.actionFor('KeyZ')).toBeNull();
  });

  it('dispatches a keydown to the subscribed handler and preventDefaults', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    kb.on('speed2', fire);

    const { event, preventDefault } = keyEvent('Digit2');
    kb.handleKeyDown(event);

    expect(fire).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('ignores auto-repeat and leaves the event for the browser', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    kb.on('speed2', fire);

    const { event, preventDefault } = keyEvent('Digit2', /* repeat */ true);
    kb.handleKeyDown(event);

    expect(fire).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does not preventDefault an unbound key', () => {
    const kb = new Keybindings(DEFAULTS);
    const { event, preventDefault } = keyEvent('KeyZ');
    kb.handleKeyDown(event);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does not preventDefault a bound key with no live subscriber', () => {
    // Out-of-battle: the registry exists but no HUD is subscribed — the press
    // must fall through untouched.
    const kb = new Keybindings(DEFAULTS);
    const { event, preventDefault } = keyEvent('Digit2');
    kb.handleKeyDown(event);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('unsubscribe stops a handler from firing', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    const off = kb.on('speed2', fire);
    off();
    kb.handleKeyDown(keyEvent('Digit2').event);
    expect(fire).not.toHaveBeenCalled();
  });

  it('fires every handler subscribed to one action', () => {
    const kb = new Keybindings(DEFAULTS);
    const a = vi.fn();
    const b = vi.fn();
    kb.on('stopObjective', a);
    kb.on('stopObjective', b);
    kb.handleKeyDown(keyEvent('KeyT').event);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('rebind re-routes the existing subscriber to the new code with no re-subscription', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    kb.on('engageObjective', fire);

    // The old key no longer triggers it...
    kb.rebind('engageObjective', 'KeyP');
    const old = keyEvent('KeyE');
    kb.handleKeyDown(old.event);
    expect(fire).not.toHaveBeenCalled();
    expect(old.preventDefault).not.toHaveBeenCalled();

    // ...the new one does.
    kb.handleKeyDown(keyEvent('KeyP').event);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(kb.codeFor('engageObjective')).toBe('KeyP');
    expect(kb.actionFor('KeyP')).toBe('engageObjective');
  });

  it('defaults to the shipped config when no overrides are passed', () => {
    // Every declared action must resolve to a non-empty code (the schema
    // guarantees presence; this guards the registry wiring).
    const kb = new Keybindings();
    for (const action of KEYBIND_ACTIONS) {
      expect(kb.codeFor(action).length).toBeGreaterThan(0);
    }
  });
});

describe('keyLabel', () => {
  it('strips the Key/Digit prefix and passes other codes through', () => {
    expect(keyLabel('KeyF')).toBe('F');
    expect(keyLabel('Digit2')).toBe('2');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Escape')).toBe('Escape');
  });

  it('97b — renders the tooltip key\'s Slash code as its face', () => {
    expect(keyLabel('Slash')).toBe('/');
  });
});

// 116b — the key rules. Every expected binding below is written out by hand
// from the rule's words, not computed through the functions under test.
describe('116b — the key rules', () => {
  const codes = (b: Record<KeybindAction, string>): string[] => KEYBIND_ACTIONS.map((a) => b[a]);
  const unique = (b: Record<KeybindAction, string>): boolean => new Set(codes(b)).size === KEYBIND_ACTIONS.length;

  it('a free key moves one action and nothing else', () => {
    expect(withRebind(DEFAULTS, 'togglePause', 'KeyP')).toEqual({ ...DEFAULTS, togglePause: 'KeyP' });
  });

  it('a taken key swaps the two actions', () => {
    // Pause takes F; Focus, which held F, takes Space.
    expect(withRebind(DEFAULTS, 'togglePause', 'KeyF')).toEqual({
      ...DEFAULTS,
      togglePause: 'KeyF',
      focusObjective: 'Space',
    });
  });

  it("an action's own key is no change, and a reserved or empty key is refused", () => {
    expect(withRebind(DEFAULTS, 'togglePause', 'Space')).toEqual(DEFAULTS);
    for (const code of ['Enter', 'NumpadEnter', 'Tab', 'Escape', '']) {
      expect(withRebind(DEFAULTS, 'togglePause', code), code).toBeNull();
    }
    expect([...RESERVED_CODES].sort()).toEqual(['Enter', 'Escape', 'NumpadEnter', 'Tab']);
  });

  it('what is stored is the difference from the defaults, and it resolves back to the same bindings', () => {
    expect(overridesOf(DEFAULTS, DEFAULTS)).toEqual({});
    const swapped = { ...DEFAULTS, togglePause: 'KeyF', focusObjective: 'Space' };
    expect(overridesOf(DEFAULTS, swapped)).toEqual({ togglePause: 'KeyF', focusObjective: 'Space' });
    expect(resolveBindings(DEFAULTS, { togglePause: 'KeyF', focusObjective: 'Space' })).toEqual(swapped);
    expect(resolveBindings(DEFAULTS, {})).toEqual(DEFAULTS);
  });

  it('three actions whose keys rotate resolve to the stored bindings', () => {
    // Engage E → F, Focus F → H, Hold H → E.
    const rotated = { ...DEFAULTS, engageObjective: 'KeyF', focusObjective: 'KeyH', holdObjective: 'KeyE' };
    expect(resolveBindings(DEFAULTS, overridesOf(DEFAULTS, rotated))).toEqual(rotated);
  });

  it('a stored set no rebind could have made still gives one key per action', () => {
    // Two actions on one key, an action this build doesn't have, a reserved
    // key and a value that isn't a string.
    const stored = {
      togglePause: 'KeyP',
      holdObjective: 'KeyP',
      dance: 'KeyD',
      stopObjective: 'Escape',
      speed1: 7,
    } as unknown as Record<string, string>;
    const resolved = resolveBindings(DEFAULTS, stored);
    expect(unique(resolved)).toBe(true);
    // In the registry's order Pause takes P first; Hold then takes it, and
    // Pause gets Hold's old key.
    expect(resolved).toEqual({ ...DEFAULTS, togglePause: 'KeyH', holdObjective: 'KeyP' });
    expect('dance' in resolved).toBe(false);
  });

  it('the registry takes the stored overrides, says what to store, and goes back to the defaults', () => {
    const kb = new Keybindings(DEFAULTS);
    kb.setOverrides({ togglePause: 'KeyF', focusObjective: 'Space' });
    expect(kb.codeFor('togglePause')).toBe('KeyF');
    expect(kb.codeFor('focusObjective')).toBe('Space');
    expect(kb.overrides()).toEqual({ togglePause: 'KeyF', focusObjective: 'Space' });
    kb.setOverrides({});
    expect(kb.bindings()).toEqual(DEFAULTS);
  });

  it('rebind swaps, refuses a reserved key, and tells its listeners of each change', () => {
    const kb = new Keybindings(DEFAULTS);
    const heard = vi.fn();
    const off = kb.onChange(heard);
    expect(kb.rebind('togglePause', 'KeyF')).toBe(true);
    expect(kb.codeFor('focusObjective')).toBe('Space');
    expect(kb.labelFor('togglePause')).toBe('F');
    expect(kb.rebind('togglePause', 'Escape')).toBe(false);
    expect(kb.codeFor('togglePause')).toBe('KeyF');
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    kb.setOverrides({});
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('after a swap each key fires its one new action', () => {
    const kb = new Keybindings(DEFAULTS);
    const pause = vi.fn();
    const focus = vi.fn();
    kb.on('togglePause', pause);
    kb.on('focusObjective', focus);
    kb.rebind('togglePause', 'KeyF');
    kb.handleKeyDown(keyEvent('KeyF').event);
    expect([pause.mock.calls.length, focus.mock.calls.length]).toEqual([1, 0]);
    kb.handleKeyDown(keyEvent('Space').event);
    expect([pause.mock.calls.length, focus.mock.calls.length]).toEqual([1, 1]);
  });

  it('a key held with Ctrl, Alt or Meta fires no hotkey and is left to the browser; Shift passes', () => {
    const kb = new Keybindings(DEFAULTS);
    const focus = vi.fn();
    kb.on('focusObjective', focus);
    for (const held of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { ctrlKey: true, altKey: true }]) {
      const { event, preventDefault } = keyEvent('KeyF');
      kb.handleKeyDown({ ...event, ...held });
      expect(preventDefault, JSON.stringify(held)).not.toHaveBeenCalled();
    }
    expect(focus).not.toHaveBeenCalled();
    const shifted = keyEvent('KeyF');
    kb.handleKeyDown({ ...shifted.event, ...{ shiftKey: true } });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(shifted.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('116c — a key typed in a text field fires no hotkey and is left to the field', () => {
    const kb = new Keybindings(DEFAULTS);
    const map = vi.fn();
    kb.on('toggleSectorMap', map);
    const typed = [
      { tagName: 'INPUT', type: 'text' },
      { tagName: 'INPUT', type: 'search' },
      { tagName: 'INPUT', type: 'number' },
      { tagName: 'TEXTAREA' },
      { tagName: 'DIV', isContentEditable: true },
    ];
    for (const target of typed) {
      expect(isTextEntry(target), JSON.stringify(target)).toBe(true);
      const { event, preventDefault } = keyEvent('KeyM');
      kb.handleKeyDown({ ...event, target });
      expect(preventDefault, JSON.stringify(target)).not.toHaveBeenCalled();
    }
    expect(map).not.toHaveBeenCalled();
    // The control: the same key anywhere else fires, a slider included.
    const elsewhere = [
      undefined,
      null,
      { tagName: 'BODY' },
      { tagName: 'BUTTON', type: 'button' },
      { tagName: 'INPUT', type: 'range' },
      { tagName: 'INPUT', type: 'checkbox' },
      { tagName: 'DIV', isContentEditable: false },
    ];
    for (const target of elsewhere) {
      expect(isTextEntry(target), JSON.stringify(target)).toBe(false);
      const { event, preventDefault } = keyEvent('KeyM');
      kb.handleKeyDown({ ...event, target });
      expect(preventDefault, JSON.stringify(target)).toHaveBeenCalledTimes(1);
    }
    expect(map).toHaveBeenCalledTimes(elsewhere.length);
  });

  it('116d — while suspended no key fires a hotkey, and every key is left alone', () => {
    const kb = new Keybindings(DEFAULTS);
    const pause = vi.fn();
    kb.on('togglePause', pause);
    const release = kb.suspend();
    const held = keyEvent('Space');
    kb.handleKeyDown(held.event);
    expect(pause).not.toHaveBeenCalled();
    expect(held.preventDefault).not.toHaveBeenCalled();
    // Suspensions count, and a release called twice releases once.
    const second = kb.suspend();
    release();
    release();
    kb.handleKeyDown(keyEvent('Space').event);
    expect(pause).not.toHaveBeenCalled();
    second();
    // The control: the same key fires once nothing suspends it.
    const after = keyEvent('Space');
    kb.handleKeyDown(after.event);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(after.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("the shipped defaults give every action its own key, each one a key an action can take", () => {
    const shipped = new Keybindings().bindings();
    expect(unique(shipped)).toBe(true);
    for (const code of codes(shipped)) {
      expect(RESERVED_CODES).not.toContain(code);
      expect(isBindable(code), code).toBe(true);
    }
  });
});

// 116e — the rules the rebind rows add. The expected values are written out
// by hand from the rules' words.
describe('116e — the rebind rows', () => {
  const key = (code: string, flags: Partial<KeyLike> = {}): KeyLike => ({
    code,
    repeat: false,
    preventDefault: () => {},
    ...flags,
  });

  it('no action takes a reserved key, a modifier or a lock on its own, or a key with no name', () => {
    const refused = [
      'Enter',
      'NumpadEnter',
      'Tab',
      'Escape',
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
      'Unidentified',
      '',
    ];
    for (const code of refused) {
      expect(isBindable(code), code).toBe(false);
      expect(withRebind(DEFAULTS, 'togglePause', code), code).toBeNull();
    }
    for (const code of ['KeyP', 'Space', 'Digit7', 'ArrowUp', 'F5', 'Numpad1', 'Backquote', 'Slash']) {
      expect(isBindable(code), code).toBe(true);
    }
  });

  it('a stored modifier is left out, so no action sits on a key that could never fire', () => {
    expect(resolveBindings(DEFAULTS, { togglePause: 'ControlLeft', focusObjective: 'ShiftLeft' })).toEqual(DEFAULTS);
  });

  it('a waiting row binds a plain key', () => {
    expect(captureVerdict(key('KeyP'))).toBe('bind');
    expect(captureVerdict(key('Space'))).toBe('bind');
    expect(captureVerdict(key('ArrowLeft'))).toBe('bind');
  });

  it('Enter and Escape call the wait off, Tab calls it off and walks on', () => {
    expect(captureVerdict(key('Escape'))).toBe('cancel');
    expect(captureVerdict(key('Enter'))).toBe('cancel');
    expect(captureVerdict(key('NumpadEnter'))).toBe('cancel');
    expect(captureVerdict(key('Tab'))).toBe('walk');
    expect(captureVerdict(key('Tab', { repeat: true }))).toBe('walk');
  });

  it('a chord is left to the browser, a modifier pressed on its own included', () => {
    expect(captureVerdict(key('KeyF', { ctrlKey: true }))).toBe('pass');
    expect(captureVerdict(key('KeyR', { metaKey: true }))).toBe('pass');
    expect(captureVerdict(key('Tab', { altKey: true }))).toBe('pass');
    expect(captureVerdict(key('ControlLeft', { ctrlKey: true }))).toBe('pass');
    expect(captureVerdict(key('AltRight', { altKey: true }))).toBe('pass');
  });

  it('an auto-repeat or a key no action takes changes nothing, and the row goes on waiting', () => {
    expect(captureVerdict(key('KeyP', { repeat: true }))).toBe('swallow');
    // A held Enter is the press that started the wait, still down.
    expect(captureVerdict(key('Enter', { repeat: true }))).toBe('swallow');
    expect(captureVerdict(key('ShiftLeft'))).toBe('swallow');
    expect(captureVerdict(key('CapsLock'))).toBe('swallow');
    expect(captureVerdict(key(''))).toBe('swallow');
  });

  it('every key a waiting row binds is a key the swap rule takes', () => {
    for (const code of ['KeyP', 'Space', 'F5', 'Enter', 'Tab', 'ShiftLeft', 'CapsLock', '', 'Numpad0']) {
      const binds = captureVerdict(key(code)) === 'bind';
      expect(withRebind(DEFAULTS, 'holdObjective', code) !== null, code).toBe(binds);
    }
  });

  it('the registry says what a rebind would store, and stays as it is', () => {
    const kb = new Keybindings(DEFAULTS);
    expect(kb.overridesWith('togglePause', 'KeyP')).toEqual({ togglePause: 'KeyP' });
    // Focus onto Pause's key: the two swap, and both are off their defaults.
    expect(kb.overridesWith('focusObjective', 'Space')).toEqual({ focusObjective: 'Space', togglePause: 'KeyF' });
    expect(kb.overridesWith('togglePause', 'Space')).toEqual({});
    expect(kb.overridesWith('togglePause', 'Escape')).toBeNull();
    expect(kb.overridesWith('togglePause', 'ShiftLeft')).toBeNull();
    expect(kb.bindings()).toEqual(DEFAULTS);

    // The read's two moves: Pause to P, then Focus to P.
    kb.setOverrides({ togglePause: 'KeyP' });
    expect(kb.overridesWith('focusObjective', 'KeyP')).toEqual({ focusObjective: 'KeyP', togglePause: 'KeyF' });
    // And back: Pause onto its default key stores nothing.
    expect(kb.overridesWith('togglePause', 'Space')).toEqual({});
    expect(kb.codeFor('togglePause')).toBe('KeyP');
  });

  it('a key with a long name shows it as words', () => {
    expect(keyLabel('ArrowUp')).toBe('Arrow Up');
    expect(keyLabel('Numpad1')).toBe('Numpad 1');
    expect(keyLabel('PageDown')).toBe('Page Down');
    expect(keyLabel('BracketLeft')).toBe('Bracket Left');
    expect(keyLabel('Backquote')).toBe('Backquote');
    expect(keyLabel('F11')).toBe('F11');
  });
});
