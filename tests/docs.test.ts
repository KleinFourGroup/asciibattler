import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Structural guards for the docs, so two recurring rot patterns get caught at
// `npm test` time instead of accumulating until a manual audit:
//   1. HANDOFF bloat — the living session doc accreting verbose per-phase
//      detail (it reached 600+ lines before the 2026-06-07 trim).
//   2. Doc-tree drift — the source tree in ARCHITECTURE.md listing files that
//      no longer exist (closes the TODO "catch doc-tree drift" item).
//   3. HANDOFF read-limit bloat — even WITHIN the line caps, packing enormous
//      lines pushes the file past the agent Read-tool token budget (~25k): it
//      hit ~30k tokens / ~69k chars at only 120 lines on 2026-06-16, unreadable
//      in one call while passing both line caps. The line metric is blind to
//      density, so we also cap CHARACTERS (a tokenizer-free proxy for tokens).
//   4. TODO-as-log — completed TODO items accreting forensic essays (the
//      2026-07-06 demotion pass found 400-word ✅ blocks, plus three items
//      still marked OPEN that had shipped weeks earlier).
//   5. The CLAUDE.md auto-load pointer vanishing — Claude Code auto-reads
//      CLAUDE.md, NOT AGENTS.md (a month of stale AGENTS status proved it);
//      lose the @-import and every session silently stops loading the norms.
//   6. ROADMAP-as-log — the pre-protocol failure mode (Phases H→46 all did
//      it): the plan accreting verbose ✅ as-built blocks until it IS the
//      worklog. The 2026-07-06 planning stack moved narrative to WORKLOG.md;
//      legal ROADMAP mutations are one-liners + a pointer, so growth stays
//      bounded. (Landed with the Economy roadmap at the Cluster-3 kickoff,
//      as the note here promised.)
// All are forcing functions: when one trips, do the cleanup it points at — or
// bump the threshold deliberately if the growth is legitimate.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');
const lineCount = (s: string) => s.split(/\r?\n/).length;

