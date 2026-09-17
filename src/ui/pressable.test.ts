/**
 * 100c1 — the pressable helper's key rule, pinned pure (vitest runs node,
 * no DOM: the wiring is the user's Firefox read). The one derived pin is
 * the rule's premise: Enter is bound to NO registry action (so the 'now'
 * path can never co-fire a hotkey) while Space IS bound (so its activation
 * must defer to the sink's verdict) — read off config/keybindings.json,
 * never restated here.
 */

import { describe, expect, it } from 'vitest';
import { pressableActivation } from './pressable';
import { KEYBINDING_DEFAULTS } from '../config/keybindings';

describe('100c1 — pressableActivation', () => {
  it('Enter activates now; Space defers; nothing else activates', () => {
    expect(pressableActivation('Enter', false)).toBe('now');
    expect(pressableActivation(' ', false)).toBe('deferred');
    for (const key of ['a', 'Escape', 'Tab', 'ArrowDown', 'Spacebar', 'NumpadEnter', '']) {
      expect(pressableActivation(key, false), key).toBeNull();
    }
  });

  it('auto-repeat never activates', () => {
    expect(pressableActivation('Enter', true)).toBeNull();
    expect(pressableActivation(' ', true)).toBeNull();
  });

  it('the premise holds in the registry: Enter unbound, Space bound', () => {
    const codes = Object.values(KEYBINDING_DEFAULTS);
    expect(codes).not.toContain('Enter');
    expect(codes).not.toContain('NumpadEnter');
    expect(codes).toContain('Space');
  });
});
