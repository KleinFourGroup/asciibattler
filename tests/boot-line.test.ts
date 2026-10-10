/**
 * 117.5h — THE LOADING LINE'S PINS. The line is static text in index.html,
 * so the page says something from its first paint, and src/main.ts takes it
 * down once Game's constructor has mounted the first screen. Two ways it
 * goes wrong without anything failing by itself: the line is dropped from
 * the page (a black frame again while 1.2 MB of script loads), or its
 * removal is dropped or moved ahead of the Game (the line left over the
 * menu, or gone before there is a screen). Both are pinned here, on every
 * `npm test`.
 *
 * 118f — THE WATCH FOR A BUNDLE THAT NEVER RAN is a classic script in
 * index.html's head, in a second language and outside the bundle's reach, so
 * nothing else in `npm test` would run it. Its text is taken from the page
 * and run here against a page made of plain objects: which reports change
 * the line's words, held row by row to answers planted in this file and to
 * `errorEventCounts`, the bundle's own rule for the same reports.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorEventCounts } from '../src/failure/rules';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

const ID = 'boot-line';

/** What is wrong with a page shell, as a list; empty when it holds the line. */
function pageFaults(html: string): string[] {
  const faults: string[] = [];
  const line = new RegExp(`<div id="${ID}">([^<]*)</div>`).exec(html);
  if (!line) faults.push(`no <div id="${ID}"> with plain text`);
  else if (line[1]!.trim() === '') faults.push('the line is empty');
  if (html.split(`id="${ID}"`).length - 1 > 1) faults.push('the line is there more than once');
  const script = html.indexOf('<script type="module"');
  if (line && script >= 0 && line.index > script) faults.push('the line comes after the module script');
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html);
  if (!noscript) faults.push('no <noscript>');
  else if (noscript[1]!.replace(/<[^>]*>/g, '').trim() === '') faults.push('the <noscript> says nothing');
  return faults;
}

/** What is wrong with the boot's handling of the line; empty when it is
 *  removed after the Game is built. */
function bootFaults(main: string): string[] {
  const faults: string[] = [];
  const built = main.indexOf('new Game(');
  const removed = main.indexOf(`getElementById('${ID}')?.remove()`);
  if (built < 0) faults.push('no `new Game(` in the boot');
  if (removed < 0) faults.push('the boot never removes the line');
  else if (removed < built) faults.push('the line is removed before the Game is built');
  return faults;
}

describe('117.5h — the loading line', () => {
  it('reads planted shells: a missing line, an empty one, a late one and a silent noscript are faults', () => {
    const good = `<body><div id="ui"></div><div id="${ID}">Loading…</div><noscript><div>Needs scripts.</div></noscript><script type="module" src="/x"></script></body>`;
    expect(pageFaults(good)).toEqual([]);
    expect(pageFaults(good.replace(`<div id="${ID}">Loading…</div>`, ''))).toEqual([`no <div id="${ID}"> with plain text`]);
    expect(pageFaults(good.replace('Loading…', ' '))).toEqual(['the line is empty']);
    expect(pageFaults(good.replace('<div>Needs scripts.</div>', '<div></div>'))).toEqual(['the <noscript> says nothing']);
    const late = `<body><script type="module" src="/x"></script><div id="${ID}">Loading…</div><noscript>Needs scripts.</noscript></body>`;
    expect(pageFaults(late)).toEqual(['the line comes after the module script']);
  });

  it('reads planted boots: no removal, and a removal ahead of the Game, are faults', () => {
    const good = `const game = new Game(a, b);\ndocument.getElementById('${ID}')?.remove();\ngame.start();`;
    expect(bootFaults(good)).toEqual([]);
    expect(bootFaults('const game = new Game(a, b);\ngame.start();')).toEqual(['the boot never removes the line']);
    expect(bootFaults(`document.getElementById('${ID}')?.remove();\nconst game = new Game(a, b);`)).toEqual([
      'the line is removed before the Game is built',
    ]);
  });

  it('index.html holds the line and a noscript line', () => {
    expect(pageFaults(read('index.html'))).toEqual([]);
  });

  it('src/main.ts removes the line once the Game is built', () => {
    expect(bootFaults(read('src/main.ts'))).toEqual([]);
  });

  it('ui.css styles the line and its twin', () => {
    const css = read('src/ui/ui.css');
    expect(css).toContain(`#${ID},`);
    expect(css).toContain('#boot-noscript {');
  });
});

// --- 118f: the watch for a bundle that never ran ---

const LOADING = 'Loading…';
const PAGE = 'https://game.example/play/index.html';

/** The page's classic script: the first `<script>` with no attribute. */
function watchSource(html: string): string | null {
  return /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? null;
}

/** What is wrong with where the watch stands; empty when it is in the head,
 *  ahead of every other script. */
function watchFaults(html: string): string[] {
  const classic = html.indexOf('<script>');
  if (classic < 0) return ['no classic script'];
  const faults: string[] = [];
  const head = html.indexOf('</head>');
  if (head < 0 || classic > head) faults.push('the watch is not in the head');
  const first = html.indexOf('<script');
  if (first !== classic) faults.push('a script comes before the watch');
  return faults;
}

