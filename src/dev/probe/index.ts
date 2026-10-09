/**
 * 112a — the pane probe kit: `window.__probe`, the Browser pane's known traps
 * held in code instead of tips (process/browser-pane.md). DEV only: main.ts
 * loads this module by a DEV-gated dynamic import, so no build for players
 * carries it.
 *
 * A pane session starts with `await __probe.ready()`. Before the page's
 * modules load, the dev server's stand-in answers that call and waits for
 * this kit (./bootstrap.ts).
 *
 * - `ready()` waits until the page is live and reports it. It fails by name,
 *   never with a quiet wrong read: a canvas the hidden pane left at 0×0, a
 *   stylesheet that failed to load (the page up with no layout), or a URL
 *   that isn't the one `go()` asked for.
 * - `go(query)` navigates, but only once `ready()` has passed on this page,
 *   since a URL set before then can be replaced by the pane's own first load.
 *   The next `ready()` checks the new URL.
 * - `check()` is the canvas-size check every read makes.
 * - 112b: `frame(dt = 0)` runs one frame of the loop's own body now, so a
 *   read after a change never sees the previous view (a hidden pane runs no
 *   frames of its own), and `frame(0)` never advances the sim.
 *   `pixels(rect)` renders and reads a crop of the canvas in one call (the
 *   drawing buffer isn't kept between tasks) and returns numbers; with
 *   `show`, it also draws the crop magnified on the page for a screenshot,
 *   until `hide()`.
 * - 112c: `drive(opts)` plays the run: each phase's command from ./drive.ts
 *   sent through `Game.dispatch`, each battle fought by hand-driven frames
 *   through its outro until Game swaps the scene, an optional audit on every
 *   Nth battle frame. It returns at the run's end, at `until`, or at its time
 *   limit (the next call carries on), and throws on a command that changes
 *   nothing, since the run would stand still.
 * - 114c: `journal()` hands out the run's journal as Game holds it (the one
 *   being recorded, or the finished one once the run is over), and every
 *   drive report carries `stateHash`, the hash a replay of that journal must
 *   reach (`npm run replay`).
 * - Every call gets a number, and a long call stops at its next poll once a
 *   later call starts, so a call the tool gave up on (it stops waiting at
 *   45 s) can't keep acting. `running()` lists the calls still running.
 */

import type { Game } from '../../Game';
import type { Renderer } from '../../render/Renderer';
import type { RunPhase } from '../../run/Run';
import type { BattleScene } from '../../scenes/BattleScene';
import { BUILD_ID } from '../../buildId';
import { snapshotHash, type RunJournal } from '../../journal/journal';
import { store as pageStore } from '../../store';
import type { RunLock } from '../../store/runLock';
import type { StoreStatus } from '../../store/store';
import { describeCommand, logHash, PHASE_ROWS, pickerFor, type Chooser, type DrivePolicy } from './drive';
import { sceneName } from './scenes';
import {
  canvasProblem,
  glReadRect,
  missingPairs,
  normalizeQuery,
  summarizePixels,
  type CanvasReading,
  type PageRect,
  type PixelSummary,
} from './page';

/** What the kit reads on the live Game. Indexed access types reach private
 *  members, so tsc checks each name here: a rename fails typecheck. */
interface GameInternals {
  readonly activeScene: Game['activeScene'];
  readonly run: Game['run'];
  readonly renderer: Game['renderer'];
  readonly runSlot: Game['runSlot'];
}

/** One frame of the loop is `onFrame(dt)` (Game's: the scene tick, then the
 *  depth sort) and `renderTwoPass()` (Renderer.start); both private. */
interface RendererInternals {
  readonly onFrame: Renderer['onFrame'];
  renderTwoPass: Renderer['renderTwoPass'];
  readonly webgl: Renderer['webgl'];
}

/** What the driver reads on a live battle scene (all private there). */
interface BattleInternals {
  readonly world: BattleScene['world'];
  readonly playback: BattleScene['playback'];
  readonly countdown: BattleScene['countdown'];
}

