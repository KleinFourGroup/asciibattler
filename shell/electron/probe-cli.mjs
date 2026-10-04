// The probe runner's front door (§112d): run a page script against the
// working tree's development-mode build in an Electron window the user never
// sees, once the probe kit's `__probe.ready()` has passed, and hand back one
// JSON line and an exit code.
//
//   npm run probe -- <script.js>                    the build's first screen
//   npm run probe -- <script.js> --seed=7           a run: seed=7&character=soldier
//   npm run probe -- <script.js> --board=quarry     a board-explorer fixture
//   npm run probe -- <script.js> --query=<query>    any URL query
//
// Options:
//   --dials=<k=v&...>  with --seed: more run dials, or other values for these
//   --window=hidden|offscreen  hidden (the default) runs about one frame a
//                      second, so a script drives its frames with the kit;
//                      offscreen runs them in real time, as the recorder does
//   --size=<w>x<h>     the page's size (default 1280x720)
//   --timeout=<s>      the run's time limit (default 120)
//   --arg=<json>       the script's argument
//   --profile=<dir>    the shell's userData, kept after the run; without it
//                      each run gets a fresh one and discards it. Two runs on
//                      one profile are two launches of the shell on one store
//   --keep             keep the temporary build and profile
//
// The script is one `export default async function (arg)`, run in the page
// after `__probe.ready()`, with `window.__probe` and `window.__game` to hand
// (process/browser-pane.md). The runner wraps the file's text in a call, so
// the function is the file's only top-level statement: a `const` above it is
// a syntax error in the page ("Unexpected token 'const'"). Its value is the result, and `{ ok: false }`
// fails it. Stdout carries only the JSON line (main.mjs's probe report);
// progress goes to stderr. Exit: 0 ok, 1 a failed check or an error, 2 the
// time limit.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, openTree, repo, Stop, stop } from './tree.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function flag(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

function queryOf() {
  const board = flag('board');
  const seed = flag('seed');
  const raw = flag('query');
  const dials = flag('dials');
  if ([board, seed, raw].filter((x) => x !== undefined).length > 1) stop('give at most one of --board, --seed and --query');
  if (dials !== undefined && seed === undefined) stop('--dials goes with --seed');
  if (board !== undefined) return `bp=board-${board}`;
  if (raw !== undefined) return raw.startsWith('?') ? raw.slice(1) : raw;
  if (seed === undefined) return '';
  if (!Number.isInteger(Number(seed))) stop(`--seed=${seed} is not an integer`);
  const params = new URLSearchParams({ seed, character: 'soldier' });
  for (const [k, v] of new URLSearchParams(dials ?? '')) params.set(k, v);
  return params.toString();
}

async function main(work) {
  const script = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (script === undefined) stop('give the page script: npm run probe -- <script.js> [options]');
  if (!existsSync(resolve(script))) stop(`no such script: ${script}`);
  const windowMode = flag('window') ?? 'hidden';
  if (windowMode !== 'hidden' && windowMode !== 'offscreen') stop(`--window=${windowMode} must be hidden or offscreen`);
  const size = flag('size') ?? '1280x720';
  if (!/^\d+x\d+$/.test(size)) stop(`--size=${size} is not <width>x<height>`);
  const seconds = Number(flag('timeout') ?? 120);
  const query = queryOf();
  const profile = flag('profile');
  const arg = flag('arg');
  if (arg !== undefined) {
    try {
      JSON.parse(arg);
    } catch {
      stop(`--arg is not JSON: ${arg}`);
    }
  }

  const tree = openTree(undefined, work, 'probe');
  const dist = join(work, 'dist');
  build(tree, dist, (line) => console.error(`probe: ${line}`));
  console.error(`probe: running ${script} on ?${query} (${tree.stamp}, ${windowMode}, ${size})`);

  const electronPath = createRequire(join(repo, 'package.json'))('electron');
  const args = [
    here,
    '--probe=kit',
    `--script=${resolve(script)}`,
    `--dist=${dist}`,
    `--url=app://game/index.html${query === '' ? '' : `?${query}`}`,
    `--window=${windowMode}`,
    `--size=${size}`,
    `--timeout=${seconds * 1000}`,
    `--profile=${profile !== undefined ? resolve(profile) : join(work, 'profile')}`,
    '--muted',
    ...(arg !== undefined ? [`--arg=${arg}`] : []),
  ];
  const child = spawn(electronPath, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  const code = await new Promise((r) => child.on('close', r));
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('{'));
  if (line === undefined) stop(`the runner printed no report (exit ${code}):\n${stderr.slice(-2000)}`);
  process.stdout.write(`${line}\n`);
  return code;
}

const work = mkdtempSync(join(tmpdir(), 'asciibattler-probe-'));
let code = 1;
try {
  code = await main(work);
} catch (err) {
  console.error(`probe: ${err instanceof Stop ? err.message : err.stack}`);
} finally {
  if (!process.argv.includes('--keep')) rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  else console.error(`probe: kept ${work}`);
}
process.exit(code);
