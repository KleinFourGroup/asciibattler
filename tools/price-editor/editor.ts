/**
 * Price editor (50f). Standalone Vite page — visit
 * http://localhost:5173/tools/price-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Authors `config/prices.json` — the port price book (§50 shape-lock: unit
 * base × level curve ± jitter, packet/daemon per-id overrides over per-kind
 * defaults, one sell fraction, one flat removal fee, the entry stock
 * counts) — with the affordances the packet editor established:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME `PricesSchema`
 *     the game boots on (src/config/prices.ts) plus `assertPriceRefs`
 *     against the REAL catalogs (every draftable archetype priced; no
 *     orphan archetype / packet / daemon keys). The form is constrained so
 *     it can barely go invalid — a draftable archetype's row can't be
 *     removed, override ids come from the catalogs — but Save still gates
 *     on the real checks, not the form's goodwill.
 *  2. **Display honesty.** The resolved-price preview derives through the
 *     `*For` price cores (unitPriceFor / packetPriceFor / daemonPriceFor /
 *     sellPriceFor) on the WORKING document — the same formulas the game
 *     reads, never a re-derivation.
 *  3. **Save to disk.** Posts the formatted whole-file JSON (through
 *     `formatPricesJson`) to the dev-only `/__save-config` endpoint
 *     (vite.config.ts allowlists `prices.json`). Copy / Download stay as
 *     offline fallbacks; the save-reload stash restores the status line.
 *
 * One document, no tabs — prices.json is a single price book, not an item
 * catalog.
 */

import './editor.css';
import {
  PRICES,
  PricesSchema,
  assertPriceRefs,
  unitPriceFor,
  packetPriceFor,
  daemonPriceFor,
  sellPriceFor,
  type PricesConfig,
} from '../../src/config/prices';
import { ALL_ARCHETYPES, DRAFTABLE_ARCHETYPES } from '../../src/sim/archetypes';
import { PACKETS } from '../../src/config/packets';
import { DAEMONS } from '../../src/config/daemons';
import { formatPricesJson } from './format';

// ---- State ----
let working: PricesConfig = structuredClone(PRICES);
let lastValid = true;

const SAVE_STASH_KEY = 'priceEditor.justSaved';
const PREVIEW_LEVELS = [1, 2, 3, 5] as const;
const DRAFTABLE = new Set<string>(DRAFTABLE_ARCHETYPES);
const PACKET_ID_LIST = PACKETS.map((p) => p.id);
const DAEMON_ID_LIST = DAEMONS.map((d) => d.id);

// ---- DOM ----
const unitRowsEl = mustQuery<HTMLDivElement>('#unit-rows');
const addArchetypeSel = mustQuery<HTMLSelectElement>('#add-archetype-sel');
const addArchetypeBtn = mustQuery<HTMLButtonElement>('#add-archetype-btn');
const levelGrowthEl = mustQuery<HTMLInputElement>('#level-growth');
const jitterEl = mustQuery<HTMLInputElement>('#jitter');
const packetDefaultEl = mustQuery<HTMLInputElement>('#packet-default');
const packetOverridesEl = mustQuery<HTMLDivElement>('#packet-overrides');
const addPacketOverrideBtn = mustQuery<HTMLButtonElement>('#add-packet-override');
const daemonDefaultEl = mustQuery<HTMLInputElement>('#daemon-default');
const daemonOverridesEl = mustQuery<HTMLDivElement>('#daemon-overrides');
const addDaemonOverrideBtn = mustQuery<HTMLButtonElement>('#add-daemon-override');
const sellFractionEl = mustQuery<HTMLInputElement>('#sell-fraction');
const removalPriceEl = mustQuery<HTMLInputElement>('#removal-price');
const stockUnitsEl = mustQuery<HTMLInputElement>('#stock-units');
const stockPacketsEl = mustQuery<HTMLInputElement>('#stock-packets');
const stockDaemonsEl = mustQuery<HTMLInputElement>('#stock-daemons');
const previewUnitsEl = mustQuery<HTMLDListElement>('#preview-units');
const previewGoodsEl = mustQuery<HTMLDListElement>('#preview-goods');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build ----
attachScalars();
attachButtons();
rebuildAll();
restoreAfterSave();

