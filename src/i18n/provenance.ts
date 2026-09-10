/**
 * §95e — PROVENANCE per translated entry (Round 7 spec §5): the authorship
 * chain a volunteer locale carries, and the FUZZY discipline built on it.
 *
 * A non-en locale entry may be a plain string (UNSTAMPED — nothing proves
 * which English it was translated from) or the provenance object:
 *
 *   { "text": "…", "source": "<fnv1a of the English at translation time>",
 *     "translator": { "who": "…", "on": "YYYY-MM-DD" },
 *     "reviewer":   { "who": "…", "on": "YYYY-MM-DD" } }
 *
 * `source` is the whole mechanism: when the English moves under a translation
 * the stored hash no longer matches and the entry is FUZZY (the gettext flag,
 * rebuilt on the pin the sidecar already needed). The runtime falls back to
 * English for a fuzzy entry (locale.ts / ui.ts — with a dev-mode marker), the
 * pin fails a shipped locale that has one (tests/i18n-en-extract.test.ts,
 * tests/i18n-ui-keys.test.ts), and `npm run i18n:review` is the only writer
 * of the stamps (scripts/i18n-review.ts): the translator role stamps `source`
 * + `translator` on the entries that were unstamped or fuzzy (dropping any
 * reviewer — a re-translation needs a fresh sign-off), the reviewer role
 * stamps `reviewer` on CURRENT entries only. English carries no provenance:
 * its authorship is git's. The credits (creditsOf) read the stamps for the
 * Round 8 credits screen — the volunteer path.
 *
 * The `text` of a UI table entry may itself be a plural object (ui.ts), so
 * the hash canonicalizes an object source with sorted keys; a string hashes
 * as itself. `fnv1a` is PERMANENT (src/core/fnv1a.ts) — a hash change would
 * fuzzy every shipped locale.
 */

import { fnv1a } from '../core/fnv1a';

export interface Stamp {
  readonly who: string;
  /** An ISO date, `YYYY-MM-DD`. */
  readonly on: string;
}

export interface ProvenanceEntry<T = unknown> {
  readonly text: T;
  readonly source?: string;
  readonly translator?: Stamp;
  readonly reviewer?: Stamp;
}

export const STAMP_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateStamp(stamp: Stamp, context: string): void {
  if (typeof stamp.who !== 'string' || stamp.who.trim().length === 0) {
    throw new Error(`i18n: ${context} — a stamp needs a non-empty 'who'`);
  }
  if (typeof stamp.on !== 'string' || !STAMP_DATE.test(stamp.on)) {
    throw new Error(`i18n: ${context} — a stamp's 'on' is an ISO date (YYYY-MM-DD), got '${String(stamp.on)}'`);
  }
}

/** The object shape — keyed by `text`. A UI plural entry (`{ one, other }`) has no `text` and is NOT one. */
export function isProvenanceEntry(entry: unknown): entry is ProvenanceEntry {
  return typeof entry === 'object' && entry !== null && !Array.isArray(entry) && 'text' in entry;
}

/** The value a locale entry carries, provenance unwrapped. */
export function entryTextOf<T>(entry: T | ProvenanceEntry<T>): T {
  return isProvenanceEntry(entry) ? (entry as ProvenanceEntry<T>).text : (entry as T);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/** A string is its own canonical form; an object (a plural entry) serializes with sorted keys. */
export function canonicalSource(english: unknown): string {
  return typeof english === 'string' ? english : JSON.stringify(sortKeys(english));
}

/** The `source` hash of an English value — what a translator stamp stores and the fuzzy check recomputes. */
export function sourceHash(english: unknown): string {
  return fnv1a(canonicalSource(english));
}

export type Currency = 'current' | 'unstamped' | 'fuzzy';

/** Where an entry stands against the English it should have been translated from. */
export function currencyOf(entry: unknown, english: unknown): Currency {
  if (!isProvenanceEntry(entry) || entry.source === undefined) return 'unstamped';
  return entry.source === sourceHash(english) ? 'current' : 'fuzzy';
}

export interface LocaleAudit {
  /** English addresses the locale file lacks. */
  readonly missing: readonly string[];
  /** File addresses no longer in the English. */
  readonly orphan: readonly string[];
  /** Entries with no `source` (a plain string, or an object never stamped). */
  readonly unstamped: readonly string[];
  /** Entries whose `source` no longer matches the current English. */
  readonly fuzzy: readonly string[];
}

/** The four checks the pins run over one locale file against its English (all four empty = shippable). */
export function auditLocale(english: Readonly<Record<string, unknown>>, file: Readonly<Record<string, unknown>>): LocaleAudit {
  const missing: string[] = [];
  const unstamped: string[] = [];
  const fuzzy: string[] = [];
  for (const [address, source] of Object.entries(english)) {
    if (!(address in file)) {
      missing.push(address);
      continue;
    }
    const currency = currencyOf(file[address], source);
    if (currency === 'unstamped') unstamped.push(address);
    else if (currency === 'fuzzy') fuzzy.push(address);
  }
  const orphan = Object.keys(file).filter((address) => !(address in english));
  return { missing, orphan, unstamped, fuzzy };
}

export function isAuditClean(audit: LocaleAudit): boolean {
  return audit.missing.length === 0 && audit.orphan.length === 0 && audit.unstamped.length === 0 && audit.fuzzy.length === 0;
}

/** The translator's stamp: text + the CURRENT English's hash + who/when. Any reviewer is dropped — a re-translation needs a fresh sign-off. */
export function translatorStamp<T>(text: T, english: unknown, stamp: Stamp): ProvenanceEntry<T> {
  validateStamp(stamp, 'translator');
  return { text, source: sourceHash(english), translator: stamp };
}

/** The reviewer's stamp on a CURRENT entry (the caller checks currency — a fuzzy entry cannot be signed off). */
export function reviewerStamp<T>(entry: ProvenanceEntry<T>, stamp: Stamp): ProvenanceEntry<T> {
  validateStamp(stamp, 'reviewer');
  return { ...entry, reviewer: stamp };
}

export interface LocaleCredit {
  readonly lang: string;
  readonly translators: readonly string[];
  readonly reviewers: readonly string[];
}

/** Every name in the stamps of the given locale files, per language, de-duplicated and sorted. */
export function creditsOf(files: Iterable<readonly [lang: string, file: Readonly<Record<string, unknown>>]>): LocaleCredit[] {
  const byLang = new Map<string, { translators: Set<string>; reviewers: Set<string> }>();
  for (const [lang, file] of files) {
    let names = byLang.get(lang);
    if (!names) {
      names = { translators: new Set(), reviewers: new Set() };
      byLang.set(lang, names);
    }
    for (const entry of Object.values(file)) {
      if (!isProvenanceEntry(entry)) continue;
      if (entry.translator) names.translators.add(entry.translator.who);
      if (entry.reviewer) names.reviewers.add(entry.reviewer.who);
    }
  }
  return [...byLang.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([lang, names]) => ({
      lang,
      translators: [...names.translators].sort(),
      reviewers: [...names.reviewers].sort(),
    }));
}