export interface PageReport {
  /** This call's number. */
  readonly call: number;
  /** The page load (`performance.timeOrigin`); a reload changes it. */
  readonly page: number;
  readonly url: string;
  /** Whether requestAnimationFrame fires. A hidden pane runs none, so the
   *  loop's frames are the session's to drive. */
  readonly frames: 'running' | 'stopped';
  readonly viewport: readonly [number, number];
  readonly canvas: readonly [number, number];
  readonly dpr: number;
  /** True when `ready()` sent a `resize` event to fix a stale canvas. */
  readonly resized: boolean;
  readonly scene: string | null;
  readonly phase: string | null;
  /** Earlier kit calls still running when this one returned (normally none). */
  readonly running: readonly number[];
  /** The build's ID (src/buildId.ts): `-dev` on the dev server. */
  readonly build: string;
  /** The page's store: its adapter, and whether it can save. */
  readonly store: StoreStatus;
  /** This tab's side of the two-tab lock: `elsewhere` in a second tab, which
   *  leaves the run slot alone. */
  readonly lock: RunLock;
}

export interface CanvasCheck {
  readonly viewport: readonly [number, number];
  readonly canvas: readonly [number, number];
}

export interface FrameReport {
  readonly call: number;
  readonly scene: string | null;
  /** The battle's sim tick, or null outside a battle. `frame(0)` never moves it. */
  readonly tick: number | null;
  readonly canvas: readonly [number, number];
}

export interface PixelsReport extends PixelSummary {
  readonly call: number;
  /** The rect asked for, in CSS pixels from the page's top-left. */
  readonly rect: PageRect;
  /** Its size in drawing-buffer pixels (CSS × the pixel ratio). */
  readonly size: readonly [number, number];
  /** The magnification when `show` drew it on the page, else null. */
  readonly shown: number | null;
}

/** A battle frame the driver hands to an audit, rendered first. */
export interface AuditFrame {
  /** The driver's battle-frame count on this page. */
  readonly n: number;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly scene: unknown;
  readonly world: unknown;
}

export interface DriveOptions {
  /** Stop on reaching this phase, or run to the end (the default). */
  readonly until?: RunPhase | 'end';
  /** The player's choices: a seeded pick (the default) or always the first. */
  readonly policy?: DrivePolicy;
  readonly seed?: number;
  /** Seconds of play per hand-driven battle frame (0.1). */
  readonly dt?: number;
  /** Return after this many battles (no limit by default). */
  readonly battles?: number;
  /** The call's own time limit (20 s), under the pane tool's 45 s; the next
   *  call carries on. */
  readonly maxMs?: number;
  /** Called on every `every`-th battle frame (10); each string it returns is
   *  a finding. */
  readonly audit?: (frame: AuditFrame) => readonly string[] | void;
  readonly every?: number;
  /** Start the log and the choices over on this page. */
  readonly restart?: boolean;
}

export interface DriveReport {
  readonly call: number;
  /** True once the run is over, or `until` is reached. */
  readonly done: boolean;
  readonly stoppedBy: string;
  readonly phase: RunPhase | null;
  /** Battles fought (one per turn), frames driven and commands sent on this page. */
  readonly battles: number;
  readonly frames: number;
  readonly steps: number;
  /** The last commands sent, `phase: command`. */
  readonly recent: readonly string[];
  /** Commands sent per phase on this page: which screens the run crossed. */
  readonly byPhase: Readonly<Record<string, number>>;
  /** A hash of every command sent on this page: equal runs, equal hashes. */
  readonly logHash: string;
  /** The journal's `snapshotHash` of the Run as it stands: what a replay of
   *  the run's journal must reach once the run is over. Null with no run. */
  readonly stateHash: string | null;
  readonly findings: { readonly count: number; readonly first: readonly string[] };
  readonly ms: number;
}

export interface Probe {
  readonly live: true;
  ready(opts?: { timeoutMs?: number }): Promise<PageReport>;
  go(query: string): { navigating: string; next: string };
  check(): CanvasCheck;
  running(): { call: number; name: string; ms: number }[];
  frame(dt?: number): FrameReport;
  pixels(rect: PageRect, opts?: { show?: boolean | number; render?: boolean }): PixelsReport;
  hide(): boolean;
  drive(opts?: DriveOptions): Promise<DriveReport>;
  journal(): RunJournal | null;
}

