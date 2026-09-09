/**
 * §95a — the locale runtime for CONFIG prose (the sidecar; Round 7 spec §5).
 *
 * English is locale zero and lives INLINE in `config/*.json`, where the
 * editors write it; its value is its own key. Every other locale is a
 * sidecar file per family (`locales/<lang>/<family>.json`, a flat map
 * address → entry) registered here before the catalogs load. A loader
 * parses its JSON, then calls `applyLocale(family, schema, data)`: every
 * prose site (prose.ts) resolves through the active locale — `en` returns
 * the inline value untouched; another locale returns its entry or THROWS
 * (a missing entry is a shipping defect, never a silent English fallback —
 * the failure that hid `emboldened`'s missing colour for weeks).
 *
 * Resolution happens once, at catalog load. A locale switch is a Round 8
 * setting and reloads the page; there is no live re-resolution.
 *
 * `LocaleEntry` is a plain string today; 95e widens it to the provenance
 * object (`{ text, source, translator, reviewer }`) — readers already
 * accept both shapes so the file format never bumps.
 */

import type { z } from 'zod';
import { proseSites, type ProseFamily, type ProseSite } from './prose';

export const DEFAULT_LOCALE = 'en';

export interface LocaleEntryObject {
  readonly text: string;
}
export type LocaleEntry = string | LocaleEntryObject;
export type LocaleFile = Readonly<Record<string, LocaleEntry>>;

let active = DEFAULT_LOCALE;
/** lang → family → file */
const tables = new Map<string, Map<string, LocaleFile>>();

export function activeLocale(): string {
  return active;
}

/** Tests + the future settings row. Takes effect for catalogs loaded AFTER the call. */
export function setActiveLocale(lang: string): void {
  if (lang.length === 0) throw new Error('i18n: locale must be non-empty');
  active = lang;
}

export function registerLocale(lang: string, family: string, file: LocaleFile): void {
  let families = tables.get(lang);
  if (!families) {
    families = new Map();
    tables.set(lang, families);
  }
  families.set(family, file);
}

/** Test hygiene: drop every registered sidecar and return to `en`. */
export function resetLocales(): void {
  tables.clear();
  active = DEFAULT_LOCALE;
}

export function entryText(entry: LocaleEntry): string {
  return typeof entry === 'string' ? entry : entry.text;
}

/** One address through the active locale. `en` is the inline value by definition. */
export function resolveProse(family: string, address: string, inline: string): string {
  if (active === DEFAULT_LOCALE) return inline;
  const entry = tables.get(active)?.get(family)?.[address];
  if (entry === undefined) {
    throw new Error(
      `i18n: locale '${active}' has no entry for '${address}' (family '${family}') — extract with \`npm run i18n:extract\`, translate it, and register the sidecar before the catalog loads`,
    );
  }
  return entryText(entry);
}

/**
 * Resolve every prose site of a parsed catalog IN PLACE through the active
 * locale. Returns the sites (post-resolution values) for callers that want
 * the census. Under `en` this is a walk with no writes — which still runs
 * the walker's guards (unknown def types, separator segments, address
 * collisions) at boot, on the forgetful path.
 */
export function applyLocale(family: string, schema: z.ZodType, data: unknown): readonly ProseSite[] {
  const sites = proseSites(family, schema, data);
  if (active === DEFAULT_LOCALE) return sites;
  for (const site of sites) {
    const resolved = resolveProse(family, site.address, site.value);
    if (resolved !== site.value) site.set(resolved);
  }
  return sites;
}

/**
 * The loader seam: resolve a freshly parsed catalog through the active
 * locale and hand back its registry descriptor. Every loader with prose
 * exports `<FAMILY>_PROSE = loadProse(...)` right after its parse (before
 * any normalize/map step copies the fields), and families.ts lists them.
 */
export function loadProse(family: string, schema: z.ZodType, data: unknown): ProseFamily {
  applyLocale(family, schema, data);
  return { family, schema, data };
}
