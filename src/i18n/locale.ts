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
 * §95e — an entry is a plain string or the provenance object
 * (provenance.ts: `{ text, source, translator, reviewer }`). A FUZZY entry —
 * one whose stored `source` hash no longer matches the inline English — is
 * the one case that does NOT throw: it resolves to the English (the
 * translation no longer describes it), prefixed with a marker under Vite's
 * DEV so a dev build shows the drift, and lands in the `fuzzyEntries()`
 * census. The pin (tests/i18n-en-extract.test.ts) is what keeps a fuzzy
 * entry out of a shipped locale; the runtime only has to survive one.
 */

import type { z } from 'zod';
import { proseSites, type ProseFamily, type ProseSite } from './prose';
import { currencyOf, entryTextOf, type ProvenanceEntry } from './provenance';

export const DEFAULT_LOCALE = 'en';

export type LocaleEntryObject = ProvenanceEntry<string>;
export type LocaleEntry = string | LocaleEntryObject;
export type LocaleFile = Readonly<Record<string, LocaleEntry>>;

/** The dev-mode prefix on a fuzzy entry's English fallback. */
export const FUZZY_MARKER = '⚠ ';
const DEV = typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;

let active = DEFAULT_LOCALE;
let marker = DEV ? FUZZY_MARKER : '';
/** lang → family → file */
const tables = new Map<string, Map<string, LocaleFile>>();
/** Every fuzzy entry resolved this page-life: config addresses + `ui.<key>`. */
const fuzzySeen = new Set<string>();

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

/** Every registered sidecar, for the credits (credits.ts). */
export function registeredLocaleFiles(): readonly (readonly [lang: string, family: string, file: LocaleFile])[] {
  const out: (readonly [string, string, LocaleFile])[] = [];
  for (const [lang, families] of tables) for (const [family, file] of families) out.push([lang, family, file]);
  return out;
}

/** Test hygiene: drop every registered sidecar, the fuzzy census, and return to `en`. */
export function resetLocales(): void {
  tables.clear();
  fuzzySeen.clear();
  active = DEFAULT_LOCALE;
  marker = DEV ? FUZZY_MARKER : '';
}

/** The prefix a fuzzy fallback carries (`''` outside DEV). Tests pin both settings. */
export function fuzzyMarker(): string {
  return marker;
}

export function setFuzzyMarker(next: string): void {
  marker = next;
}

/** The census: every fuzzy entry that resolved since the last reset (config addresses, and `ui.<key>` from ui.ts). */
export function fuzzyEntries(): readonly string[] {
  return [...fuzzySeen].sort();
}

export function recordFuzzy(id: string): void {
  fuzzySeen.add(id);
}

export function entryText(entry: LocaleEntry): string {
  return entryTextOf(entry);
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
  if (currencyOf(entry, inline) === 'fuzzy') {
    recordFuzzy(address);
    return marker + inline;
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
