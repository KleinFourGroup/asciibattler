/**
 * §95a — THE SIDECAR PINS for `en` (Round 7 spec §5), riding `npm test` so
 * they fire on the forgetful path: config prose is authored through the
 * editors with no code edit and no thought for the locale layer, so the
 * committed `locales/en/<family>.json` — a DERIVED ARTIFACT of the catalogs
 * (the prior-table tripwire shape, tests/prior-table-coverage.test.ts) —
 * must be proven current here.
 *
 * Per registered family (src/i18n/families.ts), against the LIVE catalog:
 *   1. missing — every live prose address has an entry in the extract;
 *   2. orphan  — every extract address is still a live site;
 *   3. stale   — every extract value equals the inline English.
 * Plus: every `locales/en/*.json` names a registered family (an orphan
 * FILE), and every registered family has an extract on disk.
 *
 * The fix for all of them is the same command: `npm run i18n:extract`.
 * For a non-en locale the same three checks read `source` instead of the
 * value (95e — the fuzzy pin).
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROSE_FAMILIES } from '../src/i18n/families';
import { extractFamily, localeFilePath } from '../src/i18n/extract';
import { entryText, type LocaleFile } from '../src/i18n/locale';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = 'run `npm run i18n:extract` and commit the result';

function readExtract(family: string): LocaleFile | null {
  const path = join(ROOT, localeFilePath('en', family));
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as LocaleFile;
}

describe('the en sidecar extract is current (derived-artifact pins)', () => {
  it('every locales/en/*.json names a registered prose family', () => {
    const dir = join(ROOT, 'locales', 'en');
    if (!existsSync(dir)) return;
    // `ui.json` is the UI string table (95c) — a SOURCE, not a derived extract;
    // its own pins are tests/i18n-ui-keys.test.ts.
    const known = new Set([...PROSE_FAMILIES.map((f) => `${f.family}.json`), 'ui.json']);
    const orphans = readdirSync(dir).filter((f) => f.endsWith('.json') && !known.has(f));
    expect(orphans, `orphan extract files (no registered family — delete them, or register the family): ${orphans.join(', ')}`).toEqual([]);
  });

  for (const family of PROSE_FAMILIES) {
    describe(`family '${family.family}'`, () => {
      const live = extractFamily(family);
      const liveAddresses = Object.keys(live);

      it('has a committed extract', () => {
        expect(readExtract(family.family), `${localeFilePath('en', family.family)} is missing — ${FIX}`).not.toBeNull();
      });

      it('has no MISSING address (every live prose site is in the extract)', () => {
        const file = readExtract(family.family) ?? {};
        const missing = liveAddresses.filter((a) => !(a in file));
        expect(missing, `addresses live in the catalog but absent from the extract — ${FIX}: ${missing.join(', ')}`).toEqual([]);
      });

      it('has no ORPHAN address (every extract entry is still a live site)', () => {
        const file = readExtract(family.family) ?? {};
        const orphans = Object.keys(file).filter((a) => !(a in live));
        expect(orphans, `addresses in the extract but no longer in the catalog — ${FIX}: ${orphans.join(', ')}`).toEqual([]);
      });

      it('has no STALE value (every extract entry equals the inline English)', () => {
        const file = readExtract(family.family) ?? {};
        const stale = liveAddresses.filter((a) => a in file && entryText(file[a]!) !== live[a]);
        expect(stale, `extract values that drifted from the config — ${FIX}: ${stale.join(', ')}`).toEqual([]);
      });
    });
  }
});
