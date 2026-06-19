/**
 * Sector editor (T3). Standalone Vite page — visit
 * http://localhost:5173/tools/sector-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Edits `config/sectors.json` — each sector's id / title / description / length
 * (node-map hop count) / theme / layout POOL (each entry a layoutId + optional
 * hop gate + optional roll weight) — with the same three affordances the
 * archetype/layout editors give:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME `SectorsSchema`
 *     the game boots on (imported from `src/config/sectors.ts`), so "is this
 *     valid?" can't drift from the game's load-time parse. Save is disabled
 *     while invalid (an unknown layoutId, a hop with no eligible board, etc.).
 *  2. **Live weighted-pool preview.** Pick a hop; see the eligible pool and each
 *     board's roll chance — the SAME `weight / total` weighted pick
 *     `rollEncounterMap` makes — so the procedural-vs-authored mix is tunable by
 *     feel (the T2 weight seam made visible).
 *  3. **Save to disk.** Posts the formatted whole-file JSON to the dev-only
 *     `/__save-config` endpoint (vite.config.ts allowlists `sectors.json`).
 *     Copy / Download stay as offline fallbacks.
 *
 * The theme + layoutId choices enumerate from the live `THEMES` / `LAYOUT_IDS`
 * registries (+ the procedural sentinel), so a new theme or layout surfaces here
 * with no edit. The sector-selection DAG (`config/sector-map.json`) stays
 * hand-edited JSON this round — this editor owns sectors, not the graph.
 */

import './editor.css';
import {
  SECTORS,
  SectorsSchema,
  PROCEDURAL_LAYOUT_ID,
  layoutPoolAtHop,
  type SectorDef,
  type SectorLayoutEntry,
} from '../../src/config/sectors';
import { LAYOUT_IDS, THEMES, type Theme } from '../../src/sim/layouts';
import { formatSectorsJson } from './format';

// ---- State ----
// `working` is a deep, mutable clone of the committed config; the form mutates
// it, the schema validates it, the formatter emits it. SECTORS stays the
// pristine baseline that "Revert all" restores from.
let working: SectorDef[] = structuredClone(SECTORS) as SectorDef[];
let activeIndex = 0;
let previewHop = 0;
let lastValid = true;

/** The layoutId dropdown pool: the procedural sentinel first, then every real
 *  layout. */
const LAYOUT_OPTIONS: readonly string[] = [PROCEDURAL_LAYOUT_ID, ...LAYOUT_IDS];

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const idEl = mustQuery<HTMLInputElement>('#id');
const titleEl = mustQuery<HTMLInputElement>('#title');
const descEl = mustQuery<HTMLTextAreaElement>('#description');
const lengthEl = mustQuery<HTMLInputElement>('#length');
const themeEl = mustQuery<HTMLSelectElement>('#theme');
const poolEl = mustQuery<HTMLDivElement>('#pool');
const addLayoutBtn = mustQuery<HTMLButtonElement>('#add-layout-btn');
const previewEl = mustQuery<HTMLDListElement>('#preview');
const previewHopEl = mustQuery<HTMLInputElement>('#preview-hop');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build (structure is constant; values sync per sector) ----
buildThemeOptions();
attachIdentity();
attachPreviewControls();
attachButtons();
selectSector(activeIndex);

function buildThemeOptions(): void {
  themeEl.innerHTML = '';
  for (const theme of THEMES) {
    const opt = document.createElement('option');
    opt.value = theme;
    opt.textContent = theme;
    themeEl.appendChild(opt);
  }
}

function attachIdentity(): void {
  idEl.addEventListener('input', () => {
    sector().id = idEl.value;
    refreshTabs();
    refreshDerived();
  });
  titleEl.addEventListener('input', () => {
    sector().title = titleEl.value;
    refreshTabs();
    refreshDerived();
  });
  descEl.addEventListener('input', () => {
    sector().description = descEl.value;
    refreshDerived();
  });
  lengthEl.addEventListener('input', () => {
    const n = Number.parseInt(lengthEl.value, 10);
    sector().length = Number.isFinite(n) ? n : 0;
    refreshDerived();
  });
  themeEl.addEventListener('change', () => {
    sector().theme = themeEl.value as Theme;
    refreshDerived();
  });
}

function attachPreviewControls(): void {
  previewHopEl.addEventListener('input', () => {
    const n = Number.parseInt(previewHopEl.value, 10);
    previewHop = Number.isFinite(n) && n >= 0 ? n : 0;
    refreshPreview();
  });
}

function attachButtons(): void {
  newBtn.addEventListener('click', addSector);
  addLayoutBtn.addEventListener('click', addLayoutEntry);
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
    a.download = 'sectors.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- Sector + pool mutation ----
function sector(): SectorDef {
  return working[activeIndex]!;
}

function addSector(): void {
  // A blank-but-valid sector: a unique id, a single ungated procedural board.
  let n = working.length + 1;
  let id = `sector-${n}`;
  while (working.some((s) => s.id === id)) id = `sector-${++n}`;
  working.push({
    id,
    title: 'New Sector',
    description: 'A new sector.',
    length: 5,
    theme: 'default',
    layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }],
  });
  selectSector(working.length - 1);
}

function addLayoutEntry(): void {
  sector().layouts.push({ layoutId: PROCEDURAL_LAYOUT_ID });
  buildPool();
  refreshDerived();
}

function removeLayoutEntry(index: number): void {
  sector().layouts.splice(index, 1);
  buildPool();
  refreshDerived();
}

