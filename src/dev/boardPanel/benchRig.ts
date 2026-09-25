/**
 * 108d — the frame-cost bench's live side (bench.ts is the pure side). One
 * bench frame is the render loop's frame without the scene tick: the
 * BattleRenderer's per-frame update at dt 0 (where the marks table is built),
 * the sort with the explorer's frame hook, the two-pass render, then a
 * one-pixel `readPixels` that waits for the GPU. The sim does not step, so
 * every leg draws the same board. DOM and WebGL glue, verified in the pane
 * and read in Firefox by the user.
 */

import type * as THREE from 'three';
import type { Game } from '../../Game';
import { BIN_DEPTH, MAX_MARKS, markExtent } from '../../render/groundMarks';
import {
  BENCH_DEFAULTS,
  benchChecks,
  median,
  runBench,
  type BenchOptions,
  type BenchReport,
  type BenchRig,
  type BinStats,
} from './bench';
import { internalsOf, liveBattleOf, seamMoved } from './seams';

interface RendererInternals {
  readonly webgl?: THREE.WebGLRenderer;
  readonly renderTwoPass?: () => void;
}

// The planted cost: a xorshift loop whose rate is measured once per bench. The
// result lands in a module variable so the loop cannot be optimized away.
let sink = 1;
function spinUnits(n: number): void {
  let x = sink | 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
  }
  sink = x;
}

/** Spin units per millisecond, timed over at least 100 ms so a coarse clock stays under 1 %. */
function spinRate(): number {
  spinUnits(200_000);
  for (let n = 100_000; ; n *= 2) {
    const t0 = performance.now();
    spinUnits(n);
    const took = performance.now() - t0;
    if (took >= 100) return n / took;
  }
}

/** The median step `performance.now()` takes, ms, over 50 steps (a browser may coarsen and jitter it). */
function clockStep(): number {
  const steps: number[] = [];
  let last = performance.now();
  for (let guard = 0; steps.length < 50 && guard < 5_000_000; guard++) {
    const t = performance.now();
    if (t > last) {
      steps.push(t - last);
      last = t;
    }
  }
  return steps.length > 0 ? median(steps) : Infinity;
}

/** A `RENDERER` string that names the browser, not the GPU (Chromium's). */
const GENERIC_RENDERERS = new Set(['WebKit WebGL']);

/** The GPU's name: `RENDERER` first, and the debug extension only when that is
 *  generic. The user's Firefox run logged a console message at the extension
 *  query (not pasted; most likely a deprecation warning), so the query is
 *  skipped wherever `RENDERER` already reads as a name. Unverified in Firefox:
 *  what its `RENDERER` returns. If the report's GPU line reads generic there,
 *  add that string to the set above. */
function gpuName(gl: WebGL2RenderingContext | WebGLRenderingContext): string {
  const plain: unknown = gl.getParameter(gl.RENDERER);
  if (typeof plain === 'string' && plain !== '' && !GENERIC_RENDERERS.has(plain)) return plain;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : plain;
  return typeof name === 'string' ? name : 'unknown GPU';
}

/** Run the bench on the battle on screen; a string says why it could not. */
export async function runLiveBench(game: Game, options: BenchOptions = BENCH_DEFAULTS): Promise<BenchReport | string> {
  const internals = internalsOf(game);
  const battle = liveBattleOf(game);
  if (!battle) return 'no battle on screen';
  const renderer = internals.renderer as unknown as RendererInternals;
  const webgl = renderer.webgl;
  const renderTwoPass = renderer.renderTwoPass;
  if (!webgl || typeof renderTwoPass !== 'function') {
    seamMoved('Renderer.webgl / Renderer.renderTwoPass');
    return 'seam moved: see the console';
  }
  // A hidden or minimized window draws nothing, so its timings would mean nothing.
  if (webgl.domElement.width === 0 || webgl.domElement.height === 0) return 'the canvas is 0x0 (a hidden window?)';
  const { terrain, sprites } = internals;
  const { world, battleRenderer } = battle;
  const gl = webgl.getContext();
  const pixel = new Uint8Array(4);
  const rate = spinRate();
  const marksWereOn = terrain.groundMarksOn;

  // The stress load: as many extra marks per tile as the table has room for,
  // up to a full bin, each binned into its own tile only.
  const fillBins = (): void => {
    const tiles = world.gridW * world.gridH;
    const perTile = Math.max(0, Math.min(BIN_DEPTH - 1, Math.floor((MAX_MARKS - terrain.markStats.count) / tiles)));
    const extent = markExtent('circle', 1, terrain.markStyle);
    for (let gy = 0; gy < world.gridH; gy++)
      for (let gx = 0; gx < world.gridW; gx++) {
        const x = gx + 0.5 - world.gridW / 2;
        const z = world.gridH / 2 - gy - 0.5;
        for (let k = 0; k < perTile; k++)
          terrain.addMark({ x, z, shape: 'circle', extent, dashed: false, r: 1, g: 1, b: 1, alpha: 1 });
      }
  };

  let bins: BinStats = { count: 0, maxBin: 0, overflow: 0 };
  let stressBins: BinStats = bins;
  const rig: BenchRig = {
    now: () => performance.now(),
    setMarks: (on) => terrain.setGroundMarks(on),
    frame: (load) => {
      battleRenderer.update(0);
      if (load.stress) fillBins();
      sprites.sortByDepth(internals.renderer.camera);
      if (load.plantMs > 0) spinUnits(Math.round(load.plantMs * rate));
      renderTwoPass.call(internals.renderer);
      webgl.setRenderTarget(null);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    },
    afterLeg: (leg) => {
      if (leg.marks && !leg.stress) bins = { ...terrain.markStats };
      if (leg.stress) stressBins = { ...terrain.markStats };
    },
    pause: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };

  const results = await runBench(rig, options);
  terrain.setGroundMarks(marksWereOn);
  const run = (game as unknown as { run?: { currentEncounter?: { layoutId?: string | null } | null } | null }).run;
  const layout = run?.currentEncounter?.layoutId ?? 'procedural';
  return {
    canvas: [webgl.domElement.width, webgl.domElement.height],
    gpu: gpuName(gl),
    board: `${layout} ${world.gridW}x${world.gridH}`,
    clockStep: clockStep(),
    bins,
    stressBins,
    options,
    results,
    checks: benchChecks(results, options.plantMs),
  };
}
