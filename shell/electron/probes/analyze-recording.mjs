// Read a recording back from the FILE, through ffprobe and ffmpeg's decoders,
// never through the code that wrote it (the recorder's exit re-runs this).
// Usage: node analyze-recording.mjs <base> [--outside=<epochMs>,<seconds>,<hz>]
// (reads <base>.mp4 and the <base>.json sidecar the record probe wrote)
//
// Both kinds of recording (the sidecar's `mode`):
// - THE MARKER: the eight marker squares (probes/record-page.js) are cropped
//   and averaged per frame. A frame is marker-like when every square is near
//   black or white and one is white; with the magenta patch, that counts the
//   frames still showing the lead-in or the marker.
// - THE GAME'S SOUND: each logged play() is looked up in the file's audio; a
//   cue is heard if the 150 ms after it reaches -45 dBFS, late if only the
//   400 ms after it does.
// A check twin (`--check`), which keeps the marker all through:
// - FRAMES: the marker's count per frame; over the span where it moves, a
//   step of 1 is a good frame, 0 a duplicate, and n > 1 means n - 1 frames
//   never reached the file. Check 1 passes at no more than 1 % missing.
// - THE TONE: a Goertzel filter at the planted frequency finds its onset;
//   the ninth square's first white frame is the video's side, so their
//   difference is the file's audio-to-video offset.
// - THE COLOURS: a lead-in frame is decoded as a player decodes it (the
//   file's matrix tag, or BT.709 when untagged, as players assume for HD) and
//   each patch compared with its hex.
// A clean clip passes when no frame is marker-like or shows the patch row.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2];
if (!base) throw new Error('usage: node analyze-recording.mjs <base>');
const side = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
const file = `${base}.mp4`;
const mode = side.mode ?? 'check';
const geo = side.leadIn ?? { square: 24, left: 8, markerBottom: 8, patchBottom: 40, patches: [], frames: 0 };
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
const H = vStream.height;
const tags = { range: vStream.color_range ?? null, matrix: vStream.color_space ?? null, primaries: vStream.color_primaries ?? null, transfer: vStream.color_transfer ?? null };

// --- the marker and the patch row, per frame -------------------------------
const { square: SQ, left: LEFT } = geo;
const markerY = H - geo.markerBottom - SQ;
const gray = tool('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v', '-vf', `crop=${SQ * 9}:${SQ}:${LEFT}:${markerY},scale=9:1:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
const values = [];
const flash = [];
let markerLike = 0;
for (let i = 0; i + 9 <= gray.length; i += 9) {
  let n = 0;
  let pure = true;
  let white = false;
  for (let b = 0; b < 8; b++) {
    const v = gray[i + b];
    n = (n << 1) | (v > 128 ? 1 : 0);
    if (v > 223) white = true;
    else if (v >= 32) pure = false;
  }
  if (pure && white) markerLike++;
  values.push(n);
  flash.push(gray[i + 8] > 128);
}
const magentaAt = geo.patches.findIndex(([name]) => name === 'magenta');
let patchFrames = 0;
if (magentaAt >= 0) {
  const patchY = H - geo.patchBottom - SQ;
  const rgb = tool('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v', '-vf', `crop=${SQ}:${SQ}:${LEFT + magentaAt * SQ}:${patchY},scale=1:1:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  for (let i = 0; i + 3 <= rgb.length; i += 3) if (rgb[i] > 200 && rgb[i + 1] < 56 && rgb[i + 2] > 200) patchFrames++;
}

// --- check 1: continuity (a check twin) ------------------------------------
let check1 = null;
if (mode === 'check') {
  const first = values.findIndex((v) => v !== 0);
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
  // The marker counts from page frame 1, so a first visible count above 1
  // means the frames before it never reached the file (§111c: the encoder's
  // start-up, with a low cap, lost lead-in frames 1-7 unseen).
  const missingBeforeFirst = first >= 0 ? values[first] - 1 : 0;
  missing += missingBeforeFirst;
  const slots = good + dup + missing;
  check1 = { fps, decodedFrames: values.length, markerSpan: [first, last], slots, good, duplicates: dup, missing, missingBeforeFirst, missingPct: slots === 0 ? null : Math.round((missing / slots) * 10000) / 100, worstJump, pass: slots > 0 && missing / slots <= 0.01 };
}

