// The recorder's front door (§111): record a battle to a video file from an
// offscreen Electron window that never takes focus and plays nothing aloud.
//
//   npm run record -- --board=corridors          a board-explorer fixture
//   npm run record -- --seed=12                  the root battle of a seed
//   npm run record -- --seed=12 --dials=layout=river&roster=archer,mage
//   npm run record -- --board=corridors --before=c4ca4e6^ [--after=<ref>]
//                                                a before/after pair
//
// Options:
//   --countdown=full|skip  how the clip opens: on the whole pre-battle
//                      countdown, playing through the game's own handover into
//                      the fight (full, the default), or on the fight's first
//                      frame with no countdown (skip, for clips joined together)
//   --fps=<n>          frames per second (default 60; 30 for long recordings)
//   --size=<w>x<h>     the page's size in pixels (default 1920x1080)
//   --max-seconds=<n>  stop by then if the battle has not ended (default 90)
//   --name=<name>      the clip's file name (default <input>-<commit>[-skip])
//   --check            record the analyzer's twin instead of a clean clip
//   --keep             keep the temporary builds, profiles and intermediates
//   --retime=off       a control: write each paint as it arrives, so a stall
//                      leaves the picture ahead of its sound
//   --plant-stall=<s>:<ms>[,...]  a control: block the page for <ms> at <s>
//                      seconds into the clip
//   --plant-pause=<s>:<ms>[,...]  a control: stop the window painting for <ms>
//                      at about <s> seconds into the clip
//   --backlog-cap-mb=<n>  a control: frames waiting for ffmpeg above this are
//                      dropped and counted (default 1000; set low, it plants drops)
//
// Every recording is made from a development-mode build (built fresh, about
// a second), in a fresh Electron profile that is deleted afterwards, with the
// page muted and the board explorer's panel hidden. A clean clip opens on its
// opening's first frame: a short lead-in (a frame marker and colour patches) is
// drawn, then left out of the file. It ends on the battle's last frame before
// the next screen, its sound placed 25 ms after its picture (main.mjs,
// SOUND_DELAY_MS). A --check twin keeps the lead-in and the
// marker all through and plants a tone, so the analyzer can read frame
// continuity, the audio offset and the colours. The clip and a .json sidecar
// land in clips/ (gitignored); the analyzer (probes/analyze-recording.mjs)
// reads each recording back from its file. A recording that dropped frames is
// still delivered, and exits 1.
//
// A PAIR: --before=<ref> is built in a temporary git worktree (the main
// tree's node_modules linked in), --after likewise, or the working tree when
// it is absent. The two are recorded one after the other from the same input
// and joined side by side, each under a strip naming its commit, with the
// after side's sound. Both open on their go frame, so they start in step; the
// sidecar compares their cue lists to say whether they stay so.
//
// ffmpeg with NVENC must be on the PATH (README, "Recording clips").
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, openTree, repo, Stop, stop } from './tree.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const clipsDir = join(repo, 'clips');

// The fixtures' character and roster (src/dev/boardPanel/fixtures.ts,
// RUN_BASE), so a seed's battle is fought by the same team; any of them can be
// overridden with --dials.
const SEED_BASE = { character: 'soldier', firstNode: 'elite', roster: 'mercenary,archer,rogue,healer,mage,catapult' };

