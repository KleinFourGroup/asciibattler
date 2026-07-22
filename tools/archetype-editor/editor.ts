/**
 * Unit editor (I4 · §30d · §38e). Standalone Vite page — visit
 * http://localhost:5173/tools/archetype-editor/ after `npm run dev`. Not in
 * the production build (no rollupOptions.input entry).
 *
 * Edits `config/units.json` — the whole §38 `UnitDef` catalog: the COMBATANT
 * archetypes (glyph, abilities, targeting, `draftable`, the 11-stat `baseStats`,
 * the parallel `growthRates`) AND the NEUTRAL entries (walls / half-cover /
 * future rubble — a glyph, a flat `hp` pool, `blocksLineOfSight`, and the
 * `statusSusceptibility` allow-filter). The tool gives us what the copy-paste
 * loop didn't:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME per-entry
 *     `UnitDefSchema` the game boots on (imported from `src/config/units.ts`) —
 *     a `z.union` of the combatant + neutral shapes — so "is this valid?" can't
 *     drift from the game's load-time parse. Save is disabled while invalid.
 *     (Validates PER ENTRY rather than the whole-config `z.record`, which would
 *     silently strip a new, not-yet-referenced key.)
 *  2. **Live derived-stat preview** (combatants) via the REAL game functions
 *     (`deriveStats`, `hitChanceFor`, `attackCooldownTicksFor`, `scaleStats`,
 *     `scalingStatValue`), so the numbers are correct for ANY archetype,
 *     including a freshly-created one.
 *  3. **Save to disk** via the dev-only `/__save-config` endpoint. Copy / Download
 *     stay as offline fallbacks.
 *
 *  §38e — the KEYSTONE payoff. Pre-§38 an archetype was a CLOSED typed vocabulary,
 *  so creating one needed code edits the tool couldn't perform (the `Archetype`
 *  union, the `UnitDefsSchema` key, a `glyphs.ts` glyph) — the old "Wire-up" panel
 *  emitted those edits to paste. §38c relaxed the union to an open catalog id and
 *  §38e-1 made unit glyphs catalog-derived, so creating a unit is now **pure
 *  DATA, no code edit**: the Wire-up panel is GONE, replaced by a Font-atlas
 *  budget indicator (the one real limit left — the atlas grid caps the glyph
 *  count). "+ New" clones the active entry (combatant or neutral); Save writes the
 *  file; a reload spawns + renders it.
 *
 * Schema-driven where it counts: the stat fields enumerate from `STAT_LABELS`,
 * the ability/targeting choices from the live registries, and the
 * status-susceptibility choices from `STATUS_DEFS`, so a future stat / ability /
 * status surfaces here with no edit.
 */

import './editor.css';
import {
  ALL_UNIT_DEFS,
  RARITY_TIERS,
  UnitDefSchema,
  isNeutralUnitDef,
  type CombatantUnitDef,
  type NeutralUnitDef,
  type UnitDef,
} from '../../src/config/units';
import type { UnitStats } from '../../src/sim/Unit';
import { STAT_LABELS } from '../../src/ui/statLabels';
import { knownAbilityIds } from '../../src/sim/abilities/registry';
import { knownTargetingIds } from '../../src/sim/targetingStrategies';
import { abilityDef, damageOpOf, healOpOf } from '../../src/config/abilities';
import { STATUS_DEFS } from '../../src/config/statuses';
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
import { atlasCellsFor, ATLAS_CELL_BUDGET } from '../../src/render/glyphs';
import { formatArchetypesJson } from './format';

// Keys are open (a new unit can be created), so the working set is a plain record
// keyed by string, validated per-entry against `UnitDefSchema` (the union).
type ArchetypeKey = string;
type StatKind = 'base' | 'growth';

/** A new unit's key must be a clean snake_case identifier (matches every existing
 *  key + a valid catalog id). */
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const STAT_ORDER = Object.keys(STAT_LABELS) as (keyof UnitStats)[];
const ABILITY_IDS = knownAbilityIds();
const TARGETING_IDS = knownTargetingIds();
// §38e — the statuses a neutral can opt into for its `statusSusceptibility`
// allow-filter, straight off the live registry so a new status surfaces here.
const STATUS_IDS = Object.keys(STATUS_DEFS);

/** Short label for a damage/heal op's scaling stat (the per-ability output hint —
 *  derived from the op, not a per-archetype map, so a new archetype Just Works). */
const SCALING_LABEL: Record<string, string> = {
  strength: 'STR',
  ranged: 'RNG',
  magic: 'MAG',
  none: 'flat',
};

