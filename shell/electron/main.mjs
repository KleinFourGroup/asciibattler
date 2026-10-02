// The Electron shell (Round 8's shell spike, §110): the production build in a
// desktop window, with its store kept as a file under `userData`.
//
//   npm run shell                          play the build in a window
//   npm run shell -- --probe=<name> ...    run one probe, print JSON, exit
//
// Flags (all optional):
//   --dist=<dir>      the build to load (default: the repo's dist/)
//   --load=file|app   file:// or the registered app:// scheme (default: app)
//   --url=<url>       load this instead of a build (e.g. the dev server's fixture)
//   --window=shown|hidden|offscreen
//                     shown by default when playing, hidden for a probe;
//                     hidden = never shown, background throttling off;
//                     offscreen = Electron's offscreen rendering, never shown
//   --size=<w>x<h>    the page's content size (default 1280x720)
//   --frame-rate=<n>  offscreen: the paint rate (default 60)
//   --timeout=<ms>    a probe's time limit (default 60000)
//   --switches=<a,b>  Chromium switches to append (no leading dashes)
//   --muted           mute the page's output (webContents.setAudioMuted)
//   --profile=<dir>   the userData directory (a fresh one is the store's control)
//   --probe=<name>    boot · store-write · store-read · script · kit · record
//   --value=<text>    what store-write writes
//   --script=<file>   what the script and kit probes run in the page
//   --arg=<json>      kit: the script's argument
//   --record=<base>   record: the output path without extension
//   --enter           record: enter the run's root battle (a seed opened by run
//                     dials alone; a board fixture enters its own)
//   --check           record: the analyzer's twin (the marker all through, the
//                     planted tone, the lead-in kept) instead of a clean clip
//   --countdown=full|skip  record: open on the whole pre-battle countdown
//                     (full, the default) or on the fight (skip)
//   --backlog-cap-mb=<n>  record: frames waiting for ffmpeg above this are
//                     dropped and counted (record.mjs, BACKLOG_CAP_MB)
//   --retime=off      record: a control, write each paint as it arrives
//                     (record.mjs, THE RETIME)
//   --plant-stall=<s>:<ms>[,...]  record: a control, block the page for <ms>
//                     at <s> seconds after the go frame (its last frame is
//                     painted again meanwhile, so no time is lost)
//   --plant-pause=<s>:<ms>[,...]  record: a control, stop the window painting
//                     for <ms> at about <s> seconds after the go frame (no
//                     paint arrives meanwhile, as when the display switches)
//   --journal=<file>  record: replay this run journal (one seed-started
//                     segment, played to its end) and record the whole run;
//                     --url must open the journal's seed and dials
//                     (probes/replay-page.js)
//   --speed=<n>       record, with --journal: the battles' playback speed (1)
//   --max-gap=<s>     record, with --journal: the longest wait between two
//                     commands outside a battle (default: as the journal has it)
//   --record-seconds=<n>  record: stop by then if the battle has not ended (90)
//   --tail-seconds=<n>    record: the fallback, if no next screen cuts the
//                     clip: stop this long after the battle ends (5)
//   --out=<file>      also write the probe's JSON here
//   --shot=<file>     boot: save a PNG of the page
//
// Probes print one JSON line to stdout and exit 0 on success, 1 on a failed
// check, 2 on a timeout, so a Node script can run one and read its answer.
import { app, BrowserWindow, ipcMain, net, protocol } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { faultsOf } from './faults.mjs';
import { LEAD_IN, markerFrame, mux, STAMP, startVideo } from './record.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The recording's sound is placed this much later than its measured start.
 * In a recording the sound sits 0-15 ms ahead of its picture (§111e), where
 * live play puts it after; an A/B by ear heard no difference from 0 to
 * 100 ms (§111f), so the sound goes slightly after its picture, as in play.
 */
const SOUND_DELAY_MS = 25;

