#!/usr/bin/env node
// The phase-stats instrument — AGENTS "Session self-report + the friction
// log" (user-signed 2026-09-09). Groups `git log` by the commit-subject
// phase tag and prints, per phase: commits · first→last wall time · the
// fix ratio (commits whose subject reads as a repair of the same phase).
//
//   npm run phase-stats                 # every tagged commit
//   npm run phase-stats -- --since=94   # phases ≥ 94 (numeric tags only)
//   npm run phase-stats -- --csv        # machine-readable
//
// ⚠ WALL TIME IS AN UPPER BOUND ON WORK TIME. The span from a phase's first
// commit to its last includes the user's multitasking, overnight box
// drivers, and every pause between commits; no screen tracking is wanted,
// so this number is reported with that disclaimer and never as effort. The
// session transcripts are the tighter proxy (a TODO for the close read).
//
// The tag grammar this parses, from the commit-subject convention:
//   type(TAG): subject      where TAG is  94g-3 · 94h-pre · 95a · 73-pre ·
//   H4a · GP3.2 · r6 · 88e …   The PHASE is the leading run of
//   digits-or-uppercase-letters (94 · 73 · H4 · GP3); the rest is the step.
//   Untagged commits are counted in a final "(untagged)" row.

import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const csv = args.includes('--csv');
const sinceArg = args.find((a) => a.startsWith('--since='));
const since = sinceArg ? Number(sinceArg.slice('--since='.length)) : null;

const raw = execFileSync('git', ['log', '--reverse', '--format=%H%x1f%at%x1f%s'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const TAG_RE = /^[a-z]+(?:\(([^)]*)\))?[!]?:\s/;
const PHASE_RE = /^([A-Z]*\d+|[A-Z]+\d*)/;
const FIX_RE = /\b(fix|hotfix|repair|revert|regress|correct|typo|oops|follow-?up|band-?aid|patch)\b/i;

const phases = new Map();
for (const line of raw.split('\n')) {
  if (!line) continue;
  const [hash, at, subject] = line.split('\x1f');
  const t = Number(at) * 1000;
  const tagMatch = TAG_RE.exec(subject);
  const tag = tagMatch?.[1]?.trim() ?? '';
  const phase = tag ? (PHASE_RE.exec(tag)?.[1] ?? tag) : '(untagged)';
  let row = phases.get(phase);
  if (!row) {
    row = { phase, commits: 0, fixes: 0, first: t, last: t, steps: new Set() };
    phases.set(phase, row);
  }
  row.commits++;
  if (FIX_RE.test(subject)) row.fixes++;
  row.first = Math.min(row.first, t);
  row.last = Math.max(row.last, t);
  if (tag) row.steps.add(tag);
  void hash;
}

const numeric = (p) => (/^\d+$/.test(p) ? Number(p) : null);
let rows = [...phases.values()];
if (since !== null) rows = rows.filter((r) => numeric(r.phase) !== null && numeric(r.phase) >= since);
rows.sort((a, b) => a.first - b.first);

const hours = (r) => (r.last - r.first) / 3_600_000;
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

if (csv) {
  console.log('phase,commits,steps,fix_ratio,first,last,wall_hours_upper_bound');
  for (const r of rows) {
    console.log([r.phase, r.commits, r.steps.size, (r.fixes / r.commits).toFixed(2), day(r.first), day(r.last), hours(r).toFixed(1)].join(','));
  }
  process.exit(0);
}

console.log('phase-stats — per-phase commit shape off `git log` (see the header for what wall time does NOT mean)');
console.log('⚠ wall_h is an UPPER BOUND on work time (multitasking, overnight drivers, pauses included)\n');
const header = ['phase', 'commits', 'steps', 'fix%', 'first', 'last', 'wall_h'];
const table = rows.map((r) => [r.phase, r.commits, r.steps.size, Math.round((100 * r.fixes) / r.commits), day(r.first), day(r.last), hours(r).toFixed(1)]);
const widths = header.map((h, i) => Math.max(h.length, ...table.map((row) => String(row[i]).length)));
const fmt = (row) => row.map((c, i) => String(c).padEnd(widths[i])).join('  ');
console.log(fmt(header));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
for (const row of table) console.log(fmt(row));
const total = rows.reduce((n, r) => n + r.commits, 0);
console.log(`\n${rows.length} phases · ${total} commits`);
