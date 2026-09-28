/**
 * The shell spike's boot read (§110b). This module runs BEFORE the game's
 * module graph: it has no static import of the game, reads the store with no
 * `await` before the read, shows what it found, and only then imports the
 * game. The readout answers the spike's web and Electron storage questions:
 * does the value survive a reload, a closed tab, a browser restart, and is
 * the store readable synchronously at boot in each shell.
 *
 * `?spike-deny` plants a throwing store, the readout's known answer for a
 * blocked `localStorage`. Disposed of at 110f with the rest of shell/spike.
 */

export {};

const KEY = 'asciibattler.spike110';

interface ShellStore {
  readonly shell: string;
  readonly initial: string | null;
  write(text: string): Promise<boolean>;
}

interface Boots {
  boots: number;
  first: string;
  last: string;
}

const shellStore = (window as unknown as { shellStore?: ShellStore }).shellStore;
const params = new URLSearchParams(location.search);
const planted = params.has('spike-deny');

const describe = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

// --- the read: synchronous, before anything of the game's loads ------------

const readAt = performance.now();
const uiChildrenAtRead = document.querySelector('#ui')?.childElementCount ?? -1;
let raw: string | null = null;
let readError: string | null = null;
try {
  if (planted) throw new DOMException('planted by ?spike-deny', 'SecurityError');
  raw = shellStore ? shellStore.initial : localStorage.getItem(KEY);
} catch (err) {
  readError = describe(err);
}

let previous: Boots | null = null;
let parseError: string | null = null;
if (raw !== null && raw !== '') {
  try {
    const parsed = JSON.parse(raw) as Partial<Boots>;
    if (typeof parsed.boots === 'number' && typeof parsed.first === 'string') {
      previous = { boots: parsed.boots, first: parsed.first, last: String(parsed.last) };
    } else parseError = 'not a spike record';
  } catch (err) {
    parseError = describe(err);
  }
}

const now = new Date().toISOString();
const next: Boots = {
  boots: (previous?.boots ?? 0) + 1,
  first: previous?.first ?? now,
  last: now,
};

// --- the readout -----------------------------------------------------------

const embedded = ((): boolean | string => {
  try {
    return window.top !== window;
  } catch (err) {
    return describe(err);
  }
})();
const ancestors = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;

const report = {
  shell: shellStore ? shellStore.shell : 'web',
  origin: location.origin,
  href: location.href,
  embedded,
  ancestorOrigins: ancestors ? Array.from(ancestors) : null,
  referrer: document.referrer,
  userAgent: navigator.userAgent,
  read: {
    atMs: Math.round(readAt),
    uiChildrenAtRead,
    threw: readError,
    raw,
    parseError,
    previous,
  },
  wrote: { value: next as Boots | null, error: null as string | null },
  cookieEnabled: navigator.cookieEnabled,
  persisted: null as boolean | string | null,
  hasStorageAccess: null as boolean | string | null,
  estimate: null as { usage: number | undefined; quota: number | undefined } | string | null,
  game: 'loading' as string,
  done: false,
};
(window as unknown as { __spike110: typeof report }).__spike110 = report;

const panel = document.createElement('div');
panel.setAttribute('role', 'status');
panel.style.cssText = [
  'position:fixed', 'top:8px', 'right:8px', 'z-index:5000', 'max-width:420px',
  'padding:10px 12px', 'background:#000d', 'border:1px solid #33ff00', 'color:#cfc',
  'font:14px/1.4 monospace', 'white-space:pre-wrap', 'word-break:break-all',
].join(';');
const text = document.createElement('div');
const row = document.createElement('div');
row.style.cssText = 'display:flex;gap:8px;margin-top:8px';
const button = (label: string, onClick: () => void): void => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = 'font:13px monospace;padding:4px 8px;background:#111;color:#cfc;border:1px solid #33ff00;cursor:pointer';
  b.addEventListener('click', onClick);
  row.append(b);
};
panel.append(text, row);

function render(): void {
  const r = report;
  const lines = [
    `SHELL SPIKE 110 · ${r.shell}`,
    `boots here: ${r.wrote.value?.boots ?? '?'}  (first ${r.wrote.value?.first ?? '?'})`,
    `read: ${r.read.threw ? `THREW ${r.read.threw}` : r.read.raw === null || r.read.raw === '' ? 'empty (a new player)' : r.read.parseError ? `unparseable: ${r.read.parseError}` : 'ok'}`,
    `write: ${r.wrote.error ? `FAILED ${r.wrote.error}` : 'ok'}`,
    `origin: ${r.origin}`,
    `embedded: ${String(r.embedded)}${r.ancestorOrigins ? ` in ${r.ancestorOrigins.join(' < ') || '—'}` : ''}`,
    `persisted: ${String(r.persisted)} · storage access: ${String(r.hasStorageAccess)}`,
    `game: ${r.game}`,
  ];
  text.textContent = lines.join('\n');
}

async function copyReport(): Promise<void> {
  const json = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    return;
  } catch {
    // An iframe may not be allowed the clipboard API; fall back to a selection.
  }
  const area = document.createElement('textarea');
  area.value = json;
  document.body.append(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

button('Copy', () => void copyReport());
button('Reset', () => {
  try {
    if (shellStore) void shellStore.write('');
    else localStorage.removeItem(KEY);
    report.game = 'reset: reload to start from boot 1';
  } catch (err) {
    report.game = `reset failed: ${describe(err)}`;
  }
  render();
});
button('Hide', () => panel.remove());
document.body.append(panel);
render();

// --- the write, then the async facts, then the game --------------------------

try {
  if (planted) throw new DOMException('planted by ?spike-deny', 'SecurityError');
  const serialized = JSON.stringify(next);
  if (shellStore) await shellStore.write(serialized);
  else localStorage.setItem(KEY, serialized);
} catch (err) {
  report.wrote = { value: null, error: describe(err) };
}

const storage = navigator.storage as StorageManager | undefined;
try {
  report.persisted = storage ? await storage.persisted() : 'no navigator.storage';
} catch (err) {
  report.persisted = describe(err);
}
try {
  const est = storage ? await storage.estimate() : null;
  report.estimate = est ? { usage: est.usage, quota: est.quota } : 'no navigator.storage';
} catch (err) {
  report.estimate = describe(err);
}
try {
  const doc = document as Document & { hasStorageAccess?: () => Promise<boolean> };
  report.hasStorageAccess = doc.hasStorageAccess ? await doc.hasStorageAccess() : 'no API';
} catch (err) {
  report.hasStorageAccess = describe(err);
}
render();

try {
  await import('../../src/main');
  report.game = 'booted';
} catch (err) {
  report.game = `FAILED ${describe(err)}`;
}
report.done = true;
render();
