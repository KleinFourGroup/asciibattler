#!/usr/bin/env node
// The transcript friction scan — AGENTS "Session self-report + the friction
// log" (the efficacy half's tighter proxy; promoted from a scratch probe at
// the Round 7 close, 2026-09-20). Reads the harness's retained session
// transcripts (`~/.claude/projects/<repo-slug>/*.jsonl`) and prints, per
// main-chain session: the user's turns · tool calls · FLAGGED tool errors
// (split: denied / other, with the top erroring tools) · the harness's
// "the user hasn't heard from you" nudges · output tokens ·
// the wall span. COUNTS ONLY — no conversation text is printed or stored;
// the one string it echoes is the HARNESS'S OWN reminder wording (below).
//
//   npm run friction-scan                        # every session
//   npm run friction-scan -- --since=2026-09-09  # records on/after a date
//   npm run friction-scan -- --exclude=6f87e4d0  # skip a session (yourself)
//   npm run friction-scan -- --csv
//   npm run friction-scan -- --dir=<path>        # another transcript dir
//
// ⚠ HOW TO READ IT (each line is a lesson from the first run):
//  · `err` IS A FLOOR. It counts tool results the harness flagged
//    `is_error`. The friction the papercut log describes is mostly reads
//    that SUCCEEDED and lied (a zero-stylesheet probe, a parked transition,
//    a colourised count through grep) — invisible here by construction.
//  · `--since` filters RECORDS by their own timestamp, not files by mtime
//    (mtimes were bulk-touched once) and not sessions by their first record
//    (the Round 7 kickoff session began the day before, inside the previous
//    round's close — a session-level filter dropped it).
//  · Output tokens are summed ONCE PER MESSAGE ID. Usage repeats on every
//    streamed record of a message; a naive sum read 2–8× high.
//  · A nudge is an attachment of type `silent_turn_reminder` — never a
//    text match, which also counts every tool result that QUOTES the phrase
//    (a read of retro/sessions.md, for one).
//  · THE NUDGE-TEXT TALLY is the check on the reworded reminder (2026-09-20:
//    `CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT` in the gitignored
//    `.claude/settings.local.json` — an UNDOCUMENTED variable, found by a
//    string search of claude.exe 2.1.275). Run it weekly or at a round
//    close, whichever is sooner (the HANDOFF cursor carries the due date):
//    if the newest sessions show the default wording, the override stopped
//    landing — a harness update renamed it, or the app dropped the env.
//  · COMPACTIONS ARE NOT COUNTED. No retained transcript contained one at
//    the first run, so the record's shape is unknown and a column reading 0
//    everywhere could not be told from a column that matches nothing (the
//    first draft carried exactly that column). Add it when a transcript with a
//    known compaction exists to check the reader against.
//  · `span_h` is first→last record: an UPPER BOUND on work time, same
//    disclaimer as phase-stats. Subagent sidechains are excluded throughout.
//  · Self-check before trusting a new column: the session count should
//    equal the round's Claude entries in retro/sessions.md, and `human`
//    should equal a transcript's enqueue count.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const csv = args.includes('--csv');
const since = opt('since') ?? '';
const exclude = opt('exclude') ?? '';
const slug = process.cwd().replace(/[^A-Za-z0-9]/g, '-');
const dir = opt('dir') ?? path.join(os.homedir(), '.claude', 'projects', slug);

if (!fs.existsSync(dir)) {
  console.error(`friction-scan: no transcript directory at ${dir} (pass --dir=<path>).`);
  process.exit(1);
}

const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c) => (typeof c === 'string' ? c : (c.text ?? ''))).join('\n');
};
const DENIED_RE = /denied|doesn't want to proceed|permission|rejected/i;