// ---- State ----
// `working` is a deep, mutable clone of the committed catalog; the form mutates
// it, the schema validates it, the formatter emits it. ALL_UNIT_DEFS stays the
// pristine baseline that "Revert all" restores from. §38e: the working set is the
// FULL catalog (combatants + neutrals), keyed by string, so neutrals are editable
// too — the old combatant-only `UNIT_DEFS` clone + verbatim NEUTRAL_DEFS re-attach
// on Save is gone.
let working: Record<string, UnitDef> = structuredClone(ALL_UNIT_DEFS);
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
const editorRoot = mustQuery<HTMLElement>('#editor-root');
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const deleteBtn = mustQuery<HTMLButtonElement>('#delete-btn');
const kindBadgeEl = mustQuery<HTMLSpanElement>('#kind-badge');
const glyphEl = mustQuery<HTMLInputElement>('#glyph');
const draftableEl = mustQuery<HTMLInputElement>('#draftable');
// §61b — options enumerate from RARITY_TIERS (the schema-driven discipline), so
// a future tier surfaces here with no edit.
const rarityEl = mustQuery<HTMLSelectElement>('#rarity');
for (const tier of RARITY_TIERS) {
  const opt = document.createElement('option');
  opt.value = tier;
  opt.textContent = tier;
  rarityEl.appendChild(opt);
}
const abilitiesEl = mustQuery<HTMLDivElement>('#abilities');
const targetingEl = mustQuery<HTMLDivElement>('#targeting');
// §38e — neutral-only controls.
const neutralHpEl = mustQuery<HTMLInputElement>('#neutral-hp');
const neutralLosEl = mustQuery<HTMLInputElement>('#neutral-los');
const restrictSusEl = mustQuery<HTMLInputElement>('#restrict-sus');
const susceptibilityEl = mustQuery<HTMLDivElement>('#susceptibility');
const baseStatsEl = mustQuery<HTMLDivElement>('#base-stats');
const growthRatesEl = mustQuery<HTMLDivElement>('#growth-rates');
const previewEl = mustQuery<HTMLDListElement>('#preview');
const atlasEl = mustQuery<HTMLParagraphElement>('#atlas');
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
const susChecks = new Map<string, HTMLInputElement>();

// ---- Narrowing helpers ----
// The combatant-only handlers are wired to controls only shown in combatant mode
// (and the neutral ones vice versa), so in practice these never throw — they're
// the TS narrow over the `UnitDef` union.
function activeCombatant(): CombatantUnitDef {
  const a = working[activeKey];
  if (isNeutralUnitDef(a)) throw new Error(`archetype-editor: "${activeKey}" is neutral`);
  return a;
}
function activeNeutral(): NeutralUnitDef {
  const a = working[activeKey];
  if (!isNeutralUnitDef(a)) throw new Error(`archetype-editor: "${activeKey}" is a combatant`);
  return a;
}

// ---- Build (structure is constant; values sync per unit) ----
buildTabs();
buildStatInputs();
buildAbilityChecks();
buildTargetingRadios();
buildSusceptibilityChecks();
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
      activeCombatant().targeting = id;
      refreshDerived();
    });
    label.appendChild(radio);
    label.append(` ${id}`);
    targetingEl.appendChild(label);
    targetingRadios.set(id, radio);
  }
}

// §38e — the neutral `statusSusceptibility` allow-filter: one checkbox per known
// status id. Only consulted when the "Restrict statuses" toggle is on (absent ⇒
// susceptible to all — the schema default a combatant relies on).
function buildSusceptibilityChecks(): void {
  susceptibilityEl.innerHTML = '';
  for (const id of STATUS_IDS) {
    const label = document.createElement('label');
    label.className = 'inline';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = id;
    cb.addEventListener('change', onSusceptibilityChange);
    label.appendChild(cb);
    label.append(` ${id}`);
    susceptibilityEl.appendChild(label);
    susChecks.set(id, cb);
  }
}