function flag(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

function checkTool(name, args) {
  const r = spawnSync(name, args, { encoding: 'utf8' });
  if (r.error?.code === 'ENOENT') {
    stop(
      `${name} is not on the PATH. The recorder needs ffmpeg (with ffprobe) and an NVIDIA GPU for ` +
        `NVENC; on Windows: winget install Gyan.FFmpeg, then open a new terminal (README, "Recording clips").`,
    );
  }
  if (r.status !== 0) stop(`${name} ${args.join(' ')} failed: ${String(r.stderr).slice(-300)}`);
  return r.stdout;
}

// The tree to build (the working tree, or a commit in a worktree) and its
// development-mode build: tree.mjs, shared with the probe runner.

// --- one recording ---------------------------------------------------------

async function recordOne({ dist, base, profile, query, opts }) {
  const electronPath = createRequire(join(repo, 'package.json'))('electron');
  const args = [
    here,
    '--probe=record',
    `--record=${base}`,
    `--dist=${dist}`,
    `--url=app://game/index.html?${query}`,
    '--window=offscreen',
    `--size=${opts.size}`,
    `--frame-rate=${opts.fps}`,
    `--record-seconds=${opts.maxSeconds}`,
    `--timeout=${(opts.maxSeconds + 60) * 1000}`,
    `--profile=${profile}`,
    '--muted',
    `--countdown=${opts.countdown}`,
    ...(opts.enter ? ['--enter'] : []),
    ...(opts.check ? ['--check'] : []),
    ...(opts.cap !== undefined ? [`--backlog-cap-mb=${opts.cap}`] : []),
    ...(opts.retime !== undefined ? [`--retime=${opts.retime}`] : []),
    ...(opts.stalls !== undefined ? [`--plant-stall=${opts.stalls}`] : []),
    ...(opts.pauses !== undefined ? [`--plant-pause=${opts.pauses}`] : []),
  ];
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
    stop(`the recording failed (exit ${code})`);
  }
  return probe;
}

function analyze(base) {
  const r = spawnSync(process.execPath, [join(here, 'probes', 'analyze-recording.mjs'), base], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return r.status === 0 ? JSON.parse(r.stdout) : { error: String(r.stderr).slice(-1000) };
}

function verdict(probe, analysis, check) {
  const c1 = analysis?.check1;
  const c2 = analysis?.check2;
  const cuesOk = c2 !== undefined && c2.cuesHeard === c2.gameCues;
  const dropped = probe.result.video.dropped;
  const faults = probe.result.faults;
  const good =
    dropped === 0 &&
    faults.length === 0 &&
    (check ? c1?.pass === true && analysis?.colour?.pass === true && cuesOk : analysis?.leadIn?.pass === true && cuesOk);
  const shape = check
    ? `frames missing ${c1?.missing ?? '?'} of ${c1?.slots ?? '?'} · colours within ${analysis?.colour?.maxErr ?? '?'} · audio to video ${c2?.avOffsetMs ?? '?'} ms` +
      ` (at each tone: ${c2?.tones?.offsetsMs.join(', ') ?? '?'})`
    : `${analysis?.container?.video.frames ?? '?'} frames, lead-in frames in the file ${(analysis?.leadIn?.markerLikeFrames ?? 0) + (analysis?.leadIn?.patchFrames ?? 0)}`;
  const { opening, countdownFrom, endedBy, timeline } = probe.result;
  const line =
    `${analysis?.container?.seconds.toFixed(1) ?? '?'} s · opens on ${opening === 'full' ? `the countdown at ${countdownFrom}` : 'the fight'}, ` +
    `ends at ${endedBy} · ${shape} · ` +
    `picture ahead of its sound by ${timeline?.driftMs ?? '?'} ms at the cut (page ${timeline?.pageFps ?? '?'} fps, ${timeline?.framesShort ?? '?'} page frames never reached the file) · ` +
    `retimed: ${timeline?.held ?? '?'} frames held in ${timeline?.holds.length ?? '?'} freezes (the longest ${Math.max(0, ...(timeline?.holds ?? []).map((h) => h.ms))} ms), ${timeline?.skipped ?? '?'} skipped · ` +
    `cues heard ${c2?.cuesHeard ?? '?'} of ${c2?.gameCues ?? '?'} (late ${c2?.cuesLate ?? '?'}) · ` +
    `frames dropped ${dropped} · backlog peak ${probe.result.video.backlogMaxMB} of ${probe.result.video.backlogCapMB} MB` +
    faults.map((f) => `\n  FAULT: ${f}`).join('');
  return { good, line };
}

// --- a pair ----------------------------------------------------------------

/** Do the two fights stay in step? Their cue lists, key by key from the go
 *  frame: the matched prefix, where they part, and how far apart in time the
 *  matched cues fall. */
function compareCues(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n].key === b[n].key) n++;
  const dts = a.slice(0, n).map((c, i) => Math.abs(c.s - b[i].s) * 1000).sort((x, y) => x - y);
  return {
    before: a.length,
    after: b.length,
    sameSequence: n === a.length && n === b.length,
    matchedPrefix: n,
    firstDivergence: n < Math.max(a.length, b.length) ? { index: n, before: a[n] ?? null, after: b[n] ?? null } : null,
    dtMs: dts.length === 0 ? null : { median: Math.round(dts[Math.floor(dts.length / 2)]), max: Math.round(dts[dts.length - 1]) },
  };
}

