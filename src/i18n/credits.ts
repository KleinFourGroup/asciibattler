/**
 * §95e — the translators credit: every name stamped into the REGISTERED
 * locale tables (the config sidecars from locale.ts + the UI tables from
 * ui.ts), per language. Pure over what is registered, so the Round 8
 * credits screen reads it in the browser with no file access; `en` carries
 * no stamps (English authorship is git's) and is skipped. The same
 * `creditsOf` runs over the on-disk files in `npm run i18n:review`.
 */

import { DEFAULT_LOCALE, registeredLocaleFiles } from './locale';
import { creditsOf, type LocaleCredit } from './provenance';
import { registeredUiTables } from './ui';

export type { LocaleCredit } from './provenance';

export function localeCredits(): LocaleCredit[] {
  const files: (readonly [string, Readonly<Record<string, unknown>>])[] = [];
  for (const [lang, , file] of registeredLocaleFiles()) if (lang !== DEFAULT_LOCALE) files.push([lang, file]);
  for (const [lang, table] of registeredUiTables()) if (lang !== DEFAULT_LOCALE) files.push([lang, table]);
  return creditsOf(files);
}
