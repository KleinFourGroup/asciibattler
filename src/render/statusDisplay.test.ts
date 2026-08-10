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
import { STATUS_DISPLAY, STATUS_DISPLAY_FALLBACK, statusColor } from './statusDisplay';

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