/** The halves side by side (hstack), each under a 48 px strip naming its
 *  commit in the game's font, a grey 8 px rule between them, the after side's
 *  sound. The filters work in YUV, so the halves' colours pass through; the
 *  output is tagged BT.709 like each half (record.mjs). */
function compose({ work, beforeFile, afterFile, labels, out }) {
  copyFileSync(join(repo, 'assets', 'fonts', 'jetbrains-mono', 'JetBrainsMono-Regular.ttf'), join(work, 'label.ttf'));
  writeFileSync(join(work, 'before.txt'), labels.before);
  writeFileSync(join(work, 'after.txt'), labels.after);
  const text = (file) => `drawtext=fontfile=label.ttf:textfile=${file}:fontsize=26:fontcolor=white:x=20:y=11`;
  const graph =
    `[0:v]pad=iw+8:ih+48:0:48:color=0x404040,${text('before.txt')}[a];` +
    `[1:v]pad=iw:ih+48:0:48:color=0x404040,${text('after.txt')}[b];` +
    '[a][b]hstack=inputs=2,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[v]';
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', beforeFile, '-i', afterFile, '-filter_complex', graph, '-map', '[v]', '-map', '1:a', '-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23', '-c:a', 'copy', out],
    { cwd: work, encoding: 'utf8' },
  );
  if (r.status !== 0) stop(`composing the pair failed: ${r.stderr.slice(-800)}`);
}

// --- main ------------------------------------------------------------------