/** The one-shot scalar inputs (everything but the two keyed maps). Values
 *  clamp at the input so the form stays saveable; the schema still gates. */
function attachScalars(): void {
  numInput(levelGrowthEl, working.units.levelGrowth, (v) => {
    working.units.levelGrowth = Math.max(1, v);
  });
  numInput(jitterEl, working.units.jitter, (v) => {
    working.units.jitter = Math.min(0.9, Math.max(0, v));
  });
  numInput(packetDefaultEl, working.packets.default, (v) => {
    working.packets.default = intAtLeast(1, v);
  });
  numInput(daemonDefaultEl, working.daemons.default, (v) => {
    working.daemons.default = intAtLeast(1, v);
  });
  numInput(sellFractionEl, working.sellFraction, (v) => {
    working.sellFraction = Math.min(1, Math.max(0, v));
  });
  numInput(removalPriceEl, working.unitRemovalPrice, (v) => {
    working.unitRemovalPrice = intAtLeast(0, v);
  });
  numInput(stockUnitsEl, working.portStock.units, (v) => {
    working.portStock.units = intAtLeast(0, v);
  });
  numInput(stockPacketsEl, working.portStock.packets, (v) => {
    working.portStock.packets = intAtLeast(0, v);
  });
  numInput(stockDaemonsEl, working.portStock.daemons, (v) => {
    working.portStock.daemons = intAtLeast(0, v);
  });
}

