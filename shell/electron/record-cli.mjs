// The recorder's front door (§111): record a battle to a video file from an
// offscreen Electron window that never takes focus and plays nothing aloud.
//
//   npm run record -- --board=corridors          a board-explorer fixture
//   npm run record -- --seed=12                  the root battle of a seed
//   npm run record -- --seed=12 --dials=layout=river&roster=archer,mage
//
// Options:
//   --fps=<n>          frames per second (default 60; 30 for long recordings)
//   --size=<w>x<h>     the page's size in pixels (default 1920x1080)
//   --max-seconds=<n>  stop by then if the battle has not ended (default 90)
//   --name=<name>      the clip's file name (default <input>-<commit>)
//   --check            record the analyzer's twin instead of a clean clip
//   --keep             keep the temporary build, profile and intermediates
//
// Every recording is made from the working tree's development-mode build
// (built fresh, about a second), in a fresh Electron profile that is deleted
// afterwards, with the page muted and the board explorer's panel hidden. A
// clean clip opens on the fight's first frame: a short lead-in (a frame
// marker and colour patches) is drawn, then left out of the file. A --check
// twin keeps the lead-in and the marker all through and plants a tone, so
// the analyzer can read frame continuity, the audio offset and the colours.
// The clip and a .json sidecar land in clips/ (gitignored); the analyzer
// (probes/analyze-recording.mjs) then reads the clip back from the file.
// ffmpeg with NVENC must be on the PATH (README, "Recording clips").
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const clipsDir = join(repo, 'clips');

// The fixtures' character and roster (src/dev/boardPanel/fixtures.ts,
// RUN_BASE), so a seed's battle is fought by the same team; any of them can be
// overridden with --dials.
const SEED_BASE = { character: 'soldier', firstNode: 'elite', roster: 'mercenary,archer,rogue,healer,mage,catapult' };

function fail(message) {
  console.error(`record: ${message}`);
  process.exit(1);
}