const rows = [];
const nudgeTexts = new Map(); // wording → { n, last }
let unparsable = 0;
for (const file of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
  if (exclude && file.startsWith(exclude)) continue;
  const row = { id: file.slice(0, 8), first: null, last: null, human: 0, tools: 0, errs: 0, denied: 0, nudges: 0, errTools: {} };
  const toolName = new Map();
  const tokens = new Map();
  for (const line of fs.readFileSync(path.join(dir, file), 'utf8').split('\n')) {
    if (line === '') continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      unparsable++;
      continue;
    }
    if (rec.isSidechain) continue;
    if (rec.timestamp) {
      if (rec.timestamp.slice(0, 10) < since) continue;
      row.first ??= rec.timestamp;
      row.last = rec.timestamp;
    }
    if (rec.type === 'assistant') {
      tokens.set(rec.message?.id, rec.message?.usage?.output_tokens ?? 0);
      for (const c of rec.message?.content ?? []) {
        if (c.type !== 'tool_use') continue;
        row.tools++;
        toolName.set(c.id, c.name);
      }
    } else if (rec.type === 'user') {
      const content = rec.message?.content;
      const results = Array.isArray(content) ? content.filter((c) => c.type === 'tool_result') : [];
      if (results.length === 0 && rec.origin?.kind === 'human') row.human++;
      for (const result of results) {
        if (!result.is_error) continue;
        if (DENIED_RE.test(textOf(result.content))) {
          row.denied++;
          continue;
        }
        row.errs++;
        const name = (toolName.get(result.tool_use_id) ?? '?').replace(/^mcp__.*__/, '');
        row.errTools[name] = (row.errTools[name] ?? 0) + 1;
      }
    } else if (rec.type === 'attachment') {
      if (rec.attachment?.type !== 'silent_turn_reminder') continue;
      row.nudges++;
      const wording = String(rec.attachment.text ?? '(no text field)').replace(/\s+/g, ' ').trim();
      const seen = nudgeTexts.get(wording) ?? { n: 0, last: '' };
      seen.n++;
      if ((rec.timestamp ?? '') > seen.last) seen.last = rec.timestamp ?? '';
      nudgeTexts.set(wording, seen);
    }
  }
  if (row.first === null) continue;
  row.outTok = [...tokens.values()].reduce((a, b) => a + b, 0);
  row.hours = (new Date(row.last) - new Date(row.first)) / 36e5;
  rows.push(row);
}
rows.sort((a, b) => a.first.localeCompare(b.first));

const COLS = ['human', 'tools', 'errs', 'denied', 'nudges', 'outTok'];
const topErrors = (row) =>
  Object.entries(row.errTools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => `${name}:${n}`)
    .join(' ');

if (csv) {
  console.log(['session', 'start', 'span_h', ...COLS, 'top_error_tools'].join(','));
  for (const r of rows) console.log([r.id, r.first, r.hours.toFixed(1), ...COLS.map((k) => r[k]), topErrors(r)].join(','));
} else {
  console.log(`# transcript friction scan — ${rows.length} sessions${since ? ` with records since ${since}` : ''} (${dir})`);
  console.log('# err is a FLOOR (flagged results only) · span_h is an UPPER BOUND on work time — see the script header');
  console.log(['session ', 'start           ', 'span_h', ...COLS.map((c) => c.padStart(8)), ' top error tools'].join('  '));
  for (const r of rows) {
    console.log([r.id, r.first.slice(0, 16), r.hours.toFixed(1).padStart(6), ...COLS.map((k) => String(r[k]).padStart(8)), ' ' + topErrors(r)].join('  '));
  }
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const rate = sum('tools') > 0 ? ((100 * sum('errs')) / sum('tools')).toFixed(1) : '0.0';
  console.log(`# nudge wordings seen (${nudgeTexts.size}) — newest last:`);
  for (const [wording, seen] of [...nudgeTexts].sort((a, b) => a[1].last.localeCompare(b[1].last))) {
    console.log(`#   ${String(seen.n).padStart(4)}×  last ${seen.last.slice(0, 10)}  "${wording.slice(0, 110)}${wording.length > 110 ? '…' : ''}"`);
  }
  console.log(
    `TOTAL  human ${sum('human')} · tools ${sum('tools')} · err ${sum('errs')} (${rate}% of calls) · denied ${sum('denied')} · nudges ${sum('nudges')} · outTok ${sum('outTok')} · unparsable lines ${unparsable}`,
  );
}
