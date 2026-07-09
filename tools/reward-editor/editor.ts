/**
 * Reward-table editor (48e). Standalone Vite page — visit
 * http://localhost:5173/tools/reward-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Authors `config/rewards.json` — each table's id + WEIGHTED entry list
 * (`bits {min,max}` | `packet` | `daemon`) — with the affordances the
 * sector/encounter editors established:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME
 *     `RewardTablesSchema` the game boots on (src/config/rewards.ts), plus the
 *     two referential asserts a bad save would trip at the NEXT boot:
 *     `assertRewardDaemonRefs` (a daemon entry must name a catalog idol) and
 *     the encounters-side check in reverse (renaming/deleting a table a
 *     committed encounter references would fail `assertEncounterRewardRefs`).
 *     Save is disabled while any of the three complain.
 *  2. **A live draw preview.** Each entry's roll chance (`weight / total` — the
 *     same one-entry-proportional-to-weight sample `pickWeighted` makes) plus
 *     the table's average bits per settle (BASE amounts — the display/settle
 *     folds from `bitsGain` daemons / `bitsMultiplier` apply downstream at
 *     `Run.gainBits`). Note the runtime wrinkle the preview can't show: owned
 *     daemons filter out BEFORE sampling, re-normalizing the live weights.
 *  3. **Save to disk.** Posts the formatted whole-file JSON (through
 *     `formatRewardsJson`) to the dev-only `/__save-config` endpoint
 *     (vite.config.ts allowlists `rewards.json`). Copy / Download stay as
 *     offline fallbacks.
 *
 * A **Referenced by** pane lists the committed encounters whose `rewards` refs
 * name the active table (attach refs in the encounter editor's Rewards panel).
 *
 * Saving rewrites config/rewards.json, which Vite turns into a full page reload
 * (the json → rewards.ts → editor.ts chain has no clean HMR boundary), so the
 * Save path stashes the active tab + confirmation in sessionStorage and the
 * next boot restores both — the encounter editor's SAVE_STASH_KEY pattern.
 */

import './editor.css';
import {
  REWARD_TABLES,
  REWARD_ENTRY_KINDS,
  RewardTablesSchema,
  assertRewardDaemonRefs,
  type RewardTable,
  type RewardEntry,
  type RewardEntryKind,
} from '../../src/config/rewards';
import { DAEMONS } from '../../src/config/daemons';
import { ENCOUNTERS } from '../../src/config/encounters';
import { formatRewardsJson } from './format';

// ---- State ----
// The schema's types are deeply readonly (config is immutable at runtime); the
// editor needs a mutable working copy — the encounter editor's DeepMutable
// pattern (a structuredClone is genuinely mutable at runtime; this is a
// type-only relaxation, and mutable → readonly stays assignable for consumers).
type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;
type WorkingTable = DeepMutable<RewardTable>;
type WorkingEntry = DeepMutable<RewardEntry>;

// `working` is a deep, mutable clone of the committed registry; the form
// mutates it, the schema validates it, the formatter emits it. REWARD_TABLES
// stays the pristine baseline that "Revert all" restores from.
let working: WorkingTable[] = structuredClone(REWARD_TABLES) as WorkingTable[];
let activeIndex = 0;
let lastValid = true;

/** See the header — a save reloads the page, so stash tab + status across it. */
const SAVE_STASH_KEY = 'rewardEditor.justSaved';

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const deleteBtn = mustQuery<HTMLButtonElement>('#delete-btn');
const idEl = mustQuery<HTMLInputElement>('#id');
const entriesEl = mustQuery<HTMLDivElement>('#entries');
const addEntryBtn = mustQuery<HTMLButtonElement>('#add-entry-btn');
const previewEl = mustQuery<HTMLDListElement>('#preview');
const refsEl = mustQuery<HTMLDListElement>('#refs');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build ----
attachIdentity();
attachButtons();
selectTable(activeIndex);
restoreAfterSave();

function attachIdentity(): void {
  idEl.addEventListener('input', () => {
    table().id = idEl.value;
    refreshTabs();
    refreshDerived();
  });
}

