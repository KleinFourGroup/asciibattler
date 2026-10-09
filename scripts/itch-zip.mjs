// Build the game and zip it for an itch.io HTML upload, checked:
//
//   node scripts/itch-zip.mjs            the production build
//   node scripts/itch-zip.mjs --diag     the diagnostics build (README)
//   node scripts/itch-zip.mjs --out=<dir>   where (default output/itch, which
//                                           git ignores and the dev server
//                                           doesn't watch)
//   node scripts/itch-zip.mjs --check=<zip> --against=<dir>
//                                        only check a zip against a build
//
// It writes <out>/<name>/ (the build) and <out>/<name>.zip, where <name> is
// `asciibattler-<build id>` with `-diag` for the diagnostics build, and
// prints one JSON line: the zip's path, its entry count, its bytes and the
// build's hash. It exits 1 with the reason when the build or the check fails,
// or when the build carries dev code (scripts/dev-scan.mjs).
// The build is also copied to <out>/current/, a path that doesn't change with
// the ID, for a local look: `npm run preview -- --outDir output/itch/current`
// (the `itch-preview` launch config serves it to the Browser pane on 5193).
//
// THE ZIP IS MADE ONE WAY AND CHECKED ANOTHER. PowerShell 7's
// `Compress-Archive` writes it. Two other tools on this machine write a file
// itch can't use: Windows PowerShell 5.1 writes entry names with backslashes,
// which an unzip on Linux takes as flat file names, and Git Bash's `tar -a`
// writes a TAR archive under the `.zip` name. So the script then reads the
// zip back with .NET's `ZipFile`, and fails unless every entry name is free
// of backslashes, `index.html` is at the root, and the extracted tree hashes
// the same as the build (scripts/dist-hash.mjs).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildId } from './build-id.mjs';
import { devLeaks } from './dev-scan.mjs';
import { distHash } from './dist-hash.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`itch-zip: ${message}`);
  process.exit(1);
}

function flag(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

/** Run one PowerShell 7 command. Paths go in through the environment, so the
 *  command's text holds no quoting of ours. */
function pwsh(command, env) {
  const r = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', command], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (r.error !== undefined) fail(`PowerShell 7 (pwsh) did not start: ${r.error.message}`);
  if (r.status !== 0) fail(`pwsh failed (${r.status}): ${r.stderr.trim() || r.stdout.trim()}`);
  return r.stdout;
}

/** Fail unless `zip` is the build at `dist`, as an unzip on another system
 *  would see it. Returns the zip's file count and the build's hash. */
function check(zip, dist) {
  if (!existsSync(zip)) fail(`no such zip: ${zip}`);
  if (!existsSync(join(dist, 'index.html'))) fail(`no index.html in ${dist}`);
  const tree = distHash(dist);
  const names = pwsh(
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
      '$z = [IO.Compression.ZipFile]::OpenRead($env:ITCH_ZIP); ' +
      'try { $z.Entries | ForEach-Object { $_.FullName } } finally { $z.Dispose() }',
    { ITCH_ZIP: zip },
  )
    .split(/\r?\n/)
    .filter((line) => line !== '');
  const files = names.filter((entry) => !entry.endsWith('/'));
  const backslashed = names.filter((entry) => entry.includes('\\'));
  if (backslashed.length > 0) fail(`${backslashed.length} entry names hold a backslash, e.g. ${backslashed[0]}`);
  if (!names.includes('index.html')) fail('index.html is not at the root of the zip');
  if (files.length !== tree.lines.length) fail(`the zip holds ${files.length} files and the build ${tree.lines.length}`);

  const work = mkdtempSync(join(tmpdir(), 'asciibattler-itch-zip-'));
  try {
    const extracted = join(work, 'x');
    pwsh(
      'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
        '[IO.Compression.ZipFile]::ExtractToDirectory($env:ITCH_ZIP, $env:ITCH_X)',
      { ITCH_ZIP: zip, ITCH_X: extracted },
    );
    const back = distHash(extracted);
    if (back.total !== tree.total) fail(`the extracted tree hashes ${back.total}, the build ${tree.total}`);
  } finally {
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  return { entries: files.length, zipBytes: statSync(zip).size, buildBytes: tree.bytes, hash: tree.total };
}

const checkOnly = flag('check');
if (checkOnly !== undefined) {
  const against = flag('against');
  if (against === undefined) fail('--check=<zip> goes with --against=<build dir>');
  console.log(JSON.stringify({ zip: resolve(checkOnly), build: resolve(against), ...check(resolve(checkOnly), resolve(against)) }));
  process.exit(0);
}

const diag = process.argv.includes('--diag');
const outRoot = resolve(repo, flag('out') ?? join('output', 'itch'));
const id = buildId({ cwd: repo, live: false });
// `+` is legal in a file name and awkward in a URL; the folder and the zip
// are named with `_` in its place.
const name = `asciibattler-${id.replaceAll('+', '_')}${diag ? '-diag' : ''}`;
const dist = join(outRoot, name);
const zip = join(outRoot, `${name}.zip`);
mkdirSync(outRoot, { recursive: true });

// The flag is the build's only difference, and it is set here alone: a
// `VITE_DIAG` left in the shell must not reach a build that isn't asked for.
const env = { ...process.env };
if (diag) env.VITE_DIAG = '1';
else delete env.VITE_DIAG;

console.error(`itch-zip: building ${id}${diag ? ' with the diagnostics panel' : ''}`);
const built = spawnSync(
  process.execPath,
  [join(repo, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'],
  { cwd: repo, env, encoding: 'utf8' },
);
if (built.status !== 0) fail(`the build failed:\n${built.stderr}${built.stdout}`);

// 117.5j: no dev code in a build that goes to players (scripts/dev-scan.mjs).
// The diagnostics build carries its panel and nothing else from src/dev.
const leaks = devLeaks(dist, { diag });
if (leaks.length > 0) {
  fail(`the build carries dev code:\n${leaks.map((l) => `  ${l.file}: "${l.marker}" (${l.source})`).join('\n')}`);
}

rmSync(zip, { force: true });
pwsh("Compress-Archive -Path (Join-Path $env:ITCH_SRC '*') -DestinationPath $env:ITCH_ZIP", {
  ITCH_SRC: dist,
  ITCH_ZIP: zip,
});

const checked = check(zip, dist);
const current = join(outRoot, 'current');
rmSync(current, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
cpSync(dist, current, { recursive: true });

console.log(JSON.stringify({ zip, build: dist, current, id, diag, ...checked }));
