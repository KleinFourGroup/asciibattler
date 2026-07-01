/**
 * Archetype editor (I4 · §30d). Standalone Vite page — visit
 * http://localhost:5173/tools/archetype-editor/ after `npm run dev`. Not in
 * the production build (no rollupOptions.input entry).
 *
 * Edits the archetype entries of `config/units.json` — glyph, abilities,
 * targeting policy, the `draftable` flag, the 11-stat `baseStats` block, and the
 * parallel `growthRates` — with the things the copy-paste loop didn't give us:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME per-entry
 *     `UnitDefSchema` the game boots on (imported from `src/config/units.ts`),
 *     so "is this valid?" can't drift from the game's load-time parse. Save is
 *     disabled while invalid. (§30d validates PER ENTRY rather than the whole-config
 *     `z.object` — the object would silently strip a new, not-yet-wired key.)
 *  2. **Live derived-stat preview.** maxHp / crit / move + attack cadence /
 *     to-hit / dodge are computed by the REAL game functions (`deriveStats`,
 *     `hitChanceFor`, `attackCooldownTicksFor`, `scaleStats`, `scalingStatValue`) —
 *     never reimplemented here. Per-ability output reads the op's `scaling` (the
 *     post-Y source of truth), so the numbers are correct for ANY archetype,
 *     including a freshly-created one.
 *  3. **Save to disk** via the dev-only `/__save-config` endpoint. Copy / Download
 *     stay as offline fallbacks.
 *
 *  §30d — CREATE / DELETE + the guided WIRE-UP. The editor authors a new
 *  archetype's DATA, but archetypes are a CLOSED typed vocabulary: making one
 *  actually spawn + render needs three code edits the tool can't perform (the
 *  `Archetype` union in `Unit.ts`, the `UnitDefsSchema` key in
 *  `config/units.ts`, a `glyphs.ts` glyph). So "+ New" / "Delete" scaffold
 *  the data and the **Wire-up** panel emits the exact code edits to paste — honest
 *  about the data/code split, keeping the union closed (goal #1).
 *
 * Schema-driven where it counts: the stat fields enumerate from `STAT_LABELS` and
 * the ability/targeting choices from the live registries, so a future stat or
 * ability surfaces here with no edit.
 */

import './editor.css';
import {
  UNIT_DEFS,
  NEUTRAL_DEFS,
  UnitDefSchema,
  type CombatantUnitDef,
} from '../../src/config/units';
import type { UnitStats } from '../../src/sim/Unit';
import { STAT_LABELS } from '../../src/ui/statLabels';
import { knownAbilityIds } from '../../src/sim/abilities/registry';
import { knownTargetingIds } from '../../src/sim/targetingStrategies';
import { abilityDef, damageOpOf, healOpOf } from '../../src/config/abilities';
import { STATS } from '../../src/config/stats';
import { ticksToSeconds } from '../../src/config';
import {
  attackCooldownTicksFor,
  critChanceFor,
  deriveStats,
  hitChanceFor,
} from '../../src/sim/stats';
import { scalingStatValue } from '../../src/sim/effects/resolveScalars';
import { scaleStats } from '../../src/sim/leveling';
import { GLYPHS } from '../../src/render/glyphs';
import { formatArchetypesJson } from './format';

// §30d — keys are open (a new archetype can be created), so the working set is a
// plain record keyed by string, validated per-entry against `UnitDefSchema`.
type ArchetypeKey = string;
type StatKind = 'base' | 'growth';

/** The atlas cell budget (`FontAtlas` grid; glyphs.ts caps the count). */
const ATLAS_BUDGET = 48;
/** A new archetype's key must be a clean snake_case identifier (matches every
 *  existing key + a valid `Archetype` union member). */
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const STAT_ORDER = Object.keys(STAT_LABELS) as (keyof UnitStats)[];
const ABILITY_IDS = knownAbilityIds();
const TARGETING_IDS = knownTargetingIds();

/** Short label for a damage/heal op's scaling stat (the per-ability output hint —
 *  derived from the op, not a per-archetype map, so a new archetype Just Works). */
const SCALING_LABEL: Record<string, string> = {
  strength: 'STR',
  ranged: 'RNG',
  magic: 'MAG',
  none: 'flat',
};

