// 117.5j: read a build for dev code that should not be in it.
//
//   node scripts/dev-scan.mjs <dir>           a production build (dist/)
//   node scripts/dev-scan.mjs <dir> --diag    a diagnostics build, which
//                                             carries src/dev/diag on purpose
//
// `npm run build` and scripts/itch-zip.mjs run it on what they built, so the
// builds a player gets pass through it. It exits 1 and names each marker it
// found and the file it was in.
//
// Why a scan and not only the import rule (tests/dev-guard.test.ts): the
// rule holds `src/dev` behind DEV-gated dynamic imports, but a DEV branch in
// shipped code (the store's two plants) and anything the rule's reader
// misses are caught only in the build itself.
//
// A MARKER is a string that a dev module's code carries through the
// minifier: a console tag, a storage key, a class name it writes into the
// page, a property name. tests/dev-guard.test.ts holds the list to the
// folder: every entry of `src/dev` has a marker, and every marker is in its
// source. A marker that turns up in a clean build names itself here: pick
// another for that module.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @type {ReadonlyArray<{ source: string, markers: readonly string[], diag?: true }>} */
export const DEV_MARKERS = [
  { source: 'src/dev/devEntry.ts', markers: ['[applyStatus]', '[traces] '] },
  { source: 'src/dev/TraceRecorder.ts', markers: ['onTrace'] },
  { source: 'src/dev/traceStore.ts', markers: ['asciibattler:traces'] },
  { source: 'src/dev/devKeys.ts', markers: ['[dev-keys]'] },
  { source: 'src/dev/replayTrace.ts', markers: ['replayTrace: '] },
  { source: 'src/dev/failPlant.ts', markers: ['planted by ?fail='] },
  { source: 'src/dev/boardPanel', markers: ['board-panel', 'bp-changed'] },
  { source: 'src/dev/probe', markers: ['__probe.', '__probe = '] },
  { source: 'src/dev/diag', markers: ['diag-panel', 'diag-buttons'], diag: true },
  // DEV branches in shipped modules, which the import rule does not cover.
  { source: 'src/store/choose.ts', markers: ['planted by ?'] },
];

const TEXT = /\.(js|mjs|css|html|json|map)$/;

/** Every text file under `dir`, as paths relative to it. */
function textFiles(dir) {
  const out = [];
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (TEXT.test(name)) out.push(path);
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * The markers found in a build: one row per marker and file. `diag` passes
 * the diagnostics panel's own markers, for a build made with it.
 * @param {string} dir
 * @param {{ diag?: boolean }} [opts]
 * @returns {{ file: string, marker: string, source: string }[]}
 */
export function devLeaks(dir, opts = {}) {
  const leaks = [];
  const files = textFiles(dir);
  if (files.length === 0) throw new Error(`dev-scan: no text file under ${dir}: nothing was scanned`);
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    for (const row of DEV_MARKERS) {
      if (row.diag === true && opts.diag === true) continue;
      for (const marker of row.markers) {
        if (text.includes(marker)) leaks.push({ file: relative(dir, path).replaceAll('\\', '/'), marker, source: row.source });
      }
    }
  }
  return leaks;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (dir === undefined) {
    console.error('dev-scan: give the build to read: node scripts/dev-scan.mjs <dir> [--diag]');
    process.exit(1);
  }
  const diag = process.argv.includes('--diag') || process.env.VITE_DIAG === '1';
  const leaks = devLeaks(resolve(dir), { diag });
  if (leaks.length > 0) {
    console.error(`dev-scan: ${dir} carries dev code:`);
    for (const leak of leaks) console.error(`  ${leak.file}: "${leak.marker}" (${leak.source})`);
    process.exit(1);
  }
  console.log(`dev-scan: ${dir} carries no dev marker${diag ? ' (the diagnostics panel passed)' : ''}`);
}
