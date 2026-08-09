/**
 * §75i — Camp editor. Standalone Vite page — visit
 * http://localhost:5173/tools/camp-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Authors `config/camps.json` — each camp's id / name / description / leash
 * radius / unit roster / reward refs — copying the encounter-editor shape
 * (tabs + New/Delete, the makeRewardRow rewards panel, the sessionStorage
 * save stash) minus the wave grammar and resolution preview (a camp is a
 * flat fixed group; there is nothing to resolve turn-by-turn).
 *
 *  1. **Live validation, every layer the game boots on** (the event-editor
 *     posture): the SAME `CampsSchema`, the duplicate-id check, and BOTH 75a
 *     boot asserts — `assertCampRewardRefs` (every reward ref names a real
 *     table; structurally unreachable via the dropdown but pinned anyway) and
 *     `assertLayoutCampRefs` (every committed layout's `camps[].campId` still
 *     resolves — renaming or deleting a camp a layout references would brick
 *     the game's next boot, so Save blocks until the layout is fixed).
 *  2. **Save to disk.** Posts the formatted whole-file JSON (through
 *     `formatCampsJson`, byte-faithful to the committed file) to the dev-only
 *     `/__save-config` endpoint (vite.config.ts allowlists `camps.json` since
 *     75a). Copy / Download stay as offline fallbacks.
 *
 * Placement (which layouts host a camp, at what weight) is authored on the
 * LAYOUT side — the layout editor's Camps layer — mirroring sector-owns-both:
 * a camp def owns only its intrinsic content.
 */

import './editor.css';
import {
  CAMPS,
  CampsSchema,
  CAMP_MAX_LEASH_RADIUS,
  CAMP_UNIT_MAX_COUNT,
  assertCampRewardRefs,
  assertLayoutCampRefs,
  type CampDef,
  type CampUnit,
} from '../../src/config/camps';
import { LAYOUTS } from '../../src/config/layouts';
import { REWARD_TABLE_IDS } from '../../src/config/rewards';
import { UNIT_DEFS } from '../../src/config/units';
import { glyphForArchetype, type Archetype } from '../../src/sim/archetypes';
import { formatCampsJson } from './format';

// The schema's `CampDef` is deeply readonly; the editor needs a mutable
// working copy (the encounter-editor DeepMutable pattern — a type-only
// relaxation over a structuredClone).
type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;
type WorkingCamp = DeepMutable<CampDef>;
type WorkingUnit = DeepMutable<CampUnit>;

// `working` is a deep, mutable clone of the committed catalog; the form
// mutates it, the schema validates it, the formatter emits it. CAMPS stays
// the pristine baseline "Revert all" restores from.
let working: WorkingCamp[] = structuredClone(CAMPS) as WorkingCamp[];
let activeIndex = 0;
let schemaOk = true;

/** Saving rewrites config/camps.json → a Vite full reload (no clean HMR
 *  boundary on the json → camps.ts → editor.ts chain). Stash the saved id +
 *  status so the next boot re-selects the tab and re-shows the confirmation
 *  (the encounter editor's SAVE_STASH_KEY pattern). Session-scoped. */
const SAVE_STASH_KEY = 'campEditor.justSaved';

const ARCHETYPE_IDS = Object.keys(UNIT_DEFS) as Archetype[];

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const deleteBtn = mustQuery<HTMLButtonElement>('#delete-btn');
const idEl = mustQuery<HTMLInputElement>('#id');
const nameEl = mustQuery<HTMLInputElement>('#name');
const descEl = mustQuery<HTMLTextAreaElement>('#description');
const leashEl = mustQuery<HTMLInputElement>('#leash-radius');
const usedByEl = mustQuery<HTMLParagraphElement>('#used-by');
const unitsEl = mustQuery<HTMLDivElement>('#units');
const addUnitBtn = mustQuery<HTMLButtonElement>('#add-unit-btn');
const rewardsEl = mustQuery<HTMLDivElement>('#rewards');
const addRewardBtn = mustQuery<HTMLButtonElement>('#add-reward-btn');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build ----
leashEl.max = String(CAMP_MAX_LEASH_RADIUS);
attachIdentity();
attachButtons();
selectCamp(activeIndex);
restoreAfterSave();

function camp(): WorkingCamp {
  return working[activeIndex]!;
}

function attachIdentity(): void {
  idEl.addEventListener('input', () => {
    camp().id = idEl.value;
    refreshTabs();
    refreshDerived();
  });
  nameEl.addEventListener('input', () => {
    camp().name = nameEl.value;
    refreshTabs();
    refreshDerived();
  });
  descEl.addEventListener('input', () => {
    const v = descEl.value.trim();
    if (v === '') delete camp().description;
    else camp().description = descEl.value;
    refreshDerived();
  });
  leashEl.addEventListener('input', () => {
    const n = Number.parseInt(leashEl.value, 10);
    camp().leashRadius = Number.isFinite(n) ? n : 0;
    refreshDerived();
  });
}

