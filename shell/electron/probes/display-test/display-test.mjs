// The display test (114f): one check-twin recording of corridors (skip), with
// the display switched off and woken inside the fight, the machine's load
// logged beside it, and the result read from the sidecar. Windows only; it
// turns the monitor off, so it runs at the user's go (stretch.sh has the
// tones that tell them when). The clip, its sidecar and <name>.display.json
// land in clips/<dir>/.
//
//   node display-test.mjs --name=<clip> [--dir=<clips subdirectory>]
//        [--switch=yes|no] [--off=one|all] [--warn=<s>] [--load=none|decode:<threads>]
//        [--off-at=<s>] [--dark=<s>] [--lock=<s>] [--retime=off]
//
// --off=all sends the request to every window, as a broadcast: with input
//   arriving (someone at the desk) the display's state then changes dozens of
//   times, the hardest case a recording has met. --off=one asks one window.
// --retime=off records without the retime, the failing control.
// --switch=no leaves the display alone (a control, and the dry run).
// --warn=<s> plays the warn tone that long before the switch and the clear
//   tone after the wake (for a run with the user at the desk).
// --off-at is seconds after the recorder says it is recording.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..', '..', '..');
const flag = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? dflt : hit.slice(name.length + 3);
};
const name = flag('name');
if (!name) throw new Error('--name=<clip>');
const doSwitch = flag('switch', 'yes') === 'yes';
const warnS = Number(flag('warn', '0'));
const load = flag('load', 'none');
const offAtS = Number(flag('off-at', '30'));
const darkS = Number(flag('dark', '25'));
// --lock=<s>: lock the workstation that long before the recorder starts, and
// let Windows turn the display off itself (no switch is asked).
const lockLeadS = Number(flag('lock', '0'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = flag('dir', 'display-test');
const offBy = flag('off', 'one');
const outDir = join(repo, 'clips', dir);
mkdirSync(outDir, { recursive: true });
if (existsSync(join(outDir, `${name}.mp4`))) throw new Error(`clips/${dir}/${name}.mp4 exists`);

// --- the Win32 helper --------------------------------------------------------
const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'win32-helper.ps1')], { stdio: ['pipe', 'pipe', 'inherit'] });
const replies = [];
const waiting = [];
createInterface({ input: helper.stdout }).on('line', (line) => {
  if (!line.startsWith('{')) return;
  const msg = JSON.parse(line);
  const w = waiting.shift();
  if (w) w(msg);
  else replies.push(msg);
});
const reply = () => new Promise((r) => (replies.length > 0 ? r(replies.shift()) : waiting.push(r)));
const ask = (cmd) => {
  helper.stdin.write(`${cmd}\n`);
  return reply();
};
await reply(); // ready

// --- the load log ------------------------------------------------------------
const samples = [];
let lastCpu = null;
const cpuTotals = () => {
  let idle = 0;
  let total = 0;
  for (const c of cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle;
  }
  return { idle, total };
};
let gpu = null;
const smi = spawn('nvidia-smi', ['--query-gpu=utilization.gpu,utilization.encoder,utilization.decoder', '--format=csv,noheader,nounits', '-l', '1'], { stdio: ['ignore', 'pipe', 'ignore'] });
createInterface({ input: smi.stdout }).on('line', (line) => {
  const [g, e, d] = line.split(',').map((x) => Number(x.trim()));
  gpu = { g, e, d };
});
const sampler = setInterval(async () => {
  const idleMs = (await ask('idle')).idleMs;
  const now = cpuTotals();
  if (lastCpu !== null) {
    const busy = 1 - (now.idle - lastCpu.idle) / (now.total - lastCpu.total);
    samples.push({ epoch: Date.now(), idleMs, cpu: Math.round(busy * 1000) / 10, gpu: gpu?.g ?? null, enc: gpu?.e ?? null, dec: gpu?.d ?? null });
  }
  lastCpu = now;
}, 1000);