/** Below the pane tool's own 45 s, so the kit's error arrives first. */
const READY_TIMEOUT_MS = 30_000;
const POLL_MS = 100;
/** Where `go()` leaves what it asked for; sessionStorage survives the navigation. */
const GO_KEY = '__probe.go';
/** The magnified crop's element, and the widest it is drawn by default. */
const SHOW_ID = 'probe-pixels';
const SHOW_MAX_PX = 480;
/** A drive call's own time limit, and how long a battle's outro may take. */
const DRIVE_MS = 20_000;
const OUTRO_MAX_MS = 10_000;
/** Battle frames driven between yields, so a later call can stop a drive. */
const FRAMES_PER_YIELD = 50;
const FINDINGS_KEPT = 20;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function installProbe(game: Game): Probe {
  const internals = game as unknown as GameInternals;
  const renderer = (): RendererInternals => internals.renderer as unknown as RendererInternals;

  /**
   * One frame of the loop's own body, run now, with the camera's world matrix
   * brought current first. The loop moves the overlays inside `onFrame` and
   * three.js updates the camera's matrices only inside the render, so the
   * loop's first frame after a camera change projects the bars with the old
   * camera (measured in the pane at 112b: the bars one frame behind, then
   * right). The camera shake the loop adds around its render is left out, so
   * a read is never jittered.
   */
  const runFrame = (dt: number): void => {
    internals.renderer.camera.updateMatrixWorld();
    renderer().onFrame(dt);
    renderer().renderTwoPass();
  };
  const page = Math.round(performance.timeOrigin);
  let calls = 0;
  let readyHere = false;
  const active = new Map<number, { name: string; since: number }>();

  /** The driver's state on this page; a reload starts it over. */
  interface Driver {
    readonly policy: DrivePolicy;
    readonly seed: number;
    readonly pick: Chooser;
    readonly log: string[];
    battles: number;
    frames: number;
    findingCount: number;
    readonly findings: string[];
  }
  let driver: Driver | null = null;

  /**
   * Fight the battle scene on screen until Game swaps it for the next one.
   * The fight starts at once (the countdown's Fight, as Space does), and the
   * frames are driven by hand, since a hidden pane runs none. After the last
   * tick the phase has moved on, but the scene plays its outro and Game
   * advances only after it; the outro settles as the scene ticks and its
   * timer runs on wall time, so the frames go on, slower, until the swap.
   * Returns false when the call's time runs out first.
   */
  const fight = async (call: number, d: Driver, opts: DriveOptions, until: number): Promise<boolean> => {
    const scene = internals.activeScene;
    const battle = scene as unknown as BattleInternals | null;
    if (!battle?.world) throw new Error('__probe.drive: the battle phase with no battle scene on screen');
    if (battle.countdown?.active) battle.playback?.resume();
    const dt = opts.dt ?? 0.1;
    const every = opts.every ?? 10;
    let outroSince: number | null = null;
    while (internals.activeScene === scene) {
      for (let i = 0; i < FRAMES_PER_YIELD && internals.activeScene === scene; i++) {
        d.frames++;
        if (opts.audit && d.frames % every === 0) {
          runFrame(dt);
          const run = internals.run!;
          const found = opts.audit({
            n: d.frames,
            tick: battle.world?.currentTick ?? -1,
            phase: run.phase,
            scene,
            world: battle.world,
          });
          for (const f of found ?? []) {
            d.findingCount++;
            if (d.findings.length < FINDINGS_KEPT) d.findings.push(`frame ${d.frames}: ${f}`);
          }
        } else {
          renderer().onFrame(dt);
        }
        if (internals.run?.phase !== 'battle') break;
      }
      if (internals.activeScene !== scene) break;
      if (internals.run?.phase !== 'battle') {
        outroSince ??= Date.now();
        if (Date.now() - outroSince > OUTRO_MAX_MS) {
          throw new Error(`__probe.drive: the battle ended ${OUTRO_MAX_MS / 1000} s ago and Game never swapped its scene`);
        }
        await sleep(20);
      } else {
        await sleep(0);
      }
      if (call !== calls) throw new Error(`__probe.drive (call ${call}): superseded by call ${calls}`);
      if (Date.now() >= until) return false;
    }
    d.battles++;
    return true;
  };

  const readCanvas = (): CanvasReading => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    if (!canvas) throw new Error('__probe: no #game-canvas on the page');
    return {
      viewport: [innerWidth, innerHeight],
      client: [canvas.clientWidth, canvas.clientHeight],
      buffer: [canvas.width, canvas.height],
      dpr: devicePixelRatio,
    };
  };

  const viewportError = (r: CanvasReading): Error =>
    new Error(
      `__probe: the page is ${r.viewport.join('x')} and its canvas ${r.client.join('x')} ` +
        '(a hidden pane can be zero-sized): resize_window to 1280x720, then await __probe.ready()',
    );

  /** The canvas check; a stale buffer gets one `resize` event, as a real one would. */
  const checkCanvas = (): CanvasCheck & { resized: boolean } => {
    let reading = readCanvas();
    let problem = canvasProblem(reading);
    let resized = false;
    if (problem === 'buffer') {
      window.dispatchEvent(new Event('resize'));
      resized = true;
      reading = readCanvas();
      problem = canvasProblem(reading);
    }
    if (problem === 'viewport') throw viewportError(reading);
    if (problem === 'layout') {
      throw new Error(
        `__probe: the canvas box is ${reading.client.join('x')} in a ${reading.viewport.join('x')} page, ` +
          'where ui.css makes it the whole page: the layout is off (a stylesheet that failed to load?). ' +
          'location.reload(), then await __probe.ready()',
      );
    }
    if (problem === 'buffer') {
      throw new Error(
        `__probe: the canvas buffer is ${reading.buffer.join('x')}, where its box ` +
          `${reading.client.join('x')} at pixel ratio ${reading.dpr} wants more, even after a resize event`,
      );
    }
    return { viewport: reading.viewport, canvas: reading.buffer, resized };
  };

  // What `go()` asked for, judged once, on the first load after it: this one.
  // Held for this page only, so a later reload is never judged against it.
  let goVerdict: { want: string; missing: string[] } | null = null;
  const store = (globalThis as { sessionStorage?: Storage }).sessionStorage;
  const asked = store?.getItem(GO_KEY) ?? null;
  if (asked !== null) {
    store!.removeItem(GO_KEY);
    const { want } = JSON.parse(asked) as { want: string };
    goVerdict = { want, missing: missingPairs(location.search, want) };
  }
  /** Set by `go()` on this page: its navigation hasn't replaced the page yet. */
  let navigating: string | null = null;

  const notLive = (): string[] => {
    const pending: string[] = [];
    if (document.styleSheets.length === 0) pending.push('no stylesheets yet');
    if (document.fonts.status !== 'loaded') pending.push('fonts still loading');
    if ((document.querySelector('#ui')?.childElementCount ?? 0) === 0) pending.push('the UI has not mounted');
    if (navigating !== null) pending.push(`the navigation go() started (?${navigating}) has not happened yet`);
    return pending;
  };

  /** Failures that waiting can't fix, checked once the page is live. */
  const brokenOnLoad = (): void => {
    // A page that has failed is halted under its plate (src/failure): no
    // frame runs and no command applies, so a read would be of a stopped game.
    const plate = document.querySelector('.failure-plate__error');
    if (plate !== null) {
      throw new Error(
        `__probe.ready: the page has failed and is halted; its failure plate says: ${plate.textContent} ` +
          '(location.reload(), then await __probe.ready())',
      );
    }
    // A same-origin stylesheet that failed to load stays in the list with
    // rules nobody can read (a dev server restarted mid-request did this).
    const failed = [...document.styleSheets]
      .filter((s) => s.href !== null && s.href.startsWith(location.origin))
      .filter((s) => {
        try {
          return s.cssRules.length === 0;
        } catch {
          return true;
        }
      })
      .map((s) => s.href!.slice(location.origin.length));
    if (failed.length > 0) {
      throw new Error(
        `__probe.ready: ${failed.join(', ')} failed to load, so the page has no layout. ` +
          'location.reload(), then await __probe.ready()',
      );
    }
    if (goVerdict !== null) {
      const { want, missing } = goVerdict;
      goVerdict = null;
      if (missing.length > 0) {
        throw new Error(
          `__probe.ready: go() asked for ?${want}, but the page is at ` +
            `${location.search === '' ? 'no query' : location.search}; missing ${missing.join(', ')}. ` +
            'A board fixture replaces the run dials in its URL, and a URL set before the page was ' +
            'live is replaced by the pane’s own first load.',
        );
      }
    }
  };

  const kit: Probe = {
    live: true,

    async ready(opts = {}) {
      const call = ++calls;
      const timeoutMs = opts.timeoutMs ?? READY_TIMEOUT_MS;
      const until = Date.now() + timeoutMs;
      active.set(call, { name: 'ready', since: Date.now() });
      try {
        let pending = notLive();
        while (pending.length > 0) {
          if (Date.now() >= until) {
            throw new Error(
              `__probe.ready: not live after ${Math.round(timeoutMs / 1000)} s: ${pending.join('; ')}. ` +
                'Call __probe.ready() again.',
            );
          }
          await sleep(POLL_MS);
          if (call !== calls) throw new Error(`__probe.ready (call ${call}): superseded by call ${calls}`);
          pending = notLive();
        }
        // Waiting on these helps nothing once the page is up, so they throw at once.
        brokenOnLoad();
        const { viewport, canvas, resized } = checkCanvas();

        // One animation frame requested, and a flag set if it fires; the kit
        // never awaits the frame itself, which a hidden pane may never run.
        let fired = false;
        requestAnimationFrame(() => {
          fired = true;
        });
        const frameBy = Date.now() + 200;
        while (!fired && Date.now() < frameBy) await sleep(20);
        // Let a superseded call reach its next poll and leave.
        if ([...active.keys()].some((c) => c !== call)) await sleep(POLL_MS + 20);

        readyHere = true;
        return {
          call,
          page,
          url: location.pathname + location.search,
          frames: fired ? 'running' : 'stopped',
          viewport,
          canvas,
          dpr: devicePixelRatio,
          resized,
          scene: sceneName(internals.activeScene),
          phase: internals.run?.phase ?? null,
          running: [...active.keys()].filter((c) => c !== call),
          build: BUILD_ID,
          store: pageStore.status(),
          lock: internals.runSlot.lock,
        };
      } finally {
        active.delete(call);
      }
    },

    go(query) {
      ++calls;
      if (!readyHere) {
        throw new Error(
          '__probe.go: await __probe.ready() on this page first. A URL set before the page is ' +
            'live can be replaced by the pane’s own first load.',
        );
      }
      const want = normalizeQuery(query);
      sessionStorage.setItem(GO_KEY, JSON.stringify({ want }));
      navigating = want;
      location.assign(`${location.pathname}?${want}`);
      return { navigating: `?${want}`, next: 'await __probe.ready() in the next call' };
    },

    check() {
      ++calls;
      const { viewport, canvas } = checkCanvas();
      return { viewport, canvas };
    },

    running() {
      const now = Date.now();
      return [...active].map(([call, a]) => ({ call, name: a.name, ms: now - a.since }));
    },

    frame(dt = 0) {
      const call = ++calls;
      const { canvas } = checkCanvas();
      runFrame(dt);
      const world = (internals.activeScene as { world?: { currentTick: number } | null } | null)?.world;
      return {
        call,
        scene: sceneName(internals.activeScene),
        tick: world?.currentTick ?? null,
        canvas,
      };
    },

    pixels(rect, opts = {}) {
      const call = ++calls;
      const { canvas } = checkCanvas();
      const gl = glReadRect(rect, devicePixelRatio, canvas);
      const { webgl } = renderer();
      // The drawing buffer isn't preserved between tasks, so the render and
      // the read happen here, together.
      if (opts.render !== false) runFrame(0);
      const context = webgl.getContext();
      const target = webgl.getRenderTarget();
      webgl.setRenderTarget(null);
      const bytes = new Uint8Array(gl.w * gl.h * 4);
      context.readPixels(gl.x, gl.y, gl.w, gl.h, context.RGBA, context.UNSIGNED_BYTE, bytes);
      webgl.setRenderTarget(target);
      const summary = summarizePixels(bytes, gl.w, gl.h);
      const shown = opts.show ? showCrop(bytes, gl.w, gl.h, rect, opts.show) : null;
      return { call, rect, size: [gl.w, gl.h], shown, ...summary };
    },

    hide() {
      const el = document.getElementById(SHOW_ID);
      el?.remove();
      return el !== null;
    },

    async drive(opts = {}) {
      const call = ++calls;
      const started = Date.now();
      const until = started + (opts.maxMs ?? DRIVE_MS);
      const policy = opts.policy ?? 'seeded';
      const seed = opts.seed ?? 1;
      if (driver !== null && !opts.restart && (driver.policy !== policy || driver.seed !== seed)) {
        throw new Error(
          `__probe.drive: this page is driving ${driver.policy} seed ${driver.seed}; ` +
            'pass restart: true to change it',
        );
      }
      if (driver === null || opts.restart) {
        driver = { policy, seed, pick: pickerFor(policy, seed), log: [], battles: 0, frames: 0, findingCount: 0, findings: [] };
      }
      const d = driver;
      const battlesBefore = d.battles;
      active.set(call, { name: 'drive', since: started });
      const report = (done: boolean, stoppedBy: string): DriveReport => ({
        call,
        done,
        stoppedBy,
        phase: internals.run?.phase ?? null,
        battles: d.battles,
        frames: d.frames,
        steps: d.log.length,
        recent: d.log.slice(-6),
        byPhase: d.log.reduce<Record<string, number>>((n, line) => {
          const phase = line.slice(0, line.indexOf(':'));
          n[phase] = (n[phase] ?? 0) + 1;
          return n;
        }, {}),
        logHash: logHash(d.log),
        stateHash: internals.run ? snapshotHash(internals.run.toJSON()) : null,
        findings: { count: d.findingCount, first: d.findings.slice(0, 5) },
        ms: Date.now() - started,
      });
      try {
        checkCanvas();
        for (;;) {
          if (call !== calls) throw new Error(`__probe.drive (call ${call}): superseded by call ${calls}`);
          const run = internals.run;
          if (run === null) throw new Error('__probe.drive: no run (the menu, or character select?); put character= in the URL');
          const phase = run.phase;
          if (opts.until === phase) return report(true, `reached ${phase}`);
          const step = PHASE_ROWS[phase](run, d.pick);
          if (step === 'end') return report(true, phase);
          if (step === 'fight') {
            const finished = await fight(call, d, opts, until);
            if (!finished) return report(false, 'the time limit, mid-battle');
            if (opts.battles !== undefined && d.battles - battlesBefore >= opts.battles) {
              return report(false, `${opts.battles} battle(s)`);
            }
            continue;
          }
          // A command that changes nothing would repeat forever; say so.
          const before = JSON.stringify(run.toJSON());
          game.dispatch(step.command);
          const line = `${phase}: ${describeCommand(step.command)}`;
          if (internals.run === run && JSON.stringify(run.toJSON()) === before) {
            const after = d.log.length === 0 ? '' : ` (after ${d.log.slice(-3).join(' | ')})`;
            throw new Error(`__probe.drive: "${line}" changed nothing${after}`);
          }
          d.log.push(line);
          if (Date.now() >= until) return report(false, 'the time limit');
          await sleep(0);
        }
      } finally {
        active.delete(call);
      }
    },

    // A read of what Game holds; it takes no call number, so it never stops
    // a drive that is still running.
    journal() {
      return game.currentJournal();
    },
  };

  (window as unknown as { __probe: Probe }).__probe = kit;
  return kit;
}

