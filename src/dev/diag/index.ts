/**
 * THE DIAGNOSTICS PANEL (116l): what a build's storage is like in the shell it
 * runs in, read from inside that shell. It exists for the places a dev page
 * can't go: a production build in itch's iframe, in a real browser's own
 * storage, in the Electron window.
 *
 * ONLY A BUILD MADE WITH `VITE_DIAG=1` CARRIES IT. `main.ts` loads this module
 * by a dynamic import behind that constant, so a build made without it has no
 * part of this file (README "The diagnostics build").
 *
 * What it adds to the page:
 *  - a `diag` tab on the right edge, which opens the panel;
 *  - a wrapper round the store's three writing calls, which times each one
 *    (the serialization and the adapter's write together, as the game pays
 *    for them) and counts it by section. The tally is kept across page loads
 *    in `asciibattler:diag`, a key that is no section of the store;
 *  - `window.__diag`, the same readings for a script.
 *
 * The panel reads on demand: where the page is, what the store and the
 * two-tab lock said at boot and say now, what the browser's storage holds
 * (ours and not ours), the tally, and on two buttons the storage's limit and
 * a write's cost by size (measure.ts). The report leaves by Copy, by the text
 * box itself, or by Save as file, which goes through the game's own download
 * (src/ui/download.ts), so it is also the check that a download works here.
 *
 * Dev chrome, outside every UI idiom, as the board explorer is: it mounts on
 * `<body>`, carries its own injected `<style>`, and its English is not in the
 * locale catalogs.
 */

import { BUILD_ID } from '../../buildId';
import { store } from '../../store';
import { NAMESPACE, SECTION_NAMES, storageKey, type LenientSection, type StrictSection } from '../../store/store';
import { RUN_LOCK_NAME, type RunLock } from '../../store/runLock';
import { downloadText } from '../../ui/download';
import {
  WriteTally,
  censusOf,
  describeError,
  findLimit,
  textFrom,
  timeWrites,
  timerResolution,
  type BenchRow,
  type Census,
  type LimitResult,
  type StorageLike,
  type TallyJson,
} from './measure';

/** The tally's key and the two scratch keys. None is a section, so a restore
 *  of the store leaves them alone. */
const TALLY_KEY = `${NAMESPACE}diag`;
const FILL_KEY = `${NAMESPACE}diag-fill`;
const BENCH_KEY = `${NAMESPACE}diag-bench`;

/** The longest fill tried: past a stock browser's limit several times over. */
const LIMIT_CEILING = 64 * 1024 * 1024;
const LIMIT_STEP = 1024;

/** A save is 3 to 49 KB and its journal some 15 KB more; the finished
 *  journals are kept to 1,000,000 characters and written once a run. */
const BENCH_PLAN = [
  { chars: 4 * 1024, reps: 50 },
  { chars: 16 * 1024, reps: 50 },
  { chars: 64 * 1024, reps: 50 },
  { chars: 256 * 1024, reps: 20 },
  { chars: 1024 * 1024, reps: 10 },
] as const;

/** How long a browser's own answer is waited for before it is called silent. */
const ANSWER_MS = 2000;

export interface DiagReport {
  readonly diagnostics: 1;
  readonly at: string;
  readonly build: string;
  readonly page: {
    readonly href: string;
    readonly origin: string;
    readonly embedded: boolean | string;
    readonly ancestorOrigins: readonly string[] | null;
    readonly referrer: string;
    readonly secureContext: boolean;
    readonly userAgent: string;
    readonly window: string;
  };
  readonly store: {
    readonly adapter: string;
    readonly canSave: boolean;
    readonly error: string | null;
    /** The build that last stamped the store before this page; null for a
     *  store that was empty at boot. */
    readonly previousBuild: string | null;
    /** Each section's stored characters; null where nothing is stored. */
    readonly sections: Record<string, number | null> | string;
    readonly journals: JournalsSummary | string | null;
  };
  readonly lock: {
    /** What the page was told at boot (src/store/runLock.ts). */
    readonly atBoot: RunLock;
    readonly api: boolean;
    /** Whether the manager lists the run lock as held now, by any tab. */
    readonly heldNow: boolean | string;
    readonly otherLocks: number | null;
    readonly queryMs: number | null;
  };
  readonly browser: {
    readonly estimate: { readonly usage: number | null; readonly quota: number | null } | string;
    readonly persisted: boolean | string;
    readonly hasStorageAccess: boolean | string;
  };
  readonly localStorage: Census | string;
  readonly writes: TallyJson;
  readonly clockStepMs: number;
  readonly leftoverFillRemoved: boolean;
  readonly limit: { readonly ascii: LimitResult | string; readonly twoByte: LimitResult | string } | null;
  readonly bench: readonly BenchRow[] | string | null;
}

