// The recorder's main side (§110d, a first draft for the recorder phase).
//
// In offscreen mode every `paint` event hands main the whole composited page,
// the WebGL canvas and the DOM together, as a BGRA bitmap. `startVideo` pipes
// each one into ffmpeg's stdin as one raw frame at the window's frame rate,
// and ffmpeg encodes on the GPU (NVENC). The page records its own audio
// (probes/record-page.js); `mux` joins the two at the measured start offset.
// ffmpeg is a system install on the PATH (the kickoff's call 3).
import { spawn, spawnSync } from 'node:child_process';

const nowEpoch = () => performance.timeOrigin + performance.now();

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

export function startVideo(win, { file, fps, width, height }) {
  const ff = spawn(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${width}x${height}`, '-framerate', String(fps), '-i', '-',
      '-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23', '-pix_fmt', 'yuv420p',
      file,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  );
  let stderr = '';
  ff.stderr.on('data', (d) => (stderr += d));
  const exited = new Promise((r) => ff.on('close', (code) => r(code)));

  const stats = { frames: 0, wrongSize: 0, backlogMaxBytes: 0, firstEpoch: null, intervals: [] };
  let last = null;
  const onPaint = (_event, _dirty, image) => {
    const size = image.getSize();
    if (size.width !== width || size.height !== height) {
      stats.wrongSize++;
      return;
    }
    const now = performance.now();
    if (last === null) {
      stats.firstEpoch = nowEpoch();
      stats.mainSkewMs = nowEpoch() - Date.now();
    }
    else stats.intervals.push(now - last);
    last = now;
    ff.stdin.write(image.toBitmap());
    stats.frames++;
    stats.backlogMaxBytes = Math.max(stats.backlogMaxBytes, ff.stdin.writableLength);
  };
  win.webContents.on('paint', onPaint);

  return {
    stats,
    async stop() {
      win.webContents.off('paint', onPaint);
      ff.stdin.end();
      const code = await exited;
      const slot = 1000 / fps;
      return {
        code,
        stderr: stderr.slice(-2000),
        frames: stats.frames,
        wrongSize: stats.wrongSize,
        backlogMaxMB: Math.round(stats.backlogMaxBytes / 1e5) / 10,
        paintIntervalMs: quantiles(stats.intervals),
        paintGapsOver1_5Slots: stats.intervals.filter((d) => d > 1.5 * slot).length,
      };
    },
  };
}

/**
 * The video frame that first shows the page's frame 1 on the marker
 * (probes/record-page.js), or -1. The page's audio recording starts on the
 * frame before, so this index over the rate is the audio's offset in the
 * video: an alignment by content, since the two processes' clocks disagree
 * (§110d measured 0.43 s).
 */
export function firstMarkerFrame(videoFile) {
  const SQUARE = 24;
  const crop = `crop=${SQUARE * 8}:${SQUARE}:8:ih-${SQUARE + 8},scale=8:1:flags=area`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', videoFile, '-vf', crop, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], {
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) return -1;
  for (let i = 0; i + 8 <= r.stdout.length; i += 8) {
    let n = 0;
    for (let b = 0; b < 8; b++) n = (n << 1) | (r.stdout[i + b] > 128 ? 1 : 0);
    if (n === 1) return i / 8;
  }
  return -1;
}

/** Join the video and the page's audio; `offsetS` is how much later the audio started. */
export function mux({ video, audio, out, offsetS }) {
  return run([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', video,
    '-itsoffset', offsetS.toFixed(3), '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    out,
  ]);
}
