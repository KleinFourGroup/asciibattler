import { describe, expect, it } from 'vitest';
import {
  CONTEXT_LOST_GRACE_MS,
  createContextWatch,
  createFailureWatch,
  errorEventCounts,
  failureText,
  rejectionCounts,
  type FailureReport,
} from './rules';

// 117.5i — what counts as a failure, the watch, and the wait on a lost
// context. The shapes the two filters are held to were read off a real page
// first (WORKLOG §117.5i, step zero): a ResizeObserver loop arrives as an
// `error` event with no thrown value and the page's own URL as its file; a
// missing font file rejects with a DOMException named NetworkError.

const PAGE = 'https://game.example';

describe('117.5i — which error events count', () => {
  it('counts a thrown value from the page, or from a file with no name', () => {
    expect(errorEventCounts({ error: new Error('x'), filename: `${PAGE}/assets/index.js` }, PAGE)).toBe(true);
    expect(errorEventCounts({ error: new Error('x'), filename: '' }, PAGE)).toBe(true);
    expect(errorEventCounts({ error: new Error('x') }, PAGE)).toBe(true);
    expect(errorEventCounts({ error: 'a thrown string', filename: `${PAGE}/a.js` }, PAGE)).toBe(true);
    // A blob the page made is the page's.
    expect(errorEventCounts({ error: new Error('x'), filename: `blob:${PAGE}/1199c56d` }, PAGE)).toBe(true);
  });

  it('does not count a report with no thrown value: a ResizeObserver loop, a script the browser will not describe', () => {
    expect(errorEventCounts({ error: null, filename: `${PAGE}/index.html` }, PAGE)).toBe(false);
    expect(errorEventCounts({ error: undefined, filename: `${PAGE}/index.html` }, PAGE)).toBe(false);
    expect(errorEventCounts({ filename: '' }, PAGE)).toBe(false);
  });

  it("does not count a thrown value from another origin's file", () => {
    expect(errorEventCounts({ error: new Error('x'), filename: 'moz-extension://3f2a/content.js' }, PAGE)).toBe(false);
    expect(errorEventCounts({ error: new Error('x'), filename: 'https://elsewhere.example/a.js' }, PAGE)).toBe(false);
  });

  it('counts a file under file:, where every origin reads null', () => {
    expect(errorEventCounts({ error: new Error('x'), filename: 'file:///C:/game/index.js' }, 'null')).toBe(true);
  });
});

describe('117.5i — which unhandled rejections count', () => {
  it('counts an Error', () => {
    expect(rejectionCounts(new Error('x'))).toBe(true);
    expect(rejectionCounts(new TypeError('x'))).toBe(true);
  });

  it('does not count a DOMException, which is an Error too', () => {
    const refused = new DOMException('play() failed', 'NotAllowedError');
    expect(refused instanceof Error).toBe(true);
    expect(rejectionCounts(refused)).toBe(false);
    expect(rejectionCounts(new DOMException('A network error occurred.', 'NetworkError'))).toBe(false);
  });

  it('does not count a reason that is no Error', () => {
    expect(rejectionCounts('a string')).toBe(false);
    expect(rejectionCounts(undefined)).toBe(false);
    expect(rejectionCounts({ message: 'looks like one' })).toBe(false);
  });
});