function attachButtons(): void {
  newBtn.addEventListener('click', addTable);
  deleteBtn.addEventListener('click', deleteTable);
  addEntryBtn.addEventListener('click', addEntry);
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
    a.download = 'rewards.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- Table + entry mutation ----
function table(): WorkingTable {
  return working[activeIndex]!;
}

function addTable(): void {
  let n = working.length + 1;
  let id = `table-${n}`;
  while (working.some((t) => t.id === id)) id = `table-${++n}`;
  working.push({ id, entries: [defaultEntry('bits', 1)] });
  selectTable(working.length - 1);
}

function deleteTable(): void {
  if (working.length <= 1) {
    setSaveStatus('The registry needs at least one table — add another before deleting this.', 'err');
    return;
  }
  working.splice(activeIndex, 1);
  selectTable(Math.min(activeIndex, working.length - 1));
}

function addEntry(): void {
  table().entries.push(defaultEntry('bits', 1));
  buildEntries();
  refreshDerived();
}

function removeEntry(index: number): void {
  table().entries.splice(index, 1);
  buildEntries();
  refreshDerived();
}

/** A well-formed skeleton entry of the given kind (weight carried across a
 *  kind conversion; the author then tunes the numbers). */
function defaultEntry(kind: RewardEntryKind, weight: number): WorkingEntry {
  switch (kind) {
    case 'bits':
      return { kind: 'bits', weight, min: 5, max: 10 };
    case 'packet':
      return { kind: 'packet', weight, packet: 'packet-id' };
    case 'daemon':
      return { kind: 'daemon', weight, daemon: DAEMONS[0]?.id ?? 'daemon-id' };
  }
}

// ---- Entry rows ----
function buildEntries(): void {
  entriesEl.innerHTML = '';
  table().entries.forEach((entry, i) => entriesEl.appendChild(makeEntryRow(entry, i)));
}

function makeEntryRow(entry: WorkingEntry, index: number): HTMLDivElement {
  const row = el('div', 'pool-row');

  const kindSel = el('select', 'entry-kind');
  for (const k of REWARD_ENTRY_KINDS) kindSel.appendChild(option(k));
  kindSel.value = entry.kind;
  kindSel.addEventListener('change', () => {
    table().entries[index] = defaultEntry(kindSel.value as RewardEntryKind, entry.weight);
    buildEntries();
    refreshDerived();
  });
  row.appendChild(kindSel);

  row.appendChild(
    numField('weight', entry.weight, 0.1, (v) => {
      entry.weight = v;
      refreshDerived();
    }),
  );

  switch (entry.kind) {
    case 'bits':
      row.appendChild(
        numField('min', entry.min, 1, (v) => {
          entry.min = Math.trunc(v);
          refreshDerived();
        }),
      );
      row.appendChild(
        numField('max', entry.max, 1, (v) => {
          entry.max = Math.trunc(v);
          refreshDerived();
        }),
      );
      break;
    case 'packet': {
      const wrap = el('label', 'pool-num');
      wrap.append(el('span', undefined, 'packet'));
      const input = el('input', 'packet-id');
      input.type = 'text';
      input.spellcheck = false;
      input.value = entry.packet;
      input.addEventListener('input', () => {
        entry.packet = input.value;
        refreshDerived();
      });
      wrap.appendChild(input);
      row.appendChild(wrap);
      break;
    }
    case 'daemon': {
      const sel = el('select', 'daemon-sel');
      for (const d of DAEMONS) sel.appendChild(option(d.id, `${d.name} (${d.id})`));
      sel.value = entry.daemon;
      sel.addEventListener('change', () => {
        entry.daemon = sel.value;
        refreshDerived();
      });
      row.appendChild(sel);
      break;
    }
  }

  const remove = el('button', 'pool-remove', '✕');
  remove.type = 'button';
  remove.title = 'Remove this entry';
  remove.disabled = table().entries.length <= 1; // schema floors a table at ≥1 entry
  remove.addEventListener('click', () => removeEntry(index));
  row.appendChild(remove);
  return row;
}

/** A labelled number input bound to a numeric entry field. */
function numField(label: string, value: number, step: number, onChange: (v: number) => void): HTMLLabelElement {
  const wrap = el('label', 'pool-num');
  wrap.append(el('span', undefined, label));
  const input = el('input');
  input.type = 'number';
  input.min = '0';
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('input', () => {
    const v = Number.parseFloat(input.value);
    onChange(Number.isFinite(v) ? v : 0);
  });
  wrap.appendChild(input);
  return wrap;
}

// ---- Refresh ----
function selectTable(index: number): void {
  activeIndex = index;
  idEl.value = table().id;
  buildEntries();
  refreshTabs();
  refreshDerived();
}

function refreshTabs(): void {
  tabsEl.innerHTML = '';
  working.forEach((t, i) => {
    const btn = el('button', 'tab', t.id || '(untitled)');
    btn.type = 'button';
    btn.classList.toggle('active', i === activeIndex);
    btn.addEventListener('click', () => selectTable(i));
    tabsEl.appendChild(btn);
  });
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
  refreshRefs();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const issues: string[] = [];

  const result = RewardTablesSchema.safeParse({ tables: working });
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
  // The two boot asserts a bad save would trip at the game's NEXT load:
  try {
    assertRewardDaemonRefs(working, DAEMONS);
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }
  const ids = new Set(working.map((t) => t.id));
  for (const e of ENCOUNTERS) {
    for (const ref of e.rewards ?? []) {
      if (!ids.has(ref.table)) {
        issues.push(
          `encounter "${e.id}" references table "${ref.table}" — renaming or deleting it would fail the boot assert`,
        );
      }
    }
  }

  lastValid = issues.length === 0;
  if (lastValid) {
    addValidation('ok', 'Valid — matches the game schema (incl. daemon + encounter refs). Safe to save.');
  } else {
    for (const text of issues) addValidation('error', text);
  }
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  exportEl.value = formatRewardsJson(working);
}

function refreshPreview(): void {
  previewEl.innerHTML = '';
  const t = table();
  const total = t.entries.reduce((sum, e) => sum + e.weight, 0);
  if (t.entries.length === 0 || total <= 0) {
    addRow(previewEl, '(empty)', 'no drawable entry', true);
    return;
  }
  for (const e of t.entries) {
    addRow(previewEl, describeEntry(e), `${pct(e.weight / total)}  (weight ${e.weight})`);
  }
  // Average BASE bits a settle of this table yields (bits entries only —
  // daemon/packet draws yield 0 bits here; `bitsGain` folds + `bitsMultiplier`
  // scale the settle downstream in Run.gainBits).
  const avgBits = t.entries.reduce(
    (sum, e) => (e.kind === 'bits' ? sum + (e.weight / total) * ((e.min + e.max) / 2) : sum),
    0,
  );
  addRow(previewEl, 'avg bits / settle', `≈ ${avgBits.toFixed(1)} base`, true);
}

function describeEntry(e: WorkingEntry): string {
  switch (e.kind) {
    case 'bits':
      return e.min === e.max ? `${e.min} bits` : `${e.min}–${e.max} bits`;
    case 'packet':
      return `packet ${e.packet || '(unnamed)'}`;
    case 'daemon':
      return `daemon ${DAEMONS.find((d) => d.id === e.daemon)?.name ?? e.daemon}`;
  }
}

function refreshRefs(): void {
  refsEl.innerHTML = '';
  const id = table().id;
  let any = false;
  for (const e of ENCOUNTERS) {
    for (const ref of e.rewards ?? []) {
      if (ref.table === id) {
        any = true;
        addRow(refsEl, e.name || e.id, `chance ${ref.trigger.chance}`);
      }
    }
  }
  if (!any) addRow(refsEl, '(none)', 'no committed encounter references this table', true);
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!lastValid) return;
  setSaveStatus('Saving…', 'hint');
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'rewards.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const savedId = table().id;
      const status =
        `Saved to config/rewards.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new tables.`;
      setSaveStatus(status, 'ok');
      // The write triggers a Vite full reload of this tab (see the header) —
      // stash the active tab + status so the next boot restores both.
      try {
        sessionStorage.setItem(SAVE_STASH_KEY, JSON.stringify({ savedId, status }));
      } catch {
        // sessionStorage unavailable (private mode / quota) — non-fatal; the
        // save still succeeded, the reload just won't auto-restore the tab.
      }
    } else {
      setSaveStatus(`Save failed: ${data.error ?? res.statusText}`, 'err');
    }
  } catch (err) {
    setSaveStatus(`Save failed: ${String(err)} — is the dev server running?`, 'err');
  }
}

