/**
 * Encounter editor (V2). Standalone Vite page — visit
 * http://localhost:5173/tools/encounter-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Authors `config/encounters.json` — each encounter's id / name / description /
 * health pool / kind / optional layout fit-filter / **wave-list grammar** — with
 * the affordances the archetype/sector editors established plus the one the wave
 * grammar specifically needs:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME `EncountersSchema`
 *     the game boots on (imported from `src/config/encounters.ts`), so "is this
 *     valid?" can't drift from the game's load-time parse. Save is disabled while
 *     invalid (a malformed wave, an unknown archetype, a duplicate id, …).
 *  2. **A live RESOLUTION PREVIEW.** Given a configurable sample roster + hand
 *     size + level cap + pool %, it walks the REAL pure resolvers
 *     (`waveForTurn` → `resolveWave`) for the first N turns and renders the
 *     resolved enemy team each turn. This is the "feel" surface the wave grammar
 *     needs — sequences/picks/loops/stages are only legible once you see what
 *     they field turn-by-turn. It shares the game modules (never reimplements
 *     them), so the preview and combat can't disagree.
 *  3. **Save to disk.** Posts the formatted whole-file JSON (through the recursive
 *     `formatEncountersJson`) to the dev-only `/__save-config` endpoint
 *     (vite.config.ts allowlists `encounters.json`). Copy / Download stay as
 *     offline fallbacks.
 *
 * The wave grammar is a small recursive DSL, so it's edited as JSON in a
 * monospace box (live-validated) rather than a bespoke tree GUI; skeleton-insert
 * buttons lower the authoring friction by appending a well-formed wave / pick /
 * loop / stages node to the structured model. Placement (which sectors an
 * encounter is pooled in) is authored on the SECTOR side — see the sector editor
 * and the "add to sector" toggle (V2 placement) — since the sector owns its
 * encounter pool (sector-owns-both).
 */

import './editor.css';
import {
  ENCOUNTERS,
  EncountersSchema,
  ENCOUNTER_KINDS,
  ENCOUNTER_IDS,
  type Encounter,
  type EncounterKind,
} from '../../src/config/encounters';
import { LAYOUT_IDS } from '../../src/config/layouts';
// V2 placement — the "add to sector" toggle. The sector FILE is fetched live (not
// imported) so the encounter editor never gains a runtime dependency on
// sectors.json and stays off its rebuild chain. (A write still triggers a Vite
// full-reload of every dev client; SECTOR_ADD_STASH_KEY masks that here too.)
// `formatSectorsJson` / `addEncounterToSectorPools` import sectors type-only
// (erased), so they stay dependency-free.
import { formatSectorsJson } from '../sector-editor/format';
import { addEncounterToSectorPools } from '../sector-editor/poolEdit';
import type { SectorDef } from '../../src/config/sectors';
import { DECK } from '../../src/config/deck';
import { DIFFICULTY } from '../../src/config/difficulty';
import { RNG } from '../../src/core/RNG';
import {
  resolveWave,
  type WaveContext,
  type WaveSpec,
  type WaveUnitSpec,
} from '../../src/run/encounters/wave';
import {
  waveForTurn,
  type WaveCursor,
  type EncounterState,
  type WaveEntry,
  type PickOption,
  type Stage,
} from '../../src/run/encounters/sequencer';
import { scaledUnit, glyphForArchetype, type Archetype } from '../../src/sim/archetypes';
import { ARCHETYPES } from '../../src/config/archetypes';
import type { UnitTemplate } from '../../src/sim/Unit';
import { formatEncountersJson } from './format';

// ---- State ----
// The schema's `Encounter` is deeply readonly (config is immutable at runtime);
// the editor needs a mutable working copy. `DeepMutable` strips the readonly
// modifiers so the form can assign into the clone, while every CONSUMER
// (schema / formatter / resolvers) still takes it as readonly `Encounter`
// (mutable → readonly is assignable). A structuredClone is genuinely mutable at
// runtime, so this is a type-only relaxation.
type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;
type WorkingEncounter = DeepMutable<Encounter>;
type WorkingEntry = DeepMutable<WaveEntry>;
type WSpec = DeepMutable<WaveSpec>;
type WUnit = DeepMutable<WaveUnitSpec>;
type WOption = DeepMutable<PickOption>;
type WStage = DeepMutable<Stage>;

// `working` is a deep, mutable clone of the committed catalog; the form mutates
// it, the schema validates it, the formatter emits it. ENCOUNTERS stays the
// pristine baseline that "Revert all" restores from.
let working: WorkingEncounter[] = structuredClone(ENCOUNTERS) as WorkingEncounter[];
let activeIndex = 0;
let schemaOk = true;
/** False while the waves textarea holds non-JSON text (kept separate from schema
 *  validity so the parse error sits next to the box, not in the issue list). */
let wavesParseOk = true;
/** The wave editor's surface: the recursive visual builder (default) or the raw
 *  JSON box. Both funnel into the same `working[active].waves` model, so the
 *  preview / validation / formatter / save read one source of truth either way. */
let viewMode: 'visual' | 'json' = 'visual';
let uidCounter = 0;

/** A successful "add to sector" write reloads this page: sectors.json is imported
 *  by src/config/sectors.ts with no HMR boundary, so Vite broadcasts a full-reload
 *  to every connected dev client — including this one (the fetch-not-import choice
 *  keeps editor.ts off the rebuild CHAIN, but the global reload broadcast still
 *  hits it). Stash the "Added…" confirmation so it survives the reload instead of
 *  vanishing the instant it appears. Session-scoped (mirrors the layout editor). */