// --- the colours (a check twin: the lead-in is in the file) ----------------
let colour = null;
if (mode === 'check' && geo.patches.length > 0) {
  const mid = values.findIndex((v) => v === Math.floor(geo.frames / 2));
  if (mid >= 0) {
    const matrix = tags.matrix === 'smpte170m' || tags.matrix === 'bt470bg' ? 'bt601' : 'bt709';
    const range = tags.range === 'pc' ? 'pc' : 'tv';
    const W = vStream.width;
    const frame = tool('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v', '-vf', `select=eq(n\\,${mid}),scale=in_color_matrix=${matrix}:in_range=${range}:out_range=pc,format=rgb24`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const patchY = H - geo.patchBottom - SQ;
    const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    const patches = geo.patches.map(([name, h], i) => {
      let sum = [0, 0, 0];
      let n = 0;
      for (let y = patchY + 6; y < patchY + SQ - 6; y++)
        for (let x = LEFT + i * SQ + 6; x < LEFT + (i + 1) * SQ - 6; x++) {
          const o = (y * W + x) * 3;
          sum = [sum[0] + frame[o], sum[1] + frame[o + 1], sum[2] + frame[o + 2]];
          n++;
        }
      const got = sum.map((v) => Math.round(v / n));
      const want = hex(h);
      return { name, want: h, got: got.join(','), err: Math.max(...got.map((v, k) => Math.abs(v - want[k]))) };
    });
    const maxErr = Math.max(...patches.map((p) => p.err));
    colour = { frame: mid, decodedAs: `${matrix} ${range}`, maxErr, pass: maxErr <= 6, patches };
  }
}

// --- audio -----------------------------------------------------------------
const pcmBuf = tool('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
const pcm = new Float32Array(pcmBuf.buffer, pcmBuf.byteOffset, pcmBuf.byteLength / 4);
const audioStart = Number(aStream?.start_time ?? 0);
const videoStart = Number(vStream?.start_time ?? 0);
// A cue's time is from the audio recording's start, which the mux placed at
// `offsetS` in the file (a negative offset trims the audio's head instead).
// The decode's first sample is at the stream's start_time, which sits one
// AAC priming frame (about 21 ms) before the placed start, so a cue's sample
// is counted from there (§111e: a click at a known time, through this mux,
// decoded here, lands exactly on its file time only this way).
const trim = side.audioTrimS ?? 0;
const placed = Math.max(0, side.offsetS ?? 0);
const sampleAt = (s) => Math.round((placed + s - trim - audioStart) * RATE);

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
// A cue's onset: the delay from its logged play() to its sound's rise in the
// file, the first 2 ms step from 50 ms before the cue that reaches -45 dBFS
// and stands 10 dB over the 20 ms that ended 10 ms before it. Only quiet
// starts count (that floor under -50 dBFS, no other cue in the 300 ms
// before), since a rise inside other sound can't be placed. The planted
// tone, scheduled on the audio clock 3 s after the audio's start, is the
// detector's known answer (`toneOnsetMs`, near 0).
const STEP = Math.round(RATE * 0.002);
function onsetMs(s) {
  const at = sampleAt(s);
  const floor = rmsDb(at - Math.round(RATE * 0.03), Math.round(RATE * 0.02));
  if (floor >= -50) return null;
  for (let i = at - Math.round(RATE * 0.05); i < at + Math.round(RATE * 0.4); i += STEP) {
    const level = rmsDb(i, STEP);
    if (level >= -45 && level >= floor + 10) return Math.round(((i - at) / RATE) * 1000);
  }
  return null;
}
const quiet = side.cues.filter((c, i) => !side.cues.slice(0, i).some((p) => c.s - p.s < 0.3));
const onsets = quiet.map((c) => ({ key: c.key, ms: onsetMs(c.s) })).filter((o) => o.ms !== null);
const spread = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, p10: q(0.1), median: q(0.5), p90: q(0.9), max: s[s.length - 1] };
};
const byKey = {};
for (const o of onsets) (byKey[o.key] ??= []).push(o.ms);
const cueOnsets = {
  all: spread(onsets.map((o) => o.ms)),
  byKey: Object.fromEntries(Object.entries(byKey).map(([k, v]) => [k, spread(v)])),
  toneOnsetMs: side.tone ? onsetMs(side.tone.fromS) : null,
};

const heardWithin = (seconds) => side.cues.filter((c) => rmsDb(sampleAt(c.s), Math.round(RATE * seconds)) >= -45);
const heard = heardWithin(0.15).length;
// A cue heard only in the wider window started late; one heard in neither never sounded.
const heardLate = heardWithin(0.4).length - heard;
const firstFlashFrame = flash.indexOf(true);

let toneReport = null;
if (side.tone) {
  const tone = band(side.tone.hz);
  toneReport = {
    toneDb: { peak: db(tone.peak), median: db(tone.median) },
    toneFound: tone.peak > tone.median * 100,
    toneOnsetS: tone.onsetS,
    flashFrameS: firstFlashFrame < 0 ? null : videoStart + firstFlashFrame / fps,
    avOffsetMs: tone.onsetS === null || firstFlashFrame < 0 ? null : Math.round((tone.onsetS - (videoStart + firstFlashFrame / fps)) * 1000),
  };
}

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
if (outsideArg && side.tone) {
  const [epochMs, seconds, hz] = outsideArg.split(',').map(Number);
  const startEpoch = side.startEpoch ?? side.started.startEpoch;
  const fromS = audioStart + (epochMs - startEpoch) / 1000;
  outsideTone = { ...sustained(hz, fromS, seconds), control: sustained(side.tone.hz, audioStart + side.tone.fromS, side.tone.seconds) };
}

const leadIn = { markerLikeFrames: markerLike, patchFrames };
const report = {
  file,
  mode,
  container: {
    video: vStream && { codec: vStream.codec_name, size: [vStream.width, vStream.height], rate: vStream.r_frame_rate, frames: Number(vStream.nb_read_frames), start: videoStart, tags },
    audio: aStream && { codec: aStream.codec_name, rate: aStream.sample_rate, start: audioStart },
    seconds: Number(probe.format.duration),
  },
  leadIn: mode === 'clean' ? { ...leadIn, pass: markerLike === 0 && patchFrames === 0 } : leadIn,
  check1,
  colour,
  check2: {
    gameCues: side.cues.length,
    cuesHeard: heard,
    cuesLate: heardLate,
    cueOnsets,
    overallDbfs: Math.round(rmsDb(0, pcm.length) * 10) / 10,
    ...toneReport,
    audibleTrue: `${side.audibleTrue} of ${side.audibleSamples}`,
    rejections: side.rejections.length,
    outsideTone,
  },
};
console.log(JSON.stringify(report, null, 2));
