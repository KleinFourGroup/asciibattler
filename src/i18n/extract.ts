/**
 * §95a — the extract: a family's prose as the flat `locales/en/<family>.json`
 * map (address → inline English, in catalog order so the file diffs like
 * the config it mirrors). The committed `en` files are DERIVED ARTIFACTS
 * of the catalogs — the sidecar pins (tests/i18n-en-extract.test.ts) fail
 * when they drift (the prior-table tripwire shape), and
 * `npm run i18n:extract` rebuilds them.
 */

import { proseSites } from './prose';
import type { ProseFamily } from './families';

export const LOCALES_DIR = 'locales';

export function localeFilePath(lang: string, family: string): string {
  return `${LOCALES_DIR}/${lang}/${family}.json`;
}

/** address → inline value, catalog order. */
export function extractFamily(f: ProseFamily): Record<string, string> {
  const out: Record<string, string> = {};
  for (const site of proseSites(f.family, f.schema, f.data)) out[site.address] = site.value;
  return out;
}

/** The on-disk shape: 2-space JSON + a trailing newline (every editor's emit convention). */
export function formatLocaleFile(entries: Readonly<Record<string, unknown>>): string {
  return `${JSON.stringify(entries, null, 2)}\n`;
}
