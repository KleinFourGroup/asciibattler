/**
 * Global Blacklist Editor (63g). Standalone Vite page — visit
 * http://localhost:5173/tools/blacklist-editor/ after `npm run dev`. Not in
 * the production build (no rollupOptions.input entry).
 *
 * A UI over the `draftable` flags in `config/units.json` — the single global
 * draft-exclusion mechanism (the kickoff lock: NO new config file; the
 * 63a-post verdict keeps the flag as the home for both the structural
 * exclusions and curation calls, unified here at the UI layer). Saving goes
 * through the ARCHETYPE editor's `formatArchetypesJson`, so a toggle's file
 * diff is exactly the `"draftable": false` lines (pinned in
 * tests/tools/blacklist-editor.test.ts) and this editor can never fight the
 * archetype editor over layout.
 *
 * The price-editor affordances:
 *  1. **Live real-check validation.** Every toggle re-runs the game's
 *     `UnitDefsSchema` plus the two cross-config contracts a draftable
 *     change can actually break: `assertPriceRefs` (every draftable
 *     archetype must be priced — the port-stock boot assert) and the
 *     character catalog's dead-config guard (a character-level blacklist
 *     entry must stay inside the global pool — pinned by
 *     characters.test.ts). A character weight-override on an un-drafted
 *     archetype is merely inert, so it surfaces as a non-gating warning.
 *  2. **Display honesty.** The pool preview groups the WORKING draftable
 *     set by tier (`poolsByTier` — pinned equal to the live
 *     `DRAFTABLE_BY_TIER` grouping) with per-slot chances from
 *     `RECRUITMENT.rarityWeights` renormalized over the non-empty tiers
 *     (the sampler's exact rule; global view = uniform within tier).
 *  3. **Save to disk** via `/__save-config` (`units.json` has been
 *     allowlisted since the archetype editor); Copy / Download fallbacks;
 *     the save-reload stash restores the status line.
 */

import './editor.css';
import {
  ALL_UNIT_DEFS,
  UnitDefsSchema,
  RARITY_TIERS,
  type CombatantUnitDef,
  type UnitDefsConfig,
} from '../../src/config/units';
import { RECRUITMENT } from '../../src/config/recruitment';
import { PRICES, assertPriceRefs } from '../../src/config/prices';
import { PACKETS } from '../../src/config/packets';
import { DAEMONS } from '../../src/config/daemons';
import { CHARACTERS } from '../../src/config/characters';
import { ALL_ARCHETYPES, type Archetype } from '../../src/sim/archetypes';
import { formatArchetypesJson } from '../archetype-editor/format';
import { combatantIds, draftableIds, poolsByTier, setDraftable } from './draftable';

// ---- State ----
let working: UnitDefsConfig = structuredClone(ALL_UNIT_DEFS);
let lastValid = true;

const SAVE_STASH_KEY = 'blacklistEditor.justSaved';
const PACKET_ID_LIST = PACKETS.map((p) => p.id);
const DAEMON_ID_LIST = DAEMONS.map((d) => d.id);

// ---- DOM ----
const unitRowsEl = mustQuery<HTMLDivElement>('#unit-rows');
const previewPoolEl = mustQuery<HTMLDListElement>('#preview-pool');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build ----
attachButtons();
rebuildAll();
restoreAfterSave();

function attachButtons(): void {
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
    a.download = 'units.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- The catalog rows ----
function rebuildUnitRows(): void {
  unitRowsEl.innerHTML = '';
  for (const id of combatantIds(working)) {
    const def = working[id] as CombatantUnitDef;
    const draftable = def.draftable !== false;
    const row = el('div', draftable ? 'pool-row' : 'pool-row excluded');

    const check = el('input');
    check.type = 'checkbox';
    check.checked = draftable;
    check.title = draftable ? 'In the global draft pool' : 'Excluded (draftable: false)';
    check.addEventListener('change', () => {
      setDraftable(working, id, check.checked);
      rebuildUnitRows();
      refreshDerived();
    });
    row.appendChild(check);

    row.appendChild(el('span', 'glyph', def.glyph));
    row.appendChild(el('span', 'arch-name', def.name));
    row.appendChild(el('span', 'arch-id', id));
    const tier = def.rarity ?? 'common';
    row.appendChild(el('span', `badge ${tier}`, tier));
    unitRowsEl.appendChild(row);
  }
}

// ---- Refresh ----
function rebuildAll(): void {
  rebuildUnitRows();
  refreshDerived();
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const errors: string[] = [];
  const warnings: string[] = [];

  const result = UnitDefsSchema.safeParse(working);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }

  const pool = new Set(draftableIds(working));
  if (pool.size === 0) {
    errors.push('The global draft pool is empty — every recruit/port offer roll would throw.');
  }

  // The port-stock boot assert: every draftable archetype must carry a price
  // (the game refuses to boot otherwise) — run the REAL check against the
  // working draftable set.
  try {
    assertPriceRefs(PRICES, {
      archetypes: ALL_ARCHETYPES,
      draftable: [...pool] as Archetype[],
      packetIds: PACKET_ID_LIST,
      daemonIds: DAEMON_ID_LIST,
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // The character catalog's dead-config guard (characters.test.ts): a
  // character-level blacklist ADDS to the global set — an entry the global
  // pool no longer offers is dead config and fails the shipped test. An
  // override on an un-drafted archetype is inert but legal → warning only.
  for (const c of CHARACTERS) {
    for (const a of c.blacklist) {
      if (!pool.has(a)) {
        errors.push(
          `character '${c.id}' blacklists '${a}' — now globally excluded, the entry is dead config (fix the character or keep '${a}' draftable)`,
        );
      }
    }
    for (const a of Object.keys(c.weightOverrides)) {
      if (!pool.has(a)) {
        warnings.push(
          `character '${c.id}' weight-overrides '${a}' — globally excluded, so the override is inert`,
        );
      }
    }
  }

  lastValid = errors.length === 0;
  if (lastValid) {
    addValidation(
      'ok',
      'Valid — matches the game schema, the price boot assert, and the character cross-refs. Safe to save.',
    );
  } else {
    for (const text of errors) addValidation('error', text);
  }
  for (const text of warnings) addValidation('warn', text);
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  exportEl.value = formatArchetypesJson(working);
}

/** The pool preview over the WORKING flags: `poolsByTier` grouping + the
 *  sampler's tier rule (rarityWeights renormalized over non-empty tiers;
 *  uniform within tier — the global view has no character weights). */
function refreshPreview(): void {
  previewPoolEl.innerHTML = '';
  const pools = poolsByTier(working);
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
        el('dt', 'tier muted', tier),
        el('dd', 'tier muted', 'empty — costs no probability mass'),
      );
      continue;
    }
    const tierP = RECRUITMENT.rarityWeights[tier] / tierTotal;
    previewPoolEl.append(
      el('dt', 'tier', tier),
      el('dd', 'tier', `${pct(tierP)} of each offer slot`),
    );
    for (const id of pool) {
      addRow(
        previewPoolEl,
        (working[id] as CombatantUnitDef).name,
        pct(tierP / pool.length),
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
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'units.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const status =
        `Saved to config/units.json at ${new Date().toLocaleTimeString()}. ` +
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
  working = structuredClone(ALL_UNIT_DEFS);
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

function addValidation(level: 'ok' | 'warn' | 'error', text: string): void {
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

function mustQuery<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`blacklist-editor: missing element "${selector}"`);
  return node;
}