interface JournalsSummary {
  readonly count: number;
  /** Per finished journal, oldest first. */
  readonly runs: readonly {
    readonly chars: number;
    readonly segments: number;
    readonly entries: number;
    readonly battles: number;
    readonly dials: string;
    readonly end: string;
  }[];
}

export interface DiagHandle {
  report(): Promise<DiagReport>;
  measureLimit(): DiagReport['limit'];
  bench(): DiagReport['bench'];
}

/** The page's `localStorage`, or why it can't be had. */
function webStorage(): StorageLike | string {
  try {
    const storage = window.localStorage as Storage | undefined;
    if (storage === undefined || storage === null) return 'no localStorage on this page';
    storage.getItem(TALLY_KEY);
    return storage;
  } catch (err) {
    return describeError(err);
  }
}

/** `promise`'s value, or a word for why there is none. */
async function answer<T>(make: () => Promise<T> | undefined): Promise<T | string> {
  try {
    const promise = make();
    if (promise === undefined) return 'not offered';
    return await Promise.race([
      promise,
      new Promise<string>((resolve) => setTimeout(() => resolve(`no answer in ${ANSWER_MS} ms`), ANSWER_MS)),
    ]);
  } catch (err) {
    return describeError(err);
  }
}

function summarizeJournals(text: string | null): JournalsSummary | string | null {
  if (text === null) return null;
  try {
    const data = (JSON.parse(text) as { data?: unknown }).data;
    if (!Array.isArray(data)) return 'the journals section holds no list';
    const runs = data.map((journal: unknown) => {
      const segments = ((journal as { segments?: unknown }).segments ?? []) as readonly {
        readonly start?: { readonly dials?: string };
        readonly entries?: readonly { readonly t?: string }[];
        readonly end?: { readonly reason?: string } | null;
      }[];
      const entries = segments.flatMap((s) => s.entries ?? []);
      return {
        chars: JSON.stringify(journal).length,
        segments: segments.length,
        entries: entries.length,
        battles: entries.filter((e) => e.t === 'battle').length,
        dials: segments[0]?.start?.dials ?? '',
        end: segments.at(-1)?.end?.reason ?? 'open',
      };
    });
    return { count: runs.length, runs };
  } catch (err) {
    return describeError(err);
  }
}

const CSS = `
.diag-tab {
  position: fixed; right: 0; top: 50%; z-index: 3000; transform: translateY(-50%);
  padding: 10px 3px; writing-mode: vertical-rl;
  background: rgba(8, 12, 10, 0.92); color: #7fd69a; border: 1px solid #3c6b4a; border-right: 0;
  border-radius: 3px 0 0 3px; font: 11px/1 'JetBrains Mono', 'DejaVu Sans Mono', monospace; cursor: pointer;
}
.diag-panel {
  position: fixed; right: 8px; top: 8px; bottom: 8px; z-index: 3000;
  width: min(560px, calc(100vw - 16px)); box-sizing: border-box; padding: 8px 10px 10px;
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(8, 12, 10, 0.96); color: #cfe8d4; border: 1px solid #3c6b4a; border-radius: 3px;
  font: 12px/1.35 'JetBrains Mono', 'DejaVu Sans Mono', monospace;
}
.diag-panel[hidden] { display: none; }
.diag-panel h2 { margin: 0; font-size: 12px; font-weight: 400; color: #7fd69a; }
.diag-panel .diag-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.diag-panel button {
  background: #0d1510; color: inherit; border: 1px solid #3c6b4a; font: inherit; padding: 3px 8px; cursor: pointer;
}
.diag-panel button:hover, .diag-panel button:focus-visible, .diag-tab:hover, .diag-tab:focus-visible { border-color: #7fd69a; }
.diag-panel button:disabled { color: #6f8f78; cursor: default; border-color: #2a4634; }
.diag-panel .diag-note { color: #ffd37a; min-height: 1.35em; white-space: pre-wrap; }
.diag-panel textarea {
  flex: 1; min-height: 0; resize: none; background: #05080a; color: #e6f4e9; border: 1px solid #3c6b4a;
  font: 11px/1.3 'JetBrains Mono', 'DejaVu Sans Mono', monospace; padding: 6px; white-space: pre;
}
`;