function attachButtons(): void {
  newBtn.addEventListener('click', addCamp);
  deleteBtn.addEventListener('click', deleteCamp);
  addUnitBtn.addEventListener('click', addUnit);
  addRewardBtn.addEventListener('click', addRewardRef);
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
    a.download = 'camps.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- Camp add / delete / select ----
function addCamp(): void {
  let n = working.length + 1;
  let id = `camp-${n}`;
  while (working.some((c) => c.id === id)) id = `camp-${++n}`;
  working.push({
    id,
    name: 'New Camp',
    description: 'A new neutral camp.',
    leashRadius: 3,
    units: [{ archetype: ARCHETYPE_IDS[0]! }],
  });
  selectCamp(working.length - 1);
}

function deleteCamp(): void {
  // The form assumes an active camp, so the editor holds a ≥1 floor even
  // though an EMPTY catalog is schema-legal — hand-edit config/camps.json to
  // empty it (the encounter-editor guard, with the legality caveat).
  if (working.length <= 1) {
    setSaveStatus(
      'The editor needs at least one camp on screen — to ship an empty catalog, hand-edit config/camps.json to [].',
      'err',
    );
    return;
  }
  working.splice(activeIndex, 1);
  selectCamp(Math.min(activeIndex, working.length - 1));
}

function selectCamp(index: number): void {
  activeIndex = index;
  syncForm();
  refreshTabs();
  refreshDerived();
}

/** Push `working[activeIndex]` into every form control. */
function syncForm(): void {
  const c = camp();
  idEl.value = c.id;
  nameEl.value = c.name;
  descEl.value = c.description ?? '';
  leashEl.value = String(c.leashRadius);
  buildUnits();
  buildRewards();
}

function refreshTabs(): void {
  tabsEl.innerHTML = '';
  working.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.classList.toggle('active', i === activeIndex);
    btn.textContent = c.name || c.id || '(untitled)';
    btn.addEventListener('click', () => selectCamp(i));
    tabsEl.appendChild(btn);
  });
}

// ---- Units panel ----
// One row per roster entry: archetype dropdown (combatants only — UNIT_DEFS
// is the combatant view, so the neutral defs can't be picked) + count + level.
// Count/level are optional (blank = the schema default 1), so a bare entry
// saves — and re-loads — bare.

function addUnit(): void {
  camp().units.push({ archetype: ARCHETYPE_IDS[0]! });
  buildUnits();
  refreshDerived();
}

function removeUnit(index: number): void {
  camp().units.splice(index, 1);
  buildUnits();
  refreshDerived();
}

function buildUnits(): void {
  unitsEl.innerHTML = '';
  camp().units.forEach((u, i) => unitsEl.appendChild(makeUnitRow(u, i)));
}

function makeUnitRow(u: WorkingUnit, index: number): HTMLDivElement {
  const row = el('div', 'pool-row');

  const sel = el('select', 'pool-layout');
  for (const id of ARCHETYPE_IDS) sel.appendChild(option(id, `${glyphForArchetype(id)} ${id}`));
  sel.value = u.archetype;
  sel.addEventListener('change', () => {
    u.archetype = sel.value as Archetype;
    refreshDerived();
  });
  row.appendChild(sel);

  row.appendChild(
    optionalIntControl('count', u.count, 1, CAMP_UNIT_MAX_COUNT, (v) => {
      if (v === undefined) delete u.count;
      else u.count = v;
    }),
  );
  row.appendChild(
    optionalIntControl('level', u.level, 1, undefined, (v) => {
      if (v === undefined) delete u.level;
      else u.level = v;
    }),
  );

  const remove = el('button', 'pool-remove', '✕');
  remove.type = 'button';
  remove.title = 'Remove this roster entry';
  // The schema floors `units` at ≥1 — mirror it in the control.
  remove.disabled = camp().units.length <= 1;
  remove.addEventListener('click', () => removeUnit(index));
  row.appendChild(remove);
  return row;
}

/** A labeled optional positive-int input: blank = the schema default (the
 *  field is DELETED, so a bare entry round-trips bare). */
function optionalIntControl(
  label: string,
  value: number | undefined,
  min: number,
  max: number | undefined,
  set: (v: number | undefined) => void,
): HTMLLabelElement {
  const wrap = el('label', 'pool-num');
  wrap.append(el('span', undefined, label));
  const num = el('input', 'kn-num');
  num.type = 'number';
  num.min = String(min);
  if (max !== undefined) num.max = String(max);
  num.step = '1';
  num.placeholder = '1';
  num.value = value !== undefined ? String(value) : '';
  num.addEventListener('input', () => {
    const v = Number.parseInt(num.value, 10);
    set(num.value.trim() !== '' && Number.isFinite(v) ? v : undefined);
    refreshDerived();
  });
  wrap.appendChild(num);
  return wrap;
}

// ---- Rewards panel (the encounter editor's makeRewardRow shape) ----

function addRewardRef(): void {
  const first = REWARD_TABLE_IDS[0];
  if (first === undefined) return; // registry schema floors at ≥1 table
  const c = camp();
  if (!c.rewards) c.rewards = [];
  c.rewards.push({ table: first, trigger: { chance: 1 } });
  buildRewards();
  refreshDerived();
}

