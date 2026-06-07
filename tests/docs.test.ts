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
// Both are forcing functions: when one trips, do the cleanup it points at — or
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