// ---- State ----
// `working` is a deep, mutable clone of the committed config; the form mutates
// it, the schema validates it, the formatter emits it. UNIT_DEFS stays the
// pristine baseline that "Revert all" restores from. §30d: keys are open (create /
// delete), so it's a string-keyed record.
// §38d — the editor operates on the COMBATANT catalog (`UNIT_DEFS`); NEUTRAL
// entries (walls / half-cover) aren't editable here until §38e's rework, but are
// preserved verbatim on Save (see `updateExport`). So `working` is combatant-typed
// and its field-access code is unchanged from 38c.
let working: Record<string, CombatantUnitDef> = structuredClone(UNIT_DEFS);
let activeKey: ArchetypeKey = Object.keys(working)[0]!;
let previewLevel = 1;
let refPrecision = 5;
let refEvasion = 5;
let lastValid = true;

// I6 — reference base hit chance for the incoming attacker in the "this unit
// evades" preview line. Accuracy is per-WEAPON now (no global base), so the
// dodge calc assumes a generic attacker at this accuracy; a real attacker's
// weapon may differ. The per-ability rows below show each weapon's own accuracy.
const REF_ACCURACY = 0.6;

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const deleteBtn = mustQuery<HTMLButtonElement>('#delete-btn');
const glyphEl = mustQuery<HTMLInputElement>('#glyph');
const draftableEl = mustQuery<HTMLInputElement>('#draftable');
const abilitiesEl = mustQuery<HTMLDivElement>('#abilities');
const targetingEl = mustQuery<HTMLDivElement>('#targeting');
const baseStatsEl = mustQuery<HTMLDivElement>('#base-stats');
const growthRatesEl = mustQuery<HTMLDivElement>('#growth-rates');
const previewEl = mustQuery<HTMLDListElement>('#preview');
const wireupEl = mustQuery<HTMLDivElement>('#wireup');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const previewLevelEl = mustQuery<HTMLInputElement>('#preview-level');
const refPrecisionEl = mustQuery<HTMLInputElement>('#ref-precision');
const refEvasionEl = mustQuery<HTMLInputElement>('#ref-evasion');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

const baseInputs = new Map<keyof UnitStats, HTMLInputElement>();
const growthInputs = new Map<keyof UnitStats, HTMLInputElement>();
const abilityChecks = new Map<string, HTMLInputElement>();
const targetingRadios = new Map<string, HTMLInputElement>();

// ---- Build (structure is constant; values sync per archetype) ----
buildTabs();
buildStatInputs();
buildAbilityChecks();
buildTargetingRadios();
attachIdentity();
attachPreviewControls();
attachButtons();
selectArchetype(activeKey);

function buildTabs(): void {
  tabsEl.innerHTML = '';
  for (const key of Object.keys(working) as ArchetypeKey[]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.dataset.key = key;
    btn.addEventListener('click', () => selectArchetype(key));
    tabsEl.appendChild(btn);
  }
}

function buildStatInputs(): void {
  baseStatsEl.innerHTML = '';
  growthRatesEl.innerHTML = '';
  for (const key of STAT_ORDER) {
    baseInputs.set(key, makeStatField(baseStatsEl, key, 'base'));
    growthInputs.set(key, makeStatField(growthRatesEl, key, 'growth'));
  }
}

function makeStatField(
  parent: HTMLElement,
  key: keyof UnitStats,
  kind: StatKind,
): HTMLInputElement {
  const wrap = document.createElement('label');
  wrap.className = 'stat-field';
  const name = document.createElement('span');
  name.className = 'stat-name';
  name.textContent = STAT_LABELS[key];
  name.title = key;
  const input = document.createElement('input');
  input.type = 'number';
  if (kind === 'base') {
    input.step = '1';
    // mobility is the lone signed stat (negative = slower than baseline).
    input.min = key === 'mobility' ? '-99' : '0';
    input.max = '99';
  } else {
    input.step = '0.05';
    input.min = '0';
    input.max = '1';
  }
  input.addEventListener('input', () => onStatInput(key, kind, input));
  wrap.appendChild(name);
  wrap.appendChild(input);
  parent.appendChild(wrap);
  return input;
}

function buildAbilityChecks(): void {
  abilitiesEl.innerHTML = '';
  for (const id of ABILITY_IDS) {
    const label = document.createElement('label');
    label.className = 'inline';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = id;
    cb.addEventListener('change', onAbilityChange);
    label.appendChild(cb);
    // Yb QoL: show the config display name; keep the raw id as the hover title
    // for disambiguation (mirrors the stat rows' `name.title = key`).
    label.append(` ${abilityDef(id).name}`);
    label.title = id;
    abilitiesEl.appendChild(label);
    abilityChecks.set(id, cb);
  }
}

