// The recorder's main side (§110d, the recorder phase §111).
//
// In offscreen mode every `paint` event hands main the whole composited page,
// the WebGL canvas and the DOM together, as a BGRA bitmap. `startVideo` pipes
// each one into ffmpeg's stdin as one raw frame at the window's frame rate,
// and ffmpeg encodes on the GPU (NVENC). The page records its own audio
// (probes/record-page.js); `mux` joins the two at the measured start offset.
// ffmpeg is a system install on the PATH (README, "Recording clips").
import { spawn, spawnSync } from 'node:child_process';

const nowEpoch = () => performance.timeOrigin + performance.now();

/**
 * The lead-in's geometry, in page pixels from the bottom-left corner (the
 * offscreen page renders at a device pixel ratio of 1). The marker is eight
 * squares counting the page's frames in binary plus a ninth that flashes with
 * the planted tone; the patch row above it shows known colours during the
 * lead-in only. The page draws them from these numbers (passed as options),
 * main samples the paint bitmap at them, and the analyzer crops the file at
 * them.
 */
export const LEAD_IN = {
  square: 24,
  left: 8,
  markerBottom: 8,
  patchBottom: 40,
  /** sRGB patches: the palette's team colours and accents, plus neutrals.
   *  Magenta is the gate: main pipes from the first paint without it. */
  patches: [
    ['green', '#33FF00'],
    ['red', '#FF3131'],
    ['amber', '#FFB000'],
    ['cyan', '#15F4EE'],
    ['blue', '#3D7BFF'],
    ['purple', '#9D00FF'],
    ['white', '#FFFFFF'],
    ['grey', '#808080'],
    ['magenta', '#FF00FF'],
  ],
};

/** The centre of patch `i`, as [x, y] from the top-left of a `height`-tall page. */
export function patchCentre(i, height) {
  const { square, left, patchBottom } = LEAD_IN;
  return [left + i * square + square / 2, height - patchBottom - square / 2];
}

const MAGENTA = LEAD_IN.patches.findIndex(([name]) => name === 'magenta');

/**
 * THE STAMP: the page's clock, in every paint. The page (probes/record-page.js)
 * draws `width` pixels along the bottom row from the left edge, one bit each,
 * white for 1, most significant first: the sync byte, the milliseconds since
 * the go frame (32 bits; `notStarted` before it), the page frame's count (16
 * bits) and a check byte (the six payload bytes XORed). Main reads it from
 * each paint and writes the same row's next `width` pixels over it, so it is
 * never in the file; the game draws a flat field in that corner.
 */
export const STAMP = { width: 64, sync: 0xa5, notStarted: 0xffffffff };

/** How far a paint may sit from its slot before the retime moves it: 25 ms,
 *  or three quarters of a slot where a slot is longer than that. More than
 *  half a slot, so a paint corrected by one slot is not corrected back. */
const RETIME_BAND_MS = 25;

/** Read the stamp from a paint and wipe it. Null when it is not there (the
 *  sync byte or the check byte does not match). */
function takeStamp(bitmap, width, height) {
  const row = (height - 1) * width * 4;
  const byte = (i) => {
    let v = 0;
    for (let b = 0; b < 8; b++) {
      const o = row + (i * 8 + b) * 4;
      v = (v << 1) | (bitmap[o] + bitmap[o + 1] + bitmap[o + 2] > 384 ? 1 : 0);
    }
    return v;
  };
  if (byte(0) !== STAMP.sync) return null;
  const p = [1, 2, 3, 4, 5, 6].map(byte);
  const check = byte(7);
  bitmap.copy(bitmap, row, row + STAMP.width * 4, row + STAMP.width * 8);
  if ((p[0] ^ p[1] ^ p[2] ^ p[3] ^ p[4] ^ p[5]) !== check) return null;
  return { t: ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0, frame: (p[4] << 8) | p[5] };
}

function quantiles(xs) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 100) / 100;
  return { p50: q(0.5), p99: q(0.99), max: q(1) };
}

function run(args) {
  return new Promise((done) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (d) => (stderr += d));
    ff.on('close', (code) => done({ code, stderr: stderr.slice(-2000) }));
  });
}

/**
 * The encode's colour handling. Left alone, ffmpeg converts BGRA to YUV with
 * BT.601 coefficients and tags nothing, and players decode untagged HD video
 * as BT.709: the team green read 36 levels off (§111b's step zero). So the
 * conversion is BT.709, limited range, and every colour field is tagged.
 */
const COLOUR = [
  '-vf',
  'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709',
];

/**
 * How many bytes of frames may wait for ffmpeg. The offscreen window paints in
 * real time whatever ffmpeg does, so a backlog can only be held in memory or
 * dropped; above this cap a frame is dropped and counted (`dropped`), never
 * buffered without limit. 1 GB is about 120 frames at 1080p, four times the
 * largest peak measured (265 MB at 60 fps, §110d), so a recording reaches it
 * only when the encoder stalls.
 */
export const BACKLOG_CAP_MB = 1000;