// ---- Build the per-sector pool rows ----
function buildPool(): void {
  poolEl.innerHTML = '';
  sector().layouts.forEach((entry, i) => poolEl.appendChild(makePoolRow(entry, i)));
}

function makePoolRow(entry: SectorLayoutEntry, index: number): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'pool-row';

  const select = document.createElement('select');
  select.className = 'pool-layout';
  for (const id of LAYOUT_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id === PROCEDURAL_LAYOUT_ID ? `${id} (sentinel)` : id;
    select.appendChild(opt);
  }
  select.value = entry.layoutId;
  select.addEventListener('change', () => {
    entry.layoutId = select.value;
    refreshDerived();
  });

  const minHop = makeOptionalNumber('minHop', entry.minHop, (v) => {
    if (v === undefined) delete entry.minHop;
    else entry.minHop = v;
    refreshDerived();
  });
  const weight = makeOptionalNumber('weight', entry.weight, (v) => {
    if (v === undefined) delete entry.weight;
    else entry.weight = v;
    refreshDerived();
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'pool-remove';
  remove.textContent = '✕';
  remove.title = 'Remove this board from the pool';
  remove.addEventListener('click', () => removeLayoutEntry(index));

  row.append(select, minHop, weight, remove);
  return row;
}

/** An optional numeric field (blank = the field is omitted from the entry). */
function makeOptionalNumber(
  label: string,
  value: number | undefined,
  onChange: (value: number | undefined) => void,
): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'pool-num';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.placeholder = label === 'weight' ? '1' : '0';
  input.value = value === undefined ? '' : String(value);
  input.addEventListener('input', () => {
    const raw = input.value.trim();
    if (raw === '') {
      onChange(undefined);
      return;
    }
    const n = Number.parseFloat(raw);
    onChange(Number.isFinite(n) ? n : undefined);
  });
  wrap.append(span, input);
  return wrap;
}

// ---- Refresh ----
function selectSector(index: number): void {
  activeIndex = index;
  syncForm();
  buildPool();
  refreshTabs();
  refreshDerived();
}

function refreshTabs(): void {
  tabsEl.innerHTML = '';
  working.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.classList.toggle('active', i === activeIndex);
    btn.textContent = s.title || s.id || '(untitled)';
    btn.addEventListener('click', () => selectSector(i));
    tabsEl.appendChild(btn);
  });
}

/** Push `working[activeIndex]` identity fields into the form controls. */
function syncForm(): void {
  const s = sector();
  idEl.value = s.id;
  titleEl.value = s.title;
  descEl.value = s.description;
  lengthEl.value = String(s.length);
  themeEl.value = s.theme;
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
}

function refreshValidation(): void {
  const result = SectorsSchema.safeParse(working);
  validationEl.innerHTML = '';
  if (result.success) {
    lastValid = true;
    addValidation('ok', 'Valid — matches the game schema. Safe to save.');
  } else {
    lastValid = false;
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '(root)';
      addValidation('error', `${path}: ${issue.message}`);
    }
  }
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  exportEl.value = formatSectorsJson(working);
}

function refreshPreview(): void {
  const s = sector();
  previewEl.innerHTML = '';
  // Eligible pool at the previewed hop, with each entry's weighted roll chance.
  const eligible = layoutPoolAtHop(s, previewHop);
  const total = eligible.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  if (eligible.length === 0 || total <= 0) {
    addPreview('(empty pool)', `no eligible board at hop ${previewHop}`);
  } else {
    for (const e of eligible) {
      const w = e.weight ?? 1;
      addPreview(e.layoutId, `${pct(w / total)}  (weight ${w})`);
    }
  }
  // Gated-out entries, for context (why a board isn't in the mix yet).
  for (const e of s.layouts) {
    if ((e.minHop ?? 0) > previewHop) {
      addPreview(e.layoutId, `— gated (minHop ${e.minHop})`, true);
    }
  }
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!lastValid) return;
  saveStatusEl.textContent = 'Saving…';
  saveStatusEl.className = 'hint';
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'sectors.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      saveStatusEl.textContent =
        `Saved to config/sectors.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new sectors.`;
      saveStatusEl.className = 'hint ok';
    } else {
      saveStatusEl.textContent = `Save failed: ${data.error ?? res.statusText}`;
      saveStatusEl.className = 'hint err';
    }
  } catch (err) {
    saveStatusEl.textContent = `Save failed: ${String(err)} — is the dev server running?`;
    saveStatusEl.className = 'hint err';
  }
}

function revert(): void {
  working = structuredClone(SECTORS) as SectorDef[];
  selectSector(Math.min(activeIndex, working.length - 1));
  saveStatusEl.textContent = 'Reverted to the committed config (not yet saved).';
  saveStatusEl.className = 'hint';
}

// ---- Small helpers ----
function addPreview(term: string, value: string, muted = false): void {
  const dt = document.createElement('dt');
  dt.textContent = term;
  if (muted) dt.classList.add('muted');
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (muted) dd.classList.add('muted');
  previewEl.appendChild(dt);
  previewEl.appendChild(dd);
}

function addValidation(level: 'ok' | 'error', text: string): void {
  const li = document.createElement('li');
  li.className = level;
  li.textContent = text;
  validationEl.appendChild(li);
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function flash(btn: HTMLButtonElement, label: string): void {
  const original = btn.textContent;
  btn.textContent = label;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 800);
}

function mustQuery<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`sector-editor: missing element "${selector}"`);
  return el;
}
