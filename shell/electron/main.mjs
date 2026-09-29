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
//   --probe=<name>    boot · store-write · store-read · script · record
//   --value=<text>    what store-write writes
//   --script=<file>   what the script probe runs in the page
//   --record=<base>   record: the output path without extension
//   --record-seconds=<n>  record: stop by then if the battle has not ended (90)
//   --tail-seconds=<n>    record: keep recording this long after it ends (2)
//   --out=<file>      also write the probe's JSON here
//   --shot=<file>     boot: save a PNG of the page
//
// Probes print one JSON line to stdout and exit 0 on success, 1 on a failed
// check, 2 on a timeout, so a Node script can run one and read its answer.
import { app, BrowserWindow, ipcMain, net, protocol } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { firstMarkerFrame, mux, startVideo } from './record.mjs';

const here = dirname(fileURLToPath(import.meta.url));

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

  /** §110d: record the battle to --record=<base> (.video.mp4, .audio.webm,
   *  .mp4 muxed, .json sidecar). Offscreen only: paints are the video. The
   *  page side (probes/record-page.js) routes the game's audio into its own
   *  recording and away from the speakers, and draws the frame marker. */
  async record(win) {
    if (windowMode !== 'offscreen') return { ok: false, result: 'record needs --window=offscreen' };
    const base = resolve(flag('record') ?? 'recording');
    const ready = await runPageScript(win, join(here, 'probes', 'record-page.js'));
    if (ready?.ok !== true) return { ok: false, result: { ready } };

    const video = startVideo(win, { file: `${base}.video.mp4`, fps: frameRate, width: contentW, height: contentH });
    const audible = [];
    const poll = setInterval(() => audible.push(win.webContents.isCurrentlyAudible()), 250);
    const firstFrameBy = Date.now() + 5000;
    while (video.stats.frames === 0 && Date.now() < firstFrameBy) await sleep(20);
    const started = await win.webContents.executeJavaScript('window.__rec110.start()');

    const maxMs = Number(flag('record-seconds') ?? 90) * 1000;
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs && !(await win.webContents.executeJavaScript('window.__rec110.state.ended'))) {
      await sleep(250);
    }
    await sleep(Number(flag('tail-seconds') ?? 2) * 1000);
    const page = await win.webContents.executeJavaScript('window.__rec110.stop()');
    const wallSeconds = (Date.now() - t0) / 1000;
    const videoResult = await video.stop();
    clearInterval(poll);

    writeFileSync(`${base}.audio.webm`, Buffer.from(page.audioBase64, 'base64'));
    // Align by content (the marker's first frame), not by the two processes' clocks.
    const clockOffsetS = (page.startEpoch - video.stats.firstEpoch) / 1000;
    const markerFrame = firstMarkerFrame(`${base}.video.mp4`);
    const offsetS = markerFrame > 0 ? (markerFrame - 1) / frameRate : clockOffsetS;
    const muxed = await mux({ video: `${base}.video.mp4`, audio: `${base}.audio.webm`, out: `${base}.mp4`, offsetS });
    const sidecar = {
      fps: frameRate,
      size: [contentW, contentH],
      offsetS,
      clockOffsetS,
      markerFrame,
      skewMs: { main: video.stats.mainSkewMs, page: started.pageSkewMs },
      wallSeconds,
      started,
      pageFrames: page.frames,
      flashFrames: page.flashFrames,
      tone: page.tone,
      cues: page.cues,
      rejections: page.rejections,
      ctxState: page.ctxState,
      battleEnded: page.ended,
      audibleSamples: audible.length,
      audibleTrue: audible.filter(Boolean).length,
      video: videoResult,
      mux: muxed,
    };
    writeFileSync(`${base}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);
    const { cues, ...brief } = sidecar;
    return { ok: videoResult.code === 0 && muxed.code === 0, result: { ...brief, cueCount: cues.length } };
  },
};

/** Run a page-script file: one `export default async function`, so it lints
 *  as a module; the export is stripped and the function called in the page. */
function runPageScript(win, file) {
  const source = readFileSync(resolve(file), 'utf8').replace(/^export default /m, '');
  return win.webContents.executeJavaScript(`(${source})()`);
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