/**
 * Pipe the window's paints into ffmpeg. With `gate: true` (a clean clip),
 * nothing is written until the lead-in has shown and gone: main waits for a
 * paint with the magenta patch, then writes from the first paint without it,
 * so the clip opens on the frame the page hid the lead-in in. Either way the
 * first paint that shows the patches is sampled, the colours Chromium itself
 * drew (`patchesInPaint`).
 *
 * THE CUT, the gate mirrored: once the lead-in has gone, a paint showing the
 * magenta patch again is the page's sign that the next screen has mounted
 * (probes/record-page.js), and nothing is written from it on (`stats.cut`).
 *
 * THE RETIME: the file plays frame n at n / fps, and the sound in real time,
 * so a page that stalls, or a page frame that never paints, would leave the
 * picture ahead of its sound from then on (a switch of the display stalls the
 * page 0.1-0.3 s each way, 114f). Each paint's stamp says when the page drew
 * it, so main keeps the file on the page's clock: a paint more than the band
 * late for its slot is preceded by the last written frame again, as many
 * times as it is late (`held`, the freeze the page really had), and one that
 * much early is left out (`skipped`). Inside the band nothing is moved, so a
 * steady recording is written exactly as its paints arrive. `retime: false`
 * is the control: the stamp is still read and wiped, and nothing is moved.
 * `marker: true` (a check twin) also reads the marker's count from each paint
 * and counts the paints where the stamp's frame disagrees with it.
 */