const SECTOR_ADD_STASH_KEY = 'encounterEditor.sectorAdded';

const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as Archetype[];
const ENTRY_KINDS = ['wave', 'pick', 'loop', 'stages'] as const;

// Per-kind numeric-field config for the `kindNumberControl` (a `<select>` of
// kinds + one number input bound to that kind's numeric field). Converting kind
// carries the number across when the field name matches (factor↔factor), else
// resets to the new kind's default.
type NumKey = 'value' | 'factor' | 'weight';
interface KindNumObj {
  kind: string;
  value?: number;
  factor?: number;
  weight?: number;
}
interface KindNumOption {
  readonly numKey: NumKey;
  readonly label: string;
  readonly def: number;
  readonly step: number;
  readonly min: number;
  readonly int: boolean;
}
type KindNumCfg = Record<string, KindNumOption>;

const LEVEL_BUDGET_CFG: KindNumCfg = {
  fixed: { numKey: 'value', label: '=', def: 4, step: 1, min: 0, int: true },
  mean: { numKey: 'factor', label: '×', def: 1.25, step: 0.05, min: 0, int: false },
  median: { numKey: 'factor', label: '×', def: 1.25, step: 0.05, min: 0, int: false },
};
const COUNT_CFG: KindNumCfg = {
  fixed: { numKey: 'value', label: '=', def: 3, step: 1, min: 0, int: true },
  hand: { numKey: 'factor', label: '×', def: 1.5, step: 0.05, min: 0, int: false },
};
const UNIT_COUNT_CFG: KindNumCfg = {
  fixed: { numKey: 'value', label: '=', def: 1, step: 1, min: 0, int: true },
  weight: { numKey: 'weight', label: 'w', def: 1, step: 0.1, min: 0, int: false },
};
const UNIT_LEVEL_CFG: KindNumCfg = {
  fixed: { numKey: 'value', label: 'Lv', def: 1, step: 1, min: 1, int: true },
  weight: { numKey: 'weight', label: 'w', def: 1, step: 0.1, min: 0, int: false },
};

// Preview controls (configurable per the V2 decision — mean/median level + hand
// size are what move budgets/counts).
let rosterLevels: number[] = [2, 2, 3, 3, 4];
let handSize = DECK.handSize;
let levelCap = 0; // seeded from the roster on first sync
let poolFraction = 1;
let previewTurns = 6;
let previewSeed = 1;

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const deleteBtn = mustQuery<HTMLButtonElement>('#delete-btn');
const idEl = mustQuery<HTMLInputElement>('#id');
const nameEl = mustQuery<HTMLInputElement>('#name');
const descEl = mustQuery<HTMLTextAreaElement>('#description');
const healthPoolEl = mustQuery<HTMLInputElement>('#health-pool');
const kindEl = mustQuery<HTMLDivElement>('#kind');
const layoutsEl = mustQuery<HTMLDivElement>('#layouts');
const viewVisualBtn = mustQuery<HTMLButtonElement>('#view-visual');
const viewJsonBtn = mustQuery<HTMLButtonElement>('#view-json');
const wavesVisualEl = mustQuery<HTMLDivElement>('#waves-visual');
const wavesJsonEl = mustQuery<HTMLDivElement>('#waves-json');
const wavesEl = mustQuery<HTMLTextAreaElement>('#waves');
const wavesErrorEl = mustQuery<HTMLParagraphElement>('#waves-error');
const formatWavesBtn = mustQuery<HTMLButtonElement>('#format-waves-btn');
const rosterLevelsEl = mustQuery<HTMLInputElement>('#roster-levels');
const handSizeEl = mustQuery<HTMLInputElement>('#hand-size');
const levelCapEl = mustQuery<HTMLInputElement>('#level-cap');
const poolFractionEl = mustQuery<HTMLInputElement>('#pool-fraction');
const turnsEl = mustQuery<HTMLInputElement>('#turns');
const seedEl = mustQuery<HTMLInputElement>('#seed');
const turnsOutEl = mustQuery<HTMLDivElement>('#turns-out');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');
// V2 placement — "add to sector" controls.
const sectorChecksEl = mustQuery<HTMLDivElement>('#sector-checks');
const sectorMinHopEl = mustQuery<HTMLInputElement>('#sector-minhop');
const addToSectorsBtn = mustQuery<HTMLButtonElement>('#add-to-sectors-btn');
const sectorAddStatusEl = mustQuery<HTMLParagraphElement>('#sector-add-status');

const kindRadios = new Map<EncounterKind, HTMLInputElement>();
const layoutChecks = new Map<string, HTMLInputElement>();

// ---- Build (structure is constant; values sync per encounter) ----
buildKindRadios();
buildLayoutChecks();
attachIdentity();
attachWaves();
attachViewToggle();
attachPreviewControls();
attachButtons();
levelCap = defaultLevelCap();
levelCapEl.value = String(levelCap);
handSizeEl.value = String(handSize);
rosterLevelsEl.value = rosterLevels.join(', ');
selectEncounter(activeIndex);
void loadSectorChecks();
restoreAfterSectorAdd();

function buildKindRadios(): void {
  kindEl.innerHTML = '';
  for (const kind of ENCOUNTER_KINDS) {
    const label = document.createElement('label');
    label.className = 'inline';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'kind';
    radio.value = kind;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      encounter().kind = kind;
      refreshDerived();
    });
    label.appendChild(radio);
    label.append(` ${kind}`);
    kindEl.appendChild(label);
    kindRadios.set(kind, radio);
  }
}