function flag(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

// --- the input -------------------------------------------------------------

const board = flag('board');
const seed = flag('seed');
const dials = flag('dials');
if ((board === undefined) === (seed === undefined)) fail('give one input: --board=<fixture id> or --seed=<n>');
if (board !== undefined && dials !== undefined) fail('--dials goes with --seed; a board fixture owns its run dials');
if (seed !== undefined && !Number.isInteger(Number(seed))) fail(`--seed=${seed} is not an integer`);
const fps = Number(flag('fps') ?? 60);
if (!Number.isInteger(fps) || fps < 1 || fps > 60) fail(`--fps=${flag('fps')} must be a whole number from 1 to 60`);
const size = flag('size') ?? '1920x1080';
if (!/^\d+x\d+$/.test(size)) fail(`--size=${size} is not <width>x<height>`);
const maxSeconds = Number(flag('max-seconds') ?? 90);
const keep = process.argv.includes('--keep');
const check = process.argv.includes('--check');

let query;
let inputName;
if (board !== undefined) {
  query = `bp=board-${board}_hide-1`;
  inputName = board;
} else {
  const params = new URLSearchParams({ seed, ...SEED_BASE });
  for (const [k, v] of new URLSearchParams(dials ?? '')) params.set(k, v);
  params.set('bp', 'hide-1');
  query = params.toString();
  inputName = `seed${seed}${dials ? `-${dials.replace(/[^A-Za-z0-9]+/g, '-')}` : ''}`;
}

// --- ffmpeg ----------------------------------------------------------------

function checkTool(name, args) {
  const r = spawnSync(name, args, { encoding: 'utf8' });
  if (r.error?.code === 'ENOENT') {
    fail(
      `${name} is not on the PATH. The recorder needs ffmpeg (with ffprobe) and an NVIDIA GPU for ` +
        `NVENC; on Windows: winget install Gyan.FFmpeg, then open a new terminal (README, "Recording clips").`,
    );
  }
  if (r.status !== 0) fail(`${name} ${args.join(' ')} failed: ${String(r.stderr).slice(-300)}`);
  return r.stdout;
}
if (!/\bh264_nvenc\b/.test(checkTool('ffmpeg', ['-hide_banner', '-encoders']))) {
  fail('this ffmpeg has no h264_nvenc encoder; the recorder encodes on an NVIDIA GPU (README, "Recording clips").');
}
checkTool('ffprobe', ['-version']);

// --- the build -------------------------------------------------------------

function git(args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) fail(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
const commit = git(['rev-parse', '--short=7', 'HEAD']);
const stamp = git(['status', '--porcelain']) === '' ? commit : `${commit}-dirty`;

const work = mkdtempSync(join(tmpdir(), 'asciibattler-rec-'));
const dist = join(work, 'dist');
const profile = join(work, 'profile');
const cleanup = () => {
  if (!keep) rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
};

console.log(`record: building ${stamp} (development mode)`);
const built = spawnSync(
  process.execPath,
  [join(repo, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--mode', 'development', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'],
  { cwd: repo, env: { ...process.env, NODE_ENV: 'development' }, encoding: 'utf8' },
);
if (built.status !== 0) {
  cleanup();
  fail(`the build failed:\n${built.stderr || built.stdout}`);
}
// Only a development-mode build carries the board explorer (and __game), so
// its chunk is the proof that NODE_ENV reached Vite.
if (!readdirSync(join(dist, 'assets')).some((f) => f.startsWith('boardPanel-'))) {
  cleanup();
  fail('the build has no boardPanel chunk: it was built with DEV off, and a recording needs the dev handle');
}

// --- the recording ---------------------------------------------------------

function uniqueName(name) {
  let candidate = name;
  for (let n = 2; existsSync(join(clipsDir, `${candidate}.mp4`)); n++) candidate = `${name}-${n}`;
  return candidate;
}
mkdirSync(clipsDir, { recursive: true });
const clipName = uniqueName(flag('name') ?? `${inputName}-${stamp}${check ? '-check' : ''}`);
const base = join(work, 'rec');
const electronPath = createRequire(join(repo, 'package.json'))('electron');
const args = [
  here,
  '--probe=record',
  `--record=${base}`,
  `--dist=${dist}`,
  `--url=app://game/index.html?${query}`,
  '--window=offscreen',
  `--size=${size}`,
  `--frame-rate=${fps}`,
  `--record-seconds=${maxSeconds}`,
  `--timeout=${(maxSeconds + 60) * 1000}`,
  `--profile=${profile}`,
  '--muted',
  ...(seed !== undefined ? ['--enter'] : []),
  ...(check ? ['--check'] : []),
];

console.log(`record: recording ${inputName}${check ? ' (check twin)' : ''} at ${size}, ${fps} fps (in the background; the battle plays in real time)`);
const child = spawn(electronPath, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => (stdout += d));
child.stderr.on('data', (d) => (stderr += d));
const code = await new Promise((r) => child.on('close', r));
const line = stdout.split(/\r?\n/).find((l) => l.startsWith('{'));
const probe = line ? JSON.parse(line) : null;
if (!probe?.ok || !existsSync(`${base}.mp4`)) {
  console.error(JSON.stringify(probe ?? { code, stderr: stderr.slice(-2000) }, null, 2));
  cleanup();
  fail(`the recording failed (exit ${code})`);
}

// --- deliver, then read the clip back --------------------------------------

const clip = join(clipsDir, `${clipName}.mp4`);
const sidecarFile = join(clipsDir, `${clipName}.json`);
copyFileSync(`${base}.mp4`, clip);
const sidecar = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
sidecar.recorder = { input: board !== undefined ? { board } : { seed: Number(seed), dials: dials ?? null }, query, stamp, fps, size, profile: 'fresh', check };
writeFileSync(sidecarFile, `${JSON.stringify(sidecar, null, 2)}\n`);

const analyzed = spawnSync(process.execPath, [join(here, 'probes', 'analyze-recording.mjs'), join(clipsDir, clipName)], {
  encoding: 'utf8',
  maxBuffer: 1 << 26,
});
const analysis = analyzed.status === 0 ? JSON.parse(analyzed.stdout) : null;
sidecar.analysis = analysis ?? { error: String(analyzed.stderr).slice(-1000) };
writeFileSync(sidecarFile, `${JSON.stringify(sidecar, null, 2)}\n`);
cleanup();

const c1 = analysis?.check1;
const c2 = analysis?.check2;
const cuesOk = c2 !== undefined && c2.cuesHeard === c2.gameCues;
const good = check ? c1?.pass === true && analysis?.colour?.pass === true && cuesOk : analysis?.leadIn?.pass === true && cuesOk;
const shape = check
  ? `frames missing ${c1?.missing ?? '?'} of ${c1?.slots ?? '?'} · colours within ${analysis?.colour?.maxErr ?? '?'} · audio to video ${c2?.avOffsetMs ?? '?'} ms`
  : `${analysis?.container.video.frames ?? '?'} frames, lead-in frames in the file ${(analysis?.leadIn?.markerLikeFrames ?? 0) + (analysis?.leadIn?.patchFrames ?? 0)}`;
console.log(
  [
    `record: ${good ? 'OK' : 'CHECK FAILED'}  ${clip}`,
    `  ${analysis?.container.seconds.toFixed(1) ?? '?'} s · ${shape} · ` +
      `cues heard ${c2?.cuesHeard ?? '?'} of ${c2?.gameCues ?? '?'} (late ${c2?.cuesLate ?? '?'}) · backlog peak ${probe.result.video.backlogMaxMB} MB`,
  ].join('\n'),
);
process.exit(good ? 0 : 1);