/** How long a run's clip stays on the end screen before it is cut. */
const RUN_TAIL_MS = 3000;

function flag(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

const distDir = resolve(flag('dist') ?? join(here, '..', '..', 'dist'));
const loadMode = flag('load') ?? 'app';
const probeName = flag('probe');
const PROBE_TIMEOUT_MS = Number(flag('timeout') ?? 60_000);
const pageUrl = flag('url');
const windowMode = flag('window') ?? (probeName === undefined ? 'shown' : 'hidden');
const [contentW, contentH] = (flag('size') ?? '1280x720').split('x').map(Number);
const frameRate = Number(flag('frame-rate') ?? 60);
let paints = 0;

const profile = flag('profile');
if (profile !== undefined) app.setPath('userData', resolve(profile));

// Chromium switches, appended before `ready` (the spike tries the
// anti-throttling set on a never-shown window).
const switches = (flag('switches') ?? '').split(',').filter(Boolean);
for (const s of switches) app.commandLine.appendSwitch(s);

// The app:// scheme serves dist/ from a real origin. It must be registered as
// privileged before `ready`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

// --- the store file --------------------------------------------------------

const storeFile = () => join(app.getPath('userData'), 'store.json');

ipcMain.on('shell-store:read', (event) => {
  const file = storeFile();
  event.returnValue = existsSync(file) ? readFileSync(file, 'utf8') : null;
});

ipcMain.handle('shell-store:write', (_event, text) => {
  const file = storeFile();
  mkdirSync(dirname(file), { recursive: true });
  // Write beside, then rename, so a crash mid-write leaves the old file whole.
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, file);
  return true;
});

// --- the window ------------------------------------------------------------

function serveDist() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const target = resolve(join(distDir, decodeURIComponent(pathname)));
    if (target !== distDir && !target.startsWith(distDir + sep)) {
      return new Response('outside dist', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: contentW,
    height: contentH,
    useContentSize: true,
    // A probe's shown window opens inactive (below), so it never takes focus.
    show: windowMode === 'shown' && probeName === undefined,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // A window that is never shown must not be throttled like a background tab.
      backgroundThrottling: false,
      offscreen: windowMode === 'offscreen',
    },
  });
  win.setMenuBarVisibility(false);
  // Hiding the menu bar hands its height to the page; size the content after.
  win.setContentSize(contentW, contentH);
  if (windowMode === 'shown' && probeName !== undefined) win.showInactive();
  if (windowMode === 'offscreen') {
    win.webContents.setFrameRate(frameRate);
    win.webContents.on('paint', () => {
      paints++;
    });
  }
  return win;
}

function load(win) {
  if (pageUrl !== undefined) return win.loadURL(pageUrl);
  if (loadMode === 'file') return win.loadFile(join(distDir, 'index.html'));
  return win.loadURL('app://game/index.html');
}

// --- probes ----------------------------------------------------------------

/** Console lines at warning level and above, and failed loads, for the report. */
function watch(win) {
  const log = { console: [], failedLoads: [] };
  win.webContents.on('console-message', (event, level, message, line, source) => {
    // Electron 35+ passes one event object; older versions pass positional args.
    const lvl = event.level ?? level;
    const msg = event.message ?? message;
    const where = `${event.sourceId ?? source}:${event.lineNumber ?? line}`;
    if (lvl === 'warning' || lvl === 'error' || lvl === 2 || lvl === 3) {
      log.console.push(`${lvl} ${msg} (${where})`);
    }
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log.failedLoads.push(`${code} ${desc} ${url}`);
  });
  return log;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A control's list, `<s>:<ms>[,<s>:<ms>...]`, as [seconds, ms] pairs. */
const plantList = (name) =>
  (flag(name) ?? '')
    .split(',')
    .filter(Boolean)
    .map((s) => s.split(':').map(Number));

async function pollPage(win, expr, timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await win.webContents.executeJavaScript(expr)) return true;
    await sleep(250);
  }
  return false;
}