/** Syntax a browser too old for the bundle can't parse either; the watch has
 *  to run exactly there. Read with the string literals taken out. */
function modernSyntax(source: string): string[] {
  const code = source.replace(/"[^"\n]*"|'[^'\n]*'/g, '""');
  const found: string[] = [];
  const tokens: ReadonlyArray<readonly [string, RegExp]> = [
    ['an arrow function', /=>/],
    ['a template literal', /`/],
    ['const, let or class', /\b(const|let|class)\b/],
    ['optional chaining', /\?\./],
    ['??', /\?\?/],
    ['a spread', /\.\.\./],
    ['async or await', /\b(async|await)\b/],
  ];
  for (const [name, test] of tokens) if (test.test(code)) found.push(name);
  return found;
}

interface WatchPage {
  /** The body is parsed: the line stands and `DOMContentLoaded` fires. */
  parsed(): void;
  /** The game took the line down. */
  booted(): void;
  /** An `error` event, as the window's listener gets it. */
  error(event: object): void;
  /** The line's words; null when there is no line. */
  readonly words: string | null;
  /** The window, for an event whose target is the window. */
  readonly window: object;
  /** The third argument the watch listened with. */
  readonly capture: unknown;
}

/** Run a watch's text on a page of plain objects. `modules: false` is a
 *  browser whose script elements know nothing of `noModule`. */
function openPage(source: string, modules = true): WatchPage {
  const page = new URL(PAGE);
  let line: { textContent: string } | null = null;
  let onError: ((event: object) => void) | null = null;
  let onParsed: (() => void) | null = null;
  let capture: unknown;
  const win = {
    addEventListener(type: string, listener: (event: object) => void, options?: unknown): void {
      if (type !== 'error') return;
      onError = listener;
      capture = options;
    },
  };
  const doc = {
    getElementById: (id: string) => (id === ID ? line : null),
    addEventListener(type: string, listener: () => void): void {
      if (type === 'DOMContentLoaded') onParsed = listener;
    },
    createElement(tag: string): object {
      if (tag === 'script') return modules ? { noModule: false } : {};
      // An anchor: it resolves what it is given against the page, as a
      // browser's does.
      const anchor = { protocol: '', host: '' };
      Object.defineProperty(anchor, 'href', {
        set(value: string) {
          const url = new URL(value, page);
          anchor.protocol = url.protocol;
          anchor.host = url.host;
        },
      });
      return anchor;
    },
  };
  // The page's own script text, run as the page runs it.
  new Function('window', 'document', 'location', source)(win, doc, { protocol: page.protocol, host: page.host });
  return {
    parsed() {
      line = { textContent: LOADING };
      onParsed?.();
    },
    booted() {
      line = null;
    },
    error(event) {
      onError?.(event);
    },
    get words() {
      return line?.textContent ?? null;
    },
    window: win,
    get capture() {
      return capture;
    },
  };
}

// The reports a window's `error` listener gets, and whether each means the
// game failed. The answers are planted here; the bundle's rule is asked too.
const REPORTS: ReadonlyArray<{
  readonly what: string;
  readonly event: { readonly error?: unknown; readonly filename?: string };
  readonly fails: boolean;
}> = [
  { what: 'an error thrown by our script', event: { error: new Error('x'), filename: 'https://game.example/play/assets/index-1.js' }, fails: true },
  { what: 'a value that is no Error, thrown by our script', event: { error: 'x', filename: 'https://game.example/play/assets/index-1.js' }, fails: true },
  { what: 'an error with no file named', event: { error: new Error('x'), filename: '' }, fails: true },
  { what: 'an error with no filename at all', event: { error: new Error('x') }, fails: true },
  { what: 'a ResizeObserver report: the page as its file, nothing thrown', event: { filename: PAGE }, fails: false },
  { what: 'a script the browser will not describe', event: { error: null, filename: '' }, fails: false },
  { what: "an extension's script", event: { error: new Error('x'), filename: 'moz-extension://abc/content.js' }, fails: false },
  { what: 'a script of another site', event: { error: new Error('x'), filename: 'https://other.example/x.js' }, fails: false },
  { what: 'a script of another port', event: { error: new Error('x'), filename: 'https://game.example:8443/x.js' }, fails: false },
];

// A file that didn't load reports at its element, with nothing thrown.
const FILES: ReadonlyArray<{ readonly what: string; readonly target: object; readonly fails: boolean }> = [
  { what: 'our bundle', target: { tagName: 'SCRIPT', src: 'https://game.example/play/assets/index-1.js' }, fails: true },
  { what: "an extension's script file", target: { tagName: 'SCRIPT', src: 'chrome-extension://abc/inject.js' }, fails: false },
  { what: 'a script file of another site', target: { tagName: 'SCRIPT', src: 'https://other.example/x.js' }, fails: false },
  { what: 'an image of ours', target: { tagName: 'IMG', src: 'https://game.example/play/x.png' }, fails: false },
  { what: 'a stylesheet of ours', target: { tagName: 'LINK', href: 'https://game.example/play/assets/index-1.css' }, fails: false },
];

/** Whether each report, on a fresh parsed page, changed the line's words. */
function verdicts(source: string): boolean[] {
  const said = (send: (page: WatchPage) => void): boolean => {
    const page = openPage(source);
    page.parsed();
    send(page);
    return page.words !== LOADING;
  };
  return [
    ...REPORTS.map((row) => said((page) => page.error({ target: page.window, ...row.event }))),
    ...FILES.map((row) => said((page) => page.error({ target: row.target }))),
  ];
}

const EXPECTED = [...REPORTS.map((row) => row.fails), ...FILES.map((row) => row.fails)];

describe('118f — the watch for a bundle that never ran', () => {
  const html = read('index.html');
  const source = watchSource(html) ?? '';

  it('reads planted pages: a watch out of the head, or behind another script, is a fault', () => {
    const good = '<head><script>w()</script></head><body><script type="module" src="/x"></script></body>';
    expect(watchFaults(good)).toEqual([]);
    expect(watchFaults('<head></head><body><script type="module" src="/x"></script></body>')).toEqual(['no classic script']);
    expect(watchFaults('<head></head><body><script>w()</script></body>')).toEqual(['the watch is not in the head']);
    expect(watchFaults('<head><script type="module" src="/x"></script><script>w()</script></head>')).toEqual([
      'a script comes before the watch',
    ]);
  });

  it('index.html holds the watch in its head, ahead of every other script', () => {
    expect(watchFaults(html)).toEqual([]);
    expect(source).not.toBe('');
  });

  it('reads planted scripts: each kind of newer syntax is named, and a string that holds one is not', () => {
    expect(modernSyntax('var a = function () { return "x => `y` let"; };')).toEqual([]);
    expect(modernSyntax('var a = () => 1;')).toEqual(['an arrow function']);
    expect(modernSyntax('var a = `x`;')).toEqual(['a template literal']);
    expect(modernSyntax('const a = 1; let b = a?.c ?? 2;')).toEqual(['const, let or class', 'optional chaining', '??']);
    expect(modernSyntax('f(...a); async function g() {}')).toEqual(['a spread', 'async or await']);
  });

  it('is written in syntax an old browser parses', () => {
    expect(modernSyntax(source)).toEqual([]);
  });

  it('listens in the capture phase, where a file that did not load is heard', () => {
    expect(openPage(source).capture).toBe(true);
  });

  it('tells planted watches apart: a deaf one and one that takes every report as a failure', () => {
    const deaf = '(function () {})();';
    const eager = `window.addEventListener('error', function () {
      document.getElementById('${ID}').textContent = 'failed';
    }, true);`;
    expect(verdicts(deaf)).toEqual(EXPECTED.map(() => false));
    expect(verdicts(eager)).toEqual(EXPECTED.map(() => true));
    expect(verdicts(deaf)).not.toEqual(EXPECTED);
    expect(verdicts(eager)).not.toEqual(EXPECTED);
  });

  it('changes the words for the reports that are the game failing, and for no other', () => {
    const got = verdicts(source);
    const rows = [...REPORTS, ...FILES].map((row, i) => `${row.what}: ${got[i]}`);
    const want = [...REPORTS, ...FILES].map((row) => `${row.what}: ${row.fails}`);
    expect(rows).toEqual(want);
  });

  it("gives an uncaught error the verdict the bundle's own watch gives it", () => {
    const origin = new URL(PAGE).origin;
    for (const row of REPORTS) expect(`${row.what}: ${errorEventCounts(row.event, origin)}`).toBe(`${row.what}: ${row.fails}`);
  });

  it('leaves a page that loads alone, and says its words once and for good', () => {
    const page = openPage(source);
    page.parsed();
    expect(page.words).toBe(LOADING);
    page.error({ target: { tagName: 'SCRIPT', src: 'https://game.example/play/assets/index-1.js' } });
    const words = page.words;
    expect(words).not.toBe(LOADING);
    expect((words ?? '').trim().length).toBeGreaterThan(20);
    page.error({ target: page.window, error: new Error('later'), filename: '' });
    expect(page.words).toBe(words);
  });

  it('says a failure heard before the line was parsed, once the line is there', () => {
    const page = openPage(source);
    page.error({ target: { tagName: 'SCRIPT', src: 'https://game.example/play/assets/index-1.js' } });
    expect(page.words).toBeNull();
    page.parsed();
    expect(page.words).not.toBe(LOADING);
  });

  it('does nothing once the game has taken the line down', () => {
    const page = openPage(source);
    page.parsed();
    page.booted();
    expect(() => page.error({ target: page.window, error: new Error('x'), filename: '' })).not.toThrow();
    expect(page.words).toBeNull();
  });

  it('speaks in a browser with no module scripts, which never asks for the bundle', () => {
    const old = openPage(source, false);
    old.parsed();
    expect(old.words).not.toBe(LOADING);
    const current = openPage(source, true);
    current.parsed();
    expect(current.words).toBe(LOADING);
  });
});
