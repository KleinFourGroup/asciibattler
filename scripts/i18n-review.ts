// §95e — `npm run i18n:review`: the ONLY writer of provenance stamps
// (src/i18n/provenance.ts) in a non-en locale's files — the gettext
// fuzzy-flag discipline as two roles over `locales/<lang>/<family>.json`
// (the ten prose families + `ui`):
//
//   --role=translator  Every UNSTAMPED or FUZZY entry in scope gets
//                      `source` = the hash of the CURRENT English, plus the
//                      translator stamp; any reviewer is dropped (a
//                      re-translation needs a fresh sign-off). An entry whose
//                      text still EQUALS its English is skipped and listed —
//                      a scaffold nobody translated (name it with --address
//                      to stamp it anyway: a proper noun that is the same in
//                      both languages). Addresses the file lacks are
//                      SCAFFOLDED as the plain English, unstamped, for the
//                      translator to work on; a file that does not exist is
//                      created that way. Orphans are listed, never deleted.
//   --role=reviewer    (the default) Every CURRENT entry in scope gets the
//                      reviewer stamp. Anything not current (missing /
//                      unstamped / fuzzy) is listed and the exit code is 1 —
//                      a reviewer cannot sign off a translation of an English
//                      that has since moved.
//
//   --lang=<lang>        required; `en` refused (English authorship is git's)
//   --who=<name>         required; the name the credits show
//   --on=<YYYY-MM-DD>    default today (UTC)
//   --family=<a,b,ui>    default every family + ui
//   --address=<addr>     repeatable; narrows to named entries (an unknown
//                        address is an error) and, for the translator, forces
//                        the stamp on an entry that equals its English
//   --dry                report, write nothing
//
// Ends by printing the locale's credits (creditsOf over its files on disk).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROSE_FAMILIES } from '../src/i18n/families';
import { extractFamily, formatLocaleFile, localeFilePath } from '../src/i18n/extract';
import { UI_EN } from '../src/i18n/ui';
import {
  auditLocale,
  canonicalSource,
  creditsOf,
  currencyOf,
  entryTextOf,
  reviewerStamp,
  translatorStamp,
  validateStamp,
  type ProvenanceEntry,
  type Stamp,
} from '../src/i18n/provenance';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_FAMILY = 'ui';

interface Args {
  lang: string;
  who: string;
  role: 'translator' | 'reviewer';
  on: string;
  families: string[] | null;
  addresses: string[];
  dry: boolean;
}

function fail(message: string): never {
  console.error(`i18n:review — ${message}`);
  process.exit(2);
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { lang: '', who: '', role: 'reviewer', on: new Date().toISOString().slice(0, 10), families: null, addresses: [], dry: false };
  for (const raw of argv) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(raw);
    if (!m) fail(`unrecognised argument '${raw}'`);
    const [, key, value = ''] = m;
    switch (key) {
      case 'lang': args.lang = value; break;
      case 'who': args.who = value; break;
      case 'on': args.on = value; break;
      case 'role':
        if (value !== 'translator' && value !== 'reviewer') fail(`--role is translator or reviewer, got '${value}'`);
        args.role = value;
        break;
      case 'family': args.families = value.split(',').map((s) => s.trim()).filter((s) => s.length > 0); break;
      case 'address': args.addresses.push(value); break;
      case 'dry': args.dry = true; break;
      default: fail(`unknown flag --${key}`);
    }
  }
  if (args.lang === '') fail('--lang=<lang> is required');
  if (args.lang === 'en') fail('`en` carries no provenance — English authorship is git\'s');
  if (args.who === '') fail('--who=<name> is required');
  return args;
}

const args = parseArgs(process.argv.slice(2));
const stamp: Stamp = { who: args.who, on: args.on };
validateStamp(stamp, `--who / --on`);

interface Scope {
  readonly family: string;
  readonly english: Readonly<Record<string, unknown>>;
}
const scopes: Scope[] = [
  ...PROSE_FAMILIES.map((f) => ({ family: f.family, english: extractFamily(f) as Readonly<Record<string, unknown>> })),
  { family: UI_FAMILY, english: UI_EN },
];
if (args.families) {
  for (const name of args.families) if (!scopes.some((s) => s.family === name)) fail(`unknown family '${name}' (families: ${scopes.map((s) => s.family).join(', ')})`);
}
const selected = args.families ? scopes.filter((s) => args.families!.includes(s.family)) : scopes;

type Entry = unknown;
type File = Record<string, Entry>;

