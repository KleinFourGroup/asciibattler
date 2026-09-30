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
 * - Every call gets a number, and a long call stops at its next poll once a
 *   later call starts, so a call the tool gave up on (it stops waiting at
 *   45 s) can't keep acting. `running()` lists the calls still running.
 */

import type { Game } from '../../Game';
import { canvasProblem, missingPairs, normalizeQuery, type CanvasReading } from './page';

/** What the kit reads on the live Game. Indexed access types reach private
 *  members, so tsc checks each name here: a rename fails typecheck. */
interface GameInternals {
  readonly activeScene: Game['activeScene'];
  readonly run: Game['run'];
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
}

export interface CanvasCheck {
  readonly viewport: readonly [number, number];
  readonly canvas: readonly [number, number];
}

export interface Probe {
  readonly live: true;
  ready(opts?: { timeoutMs?: number }): Promise<PageReport>;
  go(query: string): { navigating: string; next: string };
  check(): CanvasCheck;
  running(): { call: number; name: string; ms: number }[];
}

/** Below the pane tool's own 45 s, so the kit's error arrives first. */
const READY_TIMEOUT_MS = 30_000;
const POLL_MS = 100;
/** Where `go()` leaves what it asked for; sessionStorage survives the navigation. */
const GO_KEY = '__probe.go';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function installProbe(game: Game): Probe {
  const internals = game as unknown as GameInternals;
  const page = Math.round(performance.timeOrigin);
  let calls = 0;
  let readyHere = false;
  const active = new Map<number, { name: string; since: number }>();

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
          scene: internals.activeScene?.constructor.name ?? null,
          phase: internals.run?.phase ?? null,
          running: [...active.keys()].filter((c) => c !== call),
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
  };

  (window as unknown as { __probe: Probe }).__probe = kit;
  return kit;
}
