// §95a — `npm run i18n:extract`: rebuild `locales/en/<family>.json` for every
// registered prose family (src/i18n/families.ts). Run it after authoring or
// editing config prose; the sidecar pins (tests/i18n-en-extract.test.ts)
// fail until the committed extract matches the live catalogs.
//
// Never deletes: a `locales/en/*.json` with no registered family is reported
// as an orphan for a human to remove.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROSE_FAMILIES } from '../src/i18n/families';
import { extractFamily, formatLocaleFile, localeFilePath } from '../src/i18n/extract';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANG = 'en';

let total = 0;
for (const family of PROSE_FAMILIES) {
  const entries = extractFamily(family);
  const path = join(ROOT, localeFilePath(LANG, family.family));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, formatLocaleFile(entries), 'utf8');
  const n = Object.keys(entries).length;
  total += n;
  console.log(`${localeFilePath(LANG, family.family)}: ${n} addresses`);
}

const dir = join(ROOT, 'locales', LANG);
if (existsSync(dir)) {
  const known = new Set(PROSE_FAMILIES.map((f) => `${f.family}.json`));
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.json') && !known.has(file)) console.warn(`⚠ orphan: locales/${LANG}/${file} names no registered family`);
  }
}
console.log(`${PROSE_FAMILIES.length} families · ${total} addresses`);
