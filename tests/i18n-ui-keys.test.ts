/**
 * §95c — THE UI KEY-SCAN PINS, riding `npm test` on the forgetful path.
 * The UI table (`locales/en/ui.json`) is the SOURCE of the English UI
 * strings, and a call site's key is always a string literal — so a static
 * scan of `t('…')` literals across `src/` proves, config-free:
 *   1. every referenced key exists in the English table (a typo or a key
 *      that was renamed under its callers fails here, not at runtime);
 *   2. every table key is referenced somewhere (an orphan entry is a
 *      translator's wasted work — delete it with its last caller);
 *   3. no call site passes a NON-literal key (the scan cannot see it);
 *   4. every non-en `locales/<lang>/ui.json` has exactly the English key set
 *      (missing / orphan for a translation) — and, since 95e, every entry is
 *      STAMPED against the CURRENT English (unstamped / fuzzy fail; the
 *      audit is provenance.ts's `auditLocale`, the same one the config
 *      sidecars run in tests/i18n-en-extract.test.ts).
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_EN, type UiLocaleTable } from '../src/i18n/ui';
import { auditLocale } from '../src/i18n/provenance';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const LITERAL_CALL = /\bt\(\s*(['"])([^'"]+)\1/g;
/** `t(` followed by anything but a quote / whitespace / `)` — a computed key. */
const NON_LITERAL_CALL = /\bt\(\s*(?!['"])[^\s)]/g;

interface Scan {
  readonly referenced: Map<string, string[]>; // key → files
  readonly nonLiteral: string[]; // "file:line"
}

function scanSources(): Scan {
  const referenced = new Map<string, string[]>();
  const nonLiteral: string[] = [];
  for (const file of walk(SRC)) {
    if (file.endsWith(join('i18n', 'ui.ts'))) continue; // the definition site
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    for (const m of text.matchAll(LITERAL_CALL)) {
      const key = m[2]!;
      referenced.set(key, [...(referenced.get(key) ?? []), rel]);
    }
    for (const m of text.matchAll(NON_LITERAL_CALL)) {
      const line = text.slice(0, m.index).split('\n').length;
      nonLiteral.push(`${rel}:${line}`);
    }
  }
  return { referenced, nonLiteral };
}

describe('the UI string table and its call sites agree (key-scan pins)', () => {
  const scan = scanSources();
  const tableKeys = Object.keys(UI_EN);

  it('every t(key) literal in src/ exists in locales/en/ui.json', () => {
    const missing = [...scan.referenced.keys()].filter((k) => !(k in UI_EN));
    expect(missing, `keys called but absent from locales/en/ui.json: ${missing.map((k) => `${k} (${scan.referenced.get(k)!.join(', ')})`).join('; ')}`).toEqual([]);
  });

  it('every locales/en/ui.json key is referenced by some t(key) literal', () => {
    const orphans = tableKeys.filter((k) => !scan.referenced.has(k));
    expect(orphans, `orphan UI keys (no caller — delete them, or call them): ${orphans.join(', ')}`).toEqual([]);
  });

  it('no call site passes a computed key (the scan must be able to see every key)', () => {
    expect(scan.nonLiteral, `t() called with a non-literal key at: ${scan.nonLiteral.join(', ')}`).toEqual([]);
  });

  it('every shipped non-en ui.json has exactly the English key set, every entry stamped against the CURRENT English', () => {
    const dir = join(ROOT, 'locales');
    if (!existsSync(dir)) return;
    const TRANSLATE = 'the translator updates the text, then `npm run i18n:review -- --lang=<lang> --role=translator --who=<name>`';
    for (const lang of readdirSync(dir)) {
      if (lang === 'en' || !statSync(join(dir, lang)).isDirectory()) continue;
      const file = join(dir, lang, 'ui.json');
      expect(existsSync(file), `locales/${lang}/ui.json is missing — copy locales/en/ui.json and translate it`).toBe(true);
      const table = JSON.parse(readFileSync(file, 'utf8')) as UiLocaleTable;
      // One assertion over all four lists, so a failing run shows the whole picture at once.
      expect(
        auditLocale(UI_EN, table),
        `locales/${lang}/ui.json — missing: keys the table lacks · orphan: keys not in the English (delete them) · unstamped: no \`source\` stamp · fuzzy: the English moved after the translation. The fix for missing / unstamped / fuzzy: ${TRANSLATE}`,
      ).toEqual({ missing: [], orphan: [], unstamped: [], fuzzy: [] });
    }
  });
});
