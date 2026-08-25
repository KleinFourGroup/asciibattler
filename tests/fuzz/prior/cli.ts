/**
 * 84e — `npm run prior:table -- <dir> [<dir>…] [--out=<file>] [--note=…]`
 *
 * Sweeps every `decisions.csv` under the given directories (a fetched box
 * batch, a board dir, a local --out), pools the long-horizon rows into the
 * measured-terminal-prior table (priorTable.ts), prints the summary, and
 * writes the table with provenance. Default out:
 * tests/fuzz/board/prior-table.json — the committed artifact §85 reads (the
 * signed-sheet pattern: a versioned file with its measurement named).
 *
 * Refuses to build from nothing (no long-horizon rows = a wrong-batch
 * mistake, never an empty table), and names the HEAD it ran at — the
 * ONE-HEAD-per-cohort rule makes that the rows' HEAD too.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseDecisionsCsv, type DecisionRow } from '../reporters';
import { buildPriorTable, measurementHeadFromPaths, renderPriorTable } from './priorTable';

const DEFAULT_OUT = 'tests/fuzz/board/prior-table.json';

function findSidecars(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) findSidecars(p, out);
    else if (name === 'decisions.csv') out.push(p);
  }
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const dirs: string[] = [];
  let out = DEFAULT_OUT;
  let note: string | undefined;
  let measurementHeadFlag: string | undefined;
  for (const a of argv) {
    if (a.startsWith('--out=')) out = a.slice('--out='.length);
    else if (a.startsWith('--note=')) note = a.slice('--note='.length);
    else if (a.startsWith('--measurement-head='))
      measurementHeadFlag = a.slice('--measurement-head='.length);
    else if (a.startsWith('--')) throw new Error(`prior:table: unknown flag ${a}`);
    else dirs.push(a);
  }
  if (dirs.length === 0) {
    throw new Error('prior:table: give at least one batch dir (a dir holding decisions.csv files)');
  }
  const rows: DecisionRow[] = [];
  const sources: string[] = [];
  for (const d of dirs) {
    if (!existsSync(d)) throw new Error(`prior:table: no such dir ${d}`);
    const files = findSidecars(resolve(d));
    if (files.length === 0) throw new Error(`prior:table: no decisions.csv under ${d}`);
    for (const f of files) {
      rows.push(...parseDecisionsCsv(readFileSync(f, 'utf8')));
      sources.push(f);
    }
  }
  const longRows = rows.filter((r) => r.horizon !== '').length;
  if (longRows === 0) {
    throw new Error(
      `prior:table: ${rows.length} rows read but NONE at a long horizon — was the batch run with --shadow-horizon?`,
    );
  }
  // 85g2 — machine provenance: the MEASUREMENT head (the rows' HEAD,
  // parsed from the batch-dir naming or given explicitly) is a separate
  // field from the BUILD head (this checkout) — the free-text v1 `head`
  // misled across two rebuilds (the tiger-team catch). A mixed-HEAD
  // source set throws inside measurementHeadFromPaths; no parseable head
  // and no flag = refuse to build (never a mislabeled table).
  const parsedHead = measurementHeadFromPaths(sources);
  if (
    measurementHeadFlag !== undefined &&
    parsedHead !== null &&
    measurementHeadFlag !== parsedHead
  ) {
    throw new Error(
      `prior:table: --measurement-head=${measurementHeadFlag} contradicts the batch-dir head ${parsedHead}`,
    );
  }
  const measurementHead = measurementHeadFlag ?? parsedHead;
  if (measurementHead === null) {
    throw new Error(
      'prior:table: no measurement HEAD — the batch dirs carry no `YYYYMMDD-HHMMSS-<head>` segment; pass --measurement-head=<sha>',
    );
  }
  const buildHead = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const repoRoot = resolve('.');
  const table = buildPriorTable(rows, {
    measurementHead,
    buildHead,
    builtAt: new Date().toISOString(),
    // Repo-root-relative, forward slashes (85g2 — v1 wrote absolute paths).
    sources: sources.map((s) => relative(repoRoot, s).replace(/\\/g, '/')),
    ...(note !== undefined ? { note } : {}),
  });
  writeFileSync(out, JSON.stringify(table, null, 2) + '\n');
  process.stdout.write(renderPriorTable(table));
  process.stdout.write(`Wrote ${out} (${rows.length} rows read, ${longRows} long-horizon)\n`);
}

main();
