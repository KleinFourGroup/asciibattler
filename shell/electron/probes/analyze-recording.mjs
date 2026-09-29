// Read a §110d recording back from the FILE, through ffprobe and ffmpeg's
// decoders, never through the code that wrote it (the recorder's exit re-runs
// this). Usage: node analyze-recording.mjs <base>   (reads <base>.mp4 and the
// <base>.json sidecar that the record probe wrote)
//
// - FRAMES: the marker's eight squares (probes/record-page.js) are cropped
//   and averaged per frame and decoded to the page's frame count mod 256.
//   Over the span where the count moves, a step of 1 is a good frame, 0 a
//   duplicate, and n > 1 means n - 1 frames never reached the file. Check 1
//   passes at no more than 1 % of slots missing.
// - THE TONE: a Goertzel filter at the planted frequency in 20 ms windows
//   finds its onset; the ninth square's first white frame is the video's
//   side, so their difference is the file's audio-to-video offset. The same
//   filter at 1700 Hz (110e's outside tone) gives that band's level here.
// - THE GAME'S SOUND: each logged play() is looked up in the file's audio;
//   a cue is heard if the 150 ms after it reaches -45 dBFS.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2];
if (!base) throw new Error('usage: node analyze-recording.mjs <base>');
const side = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
const file = `${base}.mp4`;
const SQUARE = 24;
const RATE = 48_000;

