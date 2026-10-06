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
import { HITSPLAT_PREFIX, hitsplatText, isDotHitsplatKind, type HitsplatKind } from './fxRegistry';
import {
  STATUS_DISPLAY,
  STATUS_DISPLAY_FALLBACK,
  STATUS_SYMBOL_FALLBACK,
  statusColor,
  statusSymbol,
  EMPOWER_DISPLAY,
  empowerColor,
  empowerLabel,
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

/** 116g — the symbol pin. A status's symbol is its read where its hue fails
 *  (a camp unit's pip has no card beside it), so a status that shares one, or
 *  ships without one, is the hue-only pip again. Derived from the catalog
 *  like the colour pin: a new status fails here until it picks a symbol no
 *  other holds. */
describe('the status symbols', () => {
  const ids = Object.keys(STATUS_DEFS);

  it('every shipped status has one character of its own: no fallback, no two alike', () => {
    const symbols = ids.map(statusSymbol);
    for (const [i, symbol] of symbols.entries()) {
      expect([...symbol].length, ids[i]).toBe(1);
      expect(symbol.trim(), ids[i]).toBe(symbol);
      expect(symbol, ids[i]).not.toBe(STATUS_SYMBOL_FALLBACK);
    }
    expect(new Set(symbols).size, symbols.join(' ')).toBe(ids.length);
  });

  it('a status outside the table wears the fallback', () => {
    expect(statusSymbol('no-such-status')).toBe(STATUS_SYMBOL_FALLBACK);
  });

  it("a DoT's number wears its status's symbol, and the four a number already wore are the ones it wore", () => {
    const dotKinds = (Object.keys(HITSPLAT_PREFIX) as HitsplatKind[]).filter(isDotHitsplatKind);
    expect(dotKinds.length).toBe(3);
    for (const kind of dotKinds) expect(HITSPLAT_PREFIX[kind], kind).toBe(STATUS_DISPLAY[kind]!.symbol);
    // Rejuvenate's number is a heal number, so its pip wears the heal's sign.
    expect(STATUS_DISPLAY.rejuvenate!.symbol).toBe(HITSPLAT_PREFIX.heal);
    // The glyphs themselves, as literals: reading them from the table must not
    // have changed what a number shows.
    expect(hitsplatText('burn', 7)).toBe('~7');
    expect(hitsplatText('bleed', 7)).toBe('‡7');
    expect(hitsplatText('poison', 7)).toBe('☠7');
    expect(hitsplatText('heal', 7)).toBe('+7');
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

  // 95f — the label rides the same row (from the UI string table), so the
  // coverage above is also label coverage; and the retired `empowered` key
  // (the Mars buff until 95f — it collided with the EMPOWER mechanic that
  // grants it) must never come back into the catalogs.
  it('every shipped buff key has a table label (not the capitalized-key fallback), and `empowered` is retired', () => {
    for (const key of shippedBuffKeys()) {
      expect(EMPOWER_DISPLAY[key]!.label, key).toBeTypeOf('string');
      expect(empowerLabel(key), key).toBe(EMPOWER_DISPLAY[key]!.label);
    }
    expect(shippedBuffKeys().has('empowered')).toBe(false);
    expect(shippedBuffKeys().has('honed')).toBe(true);
    expect(empowerLabel('honed')).toBe('Honed');
    expect(empowerLabel('no-such-buff')).toBe('No-such-buff'); // the fallback, for a key outside the table
  });
});
