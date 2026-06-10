import { describe, it, expect, vi } from 'vitest';
import { Keybindings, keyLabel, type KeyLike } from './Keybindings';
import { KEYBIND_ACTIONS, type KeybindAction } from '../config/keybindings';

// Mechanic test — explicit literal bindings, never the shipped config (the
// balance-proof rule's converse: primitive/mechanic tests pin literals). The
// one config-derived check is the coverage guard below, which iterates
// KEYBIND_ACTIONS so a new action is covered the moment it's added.

const DEFAULTS: Record<KeybindAction, string> = {
  fastForward: 'KeyF',
  setObjective: 'KeyO',
  clearObjective: 'KeyC',
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
    expect(kb.codeFor('fastForward')).toBe('KeyF');
    expect(kb.codeFor('setObjective')).toBe('KeyO');
    expect(kb.codeFor('clearObjective')).toBe('KeyC');
  });

  it('reverse-maps a code to its action, or null when unbound', () => {
    const kb = new Keybindings(DEFAULTS);
    expect(kb.actionFor('KeyO')).toBe('setObjective');
    expect(kb.actionFor('KeyZ')).toBeNull();
  });

  it('dispatches a keydown to the subscribed handler and preventDefaults', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    kb.on('fastForward', fire);

    const { event, preventDefault } = keyEvent('KeyF');
    kb.handleKeyDown(event);

    expect(fire).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('ignores auto-repeat and leaves the event for the browser', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    kb.on('fastForward', fire);

    const { event, preventDefault } = keyEvent('KeyF', /* repeat */ true);
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
    const { event, preventDefault } = keyEvent('KeyF');
    kb.handleKeyDown(event);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('unsubscribe stops a handler from firing', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    const off = kb.on('fastForward', fire);
    off();
    kb.handleKeyDown(keyEvent('KeyF').event);
    expect(fire).not.toHaveBeenCalled();
  });

  it('fires every handler subscribed to one action', () => {
    const kb = new Keybindings(DEFAULTS);
    const a = vi.fn();
    const b = vi.fn();
    kb.on('clearObjective', a);
    kb.on('clearObjective', b);
    kb.handleKeyDown(keyEvent('KeyC').event);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('rebind re-routes the existing subscriber to the new code with no re-subscription', () => {
    const kb = new Keybindings(DEFAULTS);
    const fire = vi.fn();
    kb.on('setObjective', fire);

    // The old key no longer triggers it...
    kb.rebind('setObjective', 'KeyP');
    const old = keyEvent('KeyO');
    kb.handleKeyDown(old.event);
    expect(fire).not.toHaveBeenCalled();
    expect(old.preventDefault).not.toHaveBeenCalled();

    // ...the new one does.
    kb.handleKeyDown(keyEvent('KeyP').event);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(kb.codeFor('setObjective')).toBe('KeyP');
    expect(kb.actionFor('KeyP')).toBe('setObjective');
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
});