function revert(): void {
  working = structuredClone(REWARD_TABLES) as WorkingTable[];
  selectTable(Math.min(activeIndex, working.length - 1));
  setSaveStatus('Reverted to the committed config (not yet saved).', 'hint');
}

/** Boot-time companion to Save (the encounter editor's restoreAfterSave):
 *  consume the stash, re-select the saved table's tab, re-show the status.
 *  A no-op on a normal cold boot; robust to a missing/stale id. */
function restoreAfterSave(): void {
  let stash: string | null = null;
  try {
    stash = sessionStorage.getItem(SAVE_STASH_KEY);
    if (stash) sessionStorage.removeItem(SAVE_STASH_KEY);
  } catch {
    return; // sessionStorage unavailable — nothing to restore.
  }
  if (!stash) return;
  try {
    const { savedId, status } = JSON.parse(stash) as { savedId?: string; status?: string };
    if (savedId) {
      const idx = working.findIndex((t) => t.id === savedId);
      if (idx >= 0) selectTable(idx);
    }
    if (status) setSaveStatus(status, 'ok');
  } catch {
    // Malformed stash — ignore.
  }
}

// ---- Small helpers ----
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

/** Typed `document.createElement` + class/text in one call. */
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
  if (!node) throw new Error(`reward-editor: missing element "${selector}"`);
  return node;
}