export function installDiag(options: { readonly runLock: RunLock }): DiagHandle {
  const now = (): number => performance.now();
  const storage = webStorage();

  // A fill key left by a measurement that was cut off would hold the quota.
  let leftoverFillRemoved = false;
  if (typeof storage !== 'string') {
    try {
      for (const key of [FILL_KEY, BENCH_KEY]) {
        if (storage.getItem(key) !== null) {
          storage.removeItem(key);
          leftoverFillRemoved = true;
        }
      }
    } catch {
      // The report's own reads say what the storage refuses.
    }
  }

  // --- the tally of the game's own writes ---
  let stored: string | null = null;
  if (typeof storage !== 'string') {
    try {
      stored = storage.getItem(TALLY_KEY);
    } catch {
      stored = null;
    }
  }
  const tally = WriteTally.from(stored, new Date().toISOString());
  tally.countLoad();
  const keepTally = (): void => {
    if (typeof storage === 'string') return;
    try {
      storage.setItem(TALLY_KEY, JSON.stringify(tally));
    } catch {
      // A full storage keeps the tally in memory only.
    }
  };
  keepTally();
  window.addEventListener('pagehide', keepTally);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') keepTally();
  });

  const charsOf = (value: unknown): number => {
    try {
      return JSON.stringify(value)?.length ?? 0;
    } catch {
      return 0;
    }
  };
  // The store's methods are closures over its own state, so each can be
  // called through the reference taken here.
  const { writeStrict, patch, clear } = store;
  store.writeStrict = <Wire, Loaded>(section: StrictSection<Wire, Loaded>, wire: Wire): boolean => {
    const t0 = now();
    const ok = writeStrict(section, wire);
    tally.record(section.name, now() - t0, ok, charsOf(wire));
    return ok;
  };
  store.patch = <T extends object>(section: LenientSection<T>, changes: Partial<T>): boolean => {
    const t0 = now();
    const ok = patch(section, changes);
    tally.record(section.name, now() - t0, ok, charsOf(store.read(section)));
    return ok;
  };
  store.clear = (section): boolean => {
    const t0 = now();
    const ok = clear(section);
    tally.record(`${section.name}.clear`, now() - t0, ok, 0);
    return ok;
  };

  // --- the readings ---
  let limit: DiagReport['limit'] = null;
  let bench: DiagReport['bench'] = null;

  const lockNow = async (): Promise<DiagReport['lock']> => {
    const locks = (navigator as { locks?: { query?: () => Promise<{ held?: { name?: string }[] }> } }).locks;
    const api = locks !== undefined && typeof locks.query === 'function';
    if (!api) return { atBoot: options.runLock, api, heldNow: 'no lock manager', otherLocks: null, queryMs: null };
    const t0 = now();
    const state = await answer(() => locks.query!());
    const queryMs = now() - t0;
    if (typeof state === 'string') return { atBoot: options.runLock, api, heldNow: state, otherLocks: null, queryMs };
    const held = state.held ?? [];
    return {
      atBoot: options.runLock,
      api,
      heldNow: held.some((l) => l.name === RUN_LOCK_NAME),
      otherLocks: held.filter((l) => l.name !== RUN_LOCK_NAME).length,
      queryMs,
    };
  };

  const report = async (): Promise<DiagReport> => {
    const status = store.status();
    const dump = store.dump();
    const sections: Record<string, number | null> = {};
    if (dump !== null) for (const name of SECTION_NAMES) sections[name] = dump[name]?.length ?? null;
    let embedded: boolean | string;
    try {
      embedded = window.self !== window.top;
    } catch (err) {
      embedded = describeError(err);
    }
    const ancestors = (location as { ancestorOrigins?: ArrayLike<string> }).ancestorOrigins;
    const estimate = await answer(() => navigator.storage?.estimate?.());
    let census: Census | string;
    try {
      census = typeof storage === 'string' ? storage : censusOf(storage, NAMESPACE);
    } catch (err) {
      census = describeError(err);
    }
    return {
      diagnostics: 1,
      at: new Date().toISOString(),
      build: BUILD_ID,
      page: {
        href: location.href,
        origin: location.origin,
        embedded,
        ancestorOrigins: ancestors === undefined ? null : Array.from(ancestors),
        referrer: document.referrer,
        secureContext: window.isSecureContext,
        userAgent: navigator.userAgent,
        window: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`,
      },
      store: {
        adapter: status.adapter,
        canSave: status.canSave,
        error: status.error,
        previousBuild: store.previousBuild,
        sections: dump === null ? 'the store cannot read its storage' : sections,
        journals: dump === null ? null : summarizeJournals(dump.journals),
      },
      lock: await lockNow(),
      browser: {
        estimate:
          typeof estimate === 'string' ? estimate : { usage: estimate.usage ?? null, quota: estimate.quota ?? null },
        persisted: await answer(() => navigator.storage?.persisted?.()),
        hasStorageAccess: await answer(() => document.hasStorageAccess?.()),
      },
      localStorage: census,
      writes: tally.toJSON(),
      clockStepMs: timerResolution(now, 5),
      leftoverFillRemoved,
      limit,
      bench,
    };
  };

  const measureLimit = (): DiagReport['limit'] => {
    const run = (unit: string): LimitResult | string => {
      if (typeof storage === 'string') return storage;
      try {
        return findLimit(storage, FILL_KEY, { ceiling: LIMIT_CEILING, step: LIMIT_STEP, unit });
      } catch (err) {
        return describeError(err);
      }
    };
    // Twice: a storage may count characters or bytes, and a save's text is
    // nearly all one-byte. The second fill is a Cyrillic letter, made from
    // its code so no glyph outside the shipped fonts stands in this file
    // (tests/font-coverage.test.ts reads every string a page could draw).
    limit = { ascii: run('x'), twoByte: run(String.fromCharCode(0x44f)) };
    return limit;
  };

  const runBench = (): DiagReport['bench'] => {
    if (typeof storage === 'string') {
      bench = storage;
      return bench;
    }
    try {
      // A save's own text where one is stored, so the writes are of the kind
      // the game makes; else the store's other text.
      const source =
        storage.getItem(storageKey('run')) ?? storage.getItem(storageKey('settings')) ?? '{"v":47,"build":"","data":{}}';
      bench = timeWrites(storage, BENCH_KEY, BENCH_PLAN, (chars, variant) => textFrom(source, chars, variant), now);
    } catch (err) {
      bench = describeError(err);
    }
    return bench;
  };

  // --- the panel ---
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'diag-tab';
  tab.textContent = 'diag';

  const panel = document.createElement('div');
  panel.className = 'diag-panel';
  panel.hidden = true;
  const head = document.createElement('h2');
  head.textContent = `Diagnostics · ${BUILD_ID}`;
  const buttons = document.createElement('div');
  buttons.className = 'diag-buttons';
  const note = document.createElement('div');
  note.className = 'diag-note';
  const text = document.createElement('textarea');
  text.readOnly = true;
  text.spellcheck = false;
  panel.append(head, buttons, note, text);

  const refresh = async (said = ''): Promise<void> => {
    text.value = JSON.stringify(await report(), null, 1);
    note.textContent = said;
  };
  const button = (label: string, onClick: () => void | Promise<void>): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.addEventListener('click', () => void onClick());
    buttons.appendChild(el);
    return el;
  };

  button('Refresh', () => refresh('Read again.'));
  button('Copy', async () => {
    await refresh();
    try {
      await navigator.clipboard.writeText(text.value);
      note.textContent = 'Copied.';
    } catch (err) {
      // A frame may be refused the clipboard: fall back to the old command,
      // and failing that the text box is there to select.
      text.focus();
      text.select();
      const copied = document.execCommand('copy');
      note.textContent = copied
        ? `Copied (the old way; the clipboard said ${describeError(err)}).`
        : `The clipboard refused (${describeError(err)}). The text is selected: press Ctrl+C.`;
    }
  });
  button('Save as file', async () => {
    await refresh();
    const name = `asciibattler-diag-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    downloadText(name, text.value);
    note.textContent = `Asked the browser to save ${name}. If no file was offered, downloads are blocked here.`;
  });
  const limitButton = button('Storage limit', async () => {
    note.textContent = 'Measuring: the page stands still for a few seconds.';
    // Let the line above paint before the page is held.
    await new Promise((resolve) => setTimeout(resolve, 50));
    measureLimit();
    await refresh('The storage limit is under "limit". The fill key is removed.');
  });
  const benchButton = button('Time writes', async () => {
    note.textContent = 'Timing writes.';
    await new Promise((resolve) => setTimeout(resolve, 50));
    runBench();
    await refresh('The write timings are under "bench".');
  });
  // The store's writes under Electron go to its file, so the page's
  // `localStorage` says nothing about them.
  if (store.status().adapter !== 'web') {
    limitButton.disabled = true;
    benchButton.disabled = true;
  }
  button('Close', () => {
    panel.hidden = true;
    tab.hidden = false;
    tab.focus();
  });

  tab.addEventListener('click', () => {
    panel.hidden = false;
    tab.hidden = true;
    void refresh(
      store.status().adapter === 'web'
        ? ''
        : 'This store is a file, not localStorage: the two measuring buttons are off.',
    );
  });
  // Keys typed in the panel stay in it: the game's key registry listens on
  // the window for bare keys, and Space on a button here would pause a fight.
  for (const el of [panel, tab]) el.addEventListener('keydown', (e) => e.stopPropagation());

  document.body.append(tab, panel);

  const handle: DiagHandle = { report, measureLimit, bench: runBench };
  (window as unknown as { __diag: DiagHandle }).__diag = handle;
  return handle;
}