async function main(work, trees) {
  const board = flag('board');
  const seed = flag('seed');
  const dials = flag('dials');
  const beforeRef = flag('before');
  const afterRef = flag('after');
  if ((board === undefined) === (seed === undefined)) stop('give one input: --board=<fixture id> or --seed=<n>');
  if (board !== undefined && dials !== undefined) stop('--dials goes with --seed; a board fixture owns its run dials');
  if (seed !== undefined && !Number.isInteger(Number(seed))) stop(`--seed=${seed} is not an integer`);
  if (afterRef !== undefined && beforeRef === undefined) stop('--after goes with --before');
  const fps = Number(flag('fps') ?? 60);
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) stop(`--fps=${flag('fps')} must be a whole number from 1 to 60`);
  const size = flag('size') ?? '1920x1080';
  if (!/^\d+x\d+$/.test(size)) stop(`--size=${size} is not <width>x<height>`);
  const check = process.argv.includes('--check');
  const countdown = flag('countdown') ?? 'full';
  if (countdown !== 'full' && countdown !== 'skip') stop(`--countdown=${countdown} must be full or skip`);
  const opts = { fps, size, maxSeconds: Number(flag('max-seconds') ?? 90), enter: seed !== undefined, check, countdown, cap: flag('backlog-cap-mb'), retime: flag('retime'), stalls: flag('plant-stall'), pauses: flag('plant-pause') };
  // The file name says which opening, when it is not the default.
  const suffix = `${countdown === 'skip' ? '-skip' : ''}${check ? '-check' : ''}`;

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

  if (!/\bh264_nvenc\b/.test(checkTool('ffmpeg', ['-hide_banner', '-encoders']))) {
    stop('this ffmpeg has no h264_nvenc encoder; the recorder encodes on an NVIDIA GPU (README, "Recording clips").');
  }
  checkTool('ffprobe', ['-version']);
  mkdirSync(clipsDir, { recursive: true });
  const uniqueName = (name) => {
    let candidate = name;
    for (let n = 2; existsSync(join(clipsDir, `${candidate}.mp4`)); n++) candidate = `${name}-${n}`;
    return candidate;
  };
  const input = board !== undefined ? { board } : { seed: Number(seed), dials: dials ?? null };

  // One side: open its tree, build, record, read it back.
  const side = async (label, ref) => {
    const tree = openTree(ref, work, label);
    trees.push(tree);
    const dist = join(work, `dist-${label}`);
    build(tree, dist, (line) => console.log(`record: ${line}`));
    const base = join(work, `rec-${label}`);
    console.log(`record: recording ${inputName} (${tree.stamp})${check ? ', check twin' : ''} at ${size}, ${fps} fps, in the background; the battle plays in real time`);
    const probe = await recordOne({ dist, base, profile: join(work, `profile-${label}`), query, opts });
    const sidecar = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
    sidecar.recorder = { input, query, stamp: tree.stamp, ref: tree.ref, fps, size, profile: 'fresh', check, countdown };
    writeFileSync(`${base}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);
    const analysis = analyze(base);
    sidecar.analysis = analysis;
    writeFileSync(`${base}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);
    return { tree, base, probe, sidecar, analysis, ...verdict(probe, analysis, check) };
  };

  if (beforeRef === undefined) {
    const one = await side('clip', undefined);
    const name = uniqueName(flag('name') ?? `${inputName}-${one.tree.stamp}${suffix}`);
    copyFileSync(`${one.base}.mp4`, join(clipsDir, `${name}.mp4`));
    copyFileSync(`${one.base}.json`, join(clipsDir, `${name}.json`));
    console.log(`record: ${one.good ? 'OK' : 'CHECK FAILED'}  ${join(clipsDir, `${name}.mp4`)}\n  ${one.line}`);
    return one.good;
  }

  const before = await side('before', beforeRef);
  const after = await side('after', afterRef);
  const name = uniqueName(flag('name') ?? `${inputName}-${before.tree.stamp}-vs-${after.tree.stamp}${suffix}`);
  const labels = {
    before: `BEFORE  ${before.tree.ref} = ${before.tree.stamp}`,
    after: `AFTER  ${after.tree.ref} = ${after.tree.stamp}`,
  };
  const out = join(clipsDir, `${name}.mp4`);
  compose({ work, beforeFile: `${before.base}.mp4`, afterFile: `${after.base}.mp4`, labels, out });
  const inStep = compareCues(before.sidecar.cues, after.sidecar.cues);
  const lockfileDiffers =
    spawnSync('git', ['diff', '--quiet', before.tree.stamp, after.tree.ref === 'working tree' ? 'HEAD' : after.tree.stamp, '--', 'package-lock.json'], { cwd: repo }).status !== 0;
  const pairSidecar = {
    pair: { labels, sound: 'after', inStep, lockfileDiffers, note: lockfileDiffers ? 'both halves were built with the main tree\'s node_modules' : null },
    before: before.sidecar,
    after: after.sidecar,
  };
  writeFileSync(join(clipsDir, `${name}.json`), `${JSON.stringify(pairSidecar, null, 2)}\n`);
  const good = before.good && after.good;
  console.log(
    [
      `record: ${good ? 'OK' : 'CHECK FAILED'}  ${out}`,
      `  before ${before.tree.stamp}: ${before.line}`,
      `  after  ${after.tree.stamp}: ${after.line}`,
      `  in step: ${inStep.sameSequence ? 'the same cues' : `cues part at ${inStep.matchedPrefix} of ${inStep.before} / ${inStep.after}`}` +
        `, matched cues apart by median ${inStep.dtMs?.median ?? '?'} ms, max ${inStep.dtMs?.max ?? '?'} ms` +
        `${lockfileDiffers ? ' · the lockfiles differ (both built with the main tree\'s node_modules)' : ''}`,
    ].join('\n'),
  );
  return good;
}

const work = mkdtempSync(join(tmpdir(), 'asciibattler-rec-'));
const trees = [];
let ok = false;
try {
  ok = await main(work, trees);
} catch (err) {
  console.error(`record: ${err instanceof Stop ? err.message : err.stack}`);
} finally {
  let closed = true;
  for (const tree of trees) {
    try {
      tree.close();
    } catch (err) {
      closed = false;
      console.error(`record: ${err.message} (git worktree list shows what is left)`);
    }
  }
  // A worktree that failed to close may still hold its node_modules junction,
  // so the temp directory is then left for a person to look at.
  if (!closed) console.error(`record: left ${work} in place`);
  else if (!process.argv.includes('--keep')) rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
process.exit(ok ? 0 : 1);