function buildTargetingRadios(): void {
  targetingEl.innerHTML = '';
  for (const id of TARGETING_IDS) {
    const label = document.createElement('label');
    label.className = 'inline';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'targeting';
    radio.value = id;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      working[activeKey].targeting = id;
      refreshDerived();
    });
    label.appendChild(radio);
    label.append(` ${id}`);
    targetingEl.appendChild(label);
    targetingRadios.set(id, radio);
  }
}

function attachIdentity(): void {
  glyphEl.addEventListener('input', () => {
    working[activeKey].glyph = glyphEl.value;
    refreshTabs();
    refreshDerived();
  });
  draftableEl.addEventListener('change', () => {
    working[activeKey].draftable = draftableEl.checked;
    refreshDerived();
  });
}

function attachPreviewControls(): void {
  previewLevelEl.addEventListener('input', () => {
    const n = Number.parseInt(previewLevelEl.value, 10);
    previewLevel = Number.isFinite(n) && n >= 1 ? n : 1;
    refreshPreview();
  });
  refPrecisionEl.addEventListener('input', () => {
    const n = Number.parseInt(refPrecisionEl.value, 10);
    refPrecision = Number.isFinite(n) ? n : 0;
    refreshPreview();
  });
  refEvasionEl.addEventListener('input', () => {
    const n = Number.parseInt(refEvasionEl.value, 10);
    refEvasion = Number.isFinite(n) ? n : 0;
    refreshPreview();
  });
}