function removeRewardRef(index: number): void {
  const c = camp();
  c.rewards?.splice(index, 1);
  if (c.rewards !== undefined && c.rewards.length === 0) delete c.rewards;
  buildRewards();
  refreshDerived();
}

function buildRewards(): void {
  rewardsEl.innerHTML = '';
  (camp().rewards ?? []).forEach((ref, i) => rewardsEl.appendChild(makeRewardRow(ref, i)));
}

function makeRewardRow(
  ref: { table: string; trigger: { chance: number } },
  index: number,
): HTMLDivElement {
  const row = el('div', 'pool-row');

  const sel = el('select', 'pool-layout');
  for (const id of REWARD_TABLE_IDS) sel.appendChild(option(id));
  sel.value = ref.table;
  sel.addEventListener('change', () => {
    ref.table = sel.value;
    refreshDerived();
  });
  row.appendChild(sel);

  const wrap = el('label', 'pool-num');
  wrap.append(el('span', undefined, 'chance'));
  const chance = el('input', 'kn-num');
  chance.type = 'number';
  chance.min = '0';
  chance.max = '1';
  chance.step = '0.05';
  chance.value = String(ref.trigger.chance);
  chance.addEventListener('input', () => {
    const v = Number.parseFloat(chance.value);
    ref.trigger.chance = Number.isFinite(v) ? v : 0;
    refreshDerived();
  });
  wrap.appendChild(chance);
  row.appendChild(wrap);

  const remove = el('button', 'pool-remove', '✕');
  remove.type = 'button';
  remove.title = 'Remove this reward ref';
  remove.addEventListener('click', () => removeRewardRef(index));
  row.appendChild(remove);
  return row;
}

// ---- Refresh ----
function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshUsedBy();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const result = CampsSchema.safeParse(working);
  const issues: string[] = [];
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
  const ids = new Set<string>();
  for (const c of working) {
    if (ids.has(c.id)) issues.push(`duplicate camp id "${c.id}"`);
    ids.add(c.id);
  }
  // The boot asserts a bad save would trip at the game's NEXT load, fed the
  // live sibling catalogs (the event-editor posture) — only meaningful once
  // the schema itself passes.
  if (result.success) {
    try {
      assertCampRewardRefs(working, REWARD_TABLE_IDS);
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }
    try {
      assertLayoutCampRefs(LAYOUTS, working.map((c) => c.id));
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }
  }
  schemaOk = issues.length === 0;
  if (schemaOk) {
    addValidation('ok', 'Valid — matches the game schema + both boot asserts. Safe to save.');
  } else {
    for (const issue of issues) addValidation('error', issue);
  }
  saveBtn.disabled = !schemaOk;
}

function refreshExport(): void {
  if (schemaOk) exportEl.value = formatCampsJson(working);
}

/** Which committed layouts roll this camp — the placement read-back (the
 *  layout side owns the edge; this is informational only). */
function refreshUsedBy(): void {
  const id = camp().id;
  const hosts = LAYOUTS.filter((l) => (l.camps ?? []).some((r) => r.campId === id)).map(
    (l) => l.id,
  );
  usedByEl.textContent =
    hosts.length > 0
      ? `Placed on: ${hosts.join(', ')} (authored in the layout editor).`
      : 'Not placed on any committed layout yet — add it on the layout editor’s Camps layer.';
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!schemaOk) return;
  setSaveStatus('Saving…', 'hint');
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'camps.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const savedId = camp().id;
      const status =
        `Saved to config/camps.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new catalog.`;
      setSaveStatus(status, 'ok');
      // The write triggers a Vite reload of this tab — stash the active tab +
      // status so the next boot restores both (the SAVE_STASH_KEY pattern).
      try {
        sessionStorage.setItem(SAVE_STASH_KEY, JSON.stringify({ savedId, status }));
      } catch {
        // sessionStorage unavailable (private mode / quota) — non-fatal.
      }
    } else {
      setSaveStatus(`Save failed: ${data.error ?? res.statusText}`, 'err');
    }
  } catch (err) {
    setSaveStatus(`Save failed: ${String(err)} — is the dev server running?`, 'err');
  }
}

function revert(): void {
  working = structuredClone(CAMPS) as WorkingCamp[];
  selectCamp(Math.min(activeIndex, working.length - 1));
  setSaveStatus('Reverted to the committed catalog (not yet saved).', 'hint');
}

/** Boot-time companion to Save (the encounter-editor restoreAfterSave). */
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
      const idx = working.findIndex((c) => c.id === savedId);
      if (idx >= 0) selectCamp(idx);
    }
    if (status) setSaveStatus(status, 'ok');
  } catch {
    // Malformed stash — ignore.
  }
}

// ---- Small helpers ----
function addValidation(level: 'ok' | 'error', text: string): void {
  const li = document.createElement('li');
  li.className = level;
  li.textContent = text;
  validationEl.appendChild(li);
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
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`camp-editor: missing element "${selector}"`);
  return el;
}
