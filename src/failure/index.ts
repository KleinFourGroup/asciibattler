/**
 * 117.5i — THE PAGE'S FAILURE WATCH, made when this module is evaluated.
 * `main.ts` imports it third, after the store and the settings' boot and
 * ahead of the game's modules, so a module that throws as it loads (a
 * catalog that fails its schema) is already heard. What it reaches stays
 * clear of the catalogs, three.js and the game: the plate has to go up when
 * any of those is what failed. tests/failure-boot.test.ts holds both.
 *
 * A failure is one of three things, and each gets the plate
 * (src/ui/FailurePlate.ts) once:
 *   - the boot threw (`failure.boot`, from main.ts's own catch, or an
 *     `error` event before the game started);
 *   - something threw once the game was running: an `error` event or an
 *     unhandled rejection that rules.ts counts. The game is halted first
 *     (`Game.halt`), so the plate never stands over a game that still plays;
 *   - the WebGL context was lost and stayed lost (`rules.ts`,
 *     `CONTEXT_LOST_GRACE_MS`). Also halted.
 *
 * Not heard here: a script that never ran at all (a download that failed, a
 * browser too old to parse it), since this module is in that script. The
 * classic script in index.html's head hears that, and changes the loading
 * line's words. It hears an uncaught error by `errorEventCounts`'s rule
 * too, so while the line stands both may act on one report: it changes the
 * words, and the plate then takes the line down.
 */

import { showFailurePlate } from '../ui/FailurePlate';
import {
  CONTEXT_LOST_GRACE_MS,
  createContextWatch,
  createFailureWatch,
  errorEventCounts,
  rejectionCounts,
} from './rules';

/** Whether this page can make a WebGL 2 context: a scratch canvas is asked,
 *  and what it gives is handed straight back. */
function hasWebgl(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (gl === null) return false;
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return true;
}

const watch = createFailureWatch({
  show: showFailurePlate,
  hasWebgl,
  warn: (what, err) => console.error(`[failure] ${what} threw:`, err),
});

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (errorEventCounts(event, location.origin)) watch.fail(event.error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (rejectionCounts(event.reason)) watch.fail(event.reason);
  });
}

export const failure = {
  /** The boot threw. Said here, from the boot's own catch, so its plate does
   *  not rest on how a browser reports a rejected top-level await. */
  boot(thrown: unknown): void {
    watch.fail(thrown);
  },

  /**
   * The first screen is up and the loop runs: from here a failure halts the
   * game, and the canvas's context is watched.
   */
  started(halt: () => void, canvas: HTMLCanvasElement): void {
    watch.started(halt);
    const context = createContextWatch({
      graceMs: CONTEXT_LOST_GRACE_MS,
      visible: () => document.visibilityState === 'visible',
      setTimer: (fire, ms) => window.setTimeout(fire, ms),
      clearTimer: (timer) => window.clearTimeout(timer as number),
      onGone: () =>
        watch.fail(new Error(`the WebGL context was lost and not restored in ${CONTEXT_LOST_GRACE_MS / 1000} s`), 'context'),
    });
    canvas.addEventListener('webglcontextlost', () => context.lost());
    canvas.addEventListener('webglcontextrestored', () => context.restored());
    document.addEventListener('visibilitychange', () => context.visibilityChanged());
  },
};
