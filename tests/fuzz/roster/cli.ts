/**
 * 87c — `npm run roster:table -- <dir> [<dir>…] [--out=<file>] [--note=…]`
 *
 * Sweeps every `rosters.csv` (the 87a sidecar) under the given directories
 * (fetched box batches, a board dir, a local --out), pools the rows into
 * the per-hop roster table (rosterTable.ts), prints the summary, and
 * writes the table with provenance. Default out:
 * tests/fuzz/board/roster-table.json — the committed artifact
 * `--roster=sampled:*` reads (the signed-sheet pattern).
 *
 * Provenance is MANIFEST-derived (the 86e1 upgrade over prior:table's
 * dir-name parse): each sidecar's nearest-ancestor `manifest.json` names
 * the machine HEAD + dirty flag; unmanifested or dirty sources refuse the
 * build, and a mixed-HEAD source set throws (ONE HEAD per table — pooling
 * rows measured at different HEADs is the 85f hazard, and a table build
 * gets no byte-identity oracle).
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { readBatchManifest } from '../manifest';
import {
  ROSTER_TABLE_PATH,
  buildRosterTable,
  parseRostersCsv,
  renderRosterTable,
  resolveMeasurementHead,
  type RosterCsvRow,
} from './rosterTable';

function findSidecars(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) findSidecars(p, out);
    else if (name === 'rosters.csv') out.push(p);
  }
  return out;
}

/** Nearest-ancestor manifest.json for a sidecar, stopping at `root`. */
function manifestFor(sidecar: string, root: string): { head: string | null; dirty: boolean | null } {
  let dir = dirname(sidecar);
  for (;;) {
    const m = readBatchManifest(dir);
    if (m !== null) return { head: m.head, dirty: m.dirty };
    if (dir === root) return { head: null, dirty: null };
    const parent = dirname(dir);
    if (parent === dir) return { head: null, dirty: null };
    dir = parent;
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const dirs: string[] = [];
  let out = ROSTER_TABLE_PATH;
  let note: string | undefined;
  for (const a of argv) {
    if (a.startsWith('--out=')) out = a.slice('--out='.length);
    else if (a.startsWith('--note=')) note = a.slice('--note='.length);
    else if (a.startsWith('--')) throw new Error(`roster:table: unknown flag ${a}`);
    else dirs.push(a);
  }
  if (dirs.length === 0) {
    throw new Error('roster:table: give at least one batch dir (a dir holding rosters.csv files)');
  }
  const rows: RosterCsvRow[] = [];
  const sources: string[] = [];
  const manifests: { dir: string; head: string | null; dirty: boolean | null }[] = [];
  const repoRoot = resolve('.');
  for (const d of dirs) {
    if (!existsSync(d)) throw new Error(`roster:table: no such dir ${d}`);
    const root = resolve(d);
    const files = findSidecars(root);
    if (files.length === 0) throw new Error(`roster:table: no rosters.csv under ${d}`);
    for (const f of files) {
      const rel = relative(repoRoot, f).replace(/\\/g, '/');
      rows.push(...parseRostersCsv(readFileSync(f, 'utf8'), rel));
      sources.push(rel);
      manifests.push({ dir: relative(repoRoot, dirname(f)).replace(/\\/g, '/'), ...manifestFor(f, root) });
    }
  }
  const measurementHead = resolveMeasurementHead(manifests);
  const buildHead = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const table = buildRosterTable(rows, {
    measurementHead,
    buildHead,
    builtAt: new Date().toISOString(),
    sources,
    ...(note !== undefined ? { note } : {}),
  });
  writeFileSync(out, JSON.stringify(table, null, 2) + '\n');
  process.stdout.write(renderRosterTable(table));
  process.stdout.write(`Wrote ${out} (${rows.length} rows read)\n`);
}

main();