// --- the planted load --------------------------------------------------------
// A looping software decode of a clip, as fast as its threads go. Eight
// threads held a 32-thread machine near 45 % and left a recording clean; with
// no limit it starves the recorder by itself (322 frames lost, §111f-post).
let decode = null;
const loadThreads = load.startsWith('decode:') ? load.slice(7) : null;
if (load === 'decode' || loadThreads !== null) {
  const clip = join(repo, 'clips', flag('load-clip', 'corridors-f406442.mp4'));
  if (!existsSync(clip)) throw new Error(`--load needs a clip to decode: ${clip} is missing (--load-clip=<file under clips/>)`);
  decode = spawn('ffmpeg', ['-v', 'error', ...(loadThreads === null ? [] : ['-threads', loadThreads]), '-stream_loop', '-1', '-i', clip, '-f', 'null', '-'], { stdio: 'ignore' });
  await sleep(5000);
} else if (load !== 'none') throw new Error(`--load=${load}`);

// --- the lock leg: Windows' own display-off, a minute or so after a lock -------
const marks = { lock: null, off: null, on: null, warn: null, clear: null };
if (lockLeadS > 0) {
  marks.lock = Date.now();
  spawnSync('rundll32.exe', ['user32.dll,LockWorkStation']);
  await sleep(lockLeadS * 1000);
}

