// The frame-rate probe (§110c; the recorder's exit re-runs it). Run it with
// `--probe=script --script=shell/electron/probes/frame-rate.js` against the
// dev server's live fixture (`--url=http://localhost:5191/?bp=board-live`).
//
// It waits for a live battle, reads the GPU the page's WebGL context reports,
// then for 60 s (or `?probeSeconds=<n>` in the page URL) counts two things:
// the page's animation frames, with their timestamps, and the game's own
// renders, by wrapping `renderTwoPass` on the live Renderer instance (the loop
// calls it through `this`, so the instance property is what it reaches). A
// hitch is a frame interval over 1.5 times the median.
export default async function frameRate() {
  const seconds = Number(new URLSearchParams(location.search).get('probeSeconds') ?? 60);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const battle = () => window.__game?.activeScene?.world ?? null;

  const until = Date.now() + 30_000;
  while (!battle() && Date.now() < until) await sleep(200);
  if (!battle()) return { ok: false, error: 'no live battle within 30 s' };

  const renderer = window.__game.renderer;
  const gl = renderer.webgl.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

  let gameFrames = 0;
  const original = renderer.renderTwoPass;
  renderer.renderTwoPass = function counted(...args) {
    gameFrames++;
    return original.apply(this, args);
  };

  const stamps = [];
  let running = true;
  const tick = (t) => {
    stamps.push(t);
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const t0 = performance.now();
  await sleep(seconds * 1000);
  running = false;
  const elapsed = (performance.now() - t0) / 1000;
  delete renderer.renderTwoPass;

  const intervals = stamps.slice(1).map((t, i) => t - stamps[i]);
  const sorted = [...intervals].sort((a, b) => a - b);
  const q = (p) => (sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]);
  const median = q(0.5);
  const round = (x) => (x === null ? null : Math.round(x * 100) / 100);
  const canvas = renderer.webgl.domElement;
  return {
    ok: stamps.length > 0 && gameFrames > 0,
    gpu,
    seconds: round(elapsed),
    rafFrames: stamps.length,
    rafFps: round(stamps.length / elapsed),
    gameFrames,
    gameFps: round(gameFrames / elapsed),
    intervalMs: { p50: round(median), p95: round(q(0.95)), p99: round(q(0.99)), max: round(q(1)) },
    hitches: median === null ? null : intervals.filter((d) => d > 1.5 * median).length,
    page: {
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
      canvas: [canvas.width, canvas.height],
      dpr: devicePixelRatio,
      inner: [innerWidth, innerHeight],
    },
    battleStillLive: battle() !== null,
  };
}
