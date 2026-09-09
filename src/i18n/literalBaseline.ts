/**
 * §95d — the literal scan over the repo: walk SCAN_ROOTS, run `scanSource`
 * on every non-test `.ts`, and shape the result as the per-file baseline
 * (`tests/i18n-literal-baseline.json`). Shared by the ratchet test and the
 * `npm run i18n:baseline` regenerator so both count the same way.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SCAN_ROOTS, scanSource, type ProseLiteral } from './literalScan';

export const BASELINE_PATH = 'tests/i18n-literal-baseline.json';

/** file (repo-relative, forward slashes) → count of prose literals. */
export type LiteralBaseline = Readonly<Record<string, number>>;

function collectFiles(root: string, out: string[]): void {
  const st = statSync(root);
  if (st.isFile()) {
    out.push(root);
    return;
  }
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    if (statSync(p).isDirectory()) collectFiles(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
}

/** Every prose literal under SCAN_ROOTS, file paths repo-relative. */
export function scanRepo(repoRoot: string): ProseLiteral[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) collectFiles(join(repoRoot, root), files);
  files.sort();
  const out: ProseLiteral[] = [];
  for (const abs of files) {
    const rel = relative(repoRoot, abs).replace(/\\/g, '/');
    out.push(...scanSource(rel, readFileSync(abs, 'utf8')));
  }
  return out;
}

/** The baseline shape: files with ≥1 literal, sorted, counts only. */
export function baselineOf(literals: readonly ProseLiteral[]): LiteralBaseline {
  const counts = new Map<string, number>();
  for (const l of literals) counts.set(l.file, (counts.get(l.file) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function formatBaseline(b: LiteralBaseline): string {
  return `${JSON.stringify(b, null, 2)}\n`;
}