function buildLayoutChecks(): void {
  layoutsEl.innerHTML = '';
  for (const id of LAYOUT_IDS) {
    const label = document.createElement('label');
    label.className = 'inline';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = id;
    cb.addEventListener('change', onLayoutChange);
    label.appendChild(cb);
    label.append(` ${id}`);
    layoutsEl.appendChild(label);
    layoutChecks.set(id, cb);
  }
}

function attachIdentity(): void {
  idEl.addEventListener('input', () => {
    encounter().id = idEl.value;
    refreshTabs();
    refreshDerived();
  });
  nameEl.addEventListener('input', () => {
    encounter().name = nameEl.value;
    refreshTabs();
    refreshDerived();
  });
  descEl.addEventListener('input', () => {
    const v = descEl.value.trim();
    if (v === '') delete encounter().description;
    else encounter().description = descEl.value;
    refreshDerived();
  });
  healthPoolEl.addEventListener('input', () => {
    const n = Number.parseInt(healthPoolEl.value, 10);
    encounter().healthPool = Number.isFinite(n) ? n : 0;
    refreshDerived();
  });
}

function onLayoutChange(): void {
  // Rebuild in LAYOUT_IDS order; none checked → omit the fit-filter entirely.
  const chosen = LAYOUT_IDS.filter((id) => layoutChecks.get(id)!.checked);
  if (chosen.length === 0) delete encounter().layouts;
  else encounter().layouts = chosen as string[];
  refreshDerived();
}

function attachWaves(): void {
  wavesEl.addEventListener('input', () => {
    const parsed = tryParseWaves(wavesEl.value);
    if (parsed === undefined) {
      wavesParseOk = false;
    } else {
      wavesParseOk = true;
      encounter().waves = parsed as WorkingEntry[];
    }
    refreshDerived();
  });
  formatWavesBtn.addEventListener('click', () => {
    const parsed = tryParseWaves(wavesEl.value);
    if (parsed === undefined) return; // can't tidy invalid JSON
    encounter().waves = parsed as WorkingEntry[];
    syncWavesTextarea();
    wavesParseOk = true;
    refreshDerived();
  });
  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('.snippet[data-snippet]'))) {
    btn.addEventListener('click', () => insertSnippet(btn.dataset.snippet!));
  }
}

/** Parse the waves textarea; returns the array on success, `undefined` if it's
 *  not a JSON array (a parse failure — schema validity is checked separately). */
function tryParseWaves(text: string): unknown[] | undefined {
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

function attachPreviewControls(): void {
  rosterLevelsEl.addEventListener('input', () => {
    rosterLevels = rosterLevelsEl.value
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 1);
    refreshPreview();
  });
  handSizeEl.addEventListener('input', () => {
    const n = Number.parseInt(handSizeEl.value, 10);
    handSize = Number.isFinite(n) && n >= 0 ? n : 0;
    refreshPreview();
  });
  levelCapEl.addEventListener('input', () => {
    const n = Number.parseInt(levelCapEl.value, 10);
    levelCap = Number.isFinite(n) && n >= 1 ? n : 1;
    refreshPreview();
  });
  poolFractionEl.addEventListener('input', () => {
    const n = Number.parseFloat(poolFractionEl.value);
    poolFraction = Number.isFinite(n) ? Math.min(1, Math.max(0, n / 100)) : 1;
    refreshPreview();
  });
  turnsEl.addEventListener('input', () => {
    const n = Number.parseInt(turnsEl.value, 10);
    previewTurns = Number.isFinite(n) && n >= 1 ? Math.min(20, n) : 1;
    refreshPreview();
  });
  seedEl.addEventListener('input', () => {
    const n = Number.parseInt(seedEl.value, 10);
    previewSeed = Number.isFinite(n) ? n : 0;
    refreshPreview();
  });
}

