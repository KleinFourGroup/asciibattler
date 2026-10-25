#!/usr/bin/env node
// The friction log — AGENTS "Session self-report + the friction log"
// (user-signed 2026-09-09). Appends ONE JSON line to retro/papercuts.jsonl.
//
//   npm run papercut -- --who=claude --phase=95a --file=scratch/note.txt
//   npm run papercut -- --who=claude --phase=95a --stdin <<'EOF'
//   the text, quotes and backticks as they are
//   EOF
//   npm run papercut -- --who=matthew --kind=distress "…"
//
// Flags: --who=<filer> (required) · --kind=papercut|distress (default
// papercut) · --phase=<tag> (e.g. 95a) · --session=<id> (defaults to the
// first 8 characters of $CLAUDE_CODE_SESSION_ID, which the desktop app
// sets, then $CLAUDE_SESSION_ID) · --file=<path> or --stdin for the text,
// which then needs no shell quoting; otherwise the other words are the
// text. Stdin is read only with --stdin, since a command reading a stdin
// that never closes waits out the Bash tool's timeout. A text with
// backslashes goes in a file written with the Write tool: the Bash tool
// halves them, heredocs included.
// File in the MOMENT — one line, no ceremony. The separation between the
// two kinds is at READ time (the round sweep), not here.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KINDS = new Set(['papercut', 'distress']);
const USAGE =
  'usage: npm run papercut -- --who=<filer> [--kind=papercut|distress] [--phase=<tag>] [--session=<id>] (--file=<path> | --stdin | "<text>")';

/**
 * The entry a filing makes, from its arguments, the environment, the text a
 * --file or --stdin supplied, and the time; or the error that refuses it.
 */
export function entryFrom({ argv, env, text: supplied, now }) {
  const flags = {};
  const words = [];
  for (const arg of argv) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (m) flags[m[1]] = m[2] ?? true;
    else words.push(arg);
  }

  if (supplied !== undefined && words.length > 0) {
    return { error: 'give the text once: as words, or by --file or --stdin' };
  }
  const text = (supplied ?? words.join(' ')).replace(/\s+/g, ' ').trim();
  const who = typeof flags.who === 'string' ? flags.who.trim() : '';
  const kind = flags.kind ?? 'papercut';
  if (who === '' || text === '') return { error: USAGE };
  if (!KINDS.has(kind)) return { error: `--kind must be one of ${[...KINDS].join(' | ')} (got "${kind}")` };

  const session =
    (typeof flags.session === 'string' && flags.session) ||
    env.CLAUDE_CODE_SESSION_ID?.slice(0, 8) ||
    env.CLAUDE_SESSION_ID ||
    undefined;
  const phase = typeof flags.phase === 'string' && flags.phase !== '' ? flags.phase : undefined;
  const entry = {
    ts: now.toISOString(),
    who,
    kind,
    ...(session ? { session } : {}),
    ...(phase ? { phase } : {}),
    text,
  };

  // Attribution guard (the 2026-09-13 early read: five of the round's first
  // seven entries had no session). The entry still lands; the warning is for
  // the filer.
  const warnings = [];
  if (!session) {
    warnings.push('papercut: no session id from --session or the environment — pass --session=<id> (8 characters suffice) so the round sweep can attribute the entry');
  }
  if (!phase) {
    warnings.push('papercut: no --phase — pass --phase=<tag> (e.g. 96a) so the round sweep can group by phase');
  }
  return { entry, warnings };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => a.startsWith('--file='))?.slice('--file='.length);
  const text = file !== undefined ? readFileSync(file, 'utf8') : argv.includes('--stdin') ? readFileSync(0, 'utf8') : undefined;
  const { entry, warnings, error } = entryFrom({ argv, env: process.env, text, now: new Date() });
  if (error !== undefined) {
    console.error(error);
    process.exit(2);
  }
  for (const w of warnings) console.warn(w);

  const log = join(dirname(fileURLToPath(import.meta.url)), '..', 'retro', 'papercuts.jsonl');
  mkdirSync(dirname(log), { recursive: true });
  appendFileSync(log, JSON.stringify(entry) + '\n', 'utf8');
  console.log(`${entry.kind} filed by ${entry.who} → retro/papercuts.jsonl`);
}
