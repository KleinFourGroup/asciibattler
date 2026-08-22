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
import { join, resolve } from 'node:path';
import { parseDecisionsCsv, type DecisionRow } from '../reporters';
import { buildPriorTable, renderPriorTable } from './priorTable';

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
  for (const a of argv) {
    if (a.startsWith('--out=')) out = a.slice('--out='.length);
    else if (a.startsWith('--note=')) note = a.slice('--note='.length);
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
  const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const table = buildPriorTable(rows, {
    head,
    builtAt: new Date().toISOString(),
    sources,
    ...(note !== undefined ? { note } : {}),
  });
  writeFileSync(out, JSON.stringify(table, null, 2) + '\n');
  process.stdout.write(renderPriorTable(table));
  process.stdout.write(`Wrote ${out} (${rows.length} rows read, ${longRows} long-horizon)\n`);
}

main();