function attachButtons(): void {
  newBtn.addEventListener('click', addEncounter);
  deleteBtn.addEventListener('click', deleteEncounter);
  saveBtn.addEventListener('click', () => void save());
  addToSectorsBtn.addEventListener('click', () => void addCurrentEncounterToSectors());
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
    a.download = 'encounters.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- Encounter add / delete / select ----
function encounter(): WorkingEncounter {
  return working[activeIndex]!;
}

function addEncounter(): void {
  let n = working.length + 1;
  let id = `encounter-${n}`;
  while (working.some((e) => e.id === id)) id = `encounter-${++n}`;
  working.push({
    id,
    name: 'New Encounter',
    description: 'A new authored fight.',
    healthPool: 8,
    kind: 'normal',
    waves: [skeletonEntry('loop')],
  });
  selectEncounter(working.length - 1);
}

function deleteEncounter(): void {
  if (working.length <= 1) {
    setSaveStatus('A catalog needs at least one encounter — add another before deleting this.', 'err');
    return;
  }
  working.splice(activeIndex, 1);
  selectEncounter(Math.min(activeIndex, working.length - 1));
}

function selectEncounter(index: number): void {
  activeIndex = index;
  syncForm();
  refreshTabs();
  refreshDerived();
}

/** Push `working[activeIndex]` into every form control. */
function syncForm(): void {
  const e = encounter();
  idEl.value = e.id;
  nameEl.value = e.name;
  descEl.value = e.description ?? '';
  healthPoolEl.value = String(e.healthPool);
  for (const [kind, radio] of kindRadios) radio.checked = e.kind === kind;
  const fit = e.layouts ?? [];
  for (const [id, cb] of layoutChecks) cb.checked = fit.includes(id);
  syncWavesTextarea();
  wavesParseOk = true;
  renderVisual();
}

function syncWavesTextarea(): void {
  wavesEl.value = JSON.stringify(encounter().waves, null, 2);
}

function refreshTabs(): void {
  tabsEl.innerHTML = '';
  working.forEach((e, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.classList.toggle('active', i === activeIndex);
    btn.textContent = e.name || e.id || '(untitled)';
    btn.addEventListener('click', () => selectEncounter(i));
    tabsEl.appendChild(btn);
  });
}

// ---- Snippets ----
function insertSnippet(kind: string): void {
  encounter().waves = [...encounter().waves, skeletonEntry(kind)];
  syncWavesTextarea();
  wavesParseOk = true;
  refreshDerived();
}

/** A well-formed skeleton grammar node (so an inserted snippet always parses +
 *  validates; the author then tunes the numbers). */
function skeletonEntry(kind: string): WorkingEntry {
  const wave: WorkingEntry = {
    kind: 'wave',
    spec: {
      levelBudget: { kind: 'mean', factor: 1.25 },
      count: { kind: 'hand', factor: 1.5 },
      units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
    },
  };
  switch (kind) {
    case 'pick':
      return { kind: 'pick', options: [{ entry: wave, weight: 1 }] };
    case 'loop':
      return { kind: 'loop', repeat: 'forever', body: [wave] };
    case 'stages':
      return {
        kind: 'stages',
        stages: [
          { until: { kind: 'enemyPoolAtOrBelow', fraction: 0.5 }, body: [wave] },
          { body: [structuredClone(wave)] },
        ],
      };
    default:
      return wave;
  }
}

// ---- Refresh ----
function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  wavesErrorEl.textContent = '';
  wavesErrorEl.className = 'hint';
  wavesEl.classList.toggle('invalid', !wavesParseOk);
  if (!wavesParseOk) {
    wavesErrorEl.textContent = 'Wave list is not valid JSON — fix it to validate / save.';
    wavesErrorEl.className = 'hint err';
  }

  const result = EncountersSchema.safeParse(working);
  const dupIds = duplicateIds(working);
  schemaOk = result.success && dupIds.length === 0;

  if (result.success && dupIds.length === 0 && wavesParseOk) {
    addValidation('ok', 'Valid — matches the game schema. Safe to save.');
  } else {
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '(root)';
        addValidation('error', `${path}: ${issue.message}`);
      }
    }
    for (const id of dupIds) addValidation('error', `duplicate encounter id "${id}"`);
  }
  saveBtn.disabled = !(schemaOk && wavesParseOk);
}

function duplicateIds(encounters: readonly Encounter[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const e of encounters) {
    if (seen.has(e.id)) dups.add(e.id);
    seen.add(e.id);
  }
  return [...dups];
}

function refreshExport(): void {
  if (schemaOk && wavesParseOk) exportEl.value = formatEncountersJson(working);
}

function refreshPreview(): void {
  turnsOutEl.innerHTML = '';
  if (!schemaOk || !wavesParseOk) {
    addTurnNote('Resolve the validation errors to preview.');
    return;
  }
  const e = encounter();
  if (e.waves.length === 0) {
    addTurnNote('Add a wave to preview.');
    return;
  }
  const roster: UnitTemplate[] = rosterLevels.length
    ? rosterLevels.map((lv) => scaledUnit('mercenary', lv))
    : [scaledUnit('mercenary', 1)];
  const ctx: WaveContext = { roster, handSize, levelCap: Math.max(1, levelCap) };

  // Mirror production: a master stream forks a fresh battle RNG each turn (both
  // `waveForTurn`'s pick roll and `resolveWave`'s level remainder draw from it).
  const master = new RNG(previewSeed >>> 0);
  let cursor: WaveCursor | null = null;
  try {
    for (let turn = 1; turn <= previewTurns; turn++) {
      const battleRng = master.fork();
      const state: EncounterState = { poolFraction, turn };
      const stepped = waveForTurn(e.waves, cursor, state, battleRng);
      cursor = stepped.cursor;
      const team = resolveWave(stepped.spec, ctx, battleRng);
      renderTurn(turn, team);
    }
  } catch (err) {
    addTurnNote(`Preview error: ${String(err)}`);
  }
}

function renderTurn(turn: number, team: readonly UnitTemplate[]): void {
  const wrap = document.createElement('div');
  wrap.className = 'turn';

  const head = document.createElement('div');
  head.className = 'turn-head';
  const no = document.createElement('span');
  no.className = 'turn-no';
  no.textContent = `Turn ${turn}`;
  const totalLevel = team.reduce((a, u) => a + u.level, 0);
  const summary = document.createElement('span');
  summary.textContent = `${team.length} unit${team.length === 1 ? '' : 's'} · ΣLv ${totalLevel}`;
  head.append(no, summary);
  wrap.appendChild(head);

  const teamEl = document.createElement('div');
  teamEl.className = 'turn-team';
  if (team.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'turn-empty';
    empty.textContent = '(no units)';
    teamEl.appendChild(empty);
  } else {
    for (const group of groupTeam(team)) teamEl.appendChild(makeChip(group));
  }
  wrap.appendChild(teamEl);
  turnsOutEl.appendChild(wrap);
}

interface UnitGroup {
  readonly archetype: string;
  readonly level: number;
  readonly count: number;
}

/** Collapse a team into `{archetype, level} → count`, sorted by archetype then
 *  level, so a wave reads as "bandit ×4 Lv3" rather than a flat list. */
