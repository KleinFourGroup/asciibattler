#!/usr/bin/env node
// The phase-stats instrument — AGENTS "Session self-report + the friction
// log" (user-signed 2026-09-09). Groups `git log` by the commit-subject
// phase tag and prints, per phase: commits · how many of them were placed by
// inference · first→last wall time · two fix ratios.
//
//   npm run phase-stats                           # every commit
//   npm run phase-stats -- --since=110 --until=118  # phases 110 to 118, with .5 and .75
//   npm run phase-stats -- --csv                  # machine-readable
//
// ⚠ WALL TIME IS AN UPPER BOUND ON WORK TIME. The span from a phase's first
// commit to its last includes the user's multitasking, overnight box
// drivers, and every pause between commits; no screen tracking is wanted,
// so this number is reported with that disclaimer and never as effort. The
// session transcripts are the tighter proxy (a TODO for the close read).
//
// The tag grammar this parses, from the commit-subject convention:
//   type(TAG): subject      where TAG is  94g-3 · 94h-pre · 95a · 73-pre ·
//   124.5h · 117.75a · H4a · GP3.2 · r6 · 88e …   The PHASE is the leading
//   number (94 · 124.5 · 117.75) or run of uppercase letters and digits
//   (H4 · GP3); the rest is the step. Lettered eras keep their old parse
//   (E3.5 → E3: there the `.5` was a step, not a phase).
// A commit is placed by the first of these that names a phase:
//   1. its TAG (`feat(115e): …`);
//   2. a numeric step at the head of its subject, when the TAG is a word
//      (`feat(save): 115e, the build` → 115);
//   3. the phase in flight: the phase of the commit before it, for a
//      commit that names none (`docs(session report): …`). These are counted
//      in the `inferred` column, so the guesses stay visible.
// Commits before any phase is named are counted in an "(untagged)" row.
//
// The two fix ratios: `fix%` word-matches the subject (fix, revert, typo …),
// which this repo's long subjects inflate; `fixT%` counts commits of type
// `fix`. Quote the second, or both with the difference named.

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const csv = args.includes('--csv');
const numberArg = (name) => {
  const raw = args.find((a) => a.startsWith(`--${name}=`));
  return raw ? Number(raw.slice(name.length + 3)) : null;
};
const since = numberArg('since');
const until = numberArg('until');

const raw = execFileSync('git', ['log', '--reverse', '--format=%H%x1f%at%x1f%s'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const TAG_RE = /^([a-z]+)(?:\(([^)]*)\))?[!]?:\s/;
const PHASE_RE = /^(\d+\.\d+(?!\d)|[A-Z]*\d+|[A-Z]+\d*)/;
// A step at the head of a subject: digits, an optional `.5`, then the step's
// letters (`115e,` · `116c-post -` · `124.5h`).
const SUBJECT_STEP_RE = /^(\d+(?:\.\d+)?)[a-z]+(?![a-z])/;
const FIX_RE = /\b(fix|hotfix|repair|revert|regress|correct|typo|oops|follow-?up|band-?aid|patch)\b/i;

const phases = new Map();
let inFlight = '(untagged)';
for (const line of raw.split('\n')) {
  if (!line) continue;
  const [, at, subject] = line.split('\x1f');
  const t = Number(at) * 1000;
  const tagMatch = TAG_RE.exec(subject);
  const type = tagMatch?.[1] ?? '';
  const tag = tagMatch?.[2]?.trim() ?? '';
  const rest = tagMatch ? subject.slice(tagMatch[0].length) : subject;
  const fromTag = tag ? PHASE_RE.exec(tag)?.[1] : undefined;
  const fromSubject = fromTag ? undefined : SUBJECT_STEP_RE.exec(rest)?.[1];
  const named = fromTag ?? fromSubject;
  const phase = named ?? inFlight;
  if (named) inFlight = named;
  let row = phases.get(phase);
  if (!row) {
    row = { phase, commits: 0, inferred: 0, fixes: 0, fixType: 0, first: t, last: t, steps: new Set() };
    phases.set(phase, row);
  }
  row.commits++;
  if (!named) row.inferred++;
  if (FIX_RE.test(subject)) row.fixes++;
  if (type === 'fix') row.fixType++;
  row.first = Math.min(row.first, t);
  row.last = Math.max(row.last, t);
  if (fromTag) row.steps.add(tag);
  else if (fromSubject) row.steps.add(SUBJECT_STEP_RE.exec(rest)[0]);
}

const numeric = (p) => (/^\d+(\.\d+)?$/.test(p) ? Number(p) : null);
let rows = [...phases.values()];
if (since !== null || until !== null) {
  rows = rows.filter((r) => {
    const n = numeric(r.phase);
    return n !== null && (since === null || n >= since) && (until === null || n <= until);
  });
}
rows.sort((a, b) => a.first - b.first);

const hours = (r) => (r.last - r.first) / 3_600_000;
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const pct = (n, d) => Math.round((100 * n) / d);

if (csv) {
  console.log('phase,commits,inferred,steps,fix_ratio,fix_type_ratio,first,last,wall_hours_upper_bound');
  for (const r of rows) {
    console.log(
      [r.phase, r.commits, r.inferred, r.steps.size, (r.fixes / r.commits).toFixed(2), (r.fixType / r.commits).toFixed(2), day(r.first), day(r.last), hours(r).toFixed(1)].join(','),
    );
  }
  process.exit(0);
}

console.log('phase-stats — per-phase commit shape off `git log` (see the header for what wall time does NOT mean)');
console.log('⚠ wall_h is an UPPER BOUND on work time (multitasking, overnight drivers, pauses included)');
console.log('  inferred: commits that name no phase, placed in the phase in flight · fix%: subject words · fixT%: type fix\n');
const header = ['phase', 'commits', 'inferred', 'steps', 'fix%', 'fixT%', 'first', 'last', 'wall_h'];
const table = rows.map((r) => [r.phase, r.commits, r.inferred, r.steps.size, pct(r.fixes, r.commits), pct(r.fixType, r.commits), day(r.first), day(r.last), hours(r).toFixed(1)]);
const widths = header.map((h, i) => Math.max(h.length, ...table.map((row) => String(row[i]).length)));
const fmt = (row) => row.map((c, i) => String(c).padEnd(widths[i])).join('  ');
console.log(fmt(header));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
for (const row of table) console.log(fmt(row));
const total = rows.reduce((n, r) => n + r.commits, 0);
const inferred = rows.reduce((n, r) => n + r.inferred, 0);
console.log(`\n${rows.length} phases · ${total} commits (${inferred} inferred)`);