describe('117.5i — the text of a thrown value', () => {
  it('is the name and the message', () => {
    expect(failureText(new Error('Error creating WebGL context.'))).toBe('Error: Error creating WebGL context.');
    expect(failureText(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
    expect(failureText(new DOMException('A network error occurred.', 'NetworkError'))).toBe(
      'NetworkError: A network error occurred.',
    );
  });

  it('is the name alone for an empty message, and the value as text for no Error', () => {
    expect(failureText(new RangeError())).toBe('RangeError');
    expect(failureText('thrown as a string')).toBe('thrown as a string');
    expect(failureText(null)).toBe('null');
    expect(failureText(Object.create(null))).toBe('a value that has no text');
  });

  it('carries the cause, so a wrapped NetworkError still says what it was', () => {
    const cause = new DOMException('A network error occurred.', 'NetworkError');
    expect(failureText(new Error("FontAtlas: the game's font files failed to load", { cause }))).toBe(
      "Error: FontAtlas: the game's font files failed to load (NetworkError: A network error occurred.)",
    );
  });
});

/** A watch over recorders: what was shown, what was halted, what it warned. */
function watched(opts: { hasWebgl?: () => boolean; show?: (r: FailureReport) => void } = {}) {
  const shown: FailureReport[] = [];
  const warned: string[] = [];
  const log: string[] = [];
  const watch = createFailureWatch({
    show:
      opts.show ??
      ((report) => {
        shown.push(report);
        log.push('show');
      }),
    hasWebgl: opts.hasWebgl ?? (() => true),
    warn: (what) => warned.push(what),
  });
  const halt = (): void => {
    log.push('halt');
  };
  return { watch, shown, warned, log, halt };
}

describe('117.5i — the watch', () => {
  it('a failure before the game started is a boot failure', () => {
    const { watch, shown, log } = watched();
    watch.fail(new Error('no atlas'));
    expect(shown).toEqual([{ kind: 'boot', text: 'Error: no atlas' }]);
    expect(log).toEqual(['show']);
    expect(watch.reported).toEqual({ kind: 'boot', text: 'Error: no atlas' });
  });

  it('a boot failure on a page that can make no WebGL context is the WebGL plate', () => {
    const { watch, shown } = watched({ hasWebgl: () => false });
    watch.fail(new Error('Error creating WebGL context.'));
    expect(shown).toEqual([{ kind: 'webgl', text: 'Error: Error creating WebGL context.' }]);
  });

  it('once the game runs, a failure halts it and then shows the plate, and WebGL is not asked', () => {
    let asked = 0;
    const { watch, shown, log, halt } = watched({
      hasWebgl: () => {
        asked++;
        return false;
      },
    });
    watch.started(halt);
    expect(log).toEqual([]);
    watch.fail(new Error('planted'));
    expect(log).toEqual(['halt', 'show']);
    expect(shown).toEqual([{ kind: 'run', text: 'Error: planted' }]);
    expect(asked).toBe(0);
  });

  it('only the first failure speaks: a frame that throws sixty times shows one plate and halts once', () => {
    const { watch, shown, log, halt } = watched();
    watch.started(halt);
    for (let i = 0; i < 60; i++) watch.fail(new Error(`frame ${i}`));
    watch.fail(new Error('lost'), 'context');
    expect(shown).toEqual([{ kind: 'run', text: 'Error: frame 0' }]);
    expect(log).toEqual(['halt', 'show']);
  });

  it('a lost context is its own kind, and halts', () => {
    const { watch, shown, log, halt } = watched();
    watch.started(halt);
    watch.fail(new Error('the context is gone'), 'context');
    expect(shown).toEqual([{ kind: 'context', text: 'Error: the context is gone' }]);
    expect(log).toEqual(['halt', 'show']);
  });

  it('a game that starts after the page failed is halted at once', () => {
    const { watch, log, halt } = watched();
    watch.fail(new Error('during the boot'));
    expect(log).toEqual(['show']);
    watch.started(halt);
    expect(log).toEqual(['show', 'halt']);
  });

  it('a halt that throws still shows the plate, and a plate that throws stays inside the watch', () => {
    const first = watched();
    first.watch.started(() => {
      throw new Error('halt broke');
    });
    expect(() => first.watch.fail(new Error('x'))).not.toThrow();
    expect(first.shown).toEqual([{ kind: 'run', text: 'Error: x' }]);
    expect(first.warned).toEqual(['the halt']);

    const second = watched({
      show: () => {
        throw new Error('plate broke');
      },
    });
    expect(() => second.watch.fail(new Error('x'))).not.toThrow();
    expect(second.warned).toEqual(['the plate']);
    expect(second.watch.reported).toEqual({ kind: 'boot', text: 'Error: x' });
  });

  it('a WebGL check that throws leaves the plain boot plate', () => {
    const { watch, shown, warned } = watched({
      hasWebgl: () => {
        throw new Error('no document');
      },
    });
    watch.fail(new Error('x'));
    expect(shown).toEqual([{ kind: 'boot', text: 'Error: x' }]);
    expect(warned).toEqual(['the WebGL check']);
  });
});

/** A context watch on a clock moved by hand. */
function contextOnAClock(graceMs = CONTEXT_LOST_GRACE_MS) {
  let now = 0;
  let visible = true;
  let gone = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fire: () => void }>();
  const watch = createContextWatch({
    graceMs,
    visible: () => visible,
    setTimer: (fire, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fire });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id as number);
    },
    onGone: () => {
      gone++;
    },
  });
  return {
    watch,
    gone: () => gone,
    pending: () => timers.size,
    advance(ms: number): void {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at > now) continue;
        timers.delete(id);
        timer.fire();
      }
    },
    show(on: boolean): void {
      visible = on;
      watch.visibilityChanged();
    },
  };
}

describe('117.5i — the wait on a lost context', () => {
  it('waits a few seconds', () => {
    expect(CONTEXT_LOST_GRACE_MS).toBeGreaterThanOrEqual(2000);
    expect(CONTEXT_LOST_GRACE_MS).toBeLessThanOrEqual(10000);
  });

  it('a context that stays lost for the whole wait is gone, once', () => {
    const c = contextOnAClock(4000);
    c.watch.lost();
    c.advance(3999);
    expect(c.gone()).toBe(0);
    c.advance(1);
    expect(c.gone()).toBe(1);
    c.advance(60000);
    expect(c.gone()).toBe(1);
    expect(c.pending()).toBe(0);
  });

  it('a context restored inside the wait is not, and the clock keeps nothing', () => {
    const c = contextOnAClock(4000);
    c.watch.lost();
    c.advance(134);
    c.watch.restored();
    expect(c.pending()).toBe(0);
    c.advance(60000);
    expect(c.gone()).toBe(0);
  });

  it('a second loss waits the whole time again', () => {
    const c = contextOnAClock(4000);
    c.watch.lost();
    c.advance(3000);
    c.watch.restored();
    c.watch.lost();
    c.advance(3000);
    expect(c.gone()).toBe(0);
    c.advance(1000);
    expect(c.gone()).toBe(1);
  });

  it('time out of view does not count, and coming back starts the wait over', () => {
    const c = contextOnAClock(4000);
    c.watch.lost();
    c.advance(3000);
    c.show(false);
    expect(c.pending()).toBe(0);
    c.advance(600000);
    expect(c.gone()).toBe(0);
    c.show(true);
    c.advance(3999);
    expect(c.gone()).toBe(0);
    c.advance(1);
    expect(c.gone()).toBe(1);
  });

  it('a context lost out of view waits for the page to be seen, and one restored on the way back never fires', () => {
    const c = contextOnAClock(4000);
    c.show(false);
    c.watch.lost();
    expect(c.pending()).toBe(0);
    c.advance(600000);
    c.show(true);
    c.advance(500);
    c.watch.restored();
    c.advance(60000);
    expect(c.gone()).toBe(0);
  });

  it('a change of view with nothing lost arms nothing', () => {
    const c = contextOnAClock(4000);
    c.show(false);
    c.show(true);
    expect(c.pending()).toBe(0);
  });
});