function attachIdentity(): void {
  // Glyph is shared by both shapes (a common union field), so no narrow needed.
  glyphEl.addEventListener('input', () => {
    working[activeKey].glyph = glyphEl.value;
    refreshTabs();
    refreshDerived();
  });
  draftableEl.addEventListener('change', () => {
    activeCombatant().draftable = draftableEl.checked;
    refreshDerived();
  });
  rarityEl.addEventListener('change', () => {
    activeCombatant().rarity = rarityEl.value as CombatantUnitDef['rarity'];
    refreshDerived();
  });
  // ── Neutral fields ──────────────────────────────────────────────────────────
  neutralHpEl.addEventListener('input', () => {
    const n = Number.parseInt(neutralHpEl.value, 10);
    activeNeutral().hp = Number.isFinite(n) && n >= 1 ? n : 1;
    refreshDerived();
  });
  neutralLosEl.addEventListener('change', () => {
    activeNeutral().blocksLineOfSight = neutralLosEl.checked;
    refreshDerived();
  });
  restrictSusEl.addEventListener('change', () => {
    const a = activeNeutral();
    if (restrictSusEl.checked) a.statusSusceptibility = currentCheckedSusceptibility();
    else delete a.statusSusceptibility;
    editorRoot.classList.toggle('sus-restricted', restrictSusEl.checked);
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
  const a = activeCombatant();
  if (kind === 'base') a.baseStats[key] = value;
  else a.growthRates[key] = value;
  refreshDerived();
}

function onAbilityChange(): void {
  // Rebuild in registry order — deterministic. Order only matters for
  // multi-ability proposer ties (none ship today), so registry order is fine.
  activeCombatant().abilities = ABILITY_IDS.filter((id) => abilityChecks.get(id)!.checked);
  refreshDerived();
}

function onSusceptibilityChange(): void {
  // Only meaningful while restricting (the checkboxes are hidden otherwise). Store
  // in registry order — deterministic + matches the hand-authored file.
  if (!restrictSusEl.checked) return;
  activeNeutral().statusSusceptibility = currentCheckedSusceptibility();
  refreshDerived();
}

/** The ticked susceptibility ids, in `STATUS_DEFS` order. */
function currentCheckedSusceptibility(): string[] {
  return STATUS_IDS.filter((id) => susChecks.get(id)!.checked);
}

// ---- Refresh ----
function selectArchetype(key: ArchetypeKey): void {
  activeKey = key;
  syncForm();
  refreshTabs();
  refreshDerived();
}

/** Push `working[activeKey]` into every form control + toggle the kind-scoped
 *  sections (combatant stats/abilities vs neutral hp/LOS/susceptibility). */
function syncForm(): void {
  const a = working[activeKey];
  glyphEl.value = a.glyph;
  const neutral = isNeutralUnitDef(a);
  editorRoot.classList.toggle('kind-neutral', neutral);
  editorRoot.classList.toggle('kind-combatant', !neutral);
  kindBadgeEl.textContent = neutral ? '(neutral)' : '(combatant)';

  if (neutral) {
    neutralHpEl.value = String(a.hp);
    neutralLosEl.checked = a.blocksLineOfSight;
    const restrict = a.statusSusceptibility !== undefined;
    restrictSusEl.checked = restrict;
    editorRoot.classList.toggle('sus-restricted', restrict);
    for (const [id, cb] of susChecks) cb.checked = restrict && a.statusSusceptibility!.includes(id);
    return;
  }

  editorRoot.classList.remove('sus-restricted');
  draftableEl.checked = a.draftable;
  rarityEl.value = a.rarity ?? 'common';
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
  refreshAtlas();
  refreshExport();
  refreshPreview();
}

function refreshValidation(): void {
  // Validate PER ENTRY against `UnitDefSchema` (the combatant|neutral union). The
  // whole-config `UnitDefsSchema` is a `z.record` that would silently STRIP an
  // entry that fails structural checks, so we parse each entry and path the issues
  // by key, plus guard the key naming the formatter / Save will write verbatim.
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
  // §38e — an over-budget atlas would crash the FontAtlas build on the next
  // reload (unit glyphs are catalog-derived now), so it BLOCKS Save.
  const cells = atlasCellsFor(Object.values(working).map((d) => d.glyph));
  if (cells > ATLAS_CELL_BUDGET) {
    issues.push(
      `font atlas: ${cells}/${ATLAS_CELL_BUDGET} cells — over budget; reuse a glyph or grow the FontAtlas grid before saving.`,
    );
  }
  lastValid = issues.length === 0;
  if (lastValid) addValidation('ok', 'Valid — matches the game schema. Safe to save.');
  else for (const i of issues) addValidation('error', i);
  saveBtn.disabled = !lastValid;
}

/** §38e — the Font-atlas budget indicator that replaced the closed-union wire-up
 *  panel: how many atlas cells the working catalog's glyphs occupy, plus a
 *  duplicate-glyph nudge (two units sharing a glyph render identically). */
function refreshAtlas(): void {
  const glyphs = Object.values(working).map((d) => d.glyph);
  const cells = atlasCellsFor(glyphs);
  const over = cells > ATLAS_CELL_BUDGET;

  const activeGlyph = working[activeKey].glyph;
  const sharedBy = Object.entries(working)
    .filter(([, d]) => d.glyph === activeGlyph)
    .map(([k]) => k);
  const dup = sharedBy.length > 1 ? ` · glyph "${activeGlyph}" shared by ${sharedBy.join(', ')}` : '';

  atlasEl.textContent =
    `${cells} / ${ATLAS_CELL_BUDGET} atlas cells used` +
    (over ? ' — OVER budget; Save blocked until a glyph is freed.' : '') +
    (over ? '' : dup);
  atlasEl.className = over ? 'hint err' : 'hint';
}

function refreshExport(): void {
  // §38e — `working` is the FULL catalog now (combatants + neutrals in file key
  // order), so the formatter emits the whole `units.json` directly — no verbatim
  // NEUTRAL_DEFS re-attach.
  exportEl.value = formatArchetypesJson(working);
}

function refreshPreview(): void {
  const a = working[activeKey];
  previewEl.innerHTML = '';

  // §38e — a NEUTRAL has no stats/abilities to derive; show its intrinsic fields.
  if (isNeutralUnitDef(a)) {
    addPreview('Kind', 'neutral (wall / cover / rubble)');
    addPreview('HP', String(a.hp));
    addPreview('Blocks line of sight', a.blocksLineOfSight ? 'yes' : 'no');
    addPreview(
      'Susceptible to',
      a.statusSusceptibility === undefined
        ? 'all statuses (no restriction)'
        : a.statusSusceptibility.length
          ? a.statusSusceptibility.join(', ')
          : 'nothing (immune)',
    );
    return;
  }

  const base = a.baseStats as UnitStats;
  const stats: UnitStats =
    previewLevel <= 1 ? { ...base } : scaleStats(base, a.growthRates, previewLevel - 1);
  const hasAbilities = a.abilities.length > 0;
  const range = hasAbilities
    ? Math.max(...a.abilities.map((id) => abilityDef(id).rangeCells))
    : 0;
  const derived = deriveStats(stats, range);

  addPreview('Stats @ Lv ' + previewLevel, STAT_ORDER.map((k) => `${STAT_LABELS[k]} ${stats[k]}`).join('  '));
  addPreview('Max HP', String(derived.maxHp));
  addPreview('Range', hasAbilities ? String(range) : '— (no ability)');
  addPreview(
    `Dodge vs PRC ${refPrecision}`,
    `${pct(1 - hitChanceFor(REF_ACCURACY, refPrecision, stats.evasion))} (this unit evades a base-${pct(REF_ACCURACY)} attacker)`,
  );
  addPreview('Move cadence', cadence(derived.moveCooldownTicks));
  // I6 — combat profile is PER-ABILITY (might / accuracy / critBase + the
  // evadable/critable gates), computed by the REAL game helpers. Reads the
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
  working = structuredClone(ALL_UNIT_DEFS);
  // The key set may have changed (a created / deleted unit) — rebuild the tabs
  // and re-anchor `activeKey` if it no longer exists.
  if (!(activeKey in working)) activeKey = Object.keys(working)[0]!;
  buildTabs();
  selectArchetype(activeKey);
  saveStatusEl.textContent = 'Reverted to the committed config (not yet saved).';
  saveStatusEl.className = 'hint';
}

// ---- Create / delete ----
function createArchetype(): void {
  const key = window.prompt('New unit id (snake_case, e.g. "necromancer" or "boulder"):')?.trim();
  if (!key) return;
  if (key in working) {
    window.alert(`"${key}" already exists.`);
    return;
  }
  if (!KEY_PATTERN.test(key)) {
    window.alert('Id must be snake_case: a–z, 0–9, _, starting with a letter.');
    return;
  }
  // Seed from the active entry — a convenient starting point to tweak, and it
  // inherits the active entry's KIND (clone a combatant tab for a new archetype,
  // a wall tab for a new neutral). Its glyph duplicates until changed (the atlas
  // indicator flags the collision).
  working[key] = structuredClone(working[activeKey]);
  buildTabs();
  selectArchetype(key);
  saveStatusEl.textContent =
    `Created "${key}" (cloned from "${activeKey}"). Edit its glyph + fields, then Save — no code edit needed.`;
  saveStatusEl.className = 'hint';
}

function deleteArchetype(): void {
  if (Object.keys(working).length <= 1) return; // never delete the last
  if (!window.confirm(`Delete "${activeKey}" from the editor? (Nothing is written until you Save.)`)) {
    return;
  }
  const deleted = activeKey;
  delete working[activeKey];
  activeKey = Object.keys(working)[0]!;
  buildTabs();
  selectArchetype(activeKey);
  saveStatusEl.textContent = `Deleted "${deleted}" in the editor. Save writes the file.`;
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