function attachButtons(): void {
  newBtn.addEventListener('click', createArchetype);
  deleteBtn.addEventListener('click', deleteArchetype);
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

// ---- Edit handlers ----
function onStatInput(key: keyof UnitStats, kind: StatKind, input: HTMLInputElement): void {
  const raw = input.value.trim();
  const num = kind === 'base' ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
  const value = Number.isFinite(num) ? num : 0;
  if (kind === 'base') working[activeKey].baseStats[key] = value;
  else working[activeKey].growthRates[key] = value;
  refreshDerived();
}

function onAbilityChange(): void {
  // Rebuild in registry order — deterministic. Order only matters for
  // multi-ability proposer ties (none ship today), so registry order is fine.
  working[activeKey].abilities = ABILITY_IDS.filter((id) => abilityChecks.get(id)!.checked);
  refreshDerived();
}

// ---- Refresh ----
function selectArchetype(key: ArchetypeKey): void {
  activeKey = key;
  syncForm();
  refreshTabs();
  refreshDerived();
}

/** Push `working[activeKey]` into every form control. */
function syncForm(): void {
  const a = working[activeKey];
  glyphEl.value = a.glyph;
  draftableEl.checked = a.draftable;
  for (const key of STAT_ORDER) {
    baseInputs.get(key)!.value = String(a.baseStats[key]);
    growthInputs.get(key)!.value = String(a.growthRates[key]);
  }
  for (const [id, cb] of abilityChecks) cb.checked = a.abilities.includes(id);
  for (const [id, radio] of targetingRadios) radio.checked = a.targeting === id;
}

function refreshTabs(): void {
  for (const btn of Array.from(tabsEl.children) as HTMLButtonElement[]) {
    const key = btn.dataset.key as ArchetypeKey;
    btn.textContent = `${working[key].glyph}  ${key}`;
    btn.classList.toggle('active', key === activeKey);
  }
  deleteBtn.disabled = Object.keys(working).length <= 1; // never delete the last
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
  refreshWireup();
}

function refreshValidation(): void {
  // §30d — validate PER ENTRY against `UnitDefSchema`. The whole-config
  // `UnitDefsSchema` is a fixed-key `z.object` that would silently STRIP a new
  // archetype key (zod default), reporting "valid" while dropping the very entry
  // being authored — so we parse each entry and path the issues by key, plus
  // guard the key naming the formatter / Save will write verbatim.
  validationEl.innerHTML = '';
  const issues: string[] = [];
  for (const [key, a] of Object.entries(working)) {
    if (!KEY_PATTERN.test(key)) {
      issues.push(`${key}: key must be snake_case (a–z, 0–9, _, starting with a letter)`);
    }
    const result = UnitDefSchema.safeParse(a);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push(`${key}.${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
    }
  }
  lastValid = issues.length === 0;
  if (lastValid) addValidation('ok', 'Valid — matches the game schema. Safe to save.');
  else for (const i of issues) addValidation('error', i);
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  // §38d — re-attach the NEUTRAL entries (walls / half-cover) verbatim after the
  // edited combatants, so a Save reproduces the whole `units.json` (combatant then
  // neutral key order matches the file) rather than dropping the neutral fold.
  exportEl.value = formatArchetypesJson({ ...working, ...NEUTRAL_DEFS });
}

function refreshPreview(): void {
  const a = working[activeKey];
  const base = a.baseStats as UnitStats;
  const stats: UnitStats =
    previewLevel <= 1 ? { ...base } : scaleStats(base, a.growthRates, previewLevel - 1);
  const hasAbilities = a.abilities.length > 0;
  const range = hasAbilities
    ? Math.max(...a.abilities.map((id) => abilityDef(id).rangeCells))
    : 0;
  const derived = deriveStats(stats, range);

  previewEl.innerHTML = '';
  addPreview('Stats @ Lv ' + previewLevel, STAT_ORDER.map((k) => `${STAT_LABELS[k]} ${stats[k]}`).join('  '));
  addPreview('Max HP', String(derived.maxHp));
  addPreview('Range', hasAbilities ? String(range) : '— (no ability)');
  addPreview(
    `Dodge vs PRC ${refPrecision}`,
    `${pct(1 - hitChanceFor(REF_ACCURACY, refPrecision, stats.evasion))} (this unit evades a base-${pct(REF_ACCURACY)} attacker)`,
  );
  addPreview('Move cadence', cadence(derived.moveCooldownTicks));
  // I6 — combat profile is PER-ABILITY (might / accuracy / critBase + the
  // evadable/critable gates), computed by the REAL game helpers. §30d reads the
  // output stat off the op's `scaling` (the post-Y source of truth) instead of a
  // per-archetype switch, so the numbers are correct for any archetype, new ones
  // included.
  for (const id of a.abilities) addPreview(`Ability · ${id}`, abilityOutputLine(id, stats));
}

/** The per-ability preview line: the resolved output (damage/heal via the op's
 *  own scaling), to-hit / crit, and any status rider — robust for any archetype. */
function abilityOutputLine(id: string, stats: UnitStats): string {
  const def = abilityDef(id);
  const kinds = def.effects.map((e) => e.op.kind);

  // A self-target reposition (the dash): no damage/to-hit; flat motion + cooldown
  // (the motion window is the timeline's authored seconds).
  if (def.target.kind === 'self' && kinds.includes('move')) {
    const motionSeconds = def.timeline.reduce((s, p) => s + (p.seconds === 'fill' ? 0 : p.seconds), 0);
    return `leap ${def.rangeCells} · ${motionSeconds}s motion · cd ${def.cooldownSeconds}s`;
  }

  const ticks = attackCooldownTicksFor(def.cooldownSeconds, stats.speed);
  const damageOp = damageOpOf(id);
  const op = damageOp ?? healOpOf(id);

  let head: string;
  if (op) {
    const scaleVal = scalingStatValue(op.scaling, stats);
    const effect = damageOp ? 'dmg' : 'heal';
    head = `${op.might + scaleVal} ${effect} (${op.might} + ${scaleVal} ${SCALING_LABEL[op.scaling] ?? op.scaling})`;
  } else {
    // No top-level damage/heal (chain / summon / pure applyStatus): name the verb.
    head = kinds.includes('chain') ? 'chain' : kinds.includes('summon') ? 'summon' : kinds.join('+');
  }

  const statusIds = def.effects.flatMap((e) => (e.op.kind === 'applyStatus' ? [e.op.statusId] : []));
  const parts = [`${head} · rng ${def.rangeCells} · ${cadence(ticks)}`];
  if (damageOp) {
    parts.push(
      damageOp.evadable
        ? `to-hit ${pct(hitChanceFor(damageOp.accuracy, stats.precision, refEvasion))} vs EVA ${refEvasion}`
        : 'unmissable',
    );
    if (damageOp.critable) parts.push(`crit ${pct(critChanceFor(damageOp.critBase, stats.luck))} (×${STATS.critMult})`);
  }
  if (statusIds.length) parts.push(`applies ${statusIds.join('/')}`);
  return parts.join(' · ');
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
      body: JSON.stringify({ file: 'units.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      saveStatusEl.textContent =
        `Saved to config/units.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new values.`;
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
  working = structuredClone(UNIT_DEFS);
  // The key set may have changed (a created / deleted archetype) — rebuild the
  // tabs and re-anchor `activeKey` if it no longer exists.
  if (!(activeKey in working)) activeKey = Object.keys(working)[0]!;
  buildTabs();
  selectArchetype(activeKey);
  saveStatusEl.textContent = 'Reverted to the committed config (not yet saved).';
  saveStatusEl.className = 'hint';
}

// ---- Create / delete (§30d) ----
function createArchetype(): void {
  const key = window.prompt('New archetype id (snake_case, e.g. "necromancer"):')?.trim();
  if (!key) return;
  if (key in working) {
    window.alert(`"${key}" already exists.`);
    return;
  }
  if (!KEY_PATTERN.test(key)) {
    window.alert('Id must be snake_case: a–z, 0–9, _, starting with a letter.');
    return;
  }
  // Seed from the active archetype — a convenient starting point to tweak (its
  // glyph duplicates until the user changes it; the Wire-up panel flags it).
  working[key] = structuredClone(working[activeKey]);
  buildTabs();
  selectArchetype(key);
  saveStatusEl.textContent =
    `Created "${key}" (cloned from "${activeKey}"). Edit its glyph + stats, then see Wire-up for the code edits.`;
  saveStatusEl.className = 'hint';
}

function deleteArchetype(): void {
  if (Object.keys(working).length <= 1) return; // never delete the last
  if (!window.confirm(`Delete archetype "${activeKey}" from the editor? (Nothing is written until you Save.)`)) {
    return;
  }
  const deleted = activeKey;
  delete working[activeKey];
  activeKey = Object.keys(working)[0]!;
  buildTabs();
  selectArchetype(activeKey);
  saveStatusEl.textContent = `Deleted "${deleted}" in the editor. Save writes the file; see Wire-up for the code removal.`;
  saveStatusEl.className = 'hint';
}

// ---- Wire-up panel (§30d): the code edits a created / deleted archetype needs ----
function refreshWireup(): void {
  const committed = new Set(Object.keys(UNIT_DEFS));
  const current = Object.keys(working);
  const added = current.filter((k) => !committed.has(k));
  const removed = [...committed].filter((k) => !current.includes(k));
  wireupEl.innerHTML = '';

  if (added.length === 0 && removed.length === 0) {
    wireupEl.appendChild(
      elp('hint', 'No structural changes — every archetype is already wired in code. Edits Save straight to config.'),
    );
    return;
  }

  wireupEl.appendChild(
    elp('hint', 'A created / deleted archetype needs these code edits too — the JSON Save and the edits land together to make it spawn + render:'),
  );

  for (const key of added) {
    const a = working[key];
    const block = elTag('div', 'wire-block', '');
    block.appendChild(elTag('h3', '', `+ ${key}  (glyph "${a.glyph}")`));
    const ol = document.createElement('ol');
    ol.appendChild(elTag('li', '', `src/sim/Unit.ts — add  | '${key}'  to the Archetype union`));
    ol.appendChild(elTag('li', '', `src/config/units.ts — add  ${key}: UnitDefSchema,  to UnitDefsSchema`));
    ol.appendChild(elTag('li', '', `src/render/glyphs.ts — append  '${a.glyph}',  to GLYPHS (append-only, gotcha #33)`));
    block.appendChild(ol);
    wireupEl.appendChild(block);
  }
  for (const key of removed) {
    const block = elTag('div', 'wire-block', '');
    block.appendChild(elTag('h3', '', `− ${key}`));
    block.appendChild(
      elp('', `Remove '${key}' from the Archetype union (Unit.ts), UnitDefsSchema (units.ts), and its glyph in glyphs.ts.`),
    );
    wireupEl.appendChild(block);
  }

  // Atlas-budget projection: each distinct new glyph not already registered.
  const registered = GLYPHS as readonly string[];
  const newGlyphs = new Set(added.map((k) => working[k].glyph).filter((g) => !registered.includes(g)));
  const projected = GLYPHS.length + newGlyphs.size;
  const over = projected > ATLAS_BUDGET;
  wireupEl.appendChild(
    elp(over ? 'hint err' : 'hint', `Font atlas: ${projected}/${ATLAS_BUDGET} cells${over ? ' — over budget; FontAtlas.ts needs a grid resize' : ''}.`),
  );
}

// ---- Small helpers ----
function addPreview(term: string, value: string): void {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  previewEl.appendChild(dt);
  previewEl.appendChild(dd);
}

function addValidation(level: 'ok' | 'error', text: string): void {
  const li = document.createElement('li');
  li.className = level;
  li.textContent = text;
  validationEl.appendChild(li);
}

function elTag<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function elp(cls: string, text: string): HTMLParagraphElement {
  return elTag('p', cls, text);
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Cooldown ticks → a readable cadence string (seconds + per-second rate). */
function cadence(ticks: number): string {
  const seconds = ticksToSeconds(ticks);
  return `every ${seconds.toFixed(2)}s (${ticks} ticks, ${(1 / seconds).toFixed(2)}/s)`;
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
  if (!el) throw new Error(`archetype-editor: missing element "${selector}"`);
  return el;
}