describe('docs hygiene', () => {
  // The rule (AGENTS "Keep HANDOFF lean"): only the in-progress phase stays
  // verbose in `Current state`; every completed phase is one terse line + an
  // archive pointer. These caps have generous headroom over the current size
  // (~131 total / ~73 in Current state at the 2026-06-07 trim) — tripping one
  // means completed phases were left verbose.
  const HANDOFF_MAX_LINES = 250;
  const CURRENT_STATE_MAX_LINES = 120;
  // The Read-tool token budget is ~25k. At the density observed on 2026-06-16
  // (~69k chars ≈ 30k tokens → ~2.3 chars/token), 48k chars ≈ 21k tokens —
  // comfortably under the cap, with headroom for growth between cleanups. This
  // guards the failure mode the line caps miss: few but enormous lines.
  const HANDOFF_MAX_CHARS = 48_000;

  it(`HANDOFF.md stays under ${HANDOFF_MAX_LINES} lines`, () => {
    const n = lineCount(read('HANDOFF.md'));
    expect(
      n,
      `HANDOFF.md is ${n} lines. Demote completed-phase "Current state" entries to one line + an archive pointer (AGENTS "Keep HANDOFF lean"), or bump HANDOFF_MAX_LINES deliberately.`,
    ).toBeLessThanOrEqual(HANDOFF_MAX_LINES);
  });

  it(`HANDOFF "## Current state" stays under ${CURRENT_STATE_MAX_LINES} lines`, () => {
    const lines = read('HANDOFF.md').split(/\r?\n/);
    const start = lines.findIndex((l) => /^## Current state\b/.test(l));
    expect(start, 'HANDOFF.md is missing its "## Current state" heading').toBeGreaterThanOrEqual(0);
    const after = lines.slice(start + 1);
    const next = after.findIndex((l) => /^## /.test(l));
    const len = next === -1 ? after.length : next;
    expect(
      len,
      `"## Current state" is ${len} lines. Only the in-progress phase should be verbose — demote completed phases to one line + an archive pointer (AGENTS "Keep HANDOFF lean"), or bump CURRENT_STATE_MAX_LINES deliberately.`,
    ).toBeLessThanOrEqual(CURRENT_STATE_MAX_LINES);
  });

  it(`HANDOFF.md stays under ${HANDOFF_MAX_CHARS} chars (Read-tool token budget)`, () => {
    const n = read('HANDOFF.md').length;
    expect(
      n,
      `HANDOFF.md is ${n} chars (~${Math.round(n / 2.3)} tokens) — past the ~25k-token Read-tool limit, so it can't be read in one call even though it may pass the line caps (dense, oversized lines). Demote completed-phase "Current state" detail to one line + an archive pointer (AGENTS "Keep HANDOFF lean"), or bump HANDOFF_MAX_CHARS deliberately.`,
    ).toBeLessThanOrEqual(HANDOFF_MAX_CHARS);
  });

  // TODO.md is a queue, not a log (the 2026-07-06 completion convention): a
  // completed item is one ✅ line + a pointer — the full diagnosis lives in
  // git history / the run-logs. The cap allows modest wrapping, not essays.
  const TODO_COMPLETED_ITEM_MAX_LINES = 4;

  it(`every completed TODO.md item stays under ${TODO_COMPLETED_ITEM_MAX_LINES} lines`, () => {
    const lines = read('TODO.md').split(/\r?\n/);
    const offenders: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!/^- \[x\]/i.test(lines[i])) continue;
      let end = i + 1;
      while (end < lines.length && !/^- \[|^#/.test(lines[end])) end++;
      let len = end - i;
      while (len > 1 && lines[i + len - 1].trim() === '') len--; // trailing blanks
      if (len > TODO_COMPLETED_ITEM_MAX_LINES) {
        offenders.push(`line ${i + 1} (${len} lines): "${lines[i].slice(0, 60)}…"`);
      }
    }
    expect(
      offenders,
      `Completed TODO items must be one ✅ line + a pointer (≤${TODO_COMPLETED_ITEM_MAX_LINES} lines — git history keeps the diagnosis; TODO.md header has the convention): ${offenders.join('; ')}`,
    ).toEqual([]);
  });

  // The ROADMAP plan-shape budget (rot pattern 6): phase entries carry
  // charter / ordering / risk / decision points / exit criteria / scope
  // guards ONLY; mutations are one-liners + a worklog pointer. Authored size
  // at the Cluster-3 kickoff: 330 lines total, phase sections 30–40 lines.
  // Tripping a cap means as-built prose crept in — move it to WORKLOG.md, or
  // bump deliberately (e.g. an inserted phase grew the plan for real).
  const ROADMAP_MAX_LINES = 450;
  const ROADMAP_PHASE_MAX_LINES = 60;

  it(`ROADMAP.md stays under ${ROADMAP_MAX_LINES} lines (a plan, not a log)`, () => {
    const n = lineCount(read('ROADMAP.md'));
    expect(
      n,
      `ROADMAP.md is ${n} lines. It must stay a PLAN (AGENTS "The planning stack") — move narrative/as-built prose to WORKLOG.md, or bump ROADMAP_MAX_LINES deliberately if the plan legitimately grew.`,
    ).toBeLessThanOrEqual(ROADMAP_MAX_LINES);
  });

  it(`every ROADMAP.md "## Phase" section stays under ${ROADMAP_PHASE_MAX_LINES} lines`, () => {
    const lines = read('ROADMAP.md').split(/\r?\n/);
    const offenders: string[] = [];
    let phases = 0;
    let name = '';
    let count = 0;
    const flush = () => {
      if (name !== '' && count > ROADMAP_PHASE_MAX_LINES) offenders.push(`"${name}" (${count} lines)`);
    };
    for (const l of lines) {
      if (/^## /.test(l)) {
        flush();
        name = /^## Phase \d/.test(l) ? l.slice(3) : '';
        if (name !== '') phases++;
        count = 0;
        continue;
      }
      if (name !== '') count++;
    }
    flush();
    expect(phases, 'parsed no "## Phase N" sections — the heading format or parser drifted').toBeGreaterThan(0);
    expect(
      offenders,
      `Phase sections must stay plan-shaped (charter/ordering/risk/decisions/exit/scope only — narrative goes to WORKLOG.md under the matching "## Phase N"): ${offenders.join('; ')}`,
    ).toEqual([]);
  });

  it('WORKLOG.md exists (the narrative home the plan points at)', () => {
    expect(
      existsSync(join(repoRoot, 'WORKLOG.md')),
      'WORKLOG.md is missing — every round has one (created at kickoff, archived as a pair with its roadmap); without it the ROADMAP caps just push prose into hiding.',
    ).toBe(true);
  });

  // CLAUDE.md is the thin auto-load pointer (rot pattern 5): Claude Code
  // auto-reads CLAUDE.md, not AGENTS.md — if the @-import line disappears,
  // sessions silently stop loading the norms + planning-stack protocols.
  it('CLAUDE.md exists and @-imports AGENTS.md', () => {
    expect(existsSync(join(repoRoot, 'CLAUDE.md')), 'CLAUDE.md is missing').toBe(true);
    expect(
      read('CLAUDE.md'),
      'CLAUDE.md must keep its "@AGENTS.md" import line (the auto-load pointer)',
    ).toMatch(/^@AGENTS\.md\s*$/m);
  });

  // ARCHITECTURE.md "Top-level structure" is the single canonical source tree
  // (HANDOFF + AGENTS point to it). Parse it and assert every listed file path
  // still exists, so a deleted/renamed/moved file surfaces here.
  it("every file path in ARCHITECTURE's tree exists on disk", () => {
    const m = read('ARCHITECTURE.md').match(/## Top-level structure\s*```([\s\S]*?)```/);
    expect(m, 'ARCHITECTURE.md is missing its "## Top-level structure" fenced tree').not.toBeNull();

    const FILE_EXT = /\.(tsx?|js|json|glsl|css|html)$/;
    const stack: string[] = [];
    const files: string[] = [];
    for (const raw of (m as RegExpMatchArray)[1].split(/\r?\n/)) {
      const trimmed = raw.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue; // blank / comment-continuation line
      const depth = Math.floor(((raw.match(/^ */) as RegExpMatchArray)[0].length) / 2);
      const token = trimmed.split(/\s+/)[0];
      if (token.endsWith('/')) {
        stack.length = depth; // drop deeper branches on dedent
        stack[depth] = token.slice(0, -1);
      } else if (FILE_EXT.test(token)) {
        files.push([...stack.slice(0, depth), token].join('/'));
      }
    }

    expect(files.length, 'parsed no file paths — the tree format or parser drifted').toBeGreaterThan(20);
    const missing = files.filter((f) => !existsSync(join(repoRoot, f)));
    expect(
      missing,
      `ARCHITECTURE.md's tree lists path(s) that no longer exist — update the tree: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});