// Read every file in scope first: an explicit address must name a real entry
// (English or on disk) BEFORE anything is written.
const onDisk = new Map<string, File | null>();
const knownAddresses = new Set<string>();
for (const scope of selected) {
  const path = join(ROOT, localeFilePath(args.lang, scope.family));
  const file = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as File) : null;
  onDisk.set(scope.family, file);
  for (const a of Object.keys(scope.english)) knownAddresses.add(a);
  for (const a of Object.keys(file ?? {})) knownAddresses.add(a);
}
const explicit = new Set(args.addresses);
for (const a of explicit) if (!knownAddresses.has(a)) fail(`--address='${a}' names no entry in scope`);
const inScope = (address: string): boolean => explicit.size === 0 || explicit.has(address);

let totalStamped = 0;
let totalScaffolded = 0;
const blocked: string[] = [];

for (const scope of selected) {
  const path = join(ROOT, localeFilePath(args.lang, scope.family));
  const rel = localeFilePath(args.lang, scope.family);
  const read = onDisk.get(scope.family) ?? null;
  const exists = read !== null;
  if (!exists && args.role === 'reviewer') {
    blocked.push(`${rel}: no file`);
    continue;
  }
  const file: File = read ?? {};

  const audit = auditLocale(scope.english, file);
  const next: File = {};
  let stamped = 0;
  let scaffolded = 0;
  const stillEnglish: string[] = [];

  for (const [address, english] of Object.entries(scope.english)) {
    const current = file[address];
    if (!(address in file)) {
      if (args.role === 'translator' && inScope(address)) {
        next[address] = english; // the scaffold — plain, UNSTAMPED
        scaffolded++;
      } else if (inScope(address)) {
        blocked.push(`${rel}: ${address} (missing)`);
      }
      continue;
    }
    if (!inScope(address)) {
      next[address] = current;
      continue;
    }
    const currency = currencyOf(current, english);
    if (args.role === 'translator') {
      const forced = explicit.has(address);
      if (currency === 'current' && !forced) {
        next[address] = current;
        continue;
      }
      const text = entryTextOf(current);
      if (!forced && canonicalSource(text) === canonicalSource(english)) {
        stillEnglish.push(address);
        next[address] = current;
        continue;
      }
      next[address] = translatorStamp(text, english, stamp);
      stamped++;
    } else {
      if (currency !== 'current') {
        blocked.push(`${rel}: ${address} (${currency})`);
        next[address] = current;
        continue;
      }
      next[address] = reviewerStamp(current as ProvenanceEntry, stamp);
      stamped++;
    }
  }
  for (const address of audit.orphan) next[address] = file[address]; // kept, never deleted

  totalStamped += stamped;
  totalScaffolded += scaffolded;
  const notes: string[] = [];
  if (stamped > 0) notes.push(`${stamped} stamped`);
  if (scaffolded > 0) notes.push(`${scaffolded} scaffolded (plain English, unstamped — translate, then re-run)`);
  if (stillEnglish.length > 0) notes.push(`${stillEnglish.length} still equal to the English, skipped: ${stillEnglish.join(', ')} (name one with --address to stamp it)`);
  if (audit.orphan.length > 0) notes.push(`⚠ ${audit.orphan.length} orphan (no live address; delete by hand): ${audit.orphan.join(', ')}`);
  console.log(`${rel}: ${notes.length > 0 ? notes.join(' · ') : 'nothing to do'}`);

  if (!args.dry && (stamped > 0 || scaffolded > 0 || !exists)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, formatLocaleFile(next), 'utf8');
  }
}

if (blocked.length > 0) {
  console.error(`\n${blocked.length} not ${args.role === 'reviewer' ? 'signable' : 'stampable'} (${args.role === 'reviewer' ? 'only a CURRENT entry can be reviewed' : 'see above'}):`);
  for (const b of blocked) console.error(`  ${b}`);
}

const files: (readonly [string, Readonly<Record<string, unknown>>])[] = [];
for (const scope of scopes) {
  const path = join(ROOT, localeFilePath(args.lang, scope.family));
  if (existsSync(path)) files.push([args.lang, JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>]);
}
for (const credit of creditsOf(files)) {
  console.log(`\ncredits '${credit.lang}': translators ${credit.translators.join(', ') || '—'} · reviewers ${credit.reviewers.join(', ') || '—'}`);
}
console.log(`${args.dry ? '[dry] ' : ''}${args.role} '${args.who}' on ${args.on}: ${totalStamped} stamped · ${totalScaffolded} scaffolded · ${blocked.length} blocked`);

process.exit(blocked.length > 0 ? 1 : 0);
