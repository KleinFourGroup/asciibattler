/**
 * 117.5i — WHAT COUNTS AS A FAILURE, and what the page does with one. The
 * pure half of the failure watch (index.ts is the page's half): which of the
 * browser's reports are the game failing, what a thrown value reads as, the
 * watch that lets the first failure speak and no other, and the wait on a
 * lost WebGL context. Nothing here touches the DOM, so `npm test` holds it.
 */

/**
 * Which plate a failure gets (src/ui/FailurePlate.ts):
 *   - `webgl`    the boot failed on a page that can make no WebGL 2 context;
 *   - `boot`     the boot failed some other way (the font files, a module);
 *   - `run`      something threw once the game was running;
 *   - `context`  the WebGL context was lost and has not come back.
 */
export type FailureKind = 'webgl' | 'boot' | 'run' | 'context';

export interface FailureReport {
  readonly kind: FailureKind;
  /** The thrown value as text (`failureText`). */
  readonly text: string;
}

/** The origin of a script's URL, or null when it has none or isn't a URL. */
function originOf(file: string | undefined): string | null {
  if (file === undefined || file === '') return null;
  try {
    return new URL(file).origin;
  } catch {
    return null;
  }
}

/**
 * Whether an `error` event on the window is the game failing. Two kinds of
 * report are not. One carries no thrown value: that is how a browser reports
 * a ResizeObserver that could not finish within a frame (the HUD has one),
 * and a script it will not describe to this page. The other names a file of
 * another origin: an extension's script running in the page. A plate for
 * either would stop a game that was working.
 */
export function errorEventCounts(
  event: { readonly error?: unknown; readonly filename?: string },
  pageOrigin: string,
): boolean {
  if (event.error === null || event.error === undefined) return false;
  const origin = originOf(event.filename);
  return origin === null || origin === pageOrigin;
}

/**
 * Whether a rejected promise that nothing handled is the game failing: an
 * Error that is not a DOMException. A DOMException is the browser refusing
 * something at the page's edge (a sound before the first click, the
 * clipboard, a request cut short), and the game goes on without it.
 */
export function rejectionCounts(reason: unknown): boolean {
  if (!(reason instanceof Error)) return false;
  return typeof DOMException === 'undefined' || !(reason instanceof DOMException);
}

function oneText(thrown: unknown): string {
  if (thrown instanceof Error) return thrown.message === '' ? thrown.name : `${thrown.name}: ${thrown.message}`;
  try {
    return String(thrown);
  } catch {
    return 'a value that has no text';
  }
}

/**
 * A thrown value as the plate shows it: `Name: message`, with the cause
 * after it where the error names one (the atlas wraps the font's
 * `NetworkError`, which alone says nothing about a font).
 */
export function failureText(thrown: unknown): string {
  const text = oneText(thrown);
  const cause = thrown instanceof Error ? thrown.cause : undefined;
  return cause === undefined || cause === null ? text : `${text} (${oneText(cause)})`;
}

export interface FailureWatch {
  /**
   * A failure. The first one halts the game, if it had started, and shows
   * the plate. Every later one is dropped: the first is the cause, and a
   * frame that throws does so sixty times a second. `kind` is given for a
   * lost context; otherwise it follows from whether the game had started.
   */
  fail(thrown: unknown, kind?: 'context'): void;
  /**
   * The boot is over and the game runs: from here a failure is the running
   * game's, and `halt` stops it. If the page had already failed, the game is
   * halted at once, so it never plays under the plate.
   */
  started(halt: () => void): void;
  /** The failure the page reported, once there is one. */
  readonly reported: FailureReport | null;
}

export interface FailureWatchDeps {
  /** Puts the plate up. */
  readonly show: (report: FailureReport) => void;
  /** Whether this page can make a WebGL 2 context at all. Asked once, when a
   *  boot fails, on a surface the renderer's own error does not come from. */
  readonly hasWebgl: () => boolean;
  /** Where a failure of the watch's own steps goes (the console). */
  readonly warn: (what: string, err: unknown) => void;
}

export function createFailureWatch(deps: FailureWatchDeps): FailureWatch {
  let reported: FailureReport | null = null;
  let halt: (() => void) | null = null;

  // Each step stands alone: a halt that throws must not cost the player the
  // plate, and nothing here may throw back into the browser's own report.
  const attempt = (what: string, step: () => void): void => {
    try {
      step();
    } catch (err) {
      deps.warn(what, err);
    }
  };

  const bootKind = (): FailureKind => {
    let webgl = true;
    attempt('the WebGL check', () => {
      webgl = deps.hasWebgl();
    });
    return webgl ? 'boot' : 'webgl';
  };

  return {
    fail(thrown, kind) {
      if (reported !== null) return;
      const report: FailureReport = {
        kind: kind ?? (halt !== null ? 'run' : bootKind()),
        text: failureText(thrown),
      };
      reported = report;
      const stop = halt;
      if (stop !== null) attempt('the halt', stop);
      attempt('the plate', () => deps.show(report));
    },
    started(stop) {
      halt = stop;
      if (reported !== null) attempt('the halt', stop);
    },
    get reported() {
      return reported;
    },
  };
}

/**
 * How long a lost WebGL context is waited for, with the page in view. A
 * browser that takes a context away and means to return it does so within a
 * second or so, and three.js then restores the picture by itself (a forced
 * loss came back in 134 ms). After this long it is not coming back: the
 * canvas stays black over a page that otherwise works, and the plate says
 * so.
 */
export const CONTEXT_LOST_GRACE_MS = 4000;

export interface ContextWatchDeps {
  readonly graceMs: number;
  /** Whether the page is in view. */
  readonly visible: () => boolean;
  readonly setTimer: (fire: () => void, ms: number) => unknown;
  readonly clearTimer: (timer: unknown) => void;
  /** The context stayed lost for the whole wait. */
  readonly onGone: () => void;
}

export interface ContextWatch {
  lost(): void;
  restored(): void;
  /** The page went out of view or came back into it. */
  visibilityChanged(): void;
}

/**
 * The wait on a lost context. Only time in view counts, and coming back into
 * view starts the wait over: a browser may hold a hidden tab's context until
 * the tab is looked at again, and a plate that went up while nobody was
 * looking would end a game that was about to come back.
 */
export function createContextWatch(deps: ContextWatchDeps): ContextWatch {
  let lost = false;
  let armed = false;
  let timer: unknown;

  const disarm = (): void => {
    if (!armed) return;
    armed = false;
    deps.clearTimer(timer);
  };
  const arm = (): void => {
    disarm();
    if (!lost || !deps.visible()) return;
    armed = true;
    timer = deps.setTimer(() => {
      armed = false;
      if (lost) deps.onGone();
    }, deps.graceMs);
  };

  return {
    lost() {
      lost = true;
      arm();
    },
    restored() {
      lost = false;
      disarm();
    },
    visibilityChanged: arm,
  };
}
