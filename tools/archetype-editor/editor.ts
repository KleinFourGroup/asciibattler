/**
 * Archetype editor (I4). Standalone Vite page — visit
 * http://localhost:5173/tools/archetype-editor/ after `npm run dev`. Not in
 * the production build (no rollupOptions.input entry).
 *
 * Edits the six archetype entries of `config/archetypes.json` — glyph,
 * abilities, targeting policy, the 11-stat `baseStats` block, and the parallel
 * `growthRates` — with three things the copy-paste loop didn't give us:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME `ArchetypesSchema`
 *     the game boots on (imported from `src/config/archetypes.ts`), so "is this
 *     valid?" can't drift from the game's load-time parse. Save is disabled
 *     while invalid.
 *  2. **Live derived-stat preview.** maxHp / crit / move + attack cadence /
 *     to-hit / dodge are computed by the REAL game functions (`deriveStats`,
 *     `hitChanceFor`, `attackCooldownTicksFor`, `scaleStats`) — never
 *     reimplemented here — so the numbers match combat exactly. A level dial
 *     previews where growth rates land a unit deeper into a run; the to-hit /
 *     dodge rows take a reference opponent precision/evasion so the I5 dodge
 *     identities are tunable by feel.
 *  3. **Save to disk.** Posts the formatted whole-file JSON to the dev-only
 *     `/__save-config` endpoint (see vite.config.ts), closing the copy-paste
 *     loop. Copy / Download stay as offline fallbacks.
 *
 * Schema-driven where it counts: the stat fields enumerate from `STAT_LABELS`
 * (the same source the recruit/promotion cards use) and the ability/targeting
 * choices from the live registries, so a future stat or ability surfaces here
 * with no edit. Adding a brand-new *archetype* still needs code (the closed
 * `Archetype` union + a glyph + ability factories) — once those land, the new
 * key shows up here automatically for tuning.
 */

import './editor.css';
import { ARCHETYPES, ArchetypesSchema, type ArchetypesConfig } from '../../src/config/archetypes';
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
  damageStatFor,
  deriveStats,
  hitChanceFor,
} from '../../src/sim/stats';
import { scaleStats } from '../../src/sim/leveling';
import { formatArchetypesJson } from './format';

type ArchetypeKey = keyof ArchetypesConfig;
type StatKind = 'base' | 'growth';

const STAT_ORDER = Object.keys(STAT_LABELS) as (keyof UnitStats)[];
const ABILITY_IDS = knownAbilityIds();
const TARGETING_IDS = knownTargetingIds();

/** Display hint for which stat drives a unit's strike/heal output. The
 *  authoritative mapping is `damageStatFor` (sim); this only labels it. */
const OUTPUT_LABEL: Record<ArchetypeKey, string> = {
  // I5 — the melee family all strike on STR.
  mercenary: 'STR',
  adventurer: 'STR',
  ronin: 'STR',
  bandit: 'STR',
  ranged: 'RNG',
  rogue: 'STR',
  healer: 'MAG (heal)',
  mage: 'MAG',
  catapult: 'RNG',
  // §29 demo roster.
  reaver: 'STR',
};

// ---- State ----
// `working` is a deep, mutable clone of the committed config; the form mutates
// it, the schema validates it, the formatter emits it. ARCHETYPES stays the
// pristine baseline that "Revert all" restores from.
let working: ArchetypesConfig = structuredClone(ARCHETYPES);
let activeKey: ArchetypeKey = (Object.keys(working) as ArchetypeKey[])[0]!;
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
const glyphEl = mustQuery<HTMLInputElement>('#glyph');
const abilitiesEl = mustQuery<HTMLDivElement>('#abilities');
const targetingEl = mustQuery<HTMLDivElement>('#targeting');
const baseStatsEl = mustQuery<HTMLDivElement>('#base-stats');
const growthRatesEl = mustQuery<HTMLDivElement>('#growth-rates');
const previewEl = mustQuery<HTMLDListElement>('#preview');
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
attachGlyph();
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

function attachGlyph(): void {
  glyphEl.addEventListener('input', () => {
    working[activeKey].glyph = glyphEl.value;
    refreshTabs();
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
    a.download = 'archetypes.json';
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
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
}

function refreshValidation(): void {
  const result = ArchetypesSchema.safeParse(working);
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
  exportEl.value = formatArchetypesJson(working);
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
  // I6 — combat profile is PER-WEAPON now (might / accuracy / critBase + the
  // evadable/critable gates), so damage, to-hit, and crit are shown per ability
  // rather than as single unit-wide numbers. Computed by the REAL game helpers.
  for (const id of a.abilities) {
    const def = abilityDef(id);
    if (def.target.kind === 'self') {
      // N1 — a pure-reposition leap (the dash): no damage/to-hit/crit, just leap
      // distance + the flat (speed-independent) motion + cooldown. The motion
      // window is the timeline's authored seconds (the dash's single impact phase).
      const motionSeconds = def.timeline.reduce(
        (s, p) => s + (p.seconds === 'fill' ? 0 : p.seconds),
        0,
      );
      addPreview(
        `Ability · ${id}`,
        `dash ${def.rangeCells} · ${motionSeconds}s motion · cd ${def.cooldownSeconds}s`,
      );
      continue;
    }
    const ticks = attackCooldownTicksFor(def.cooldownSeconds, stats.speed);
    const scaling = activeKey === 'healer' ? stats.magic : damageStatFor(activeKey, stats);
    // The flat base output is on the verb's damage OR heal op (both carry `might`).
    const damageOp = damageOpOf(id);
    const might = (damageOp ?? healOpOf(id))?.might ?? 0;
    const out = might + scaling;
    const effect = activeKey === 'healer' ? 'heal' : 'dmg';
    const toHit = damageOp?.evadable
      ? `${pct(hitChanceFor(damageOp.accuracy, stats.precision, refEvasion))} vs EVA ${refEvasion}`
      : 'unmissable';
    const crit = damageOp?.critable
      ? `${pct(critChanceFor(damageOp.critBase, stats.luck))} (×${STATS.critMult})`
      : 'no crit';
    addPreview(
      `Ability · ${id}`,
      `${out} ${effect} (${might} might + ${scaling} ${OUTPUT_LABEL[activeKey]}) · rng ${def.rangeCells} · ${cadence(ticks)}` +
        ` · to-hit ${toHit} · crit ${crit}`,
    );
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
      body: JSON.stringify({ file: 'archetypes.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      saveStatusEl.textContent =
        `Saved to config/archetypes.json at ${new Date().toLocaleTimeString()}. ` +
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
  working = structuredClone(ARCHETYPES);
  selectArchetype(activeKey); // same keys, so activeKey stays valid
  saveStatusEl.textContent = 'Reverted to the committed config (not yet saved).';
  saveStatusEl.className = 'hint';
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
