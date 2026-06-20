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
  type Encounter,
  type EncounterKind,
} from '../../src/config/encounters';
import { LAYOUT_IDS } from '../../src/config/layouts';
import { DECK } from '../../src/config/deck';
import { DIFFICULTY } from '../../src/config/difficulty';
import { RNG } from '../../src/core/RNG';
import { resolveWave, type WaveContext } from '../../src/run/encounters/wave';
import {
  waveForTurn,
  type WaveCursor,
  type EncounterState,
  type WaveEntry,
} from '../../src/run/encounters/sequencer';
import { scaledUnit, glyphForArchetype } from '../../src/sim/archetypes';
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

// `working` is a deep, mutable clone of the committed catalog; the form mutates
// it, the schema validates it, the formatter emits it. ENCOUNTERS stays the
// pristine baseline that "Revert all" restores from.
let working: WorkingEncounter[] = structuredClone(ENCOUNTERS) as WorkingEncounter[];
let activeIndex = 0;
let schemaOk = true;
/** False while the waves textarea holds non-JSON text (kept separate from schema
 *  validity so the parse error sits next to the box, not in the issue list). */
let wavesParseOk = true;

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

const kindRadios = new Map<EncounterKind, HTMLInputElement>();
const layoutChecks = new Map<string, HTMLInputElement>();

// ---- Build (structure is constant; values sync per encounter) ----
buildKindRadios();
buildLayoutChecks();
attachIdentity();
attachWaves();
attachPreviewControls();
attachButtons();
levelCap = defaultLevelCap();
levelCapEl.value = String(levelCap);
handSizeEl.value = String(handSize);
rosterLevelsEl.value = rosterLevels.join(', ');
selectEncounter(activeIndex);

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