export function startVideo(win, { file, fps, width, height, gate = false, backlogCapMB = BACKLOG_CAP_MB, retime = true, marker = false }) {
  const ff = spawn(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${width}x${height}`, '-framerate', String(fps), '-i', '-',
      ...COLOUR,
      '-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23',
      file,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );
  let stderr = '';
  ff.stderr.on('data', (d) => (stderr += d));
  const exited = new Promise((r) => ff.on('close', (code) => r(code)));

  const stats = {
    paints: 0,
    frames: 0,
    heldBeforeGate: 0,
    dropped: 0,
    droppedAt: [],
    wrongSize: 0,
    backlogMaxBytes: 0,
    firstEpoch: null,
    intervals: [],
    paintTimes: [],
    held: 0,
    holds: [],
    skipped: 0,
    skippedAt: [],
    stamped: 0,
    stampUnreadable: 0,
    unplaced: 0,
    markerMismatch: 0,
    patchesInPaint: null,
    cut: null,
    paintsAfterCut: 0,
  };
  const capBytes = backlogCapMB * 1e6;
  let last = null;
  let seenLeadIn = false;
  let leadInGone = false;
  let open = !gate;
  const pixel = (bitmap, [x, y]) => {
    const o = (y * width + x) * 4;
    return [bitmap[o + 2], bitmap[o + 1], bitmap[o]]; // BGRA → RGB
  };
  const slot = 1000 / fps;
  const band = Math.max(RETIME_BAND_MS / slot, 0.75);
  let base = null; // the file frame that time zero (the go frame) falls on
  let lastT = -1;
  let lastWritten = null;
  // One frame to ffmpeg, or dropped and counted when its backlog is over the cap.
  const write = (bitmap) => {
    if (ff.stdin.writableLength + bitmap.length > capBytes) {
      stats.dropped++;
      // Where in the file each drop falls: the index the frame would have had.
      if (stats.droppedAt.length < 1000) stats.droppedAt.push(stats.frames);
      return;
    }
    ff.stdin.write(bitmap);
    stats.frames++;
    stats.paintTimes.push(Math.round((nowEpoch() - stats.firstEpoch) * 10) / 10);
    stats.backlogMaxBytes = Math.max(stats.backlogMaxBytes, ff.stdin.writableLength);
    lastWritten = bitmap;
  };
  // How many slots late (positive) or early this paint is for the next frame.
  const deviation = (stamp) => {
    if (stamp === null || stamp.t === STAMP.notStarted || stamp.t < lastT) return null;
    lastT = stamp.t;
    if (base === null) base = stats.frames;
    return base + (stamp.t * fps) / 1000 - stats.frames;
  };
  const hold = (d) => {
    const n = Math.round(d);
    if (stats.holds.length < 1000) stats.holds.push({ atFrame: stats.frames, frames: n });
    for (let i = 0; i < n && lastWritten !== null; i++) {
      write(lastWritten);
      stats.held++;
    }
  };
  const markerCount = (bitmap) => {
    const { square, left, markerBottom } = LEAD_IN;
    let n = 0;
    for (let b = 0; b < 8; b++) {
      const [r, g, bl] = pixel(bitmap, [left + b * square + square / 2, height - markerBottom - square / 2]);
      n = (n << 1) | (r + g + bl > 384 ? 1 : 0);
    }
    return n;
  };
  const onPaint = (_event, _dirty, image) => {
    const size = image.getSize();
    if (size.width !== width || size.height !== height) {
      stats.wrongSize++;
      return;
    }
    stats.paints++;
    if (stats.cut !== null) {
      stats.paintsAfterCut++;
      return;
    }
    const bitmap = image.toBitmap();
    const [r, g, b] = pixel(bitmap, patchCentre(MAGENTA, height));
    const leadIn = r > 200 && g < 56 && b > 200;
    const stamp = takeStamp(bitmap, width, height);
    if (stamp === null) {
      stats.stampUnreadable++;
      // From the go frame on, a paint without one is written as it came.
      if (base !== null) stats.unplaced++;
    } else {
      stats.stamped++;
      if (marker && markerCount(bitmap) !== (stamp.frame & 255)) stats.markerMismatch++;
    }
    const d = deviation(stamp);
    if (leadIn && !seenLeadIn) {
      seenLeadIn = true;
      stats.patchesInPaint = LEAD_IN.patches.map(([name, hex], i) => ({ name, want: hex, got: pixel(bitmap, patchCentre(i, height)) }));
    }
    if (leadIn && leadInGone) {
      // The cut frame is not written, and the file runs up to its time.
      if (retime && d !== null && d > band) hold(d);
      stats.cut = { atFrame: stats.frames, epoch: nowEpoch() };
      stats.paintsAfterCut++;
      return;
    }
    if (seenLeadIn && !leadIn) leadInGone = true;
    if (!open) {
      if (!leadInGone) {
        stats.heldBeforeGate++;
        return;
      }
      open = true;
    }
    const now = performance.now();
    if (last === null) {
      stats.firstEpoch = nowEpoch();
      stats.mainSkewMs = nowEpoch() - Date.now();
    } else stats.intervals.push(now - last);
    last = now;
    if (retime && d !== null) {
      if (d < -band) {
        stats.skipped++;
        if (stats.skippedAt.length < 1000) stats.skippedAt.push(stats.frames);
        return;
      }
      if (d > band) hold(d);
    }
    write(bitmap);
  };
  win.webContents.on('paint', onPaint);

  return {
    stats,
    async stop() {
      win.webContents.off('paint', onPaint);
      ff.stdin.end();
      const code = await exited;
      return {
        code,
        stderr: stderr.slice(-2000),
        paints: stats.paints,
        frames: stats.frames,
        heldBeforeGate: stats.heldBeforeGate,
        gateOpened: open,
        cutAtFrame: stats.cut?.atFrame ?? null,
        paintsAfterCut: stats.paintsAfterCut,
        dropped: stats.dropped,
        droppedAt: stats.droppedAt,
        // The retime: frames written again before a late paint, and early
        // paints left out. `goAtFrame` is the file frame of the go frame.
        retime: {
          on: retime,
          bandMs: Math.round(band * slot * 10) / 10,
          goAtFrame: base,
          held: stats.held,
          holds: stats.holds,
          longestHoldMs: Math.round(Math.max(0, ...stats.holds.map((h) => h.frames)) * slot),
          skipped: stats.skipped,
          skippedAt: stats.skippedAt,
          stamped: stats.stamped,
          stampUnreadable: stats.stampUnreadable,
          unplaced: stats.unplaced,
          markerMismatch: marker ? stats.markerMismatch : null,
        },
        backlogCapMB,
        wrongSize: stats.wrongSize,
        backlogMaxMB: Math.round(stats.backlogMaxBytes / 1e5) / 10,
        paintIntervalMs: quantiles(stats.intervals),
        paintGapsOver1_5Slots: stats.intervals.filter((d) => d > 1.5 * slot).length,
        // When main received each written frame, in ms from the first.
        paintTimesMs: stats.paintTimes,
        patchesInPaint: stats.patchesInPaint,
      };
    },
  };
}

/**
 * The index of the first video frame whose marker (probes/record-page.js)
 * reads `value`, or -1. A check recording keeps the marker on, so the frame
 * showing the page frame the audio started on locates the audio in the video:
 * an alignment by content, since the two processes' clocks disagree (§110d
 * measured 0.43 s).
 */
export function markerFrame(videoFile, value, height) {
  const { square, left, markerBottom } = LEAD_IN;
  const crop = `crop=${square * 8}:${square}:${left}:${height - markerBottom - square},scale=8:1:flags=area`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', videoFile, '-vf', crop, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], {
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) return -1;
  for (let i = 0; i + 8 <= r.stdout.length; i += 8) {
    let n = 0;
    for (let b = 0; b < 8; b++) n = (n << 1) | (r.stdout[i + b] > 128 ? 1 : 0);
    if (n === (value & 255)) return i / 8;
  }
  return -1;
}

/** Join the video and the page's audio. `offsetS` is where the audio's start
 *  falls in the video: positive delays it, negative trims its head. The page
 *  records audio until main stops it, past the video's last frame, so the
 *  output ends at `durationS`, the video's length. */
export function mux({ video, audio, out, offsetS, durationS }) {
  const place = offsetS >= 0 ? ['-itsoffset', offsetS.toFixed(4)] : ['-ss', (-offsetS).toFixed(4)];
  return run([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', video,
    ...place, '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', durationS.toFixed(4),
    out,
  ]);
}