// --- the recording -----------------------------------------------------------
const launchedAt = Date.now();
const rec = spawn(process.execPath, [join(repo, 'shell', 'electron', 'record-cli.mjs'), '--board=corridors', '--countdown=skip', '--check', `--name=${dir}/${name}`, ...(flag('retime') === undefined ? [] : [`--retime=${flag('retime')}`])], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
let recOut = '';
let recordingAt = null;
rec.stdout.on('data', (d) => {
  recOut += d;
  if (recordingAt === null && /record: recording /.test(recOut)) recordingAt = Date.now();
});
rec.stderr.on('data', (d) => (recOut += d));
const recDone = new Promise((r) => rec.on('close', r));

const untilRecording = Date.now() + 60_000;
while (recordingAt === null && Date.now() < untilRecording) await sleep(50);
if (recordingAt === null) throw new Error(`the recorder never said it was recording:\n${recOut}`);

let recClosed = false;
void recDone.then(() => (recClosed = true));
if (lockLeadS > 0) {
  // Wait for the display to go off by itself, then try the wake 25 s later.
  let off = null;
  while (off === null && !recClosed) {
    await sleep(300);
    off = (await ask('events')).events.find((e) => e.state === 0 && e.epoch > marks.lock) ?? null;
  }
  if (off !== null) {
    const idle = await ask('idle');
    marks.off = { cmd: 'windows', before: off.epoch, after: off.epoch, idleMs: idle.idleMs };
    await sleep(Math.max(0, off.epoch + darkS * 1000 - Date.now()));
    if (!recClosed) marks.on = await ask('on');
  }
} else if (doSwitch) {
  const offAt = recordingAt + offAtS * 1000;
  if (warnS > 0) {
    await sleep(Math.max(0, offAt - warnS * 1000 - Date.now()));
    marks.warn = await ask('beep warn');
  }
  await sleep(Math.max(0, offAt - Date.now()));
  marks.off = await ask(offBy === 'all' ? 'off-all' : 'off');
  // One window is asked first; if the display has not gone off 1.5 s later,
  // every window is (a broadcast).
  await sleep(1500);
  const went = (await ask('events')).events.some((e) => e.state === 0 && e.epoch >= marks.off.before);
  if (!went) marks.offAll = await ask('off-all');
  await sleep(Math.max(0, marks.off.after + darkS * 1000 - Date.now()));
  marks.on = await ask('on');
  if (warnS > 0) marks.clear = await ask('beep clear');
}
const code = await recDone;
await sleep(1500);
const events = (await ask('events')).events;
clearInterval(sampler);
smi.kill();
decode?.kill();
helper.stdin.write('quit\n');

// --- the reading -------------------------------------------------------------
const sidecarFile = join(outDir, `${name}.json`);
if (!existsSync(sidecarFile)) {
  console.log(recOut);
  throw new Error(`no sidecar at ${sidecarFile} (the recorder exited ${code})`);
}
const side = JSON.parse(readFileSync(sidecarFile, 'utf8'));
const go = side.startEpoch;
const rel = (epoch) => (epoch == null ? null : Math.round(epoch - go) / 1000);
const slot = 1000 / side.fps;
const tl = side.timeline;
const long = (tl?.longFrames ?? []).map((f) => ({ atS: rel(f.epoch), ms: f.ms }));
const times = side.pageFrameTimesMs ?? [];
const gaps = times.slice(1).map((t, i) => t - times[i]);
const over = (ms) => gaps.filter((g) => g > ms);
const sumOver = (xs) => Math.round(xs.reduce((a, g) => a + g - slot, 0));
const paint = side.video?.paintTimesMs ?? [];
const paintGaps = paint.slice(1).map((t, i) => t - paint[i]);
const cutEpoch = go + (tl?.pageS ?? side.durationS) * 1000;
const within = (from, to) => samples.filter((s) => s.epoch >= from && s.epoch <= to);
const stat = (xs, key) => {
  const v = xs.map((s) => s[key]).filter((x) => x !== null);
  return v.length === 0 ? null : { mean: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, max: Math.max(...v) };
};
const fight = within(go, cutEpoch);
const before = marks.off ? within(marks.off.before - 20_000, marks.off.before) : [];
const c2 = side.analysis?.check2;
const result = {
  name,
  plan: { switch: doSwitch, off: offBy, retime: flag('retime', 'on'), warnS, load, offAtS, darkS, lockLeadS },
  lockS: rel(marks.lock),
  recorderExit: code,
  setupS: rel(recordingAt) === null ? null : -rel(recordingAt),
  offS: rel(marks.off?.after),
  offCallMs: marks.off ? marks.off.after - marks.off.before : null,
  offBy: marks.off ? (marks.off.cmd === 'windows' ? 'windows, after the lock' : offBy === 'all' ? 'every window' : marks.offAll ? 'one window, then every window' : 'one window') : null,
  inputIdleAtOffMs: marks.off?.idleMs ?? null,
  onS: rel(marks.on?.before),
  // Input seen during the dark: the last input is younger than the dark.
  inputIdleAtWakeMs: marks.on?.idleMs ?? null,
  inputWhileDark: marks.on ? marks.on.idleMs < marks.on.before - marks.off.after - 200 : null,
  displayEvents: events.map((e) => ({ atS: rel(e.epoch), state: e.state })),
  timeline: tl && { pageFrames: tl.pageFrames, fileFrames: tl.fileFrames, framesShort: tl.framesShort, pageFps: tl.pageFps, driftMs: tl.driftMs, held: tl.held, skipped: tl.skipped, freezes: tl.holds?.length, longestFreezeMs: Math.max(0, ...(tl.holds ?? []).map((h) => h.ms)) },
  longFrames: { n: long.length, sumOverSlotMs: Math.round(long.reduce((a, f) => a + f.ms - slot, 0)), list: long },
  pageGaps: {
    frames: times.length,
    over25: over(25).length,
    over40: over(40).length,
    sumOver25Ms: sumOver(over(25)),
    sumOver40Ms: sumOver(over(40)),
    max: gaps.length ? Math.round(Math.max(...gaps)) : null,
  },
  paintGaps: { frames: paint.length, over25: paintGaps.filter((g) => g > 25).length, max: paintGaps.length ? Math.round(Math.max(...paintGaps)) : null },
  file: side.analysis?.check1 && { missing: side.analysis.check1.missing, duplicates: side.analysis.check1.duplicates, slots: side.analysis.check1.slots },
  cues: c2 && `${c2.cuesHeard} of ${c2.gameCues} (late ${c2.cuesLate}, past the end ${c2.cuesPastEnd})`,
  tones: c2?.tones ?? null,
  faults: side.faults,
  // The time since the last input, sampled each second: over the fight, and over the dark.
  inputIdleMs: { fight: stat(fight, 'idleMs'), dark: marks.off && marks.on ? stat(within(marks.off.after, marks.on.before), 'idleMs') : null },
  load: { fight: { cpu: stat(fight, 'cpu'), gpu: stat(fight, 'gpu'), dec: stat(fight, 'dec') }, before20s: { cpu: stat(before, 'cpu'), gpu: stat(before, 'gpu') } },
  wallS: Math.round((Date.now() - launchedAt) / 100) / 10,
};
writeFileSync(join(outDir, `${name}.display.json`), `${JSON.stringify({ ...result, samples, recorderOutput: recOut }, null, 2)}\n`);
console.log(JSON.stringify(result, null, 1));
process.exit(0);