function tool(cmd, args) {
  const r = spawnSync(cmd, args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${String(r.stderr).slice(-500)}`);
  return r.stdout;
}

// --- the container ---------------------------------------------------------
const probe = JSON.parse(
  tool('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]).toString(),
);
const vStream = probe.streams.find((s) => s.codec_type === 'video');
const aStream = probe.streams.find((s) => s.codec_type === 'audio');
const fps = side.fps;

// --- frames ----------------------------------------------------------------
const crop = `crop=${SQUARE * 9}:${SQUARE}:8:ih-${SQUARE + 8},scale=9:1:flags=area`;
const gray = tool('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v', '-vf', crop, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
const values = [];
const flash = [];
for (let i = 0; i + 9 <= gray.length; i += 9) {
  let n = 0;
  for (let b = 0; b < 8; b++) n = (n << 1) | (gray[i + b] > 128 ? 1 : 0);
  values.push(n);
  flash.push(gray[i + 8] > 128);
}
let first = values.findIndex((v) => v !== 0);
let last = values.length - 1;
while (last > first && values[last] === values[last - 1]) last--;
let good = 0;
let dup = 0;
let missing = 0;
let worstJump = 0;
for (let i = first + 1; i <= last; i++) {
  const d = (values[i] - values[i - 1] + 256) % 256;
  if (d === 1) good++;
  else if (d === 0) dup++;
  else {
    missing += d - 1;
    worstJump = Math.max(worstJump, d);
  }
}
const slots = good + dup + missing;
const firstFlashFrame = flash.indexOf(true);

// --- audio -----------------------------------------------------------------
const pcmBuf = tool('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
const pcm = new Float32Array(pcmBuf.buffer, pcmBuf.byteOffset, pcmBuf.byteLength / 4);
const audioStart = Number(aStream?.start_time ?? 0);
const videoStart = Number(vStream?.start_time ?? 0);

function goertzel(hz, from, len) {
  const k = 2 * Math.cos((2 * Math.PI * hz) / RATE);
  let s1 = 0;
  let s2 = 0;
  for (let i = from; i < from + len && i < pcm.length; i++) {
    const s0 = pcm[i] + k * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return (s1 * s1 + s2 * s2 - k * s1 * s2) / (len * len);
}
function band(hz) {
  const win = Math.round(RATE * 0.02);
  const powers = [];
  for (let i = 0; i + win <= pcm.length; i += win) powers.push(goertzel(hz, i, win));
  const sorted = [...powers].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1e-20;
  const peak = sorted[sorted.length - 1] ?? 0;
  const onset = powers.findIndex((p) => p > peak / 10);
  return { powers, median, peak, onsetS: onset < 0 ? null : audioStart + (onset * win) / RATE };
}
const tone = band(side.tone.hz);
const outside = band(1700);
const db = (x) => (x > 0 ? Math.round(10 * Math.log10(x) * 10) / 10 : -Infinity);

const rmsDb = (from, len) => {
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, from); i < from + len && i < pcm.length; i++) {
    sum += pcm[i] * pcm[i];
    n++;
  }
  return n === 0 ? -Infinity : 10 * Math.log10(sum / n + 1e-20);
};
const heardWithin = (seconds) =>
  side.cues.filter((c) => rmsDb(Math.round(c.s * RATE), Math.round(RATE * seconds)) >= -45);
const heard = heardWithin(0.15).length;
// A cue heard only in the wider window started late; one heard in neither never sounded.
const heardLate = heardWithin(0.4).length - heard;
const overallDb = Math.round(rmsDb(0, pcm.length) * 10) / 10;

// A sustained tone: the share of 50 ms windows in [fromS, fromS + seconds)
// (file time) whose band power reaches -50 dB. The game's own sound stays
// under -46 dB at 2500 Hz (§110d), so a leaked outside tone reads near 100 %
// and its absence near 0; the planted tone is the detector's known positive.
function sustained(hz, fromS, seconds) {
  const win = Math.round(RATE * 0.05);
  const start = Math.round((fromS - audioStart) * RATE);
  let hot = 0;
  let n = 0;
  for (let i = Math.max(0, start); i + win <= Math.min(pcm.length, start + seconds * RATE); i += win) {
    if (goertzel(hz, i, win) >= 1e-5) hot++;
    n++;
  }
  return { hz, fromS: Math.round(fromS * 1000) / 1000, windows: n, sharePct: n === 0 ? null : Math.round((100 * hot) / n) };
}
// --outside=<epochMs>,<seconds>,<hz>: another app's tone, by the wall clock.
const outsideArg = process.argv.find((a) => a.startsWith('--outside='))?.slice(10);
let outsideTone = null;
if (outsideArg) {
  const [epochMs, seconds, hz] = outsideArg.split(',').map(Number);
  const fromS = audioStart + (epochMs - side.started.startEpoch) / 1000;
  outsideTone = { ...sustained(hz, fromS, seconds), control: sustained(side.tone.hz, audioStart + side.tone.fromS, side.tone.seconds) };
}

const report = {
  file,
  container: {
    video: vStream && { codec: vStream.codec_name, size: [vStream.width, vStream.height], rate: vStream.r_frame_rate, frames: Number(vStream.nb_read_frames), start: videoStart },
    audio: aStream && { codec: aStream.codec_name, rate: aStream.sample_rate, start: audioStart },
    seconds: Number(probe.format.duration),
  },
  check1: {
    fps,
    decodedFrames: values.length,
    markerSpan: [first, last],
    slots,
    good,
    duplicates: dup,
    missing,
    missingPct: slots === 0 ? null : Math.round((missing / slots) * 10000) / 100,
    worstJump,
    pass: slots > 0 && missing / slots <= 0.01,
  },
  check2: {
    gameCues: side.cues.length,
    cuesHeard: heard,
    cuesLate: heardLate,
    overallDbfs: overallDb,
    toneDb: { peak: db(tone.peak), median: db(tone.median) },
    toneFound: tone.peak > tone.median * 100,
    toneOnsetS: tone.onsetS,
    flashFrameS: firstFlashFrame < 0 ? null : videoStart + firstFlashFrame / fps,
    avOffsetMs:
      tone.onsetS === null || firstFlashFrame < 0 ? null : Math.round((tone.onsetS - (videoStart + firstFlashFrame / fps)) * 1000),
    band1700Db: { peak: db(outside.peak), median: db(outside.median) },
    audibleTrue: `${side.audibleTrue} of ${side.audibleSamples}`,
    rejections: side.rejections.length,
    outsideTone,
  },
};
console.log(JSON.stringify(report, null, 2));
