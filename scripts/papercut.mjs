#!/usr/bin/env node
// The friction log — AGENTS "Session self-report + the friction log"
// (user-signed 2026-09-09). Appends ONE JSON line to retro/papercuts.jsonl.
//
//   npm run papercut -- --who=claude "the permission prompt on sed -n"
//   npm run papercut -- --who=matthew --kind=distress "…"
//
// Flags: --who=<filer> (required) · --kind=papercut|distress (default
// papercut) · --session=<id> (optional; defaults to $CLAUDE_SESSION_ID if
// set) · --phase=<tag> (optional, e.g. 95a). Everything else is the text.
// File in the MOMENT — one line, no ceremony. The separation between the
// two kinds is at READ time (the round sweep), not here.

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const LOG = join(here, '..', 'retro', 'papercuts.jsonl');
const KINDS = new Set(['papercut', 'distress']);

const flags = {};
const words = [];
for (const arg of process.argv.slice(2)) {
  const m = /^--([a-z]+)=(.*)$/.exec(arg);
  if (m) flags[m[1]] = m[2];
  else words.push(arg);
}

const text = words.join(' ').trim();
const who = flags.who?.trim();
const kind = flags.kind ?? 'papercut';

const usage = () => {
  console.error('usage: npm run papercut -- --who=<filer> [--kind=papercut|distress] [--session=<id>] [--phase=<tag>] "<text>"');
  process.exit(2);
};
if (!who || !text) usage();
if (!KINDS.has(kind)) {
  console.error(`--kind must be one of ${[...KINDS].join(' | ')} (got "${kind}")`);
  process.exit(2);
}

const entry = {
  ts: new Date().toISOString(),
  who,
  kind,
  ...(flags.session ?? process.env.CLAUDE_SESSION_ID ? { session: flags.session ?? process.env.CLAUDE_SESSION_ID } : {}),
  ...(flags.phase ? { phase: flags.phase } : {}),
  text,
};

mkdirSync(dirname(LOG), { recursive: true });
appendFileSync(LOG, JSON.stringify(entry) + '\n', 'utf8');
console.log(`${kind} filed by ${who} → retro/papercuts.jsonl`);
