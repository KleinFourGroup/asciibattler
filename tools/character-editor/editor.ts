/**
 * Character editor (63f). Standalone Vite page — visit
 * http://localhost:5173/tools/character-editor/ after `npm run dev`. Not in
 * the production build (no rollupOptions.input entry).
 *
 * Authors `config/characters.json` — the starting-character catalog (§63a:
 * roster / daemon / draft-blacklist additions / within-tier weight overrides)
 * — with the affordances the price editor established:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME
 *     `CharactersSchema` the game boots on (src/config/characters.ts) plus
 *     the `assertDefaultCharacter` boot check. The form is constrained so it
 *     can barely go invalid — roster/blacklist/override ids come from the
 *     real catalogs, the blacklist⇄override disjointness is enforced by the
 *     row selects — but Save still gates on the real checks, not the form's
 *     goodwill.
 *  2. **Display honesty.** The draft-pool preview derives through the REAL
 *     `draftPoolsFor` core (src/run/Recruitment.ts) — the same pools
 *     `rollOffer` draws from for recruit offers AND port stock — with the
 *     per-slot chance computed from `RECRUITMENT.rarityWeights` renormalized
 *     over the non-empty tiers (the sampler's exact rule) × the within-tier
 *     weight share.
 *  3. **Save to disk.** Posts the formatted whole-file JSON (through
 *     `formatCharactersJson`) to the dev-only `/__save-config` endpoint
 *     (vite.config.ts allowlists `characters.json`). Copy / Download stay as
 *     offline fallbacks; the save-reload stash restores the status line.
 *
 * One tab per character (the catalog is a short list); the selected tab
 * survives a save-reload (the encounter editor's tab-restore).
 */

import './editor.css';
import {
  CHARACTERS,
  CharactersSchema,
  DEFAULT_CHARACTER_ID,
  normalizeCharacter,
  assertDefaultCharacter,
  type CharacterConfig,
} from '../../src/config/characters';
import { DAEMONS } from '../../src/config/daemons';
import { RECRUITMENT } from '../../src/config/recruitment';
import { RARITY_TIERS } from '../../src/config/units';
import {
  ALL_ARCHETYPES,
  DRAFTABLE_ARCHETYPES,
  nameForArchetype,
  type Archetype,
} from '../../src/sim/archetypes';
import { draftPoolsFor } from '../../src/run/Recruitment';
import { formatCharactersJson } from './format';

/** The working document — `CharacterConfig` with the readonly/branding
 *  relaxed for form edits; `toConfigs` narrows it back for the formatter +
 *  the real validators. */
interface WorkingCharacter {
  id: string;
  name: string;
  description: string;
  roster: string[];
  daemon: string;
  blacklist: string[];
  weightOverrides: Record<string, number>;
}

// ---- State ----
let working: WorkingCharacter[] = fromCatalog();
let selected = 0;
let lastValid = true;

const SAVE_STASH_KEY = 'characterEditor.justSaved';
const TAB_STASH_KEY = 'characterEditor.tab';
const DAEMON_ID_LIST = DAEMONS.map((d) => d.id);

function fromCatalog(): WorkingCharacter[] {
  return CHARACTERS.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    roster: [...c.roster],
    daemon: c.daemon,
    blacklist: [...c.blacklist],
    weightOverrides: { ...c.weightOverrides } as Record<string, number>,
  }));
}

function toConfigs(chars: readonly WorkingCharacter[]): CharacterConfig[] {
  return chars as unknown as CharacterConfig[];
}

function current(): WorkingCharacter {
  return working[selected]!;
}

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#char-tabs');
const addCharBtn = mustQuery<HTMLButtonElement>('#add-char-btn');
const idEl = mustQuery<HTMLInputElement>('#char-id');
const nameEl = mustQuery<HTMLInputElement>('#char-name');
const descEl = mustQuery<HTMLTextAreaElement>('#char-desc');
const daemonEl = mustQuery<HTMLSelectElement>('#char-daemon');
const rosterRowsEl = mustQuery<HTMLDivElement>('#roster-rows');
const addRosterBtn = mustQuery<HTMLButtonElement>('#add-roster-btn');
const blacklistRowsEl = mustQuery<HTMLDivElement>('#blacklist-rows');
const addBlacklistBtn = mustQuery<HTMLButtonElement>('#add-blacklist-btn');
const overrideRowsEl = mustQuery<HTMLDivElement>('#override-rows');
const addOverrideBtn = mustQuery<HTMLButtonElement>('#add-override-btn');
const dupCharBtn = mustQuery<HTMLButtonElement>('#dup-char-btn');
const delCharBtn = mustQuery<HTMLButtonElement>('#del-char-btn');
const previewSummaryEl = mustQuery<HTMLDListElement>('#preview-summary');
const previewPoolEl = mustQuery<HTMLDListElement>('#preview-pool');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build ----
for (const d of DAEMONS) daemonEl.appendChild(option(d.id, d.name));
attachIdentity();
attachButtons();
restoreTab();
rebuildAll();
restoreAfterSave();