function groupTeam(team: readonly UnitTemplate[]): UnitGroup[] {
  const map = new Map<string, UnitGroup & { count: number }>();
  for (const u of team) {
    const key = `${u.archetype}@${u.level}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { archetype: u.archetype, level: u.level, count: 1 });
  }
  return [...map.values()].sort(
    (a, b) => a.archetype.localeCompare(b.archetype) || a.level - b.level,
  );
}

function makeChip(group: UnitGroup): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'unit-chip';
  const glyph = document.createElement('span');
  glyph.className = 'glyph';
  glyph.textContent = glyphForArchetype(group.archetype as Parameters<typeof glyphForArchetype>[0]);
  const xn = document.createElement('span');
  xn.className = 'xn';
  xn.textContent = `${group.archetype} ×${group.count}`;
  const lv = document.createElement('span');
  lv.className = 'lv';
  lv.textContent = `Lv${group.level}`;
  chip.append(glyph, xn, lv);
  chip.title = `${group.count} × ${group.archetype} at level ${group.level}`;
  return chip;
}

function addTurnNote(text: string): void {
  const note = document.createElement('p');
  note.className = 'turn-empty';
  note.textContent = text;
  turnsOutEl.appendChild(note);
}

/** The production per-instance level ceiling: highest roster level +
 *  `DIFFICULTY.unitLevelDelta` (mirrors `rollEnemyWave`'s `cap`). */
function defaultLevelCap(): number {
  return Math.max(1, ...rosterLevels) + DIFFICULTY.unitLevelDelta;
}

// ---- Visual wave builder ----
// A recursive form over the wave grammar. Field edits mutate the model in place
// (no re-render, so a number input keeps focus while you type); structural edits
// (add / remove / reorder / kind-convert) mutate the model and re-render the
// whole tree (simpler + safe for the small trees authored here). Every edit ends
// in `refreshDerived()` so the preview / validation / export track live.

function attachViewToggle(): void {
  viewVisualBtn.addEventListener('click', () => setView('visual'));
  viewJsonBtn.addEventListener('click', () => setView('json'));
}

function setView(mode: 'visual' | 'json'): void {
  if (mode === 'visual') {
    // Commit any pending JSON edits before leaving the JSON box; refuse to switch
    // on unparseable JSON so edits aren't silently dropped.
    if (viewMode === 'json') {
      const parsed = tryParseWaves(wavesEl.value);
      if (parsed === undefined) {
        wavesParseOk = false;
        refreshValidation();
        wavesErrorEl.textContent = 'Fix the JSON before switching to Visual.';
        wavesErrorEl.className = 'hint err';
        return;
      }
      encounter().waves = parsed as WorkingEntry[];
      wavesParseOk = true;
    }
    viewMode = 'visual';
    wavesVisualEl.hidden = false;
    wavesJsonEl.hidden = true;
    viewVisualBtn.classList.add('active');
    viewJsonBtn.classList.remove('active');
    renderVisual();
  } else {
    viewMode = 'json';
    syncWavesTextarea();
    wavesParseOk = true;
    wavesVisualEl.hidden = true;
    wavesJsonEl.hidden = false;
    viewJsonBtn.classList.add('active');
    viewVisualBtn.classList.remove('active');
  }
  refreshDerived();
}

/** Re-render the whole visual tree from the active encounter's wave list. A no-op
 *  in JSON mode (the textarea is the live surface there). */
function renderVisual(): void {
  if (viewMode !== 'visual') return;
  wavesVisualEl.innerHTML = '';
  const list = encounter().waves;
  const head = el('div', 'sub-head');
  head.append(el('span', 'sub-title', 'waves'), addBar(list));
  wavesVisualEl.appendChild(head);
  const inner = el('div', 'sub-list root-list');
  list.forEach((_, i) => renderEntry(list, i, inner));
  wavesVisualEl.appendChild(inner);
}

/** Render `list[i]` as an array member — it gets remove / reorder controls and a
 *  kind-convert select that replaces it in `list`. */
function renderEntry(list: WorkingEntry[], i: number, parent: HTMLElement): void {
  renderEntryNode(
    list[i]!,
    (k) => {
      list[i] = skeletonEntry(k);
    },
    nodeControls(list, i),
    parent,
  );
}

/** Render one grammar node. `onConvert` replaces the entry with a fresh skeleton
 *  of the chosen kind; `controls` is the array-member control cluster (null for a
 *  pick option's single entry, which the option row already controls). */
function renderEntryNode(
  entry: WorkingEntry,
  onConvert: (kind: string) => void,
  controls: HTMLElement | null,
  parent: HTMLElement,
): void {
  const node = el('div', `node node--${entry.kind}`);
  const head = el('div', 'node-head');
  const kindSel = el('select', 'node-kind');
  for (const k of ENTRY_KINDS) kindSel.appendChild(option(k));
  kindSel.value = entry.kind;
  kindSel.addEventListener('change', () => {
    onConvert(kindSel.value);
    renderVisual();
    refreshDerived();
  });
  head.appendChild(kindSel);
  if (controls) head.appendChild(controls);
  node.appendChild(head);

  const body = el('div', 'node-body');
  switch (entry.kind) {
    case 'wave':
      renderSpec(entry.spec, body);
      break;
    case 'loop':
      renderLoop(entry, body);
      break;
    case 'pick':
      renderOptions(entry.options, body);
      break;
    case 'stages':
      renderStages(entry.stages, body);
      break;
  }
  node.appendChild(body);
  parent.appendChild(node);
}

function renderSpec(spec: WSpec, parent: HTMLElement): void {
  const grid = el('div', 'spec-grid');
  grid.append(el('span', 'field-label', 'budget'), kindNumberControl(spec.levelBudget, LEVEL_BUDGET_CFG, (o) => {
    spec.levelBudget = o as WSpec['levelBudget'];
  }));
  grid.append(el('span', 'field-label', 'count'), kindNumberControl(spec.count, COUNT_CFG, (o) => {
    spec.count = o as WSpec['count'];
  }));
  parent.appendChild(grid);

  const uHead = el('div', 'sub-head');
  const addU = el('button', 'add-btn', '+ unit');
  addU.type = 'button';
  addU.addEventListener('click', () => {
    spec.units.push(newUnit());
    renderVisual();
    refreshDerived();
  });
  uHead.append(el('span', 'sub-title', 'units'), addU);
  parent.appendChild(uHead);

  const uWrap = el('div', 'units');
  spec.units.forEach((_, i) => uWrap.appendChild(renderUnitRow(spec.units, i)));
  parent.appendChild(uWrap);
}

function renderUnitRow(units: WUnit[], i: number): HTMLElement {
  const u = units[i]!;
  const row = el('div', 'unit-row');
  const arche = el('select', 'arche-sel');
  for (const id of ARCHETYPE_IDS) arche.appendChild(option(id, `${glyphForArchetype(id)} ${id}`));
  arche.value = u.archetype;
  arche.addEventListener('change', () => {
    u.archetype = arche.value as Archetype;
    refreshDerived();
  });
  row.append(arche);
  row.append(el('span', 'field-label', 'cnt'), kindNumberControl(u.count, UNIT_COUNT_CFG, (o) => {
    u.count = o as WUnit['count'];
  }));
  row.append(el('span', 'field-label', 'lvl'), kindNumberControl(u.level, UNIT_LEVEL_CFG, (o) => {
    u.level = o as WUnit['level'];
  }));
  row.append(nodeControls(units, i));
  return row;
}

function renderLoop(entry: Extract<WorkingEntry, { kind: 'loop' }>, parent: HTMLElement): void {
  const row = el('div', 'loop-row');
  row.append(el('span', 'field-label', 'repeat'));
  const name = `repeat-${uidCounter++}`;
  const forever = entry.repeat === 'forever';

  const fLbl = el('label', 'inline');
  const fr = el('input');
  fr.type = 'radio';
  fr.name = name;
  fr.checked = forever;
  fLbl.append(fr, document.createTextNode(' forever'));

  const nLbl = el('label', 'inline');
  const nr = el('input');
  nr.type = 'radio';
  nr.name = name;
  nr.checked = !forever;
  const nNum = el('input', 'kn-num');
  nNum.type = 'number';
  nNum.min = '1';
  nNum.step = '1';
  nNum.value = String(typeof entry.repeat === 'number' ? entry.repeat : 2);
  nNum.disabled = forever;
  nLbl.append(nr, document.createTextNode(' × '), nNum);

  fr.addEventListener('change', () => {
    if (!fr.checked) return;
    entry.repeat = 'forever';
    renderVisual();
    refreshDerived();
  });
  nr.addEventListener('change', () => {
    if (!nr.checked) return;
    const v = Number.parseInt(nNum.value, 10);
    entry.repeat = Number.isFinite(v) && v >= 1 ? v : 2;
    renderVisual();
    refreshDerived();
  });
  nNum.addEventListener('input', () => {
    const v = Number.parseInt(nNum.value, 10);
    entry.repeat = Number.isFinite(v) && v >= 1 ? v : 1;
    refreshDerived();
  });

  row.append(fLbl, nLbl);
  parent.append(row, subgroup('body', entry.body));
}

function renderOptions(options: WOption[], parent: HTMLElement): void {
  const box = el('div', 'subgroup');
  const head = el('div', 'sub-head');
  const add = el('button', 'add-btn', '+ option');
  add.type = 'button';
  add.addEventListener('click', () => {
    options.push({ entry: skeletonEntry('wave'), weight: 1 });
    renderVisual();
    refreshDerived();
  });
  head.append(el('span', 'sub-title', 'options'), add);
  box.appendChild(head);

  const inner = el('div', 'sub-list');
  options.forEach((opt, i) => {
    const optBox = el('div', 'option');
    const oh = el('div', 'option-head');
    const w = el('input', 'kn-num');
    w.type = 'number';
    w.min = '0';
    w.step = '0.1';
    w.value = String(opt.weight);
    w.addEventListener('input', () => {
      const v = Number.parseFloat(w.value);
      opt.weight = Number.isFinite(v) ? v : 0;
      refreshDerived();
    });
    oh.append(el('span', 'field-label', 'weight'), w, nodeControls(options, i));
    optBox.appendChild(oh);
    renderEntryNode(
      opt.entry,
      (k) => {
        opt.entry = skeletonEntry(k);
      },
      null,
      optBox,
    );
    inner.appendChild(optBox);
  });
  box.appendChild(inner);
  parent.appendChild(box);
}

function renderStages(stages: WStage[], parent: HTMLElement): void {
  const box = el('div', 'subgroup');
  const head = el('div', 'sub-head');
  const add = el('button', 'add-btn', '+ stage');
  add.type = 'button';
  add.addEventListener('click', () => {
    stages.push({ body: [skeletonEntry('wave')] });
    renderVisual();
    refreshDerived();
  });
  head.append(el('span', 'sub-title', 'stages'), add);
  box.appendChild(head);

  const inner = el('div', 'sub-list');
  stages.forEach((st, i) => {
    const sb = el('div', 'node node--stages');
    const sh = el('div', 'node-head');
    sh.appendChild(el('span', 'stage-label', `stage ${i + 1}`));

    const untilLbl = el('label', 'inline');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = st.until !== undefined;
    cb.addEventListener('change', () => {
      if (cb.checked) st.until = { kind: 'enemyPoolAtOrBelow', fraction: 0.5 };
      else delete st.until;
      renderVisual();
      refreshDerived();
    });
    untilLbl.append(cb, document.createTextNode(' advance when pool ≤'));
    sh.appendChild(untilLbl);

    if (st.until) {
      const f = el('input', 'kn-num');
      f.type = 'number';
      f.min = '0';
      f.max = '1';
      f.step = '0.05';
      f.value = String(st.until.fraction);
      f.addEventListener('input', () => {
        const v = Number.parseFloat(f.value);
        if (st.until) st.until.fraction = Number.isFinite(v) ? v : 0;
        refreshDerived();
      });
      sh.appendChild(f);
    }
    sh.appendChild(nodeControls(stages, i));
    sb.appendChild(sh);

    const body = el('div', 'node-body');
    body.appendChild(subgroup('body', st.body));
    sb.appendChild(body);
    inner.appendChild(sb);
  });
  box.appendChild(inner);
  parent.appendChild(box);
}

/** A `kind` select + a single number input bound to that kind's numeric field
 *  (the shared shape of levelBudget / count / unit-count / unit-level). */
function kindNumberControl(obj: KindNumObj, cfg: KindNumCfg, setObj: (o: KindNumObj) => void): HTMLElement {
  const wrap = el('span', 'kn');
  const sel = el('select', 'kn-kind');
  for (const k of Object.keys(cfg)) sel.appendChild(option(k));
  sel.value = obj.kind;
  sel.addEventListener('change', () => {
    const oldCfg = cfg[obj.kind]!;
    const newCfg = cfg[sel.value]!;
    const carried = oldCfg.numKey === newCfg.numKey ? (obj[oldCfg.numKey] ?? newCfg.def) : newCfg.def;
    setObj({ kind: sel.value, [newCfg.numKey]: carried });
    renderVisual();
    refreshDerived();
  });

  const c = cfg[obj.kind]!;
  const num = el('input', 'kn-num');
  num.type = 'number';
  num.step = String(c.step);
  num.min = String(c.min);
  num.value = String(obj[c.numKey] ?? c.def);
  num.addEventListener('input', () => {
    const raw = num.value.trim();
    const v = c.int ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
    obj[c.numKey] = Number.isFinite(v) ? v : 0;
    refreshDerived();
  });

  wrap.append(sel, el('span', 'kn-x', c.label), num);
  return wrap;
}

/** A nested-list block (a loop/stage `body`) with an add bar + its entries. */
function subgroup(title: string, list: WorkingEntry[]): HTMLElement {
  const box = el('div', 'subgroup');
  const head = el('div', 'sub-head');
  head.append(el('span', 'sub-title', title), addBar(list));
  box.appendChild(head);
  const inner = el('div', 'sub-list');
  list.forEach((_, i) => renderEntry(list, i, inner));
  box.appendChild(inner);
  return box;
}

/** The "+ wave / pick / loop / stages" add bar for a wave list. */
function addBar(list: WorkingEntry[]): HTMLElement {
  const bar = el('span', 'add-bar');
  for (const k of ENTRY_KINDS) {
    const b = el('button', 'add-btn', `+ ${k}`);
    b.type = 'button';
    b.addEventListener('click', () => {
      list.push(skeletonEntry(k));
      renderVisual();
      refreshDerived();
    });
    bar.appendChild(b);
  }
  return bar;
}

/** Remove / reorder controls for an array member. `minOne` disables remove when
 *  the array is at its schema minimum (waves / units / options / stages need ≥1). */
function nodeControls<T>(arr: T[], i: number, minOne = true): HTMLElement {
  const wrap = el('span', 'node-ctl');
  wrap.append(
    ctlBtn('↑', i === 0, () => {
      swap(arr, i, i - 1);
      renderVisual();
      refreshDerived();
    }),
    ctlBtn('↓', i === arr.length - 1, () => {
      swap(arr, i, i + 1);
      renderVisual();
      refreshDerived();
    }),
    ctlBtn(
      '✕',
      minOne && arr.length <= 1,
      () => {
        arr.splice(i, 1);
        renderVisual();
        refreshDerived();
      },
      'rm',
    ),
  );
  return wrap;
}

function ctlBtn(label: string, disabled: boolean, onClick: () => void, extraCls = ''): HTMLButtonElement {
  const b = el('button', `ctl-btn${extraCls ? ` ${extraCls}` : ''}`, label);
  b.type = 'button';
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

function newUnit(): WUnit {
  return {
    archetype: ARCHETYPE_IDS[0]!,
    count: { kind: 'weight', weight: 1 },
    level: { kind: 'weight', weight: 1 },
  };
}

function swap<T>(arr: T[], i: number, j: number): void {
  if (j < 0 || j >= arr.length) return;
  const tmp = arr[i]!;
  arr[i] = arr[j]!;
  arr[j] = tmp;
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

// ---- Add to sector (V2 placement) ----
// The sector owns its encounter pool (sector-owns-both), so this writes the
// SECTOR file — the mirror of the layout editor's "add to sector" toggle.

/** Fetch + JSON-parse the live config/sectors.json (the dev server serves it
 *  statically). Fetching rather than importing keeps this page off sectors.json's
 *  rebuild chain — though Vite still broadcasts a full-reload on a write (see
 *  SECTOR_ADD_STASH_KEY), so the fetch buys decoupling, not a reload-free write. */
async function fetchSectors(): Promise<SectorDef[]> {
  const res = await fetch('/config/sectors.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SectorDef[];
}

/** Render one checkbox per sector for the "add to sector pool" control. */
async function loadSectorChecks(): Promise<void> {
  try {
    const sectors = await fetchSectors();
    sectorChecksEl.innerHTML = '';
    if (sectors.length === 0) {
      sectorChecksEl.innerHTML = '<p class="hint">No sectors defined.</p>';
      return;
    }
    for (const s of sectors) {
      const label = document.createElement('label');
      label.className = 'inline';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = s.id;
      label.appendChild(cb);
      label.append(` ${s.title || s.id}`);
      sectorChecksEl.appendChild(label);
    }
  } catch (err) {
    sectorChecksEl.innerHTML = `<p class="hint err">Could not load sectors: ${String(err)}</p>`;
  }
}

/**
 * Append the current encounter to each checked sector's pool and write the SECTOR
 * file. The encounter must be a KNOWN id (saved to encounters.json) so the sector
 * schema's encounter-ref guard accepts it — Save the encounter first; a pool
 * already listing it is skipped (idempotent).
 */
async function addCurrentEncounterToSectors(): Promise<void> {
  const id = encounter().id;
  if (!ENCOUNTER_IDS.includes(id)) {
    setSectorAddStatus(
      `Save the encounter to config first — "${id}" isn't a committed encounter id yet, so a sector can't reference it.`,
      'err',
    );
    return;
  }
  const chosen = Array.from(
    sectorChecksEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
  ).map((cb) => cb.value);
  if (chosen.length === 0) {
    setSectorAddStatus('Pick at least one sector.', 'err');
    return;
  }
  const raw = sectorMinHopEl.value.trim();
  const minHop = raw === '' ? undefined : Number.parseInt(raw, 10);
  if (minHop !== undefined && (!Number.isInteger(minHop) || minHop < 0)) {
    setSectorAddStatus('Hop gate must be a non-negative whole number (or blank).', 'err');
    return;
  }
  setSectorAddStatus('Saving…', 'hint');
  try {
    const sectors = await fetchSectors();
    const { added, skipped } = addEncounterToSectorPools(sectors, id, chosen, minHop);
    if (added.length === 0) {
      setSectorAddStatus(`Already in: ${skipped.join(', ')}. Nothing to write.`, 'hint');
      return;
    }
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'sectors.json', content: formatSectorsJson(sectors) }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const skipNote = skipped.length > 0 ? ` (skipped, already present: ${skipped.join(', ')})` : '';
      const status = `Added "${id}" to ${added.join(', ')}${skipNote}.`;
      setSectorAddStatus(status, 'ok');
      // The write triggers a Vite reload of this tab (see SECTOR_ADD_STASH_KEY) —
      // stash the confirmation so the next boot re-shows it instead of a blank
      // status that reads as "nothing happened".
      try {
        sessionStorage.setItem(SECTOR_ADD_STASH_KEY, JSON.stringify({ status }));
      } catch {
        // sessionStorage unavailable (private mode / quota) — non-fatal; the write
        // still succeeded, the reload just won't auto-restore the status.
      }
    } else {
      setSectorAddStatus(`Save failed: ${data.error ?? res.statusText}`, 'err');
    }
  } catch (err) {
    setSectorAddStatus(`Save failed: ${String(err)} — is the dev server running?`, 'err');
  }
}

function setSectorAddStatus(text: string, cls: 'hint' | 'ok' | 'err'): void {
  sectorAddStatusEl.textContent = text;
  sectorAddStatusEl.className = cls === 'hint' ? 'hint' : `hint ${cls}`;
}

/**
 * Boot-time companion to the "add to sector" toggle: a successful pool write
 * reloads this tab (see SECTOR_ADD_STASH_KEY), so re-show the stashed confirmation
 * in the sector-add status line. A no-op on a normal cold boot.
 */
function restoreAfterSectorAdd(): void {
  let stash: string | null = null;
  try {
    stash = sessionStorage.getItem(SECTOR_ADD_STASH_KEY);
    if (stash) sessionStorage.removeItem(SECTOR_ADD_STASH_KEY);
  } catch {
    return; // sessionStorage unavailable — nothing to restore.
  }
  if (!stash) return;
  try {
    const { status } = JSON.parse(stash) as { status?: string };
    if (status) setSectorAddStatus(status, 'ok');
  } catch {
    // Malformed stash — ignore.
  }
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!(schemaOk && wavesParseOk)) return;
  setSaveStatus('Saving…', 'hint');
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'encounters.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      setSaveStatus(
        `Saved to config/encounters.json at ${new Date().toLocaleTimeString()}. ` +
          `An open game tab hot-reloads the new catalog.`,
        'ok',
      );
    } else {
      setSaveStatus(`Save failed: ${data.error ?? res.statusText}`, 'err');
    }
  } catch (err) {
    setSaveStatus(`Save failed: ${String(err)} — is the dev server running?`, 'err');
  }
}

function revert(): void {
  working = structuredClone(ENCOUNTERS) as WorkingEncounter[];
  selectEncounter(Math.min(activeIndex, working.length - 1));
  setSaveStatus('Reverted to the committed catalog (not yet saved).', 'hint');
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

function mustQuery<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`encounter-editor: missing element "${selector}"`);
  return el;
}
