/**
 * §95c — the UI string table: `t(key, params?)` for every literal that lives
 * in CODE rather than in a config catalog (Round 7 spec §5). Unlike config
 * prose (the sidecar — English inline, other locales derived), the UI table's
 * English is the SOURCE: `locales/en/ui.json`, an explicit-key flat map.
 * Keys are namespaced dot paths (`stat.power`, `roster.empty`,
 * `cache.overflow`), and a call site's key is ALWAYS a string literal — the
 * key-scan pins (tests/i18n-ui-keys.test.ts) read the literals to prove
 * every referenced key exists and every table key is referenced.
 *
 * Entries: a plain string, or a PLURAL entry — an object keyed by CLDR
 * plural category (`one` / `other` / …, `other` required) selected by
 * `Intl.PluralRules` on the `count` param. Placeholders are `{name}`;
 * a number param is formatted by `Intl.NumberFormat` (locale-correct
 * grouping and digits). No dependency — the browser's Intl is the engine.
 * A word that changes with a branch is two whole entries, never a fragment
 * (the spec's rule: word order belongs to the translator).
 *
 * Failure is loud: an unknown key, a missing placeholder param, a plural
 * entry with no numeric `count`, or a non-en locale lacking a key all THROW
 * (the empower-pin discipline — never a silent English fallback).
 *
 * Calling `t()` at module level (STAT_LABELS, the game-over COPY, the HUD
 * button table) is fine: the locale is fixed for the page's life (a switch
 * is a Round 8 setting and reloads).
 *
 * §95e — a non-en table entry may carry provenance (provenance.ts:
 * `{ text, source, … }`, where `text` is the string or plural entry). A
 * FUZZY entry (its `source` no longer hashes the English) resolves to the
 * ENGLISH entry with the dev marker and lands in the shared census as
 * `ui.<key>`; the pin (tests/i18n-ui-keys.test.ts) keeps one out of a
 * shipped table.
 */

import uiEn from '../../locales/en/ui.json';
import { DEFAULT_LOCALE, activeLocale, fuzzyMarker, recordFuzzy } from './locale';
import { currencyOf, entryTextOf, isProvenanceEntry, type ProvenanceEntry } from './provenance';

export type PluralEntry = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & { readonly other: string };
export type UiEntry = string | PluralEntry;
export type UiTable = Readonly<Record<string, UiEntry>>;
/** A registered (non-en) table: plain entries, or provenance-wrapped ones. */
export type UiLocaleEntry = UiEntry | ProvenanceEntry<UiEntry>;
export type UiLocaleTable = Readonly<Record<string, UiLocaleEntry>>;
export type TParams = Readonly<Record<string, string | number>>;

const tables = new Map<string, UiLocaleTable>([[DEFAULT_LOCALE, uiEn as UiTable]]);

/** The English source table (the key-scan pins + the extract read it). */
export const UI_EN: UiTable = uiEn as UiTable;

export function registerUiLocale(lang: string, table: UiLocaleTable): void {
  tables.set(lang, table);
}

/** Every registered table, `en` included, for the credits (credits.ts). */
export function registeredUiTables(): readonly (readonly [lang: string, table: UiLocaleTable])[] {
  return [...tables.entries()];
}

/** Test hygiene: drop every registered non-en table. */
export function resetUiLocales(): void {
  for (const lang of [...tables.keys()]) if (lang !== DEFAULT_LOCALE) tables.delete(lang);
}

export function isPluralEntry(entry: UiEntry): entry is PluralEntry {
  return typeof entry !== 'string' && !isProvenanceEntry(entry);
}

const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function rulesFor(lang: string): Intl.PluralRules {
  let r = pluralRules.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang);
    pluralRules.set(lang, r);
  }
  return r;
}

function numbersFor(lang: string): Intl.NumberFormat {
  let f = numberFormats.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(lang);
    numberFormats.set(lang, f);
  }
  return f;
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** Substitute `{name}` placeholders; numbers go through the locale's formatter. */
export function formatTemplate(lang: string, key: string, template: string, params: TParams): string {
  return template.replace(PLACEHOLDER, (_m, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`i18n: '${key}' needs a '{${name}}' param and none was passed`);
    }
    return typeof value === 'number' ? numbersFor(lang).format(value) : value;
  });
}

/** One UI string through the active locale. */
export function t(key: string, params: TParams = {}): string {
  const lang = activeLocale();
  const table = tables.get(lang);
  const raw = table?.[key];
  if (raw === undefined) {
    if (lang !== DEFAULT_LOCALE && !(key in UI_EN)) {
      throw new Error(`i18n: unknown UI key '${key}' (not in locales/en/ui.json either)`);
    }
    throw new Error(
      lang === DEFAULT_LOCALE
        ? `i18n: unknown UI key '${key}' — add it to locales/en/ui.json`
        : `i18n: locale '${lang}' has no UI entry for '${key}' — translate it in locales/${lang}/ui.json`,
    );
  }
  let entry: UiEntry = entryTextOf<UiEntry>(raw);
  let prefix = '';
  const english = UI_EN[key];
  if (lang !== DEFAULT_LOCALE && english !== undefined && currencyOf(raw, english) === 'fuzzy') {
    recordFuzzy(`ui.${key}`);
    entry = english;
    prefix = fuzzyMarker();
  }
  let template: string;
  if (isPluralEntry(entry)) {
    const count = params.count;
    if (typeof count !== 'number') {
      throw new Error(`i18n: '${key}' is a plural entry and needs a numeric 'count' param`);
    }
    template = entry[rulesFor(lang).select(count)] ?? entry.other;
  } else {
    template = entry;
  }
  return prefix + formatTemplate(lang, key, template, params);
}