function attachButtons(): void {
  addArchetypeBtn.addEventListener('click', () => {
    const archetype = addArchetypeSel.value;
    if (!archetype || working.units.baseByArchetype[archetype] !== undefined) return;
    working.units.baseByArchetype[archetype] = 25;
    rebuildUnitRows();
    refreshDerived();
  });
  addPacketOverrideBtn.addEventListener('click', () => {
    addOverride(working.packets, PACKET_ID_LIST);
    rebuildOverrideRows();
    refreshDerived();
  });
  addDaemonOverrideBtn.addEventListener('click', () => {
    addOverride(working.daemons, DAEMON_ID_LIST);
    rebuildOverrideRows();
    refreshDerived();
  });
  saveBtn.addEventListener('click', () => void save());
  revertBtn.addEventListener('click', revert);
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(exportEl.value);
    flash(copyBtn, 'Copied!');
  });
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([`${exportEl.value}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prices.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- The unit-price rows ----
function rebuildUnitRows(): void {
  unitRowsEl.innerHTML = '';
  for (const archetype of Object.keys(working.units.baseByArchetype)) {
    const row = el('div', 'pool-row');
    row.appendChild(el('span', 'arch-name', archetype));
    if (DRAFTABLE.has(archetype)) {
      row.appendChild(el('span', 'badge', 'draftable'));
    }
    const priceWrap = el('label', 'pool-num');
    priceWrap.append(el('span', undefined, 'base'));
    const input = el('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = String(working.units.baseByArchetype[archetype]);
    input.addEventListener('input', () => {
      const v = Number.parseFloat(input.value);
      working.units.baseByArchetype[archetype] = intAtLeast(1, Number.isFinite(v) ? v : 1);
      refreshDerived();
    });
    priceWrap.appendChild(input);
    row.appendChild(priceWrap);

    const remove = el('button', 'pool-remove', '✕');
    remove.type = 'button';
    if (DRAFTABLE.has(archetype)) {
      remove.disabled = true;
      remove.title = 'Draftable — port stock rolls from the draft pool, so the price is required';
    } else {
      remove.title = 'Remove this price';
      remove.addEventListener('click', () => {
        delete working.units.baseByArchetype[archetype];
        rebuildUnitRows();
        refreshDerived();
      });
    }
    row.appendChild(remove);
    unitRowsEl.appendChild(row);
  }
  rebuildAddArchetypeSelect();
}

function rebuildAddArchetypeSelect(): void {
  addArchetypeSel.innerHTML = '';
  const unpriced = ALL_ARCHETYPES.filter(
    (a) => working.units.baseByArchetype[a] === undefined,
  );
  for (const a of unpriced) addArchetypeSel.appendChild(option(a));
  const none = unpriced.length === 0;
  addArchetypeSel.disabled = none;
  addArchetypeBtn.disabled = none;
  if (none) addArchetypeSel.appendChild(option('', '(every archetype is priced)'));
}

// ---- The override rows (packets / daemons share the machinery) ----
type PriceBook = PricesConfig['packets'];

function addOverride(book: PriceBook, catalogIds: readonly string[]): void {
  const free = catalogIds.find((id) => book.byId[id] === undefined);
  if (free === undefined) return;
  book.byId[free] = book.default;
}

/** Re-key an override in place, preserving the book's entry order (a
 *  delete+set would push the row to the bottom mid-edit). */
function rekeyOverride(book: PriceBook, from: string, to: string): void {
  const next: Record<string, number> = {};
  for (const [id, price] of Object.entries(book.byId)) {
    if (id === from) next[to] = price;
    else next[id] = price;
  }
  book.byId = next;
}

function buildOverrideRows(
  container: HTMLDivElement,
  book: PriceBook,
  catalogIds: readonly string[],
  nameOf: (id: string) => string,
  addBtn: HTMLButtonElement,
): void {
  container.innerHTML = '';
  const overridden = new Set(Object.keys(book.byId));
  for (const id of Object.keys(book.byId)) {
    const row = el('div', 'pool-row');

    const sel = el('select');
    sel.className = 'daemon-sel';
    for (const candidate of catalogIds) {
      if (candidate !== id && overridden.has(candidate)) continue;
      sel.appendChild(option(candidate, nameOf(candidate)));
    }
    sel.value = id;
    sel.addEventListener('change', () => {
      rekeyOverride(book, id, sel.value);
      rebuildOverrideRows();
      refreshDerived();
    });
    row.appendChild(sel);

    const priceWrap = el('label', 'pool-num');
    priceWrap.append(el('span', undefined, 'bits'));
    const input = el('input');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = String(book.byId[id]);
    input.addEventListener('input', () => {
      const v = Number.parseFloat(input.value);
      book.byId[id] = intAtLeast(1, Number.isFinite(v) ? v : 1);
      refreshDerived();
    });
    priceWrap.appendChild(input);
    row.appendChild(priceWrap);

    const remove = el('button', 'pool-remove', '✕');
    remove.type = 'button';
    remove.title = 'Remove this override (falls back to the default)';
    remove.addEventListener('click', () => {
      delete book.byId[id];
      rebuildOverrideRows();
      refreshDerived();
    });
    row.appendChild(remove);
    container.appendChild(row);
  }
  addBtn.disabled = catalogIds.every((id) => book.byId[id] !== undefined);
}

function rebuildOverrideRows(): void {
  buildOverrideRows(
    packetOverridesEl,
    working.packets,
    PACKET_ID_LIST,
    (id) => PACKETS.find((p) => p.id === id)?.name ?? id,
    addPacketOverrideBtn,
  );
  buildOverrideRows(
    daemonOverridesEl,
    working.daemons,
    DAEMON_ID_LIST,
    (id) => DAEMONS.find((d) => d.id === id)?.name ?? id,
    addDaemonOverrideBtn,
  );
}

function rebuildAll(): void {
  rebuildUnitRows();
  rebuildOverrideRows();
  syncScalarInputs();
  refreshDerived();
}

function syncScalarInputs(): void {
  levelGrowthEl.value = String(working.units.levelGrowth);
  jitterEl.value = String(working.units.jitter);
  packetDefaultEl.value = String(working.packets.default);
  daemonDefaultEl.value = String(working.daemons.default);
  sellFractionEl.value = String(working.sellFraction);
  removalPriceEl.value = String(working.unitRemovalPrice);
  stockUnitsEl.value = String(working.portStock.units);
  stockPacketsEl.value = String(working.portStock.packets);
  stockDaemonsEl.value = String(working.portStock.daemons);
}

// ---- Refresh ----
function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const issues: string[] = [];

  const result = PricesSchema.safeParse(working);
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
  try {
    assertPriceRefs(working, {
      archetypes: ALL_ARCHETYPES,
      draftable: DRAFTABLE_ARCHETYPES,
      packetIds: PACKET_ID_LIST,
      daemonIds: DAEMON_ID_LIST,
    });
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }

  lastValid = issues.length === 0;
  if (lastValid) {
    addValidation('ok', 'Valid — matches the game schema + the catalog refs. Safe to save.');
  } else {
    for (const text of issues) addValidation('error', text);
  }
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  exportEl.value = formatPricesJson(working);
}

/** Both previews derive through the `*For` cores on the WORKING document —
 *  the exact formulas the game charges with (display honesty). */
function refreshPreview(): void {
  previewUnitsEl.innerHTML = '';
  for (const archetype of Object.keys(working.units.baseByArchetype)) {
    const curve = PREVIEW_LEVELS.map(
      (level) => `L${level} ${unitPriceFor(working, archetype, level)}`,
    ).join(' · ');
    const draftable = DRAFTABLE.has(archetype);
    previewUnitsEl.append(
      el('dt', draftable ? undefined : 'muted', archetype + (draftable ? '' : ' (never stocked)')),
      el('dd', draftable ? undefined : 'muted', curve),
    );
  }

  previewGoodsEl.innerHTML = '';
  for (const packet of PACKETS) {
    const buy = packetPriceFor(working, packet.id);
    const override = working.packets.byId[packet.id] !== undefined ? ' (override)' : '';
    addRow(previewGoodsEl, packet.name, `${buy} bits → sells ${sellPriceFor(working, buy)}${override}`);
  }
  for (const daemon of DAEMONS) {
    const buy = daemonPriceFor(working, daemon.id);
    const override = working.daemons.byId[daemon.id] !== undefined ? ' (override)' : '';
    addRow(previewGoodsEl, daemon.name, `${buy} bits${override}`);
  }
  addRow(previewGoodsEl, 'remove a unit', `${working.unitRemovalPrice} bits (flat)`);
  addRow(
    previewGoodsEl,
    'stock per dock',
    `${working.portStock.units} units · ${working.portStock.packets} packets · ${working.portStock.daemons} daemons`,
  );
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!lastValid) return;
  setSaveStatus('Saving…', 'hint');
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'prices.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const status =
        `Saved to config/prices.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new book.`;
      setSaveStatus(status, 'ok');
      try {
        sessionStorage.setItem(SAVE_STASH_KEY, JSON.stringify({ status }));
      } catch {
        // sessionStorage unavailable — non-fatal (see the reward editor).
      }
    } else {
      setSaveStatus(`Save failed: ${data.error ?? res.statusText}`, 'err');
    }
  } catch (err) {
    setSaveStatus(`Save failed: ${String(err)} — is the dev server running?`, 'err');
  }
}

function revert(): void {
  working = structuredClone(PRICES);
  rebuildAll();
  setSaveStatus('Reverted to the committed config (not yet saved).', 'hint');
}

function restoreAfterSave(): void {
  let stash: string | null = null;
  try {
    stash = sessionStorage.getItem(SAVE_STASH_KEY);
    if (stash) sessionStorage.removeItem(SAVE_STASH_KEY);
  } catch {
    return;
  }
  if (!stash) return;
  try {
    const { status } = JSON.parse(stash) as { status?: string };
    if (status) setSaveStatus(status, 'ok');
  } catch {
    // Malformed stash — ignore.
  }
}

// ---- Small helpers (the packet editor's set) ----
function numInput(input: HTMLInputElement, initial: number, apply: (v: number) => void): void {
  input.value = String(initial);
  input.addEventListener('input', () => {
    const v = Number.parseFloat(input.value);
    if (Number.isFinite(v)) apply(v);
    refreshDerived();
  });
}

function intAtLeast(floor: number, v: number): number {
  return Math.max(floor, Math.trunc(v));
}

function addRow(dl: HTMLDListElement, term: string, value: string, muted = false): void {
  const dt = el('dt', muted ? 'muted' : undefined, term);
  const dd = el('dd', muted ? 'muted' : undefined, value);
  dl.append(dt, dd);
}

function addValidation(level: 'ok' | 'error', text: string): void {
  validationEl.appendChild(el('li', level, text));
}

function setSaveStatus(text: string, cls: 'hint' | 'ok' | 'err'): void {
  saveStatusEl.textContent = text;
  saveStatusEl.className = cls === 'hint' ? 'hint' : `hint ${cls}`;
}

function flash(btn: HTMLButtonElement, label: string): void {
  const original = btn.textContent;
  btn.textContent = label;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 800);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function option(value: string, label = value): HTMLOptionElement {
  const o = el('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function mustQuery<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`price-editor: missing element "${selector}"`);
  return node;
}