const probes = {
  /** Did the build boot: the UI mounted, the canvas sized, no errors. */
  async boot(win) {
    const mounted = await pollPage(win, `(document.querySelector('#ui')?.childElementCount ?? 0) > 0`, 20_000);
    const page = await win.webContents.executeJavaScript(`({
      origin: location.origin,
      href: location.href,
      uiChildren: document.querySelector('#ui')?.childElementCount ?? 0,
      canvas: (() => { const c = document.querySelector('#game-canvas'); return c ? [c.width, c.height] : null; })(),
      fontsStatus: document.fonts.status,
      shellStore: typeof window.shellStore,
    })`);
    const shot = flag('shot');
    if (shot !== undefined) writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
    return { ok: mounted, result: page };
  },

  /** Read what the preload saw, then write --value through the bridge. */
  async 'store-write'(win) {
    const value = flag('value') ?? '';
    const before = await win.webContents.executeJavaScript('window.shellStore?.initial ?? null');
    const wrote = await win.webContents.executeJavaScript(
      `window.shellStore.write(${JSON.stringify(value)})`,
    );
    return { ok: wrote === true, result: { initialBefore: before, wrote: value, file: storeFile() } };
  },

  /** What the preload handed the page at boot. */
  async 'store-read'(win) {
    const initial = await win.webContents.executeJavaScript('window.shellStore?.initial ?? null');
    return { ok: true, result: { initial, file: storeFile() } };
  },

  /** Run --script=<file> in the page (see runPageScript). Its value is the
   *  result, and `{ ok: false }` fails. */
  async script(win) {
    const file = flag('script');
    if (file === undefined) return { ok: false, result: 'script needs --script=<file>' };
    const result = await runPageScript(win, file);
    return { ok: result?.ok !== false, result };
  },

  /** The probe runner's probe (probe-cli.mjs, §112d): wait for the probe kit
   *  (`window.__probe`, a development-mode build's), pass `__probe.ready()`,
   *  then run --script=<file> as the script probe does, with --arg=<json> as
   *  its argument. A page error comes back by its message, and a result of
   *  `{ ok: false }` fails. */
  async kit(win) {
    const file = flag('script');
    if (file === undefined) return { ok: false, result: 'kit needs --script=<file>' };
    const installed = await pollPage(win, 'window.__probe?.live === true', 30_000);
    if (!installed) return { ok: false, result: 'no window.__probe within 30 s: is this a development-mode build?' };
    const caught = (expr) =>
      `Promise.resolve().then(() => ${expr}).then((value) => ({ value }), (e) => ({ error: String((e && e.message) || e) }))`;
    const ready = await win.webContents.executeJavaScript(caught('window.__probe.ready()'));
    if (ready.error !== undefined) return { ok: false, result: { ready: ready.error } };
    const source = readFileSync(resolve(file), 'utf8').replace(/^export default /m, '');
    const ran = await win.webContents.executeJavaScript(caught(`(${source})(${flag('arg') ?? '{}'})`));
    if (ran.error !== undefined) return { ok: false, result: { ready: ready.value, error: ran.error } };
    return { ok: ran.value?.ok !== false, result: { ready: ready.value, script: ran.value } };
  },

  /** Record the battle to --record=<base> (.video.mp4, .audio.webm, .mp4
   *  muxed, .json sidecar). Offscreen only: paints are the video. The page
   *  side (probes/record-page.js) routes the game's audio into its own
   *  recording and away from the speakers, and draws the lead-in; a clean
   *  clip starts on the frame after it, a --check twin keeps it all. Either
   *  ends before the paint that shows the next screen. */
  async record(win) {
    if (windowMode !== 'offscreen') return { ok: false, result: 'record needs --window=offscreen' };
    const base = resolve(flag('record') ?? 'recording');
    const check = process.argv.includes('--check');
    const leadInFrames = Math.max(10, Math.round(frameRate * 0.5));
    // A run from its journal: the replay driver is installed as a function,
    // and the page script makes one from it.
    const journalFile = flag('journal');
    let journal;
    if (journalFile !== undefined) {
      const maxGapS = flag('max-gap');
      journal = {
        segment: JSON.parse(readFileSync(resolve(journalFile), 'utf8')).segments[0],
        speed: Number(flag('speed') ?? 1),
        tailMs: RUN_TAIL_MS,
        ...(maxGapS === undefined ? {} : { maxGapMs: Number(maxGapS) * 1000 }),
      };
      const driver = readFileSync(join(here, 'probes', 'replay-page.js'), 'utf8').replace(/^export default /m, '');
      await win.webContents.executeJavaScript(`window.__replayDriver = ${driver}; true`);
    }
    const ready = await runPageScript(win, join(here, 'probes', 'record-page.js'), {
      ...(journal === undefined ? {} : { journal }),
      enter: process.argv.includes('--enter'),
      check,
      countdown: flag('countdown') ?? 'full',
      leadIn: LEAD_IN,
      leadInFrames,
      stamp: STAMP,
      stalls: plantList('plant-stall').map(([atS, ms]) => ({ atS, ms })),
    });
    if (ready?.ok !== true) return { ok: false, result: { ready } };

    const cap = flag('backlog-cap-mb');
    const video = startVideo(win, {
      file: `${base}.video.mp4`,
      fps: frameRate,
      width: contentW,
      height: contentH,
      gate: !check,
      retime: flag('retime') !== 'off',
      marker: check,
      ...(cap === undefined ? {} : { backlogCapMB: Number(cap) }),
    });
    const audible = [];
    const poll = setInterval(() => audible.push(win.webContents.isCurrentlyAudible()), 250);
    // Paints, not written frames: a clean clip writes none until the lead-in is over.
    const firstPaintBy = Date.now() + 5000;
    while (video.stats.paints === 0 && Date.now() < firstPaintBy) await sleep(20);
    const started = await win.webContents.executeJavaScript('window.__rec110.start()');
    for (const [atS, ms] of plantList('plant-pause')) {
      setTimeout(() => {
        win.webContents.stopPainting();
        setTimeout(() => win.webContents.startPainting(), ms);
      }, (leadInFrames / frameRate + atS) * 1000);
    }

    // Until the cut (the next screen's first paint; a run's: its end screen's
    // tail), or the fallback after the battle or the run ends, or the time
    // limit.
    const maxMs = Number(flag('record-seconds') ?? 90) * 1000;
    const tailMs = Number(flag('tail-seconds') ?? 5) * 1000 + (journal === undefined ? 0 : RUN_TAIL_MS);
    const t0 = Date.now();
    let endedAt = null;
    let endedBy = 'the time limit';
    while (Date.now() - t0 < maxMs) {
      if (video.stats.cut !== null) {
        endedBy = journal === undefined ? 'the next screen' : 'the run\'s end';
        break;
      }
      if (endedAt === null && (await win.webContents.executeJavaScript('window.__rec110.state.ended'))) endedAt = Date.now();
      if (endedAt !== null && Date.now() - endedAt >= tailMs) {
        endedBy = 'the fallback';
        break;
      }
      await sleep(50);
    }
    const videoResult = await video.stop();
    const page = await win.webContents.executeJavaScript('window.__rec110.stop()');
    const wallSeconds = (Date.now() - t0) / 1000;
    clearInterval(poll);

    writeFileSync(`${base}.audio.webm`, Buffer.from(page.audioBase64, 'base64'));
    // Align by content, not by the two processes' clocks: the audio starts in
    // the go frame's callback, so it starts on the video frame showing that
    // callback's change. A check twin finds that frame by its marker count; a
    // clean clip opens on it (the gate). (§110d started the audio just before
    // a callback and placed it one frame earlier; placing this one the same
    // way read the tone 34 ms early instead of 18, §111b.)
    const clockOffsetS = (page.startEpoch - video.stats.firstEpoch) / 1000;
    const goVideoFrame = check ? markerFrame(`${base}.video.mp4`, page.goFrame, contentH) : 0;
    const offsetS = (goVideoFrame >= 0 ? goVideoFrame / frameRate : clockOffsetS) + SOUND_DELAY_MS / 1000;
    const durationS = videoResult.frames / frameRate;
    const muxed = await mux({ video: `${base}.video.mp4`, audio: `${base}.audio.webm`, out: `${base}.mp4`, offsetS, durationS });
    const tl = timeline(page, videoResult, goVideoFrame);
    const cut = page.cut === null && videoResult.cutAtFrame === null ? null : { page: page.cut, atFrame: videoResult.cutAtFrame };
    const faults = faultsOf({ timeline: tl, cut, endedBy, retime: videoResult.retime, replay: page.replay }, tailMs / 1000);
    const sidecar = {
      mode: check ? 'check' : 'clean',
      replay: page.replay,
      opening: page.opening,
      countdownFrom: page.countdownFrom,
      fps: frameRate,
      size: [contentW, contentH],
      leadIn: { ...LEAD_IN, frames: leadInFrames },
      soundDelayMs: SOUND_DELAY_MS,
      offsetS,
      audioTrimS: Math.max(0, -offsetS),
      endedBy,
      cut,
      timeline: tl,
      faults,
      durationS,
      startEpoch: page.startEpoch,
      clockOffsetS,
      goVideoFrame,
      skewMs: { main: video.stats.mainSkewMs, page: started.pageSkewMs },
      wallSeconds,
      started,
      pageFrames: page.frames,
      pageFrameTimesMs: page.frameTimesMs,
      flashFrames: page.flashFrames,
      flashStarts: page.flashStarts,
      tone: page.tone,
      cues: page.cues,
      cuesAfterCut: page.cuesAfterCut,
      boxShownAtGo: page.boxShownAtGo,
      rejections: page.rejections,
      ctxState: page.ctxState,
      battleEnded: page.ended,
      audibleSamples: audible.length,
      audibleTrue: audible.filter(Boolean).length,
      video: videoResult,
      mux: muxed,
    };
    writeFileSync(`${base}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);
    // The printed line leaves the long lists to the sidecar.
    const cues = sidecar.cues;
    const brief = { ...sidecar, video: { ...videoResult } };
    for (const list of ['cues', 'pageFrameTimesMs']) delete brief[list];
    delete brief.video.paintTimesMs;
    // Every battle plays cues, so none logged means the play() wrap caught
    // nothing (a moved seam) and the file's sound can't be checked.
    const problems = [
      !videoResult.gateOpened && 'the lead-in never showed and went, so no frame was written',
      videoResult.code !== 0 && 'ffmpeg (video) failed',
      muxed.code !== 0 && 'ffmpeg (mux) failed',
      cues.length === 0 && 'no cues logged: the AudioPlayer.play wrap caught nothing (seam moved?)',
    ].filter(Boolean);
    return { ok: problems.length === 0, result: { ...brief, cueCount: cues.length, problems } };
  },
};

/**
 * Does the file's picture keep real time? The file plays frame n at n / fps,
 * and the sound in real time; the page's frame clock (the rAF times of the go
 * and cut frames) says when the cut frame really came. `driftMs` is how far
 * the picture has run ahead of its sound by the cut, beyond the fixed delay.
 * `framesShort` is how many frames the file is short of the page between the
 * go frame and the cut: page frames that never reached main as a paint, each
 * a frame of time the file leaves out, less paints that repeated a page frame
 * (a hitch). A check twin's marker reads the same count from the file (its
 * missing frames less its repeats). Both sides count from the go frame, the
 * file's frame `goVideoFrame` (0 in a clean clip; a check twin keeps what
 * came before it). Null without a cut, whose frame is the only one both
 * sides know.
 *
 * With the retime (record.mjs) the file holds frames main wrote again and
 * lacks paints it left out, so the paints that reached main are the file's
 * frames less those held, plus those skipped, and `framesShort` is counted
 * against that. The drift then says whether the retime kept the file on the
 * page's clock, and `holds` is each freeze it wrote, in file time from the
 * go frame.
 */
function timeline(page, videoResult, goVideoFrame) {
  if (page.cut === null || videoResult.cutAtFrame === null || goVideoFrame < 0) return null;
  const pageFrames = page.cut.pageFrame - page.goFrame;
  const fileFrames = videoResult.cutAtFrame - goVideoFrame;
  const { held, skipped, holds } = videoResult.retime;
  const fileS = fileFrames / frameRate;
  return {
    pageFrames,
    fileFrames,
    framesShort: pageFrames - (fileFrames - held + skipped),
    held,
    skipped,
    holds: holds.map((h) => ({ atS: Math.round(((h.atFrame - goVideoFrame) / frameRate) * 1000) / 1000, ms: Math.round((h.frames * 1000) / frameRate) })),
    pageS: page.cut.s,
    fileS: Math.round(fileS * 1000) / 1000,
    pageFps: Math.round((pageFrames / page.cut.s) * 1000) / 1000,
    driftMs: Math.round((page.cut.s - fileS) * 1000),
    longFrames: page.longFrames,
  };
}

/** Run a page-script file: one `export default async function`, so it lints
 *  as a module; the export is stripped and the function called in the page
 *  with `opts` (JSON) as its argument. */
function runPageScript(win, file, opts = {}) {
  const source = readFileSync(resolve(file), 'utf8').replace(/^export default /m, '');
  return win.webContents.executeJavaScript(`(${source})(${JSON.stringify(opts)})`);
}

function report(out, code) {
  const text = JSON.stringify(out);
  process.stdout.write(`${text}\n`);
  const file = flag('out');
  if (file !== undefined) writeFileSync(file, `${text}\n`);
  app.exit(code);
}

async function runProbe(win) {
  const probe = probes[probeName];
  if (probe === undefined) {
    report({ probe: probeName, ok: false, error: `unknown probe; known: ${Object.keys(probes).join(', ')}` }, 1);
    return;
  }
  const log = watch(win);
  if (process.argv.includes('--muted')) win.webContents.setAudioMuted(true);
  const audible = [];
  const audiblePoll = setInterval(() => audible.push(win.webContents.isCurrentlyAudible()), 250);
  const timer = setTimeout(() => report({ probe: probeName, load: loadMode, ok: false, error: 'timeout', ...log }, 2), PROBE_TIMEOUT_MS);
  try {
    await load(win);
    const { ok, result } = await probe(win);
    clearTimeout(timer);
    clearInterval(audiblePoll);
    const shell = {
      window: windowMode,
      content: win.getContentSize(),
      switches: switches.map((s) => [s, app.commandLine.hasSwitch(s)]),
      paints: windowMode === 'offscreen' ? paints : null,
      muted: win.webContents.isAudioMuted(),
      audible: `${audible.filter(Boolean).length} of ${audible.length}`,
      gpuFeatureStatus: app.getGPUFeatureStatus(),
      gpuDevices: (await app.getGPUInfo('basic')).gpuDevice,
    };
    report({ probe: probeName, load: pageUrl ?? loadMode, ok, result, shell, ...log }, ok ? 0 : 1);
  } catch (err) {
    clearTimeout(timer);
    report({ probe: probeName, load: loadMode, ok: false, error: String(err), ...log }, 1);
  }
}

app.whenReady().then(() => {
  serveDist();
  const win = createWindow();
  if (probeName !== undefined) void runProbe(win);
  else void load(win);
});

app.on('window-all-closed', () => app.quit());
