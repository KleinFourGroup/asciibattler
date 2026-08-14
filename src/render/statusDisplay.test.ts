/**
 * §76b — the STATUS_DISPLAY coverage pin. The map had no guard, so a shipped
 * status without an entry silently rendered the magenta fallback (`emboldened`
 * did exactly that from 47f until §76b). Headless-safe despite living in
 * `src/render/` — `statusDisplay.ts` is pure data (the FontAtlas.test.ts
 * precedent for testing the render layer's DOM-free modules).
 *
 * Derived from the live catalog (never a hardcoded status list): a new status
 * (`inspired` at the §76 design round, and everything after) fails here until
 * it picks a color — the new-status checklist, enforced.
 */

import { describe, it, expect } from 'vitest';
import { STATUS_DEFS } from '../config/statuses';
import { DAEMONS } from '../config/daemons';
import { PACKETS } from '../config/packets';
import { daemonEmpowerHook } from '../run/daemon';
import {
  STATUS_DISPLAY,
  STATUS_DISPLAY_FALLBACK,
  statusColor,
  EMPOWER_DISPLAY,
  empowerColor,
} from './statusDisplay';

describe('STATUS_DISPLAY coverage', () => {
  it('every shipped StatusDef has a display color (no magenta fallbacks)', () => {
    const missing = Object.keys(STATUS_DEFS).filter((id) => !(id in STATUS_DISPLAY));
    expect(missing).toEqual([]);
  });

  it('every shipped status resolves to a non-fallback color', () => {
    for (const id of Object.keys(STATUS_DEFS)) {
      expect(statusColor(id), id).not.toBe(STATUS_DISPLAY_FALLBACK);
    }
  });

  it('carries no orphan entries for retired statuses', () => {
    const orphans = Object.keys(STATUS_DISPLAY).filter((id) => !(id in STATUS_DEFS));
    expect(orphans).toEqual([]);
  });
});

/** 78d — the same three-guard pin for the empower-buff table, derived from
 *  the LIVE key sources (daemon empower hooks + packet applyBuff — the
 *  badge-eligibility union Run.empowerStacks uses; events grant no buffs as
 *  of §74). A new buff key fails here until it picks a color; a retired one
 *  fails the orphan guard until its entry goes. */
describe('EMPOWER_DISPLAY coverage', () => {
  const shippedBuffKeys = (): Set<string> => {
    const keys = new Set<string>();
    for (const d of DAEMONS) {
      const hook = daemonEmpowerHook(d);
      if (hook !== undefined) keys.add(hook.buff.key);
    }
    for (const p of PACKETS) {
      if (p.effect.op === 'applyBuff') keys.add(p.effect.buff.key);
    }
    return keys;
  };

  it('every shipped empower/packet buff key has a display color', () => {
    const missing = [...shippedBuffKeys()].filter((key) => !(key in EMPOWER_DISPLAY));
    expect(missing).toEqual([]);
  });

  it('every shipped buff key resolves to a non-fallback color', () => {
    for (const key of shippedBuffKeys()) {
      expect(empowerColor(key), key).not.toBe(STATUS_DISPLAY_FALLBACK);
    }
  });

  it('carries no orphan entries for retired buff keys', () => {
    const keys = shippedBuffKeys();
    const orphans = Object.keys(EMPOWER_DISPLAY).filter((key) => !keys.has(key));
    expect(orphans).toEqual([]);
  });
});