/**
 * Draw a crop magnified in the page's top-left corner, above the game and
 * its scanlines, so a screenshot shows a few pixels large (the pane's zoom
 * returns the whole screenshot). The crop is the canvas alone: DOM overlays
 * (bars, hitsplats) aren't in it. It stays until `__probe.hide()` or the
 * next shown crop. Returns the magnification.
 */
function showCrop(bottomUp: Uint8Array, w: number, h: number, rect: PageRect, show: true | number): number {
  const scale = typeof show === 'number' ? show : Math.max(1, Math.floor(SHOW_MAX_PX / Math.max(w, h)));
  const native = document.createElement('canvas');
  native.width = w;
  native.height = h;
  const image = new ImageData(w, h);
  for (let row = 0; row < h; row++) {
    image.data.set(bottomUp.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
  }
  native.getContext('2d')!.putImageData(image, 0, 0);

  document.getElementById(SHOW_ID)?.remove();
  const box = document.createElement('div');
  box.id = SHOW_ID;
  box.style.cssText =
    'position:fixed;left:8px;top:8px;z-index:2147483647;padding:4px;background:#000;' +
    'border:1px solid #fff;font:12px monospace;color:#fff;pointer-events:none';
  const big = document.createElement('canvas');
  big.width = w * scale;
  big.height = h * scale;
  big.style.cssText = 'display:block;image-rendering:pixelated';
  const ctx = big.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(native, 0, 0, w * scale, h * scale);
  const label = document.createElement('div');
  label.textContent = `__probe.pixels ${rect.x},${rect.y} ${rect.w}x${rect.h} ×${scale}`;
  box.append(big, label);
  document.body.append(box);
  return scale;
}