function attachIdentity(): void {
  idEl.addEventListener('input', () => {
    current().id = idEl.value.trim();
    rebuildTabs();
    refreshDerived();
  });
  nameEl.addEventListener('input', () => {
    current().name = nameEl.value;
    rebuildTabs();
    refreshDerived();
  });
  descEl.addEventListener('input', () => {
    current().description = descEl.value;
    refreshDerived();
  });
  daemonEl.addEventListener('change', () => {
    current().daemon = daemonEl.value;
    refreshDerived();
  });
}

function attachButtons(): void {
  addCharBtn.addEventListener('click', () => {
    working.push({
      id: uniqueId('new-character'),
      name: 'New Character',
      description: 'A new company.',
      roster: ['mercenary'],
      daemon: DAEMON_ID_LIST[0]!,
      blacklist: [],
      weightOverrides: {},
    });
    selected = working.length - 1;
    rebuildAll();
  });
  dupCharBtn.addEventListener('click', () => {
    const c = current();
    working.push({
      ...structuredClone(c),
      id: uniqueId(`${c.id}-copy`),
      name: `${c.name} (copy)`,
    });
    selected = working.length - 1;
    rebuildAll();
  });
  delCharBtn.addEventListener('click', () => {
    working.splice(selected, 1);
    selected = Math.max(0, selected - 1);
    rebuildAll();
  });
  addRosterBtn.addEventListener('click', () => {
    current().roster.push(ALL_ARCHETYPES[0]!);
    rebuildRosterRows();
    refreshDerived();
  });
  addBlacklistBtn.addEventListener('click', () => {
    const c = current();
    const free = DRAFTABLE_ARCHETYPES.find(
      (a) => !c.blacklist.includes(a) && c.weightOverrides[a] === undefined,
    );
    if (free === undefined) return;
    c.blacklist.push(free);
    rebuildBlacklistRows();
    rebuildOverrideRows();
    refreshDerived();
  });
  addOverrideBtn.addEventListener('click', () => {
    const c = current();
    const free = DRAFTABLE_ARCHETYPES.find(
      (a) => c.weightOverrides[a] === undefined && !c.blacklist.includes(a),
    );
    if (free === undefined) return;
    c.weightOverrides[free] = 1;
    rebuildBlacklistRows();
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
    a.download = 'characters.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function uniqueId(base: string): string {
  if (!working.some((c) => c.id === base)) return base;
  let n = 2;
  while (working.some((c) => c.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ---- Tabs ----
function rebuildTabs(): void {
  tabsEl.innerHTML = '';
  working.forEach((c, i) => {
    const tab = el('button', i === selected ? 'tab active' : 'tab', c.name || c.id || '(unnamed)');
    tab.type = 'button';
    tab.addEventListener('click', () => {
      selected = i;
      stashTab();
      rebuildAll();
    });
    tabsEl.appendChild(tab);
  });
}

function stashTab(): void {
  try {
    sessionStorage.setItem(TAB_STASH_KEY, String(selected));
  } catch {
    // sessionStorage unavailable — non-fatal.
  }
}

function restoreTab(): void {
  try {
    const raw = sessionStorage.getItem(TAB_STASH_KEY);
    if (raw === null) return;
    const i = Number.parseInt(raw, 10);
    if (Number.isInteger(i) && i >= 0 && i < working.length) selected = i;
  } catch {
    // sessionStorage unavailable — non-fatal.
  }
}

// ---- The roster rows ----
function rebuildRosterRows(): void {
  const c = current();
  rosterRowsEl.innerHTML = '';
  c.roster.forEach((archetype, i) => {
    const row = el('div', 'pool-row');
    row.appendChild(el('span', 'slot', `#${i + 1}`));

    const sel = el('select');
    sel.className = 'arch-sel';
    for (const a of ALL_ARCHETYPES) sel.appendChild(option(a, nameForArchetype(a)));
    sel.value = archetype;
    sel.addEventListener('change', () => {
      c.roster[i] = sel.value;
      refreshDerived();
    });
    row.appendChild(sel);

    const remove = el('button', 'pool-remove', '✕');
    remove.type = 'button';
    if (c.roster.length <= 1) {
      remove.disabled = true;
      remove.title = 'A roster needs at least one unit (the schema minimum)';
    } else {
      remove.title = 'Remove this slot';
      remove.addEventListener('click', () => {
        c.roster.splice(i, 1);
        rebuildRosterRows();
        refreshDerived();
      });
    }
    row.appendChild(remove);
    rosterRowsEl.appendChild(row);
  });
}

// ---- The blacklist rows ----
function rebuildBlacklistRows(): void {
  const c = current();
  blacklistRowsEl.innerHTML = '';
  c.blacklist.forEach((archetype, i) => {
    const row = el('div', 'pool-row');

    // Candidates: draftable archetypes not already blacklisted or overridden
    // (blacklist ⇄ override disjointness enforced at the select), plus the
    // row's own value so it stays displayed.
    const sel = el('select');
    sel.className = 'arch-sel';
    for (const a of DRAFTABLE_ARCHETYPES) {
      if (a !== archetype && (c.blacklist.includes(a) || c.weightOverrides[a] !== undefined))
        continue;
      sel.appendChild(option(a, nameForArchetype(a)));
    }
    sel.value = archetype;
    sel.addEventListener('change', () => {
      c.blacklist[i] = sel.value;
      rebuildBlacklistRows();
      rebuildOverrideRows();
      refreshDerived();
    });
    row.appendChild(sel);

    const remove = el('button', 'pool-remove', '✕');
    remove.type = 'button';
    remove.title = 'Remove from the blacklist';
    remove.addEventListener('click', () => {
      c.blacklist.splice(i, 1);
      rebuildBlacklistRows();
      rebuildOverrideRows();
      refreshDerived();
    });
    row.appendChild(remove);
    blacklistRowsEl.appendChild(row);
  });
  addBlacklistBtn.disabled = DRAFTABLE_ARCHETYPES.every(
    (a) => c.blacklist.includes(a) || c.weightOverrides[a] !== undefined,
  );
}

// ---- The weight-override rows ----
function rebuildOverrideRows(): void {
  const c = current();
  overrideRowsEl.innerHTML = '';
  for (const archetype of Object.keys(c.weightOverrides)) {
    const row = el('div', 'pool-row');

    const sel = el('select');
    sel.className = 'arch-sel';
    for (const a of DRAFTABLE_ARCHETYPES) {
      if (a !== archetype && (c.weightOverrides[a] !== undefined || c.blacklist.includes(a)))
        continue;
      sel.appendChild(option(a, nameForArchetype(a)));
    }
    sel.value = archetype;
    sel.addEventListener('change', () => {
      rekeyOverride(c, archetype, sel.value);
      rebuildBlacklistRows();
      rebuildOverrideRows();
      refreshDerived();
    });
    row.appendChild(sel);

    const weightWrap = el('label', 'pool-num');
    weightWrap.append(el('span', undefined, 'weight'));
    const input = el('input');
    input.type = 'number';
    input.min = '0.05';
    input.step = '0.25';
    input.value = String(c.weightOverrides[archetype]);
    input.addEventListener('input', () => {
      const v = Number.parseFloat(input.value);
      if (Number.isFinite(v) && v > 0) c.weightOverrides[archetype] = v;
      refreshDerived();
    });
    weightWrap.appendChild(input);
    row.appendChild(weightWrap);

    const remove = el('button', 'pool-remove', '✕');
    remove.type = 'button';
    remove.title = 'Remove this override (falls back to weight 1)';
    remove.addEventListener('click', () => {
      delete c.weightOverrides[archetype];
      rebuildBlacklistRows();
      rebuildOverrideRows();
      refreshDerived();
    });
    row.appendChild(remove);
    overrideRowsEl.appendChild(row);
  }
  addOverrideBtn.disabled = DRAFTABLE_ARCHETYPES.every(
    (a) => c.weightOverrides[a] !== undefined || c.blacklist.includes(a),
  );
}

/** Re-key an override in place, preserving entry order (a delete+set would
 *  push the row to the bottom mid-edit — the price editor's fix). */
function rekeyOverride(c: WorkingCharacter, from: string, to: string): void {
  const next: Record<string, number> = {};
  for (const [a, w] of Object.entries(c.weightOverrides)) {
    if (a === from) next[to] = w;
    else next[a] = w;
  }
  c.weightOverrides = next;
}

// ---- Rebuild / refresh ----
function rebuildAll(): void {
  rebuildTabs();
  syncIdentity();
  rebuildRosterRows();
  rebuildBlacklistRows();
  rebuildOverrideRows();
  refreshDerived();
}

function syncIdentity(): void {
  const c = current();
  idEl.value = c.id;
  nameEl.value = c.name;
  descEl.value = c.description;
  daemonEl.value = c.daemon;
  const isDefault = c.id === DEFAULT_CHARACTER_ID;
  delCharBtn.disabled = isDefault || working.length <= 1;
  delCharBtn.title = isDefault
    ? `'${DEFAULT_CHARACTER_ID}' is the boot-asserted default — every unconfigured entry point resolves to it`
    : working.length <= 1
      ? 'The catalog needs at least one character (the schema minimum)'
      : 'Delete this character';
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const issues: string[] = [];

  const result = CharactersSchema.safeParse({ characters: working });
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  } else {
    try {
      assertDefaultCharacter(result.data.characters.map(normalizeCharacter));
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }
  }

  lastValid = issues.length === 0;
  if (lastValid) {
    addValidation('ok', 'Valid — matches the game schema + the default-character boot check. Safe to save.');
  } else {
    for (const text of issues) addValidation('error', text);
  }
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  exportEl.value = formatCharactersJson(toConfigs(working));
}

/** The run summary + the draft-pool chances, both derived through the real
 *  cores on the WORKING character (display honesty). */
function refreshPreview(): void {
  const c = current();

  previewSummaryEl.innerHTML = '';
  const counts = new Map<string, number>();
  for (const a of c.roster) counts.set(a, (counts.get(a) ?? 0) + 1);
  const rosterText = [...counts.entries()].map(([a, n]) => `${n}× ${a}`).join(', ');
  addRow(previewSummaryEl, 'roster', `${c.roster.length} units — ${rosterText}`);
  addRow(previewSummaryEl, 'starting level', `L${RECRUITMENT.startingLevel} (global)`);
  const daemon = DAEMONS.find((d) => d.id === c.daemon);
  addRow(previewSummaryEl, 'daemon', daemon ? daemon.name : `(unknown: ${c.daemon})`);

  previewPoolEl.innerHTML = '';
  // The REAL pool derivation (`draftPoolsFor`) + the sampler's exact tier
  // rule: rarityWeights renormalized over the NON-EMPTY tiers, then the
  // within-tier weighted pick (absent = 1).
  const pools = draftPoolsFor(c.blacklist as readonly Archetype[]);
  const nonEmpty = RARITY_TIERS.filter((t) => pools[t].length > 0);
  const tierTotal = nonEmpty.reduce((acc, t) => acc + RECRUITMENT.rarityWeights[t], 0);
  if (tierTotal <= 0) {
    addRow(previewPoolEl, '(broken)', 'every non-empty tier has zero rarity weight');
    return;
  }
  for (const tier of RARITY_TIERS) {
    const pool = pools[tier];
    if (pool.length === 0) {
      previewPoolEl.append(
        el('dt', `tier ${tier} muted`, tier),
        el('dd', 'tier muted', 'empty — costs no probability mass'),
      );
      continue;
    }
    const tierP = RECRUITMENT.rarityWeights[tier] / tierTotal;
    previewPoolEl.append(
      el('dt', `tier ${tier}`, tier),
      el('dd', 'tier', `${pct(tierP)} of each offer slot`),
    );
    const poolTotal = pool.reduce((acc, a) => acc + (c.weightOverrides[a] ?? 1), 0);
    for (const a of pool) {
      const w = c.weightOverrides[a] ?? 1;
      const overridden = c.weightOverrides[a] !== undefined;
      addRow(
        previewPoolEl,
        nameForArchetype(a),
        `${pct(tierP * (w / poolTotal))}${overridden ? ` (weight ${w})` : ''}`,
      );
    }
  }
}

function pct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!lastValid) return;
  setSaveStatus('Saving…', 'hint');
  stashTab();
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'characters.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const status =
        `Saved to config/characters.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new catalog.`;
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
  working = fromCatalog();
  selected = Math.min(selected, working.length - 1);
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

// ---- Small helpers (the price editor's set) ----
function addRow(dl: HTMLDListElement, term: string, value: string): void {
  dl.append(el('dt', undefined, term), el('dd', undefined, value));
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
  if (!node) throw new Error(`character-editor: missing element "${selector}"`);
  return node;
}
