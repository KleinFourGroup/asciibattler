/**
 * Attack editor (§30a). Standalone Vite page — visit
 * http://localhost:5173/tools/attack-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Edits `config/abilities.json` — the single `AbilityDef` catalog every combat
 * verb resolves against (`src/sim/effects/schema.ts`). Like the archetype
 * editor, it gives three things the copy-paste loop didn't:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME `AbilityDefSchema`
 *     the game boots on, so "is this valid?" can't drift from the load-time
 *     parse. Save is disabled while invalid.
 *  2. **A structure preview.** The timeline + effect-op outline of the selected
 *     ability (resolved damage/heal NUMBERS, sharing the real interpreter, land
 *     in §30c).
 *  3. **Save to disk.** Posts the formatted whole-file JSON to the dev-only
 *     `/__save-config` endpoint (vite.config.ts), through the byte-faithful
 *     `formatAbilitiesJson`. Copy / Download stay as offline fallbacks.
 *
 * §30a scope: the scalar/identity fields + the target selector are form-edited;
 * the timeline + the recursive effect-op tree are shown read-only (their form
 * builders land in §30b/§30c). The whole catalog still round-trips through the
 * formatter on every Save, so untouched abilities pass through byte-identical.
 */

import './editor.css';
import { ABILITY_DEFS } from '../../src/config/abilities';
import { AbilityDefSchema, type AbilityDef, type EffectOp, type TargetSelector } from '../../src/sim/effects/schema';
import { formatAbilitiesJson } from './format';

// Small enum mirrors of the schema unions (the schema doesn't export the raw
// arrays). A drift from the schema is caught by the live validation below — these
// only populate the <select> choices.
const ORPHAN_POLICIES = ['commit-at-cast', 'fizzle', 'ground-target', 're-home'] as const;
const TARGET_KINDS = ['self', 'enemyInRange', 'aoe', 'lowestHpAlly'] as const;
const AOE_SHAPES = ['square', 'line', 'cross'] as const;
const AOE_ANCHORS = ['caster', 'targetCell'] as const;
const AFFECTS = ['enemies', 'allies', 'all'] as const;

type TargetKind = (typeof TARGET_KINDS)[number];

function defaultTarget(kind: TargetKind): TargetSelector {
  switch (kind) {
    case 'self':
      return { kind: 'self' };
    case 'enemyInRange':
      return { kind: 'enemyInRange' };
    case 'aoe':
      return { kind: 'aoe', shape: 'square', radius: 1, anchor: 'targetCell', affects: 'enemies', ringMultiplier: 1 };
    case 'lowestHpAlly':
      return { kind: 'lowestHpAlly', rangeCells: 3 };
  }
}

// ---- State ----
// `working` is a deep, mutable clone of the committed catalog; the form mutates
// it, the schema validates it, the formatter emits it. ABILITY_DEFS stays the
// pristine baseline "Revert all" restores from.
let working: Record<string, AbilityDef> = structuredClone(ABILITY_DEFS);
let activeId: string = Object.keys(working)[0]!;
let lastValid = true;

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const idEl = mustQuery<HTMLInputElement>('#id');
const nameEl = mustQuery<HTMLInputElement>('#name');
const cooldownEl = mustQuery<HTMLInputElement>('#cooldownSeconds');
const priorityEl = mustQuery<HTMLInputElement>('#priority');
const rangeEl = mustQuery<HTMLInputElement>('#rangeCells');
const minRangeEl = mustQuery<HTMLInputElement>('#minRangeCells');
const orphanEl = mustQuery<HTMLSelectElement>('#orphanPolicy');
const speedScaledEl = mustQuery<HTMLInputElement>('#speedScaled');
const ignoresLosEl = mustQuery<HTMLInputElement>('#ignoresLineOfSight');
const targetKindEl = mustQuery<HTMLSelectElement>('#target-kind');
const targetFieldsEl = mustQuery<HTMLDivElement>('#target-fields');
const effectsJsonEl = mustQuery<HTMLPreElement>('#effects-json');
const previewEl = mustQuery<HTMLDListElement>('#preview');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build (structure is constant; values sync per ability) ----
buildTabs();
fillSelect(orphanEl, ORPHAN_POLICIES);
fillSelect(targetKindEl, TARGET_KINDS);
attachIdentity();
attachTargetKind();
attachButtons();
selectAbility(activeId);

function buildTabs(): void {
  tabsEl.innerHTML = '';
  for (const id of Object.keys(working)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.dataset.id = id;
    btn.addEventListener('click', () => selectAbility(id));
    tabsEl.appendChild(btn);
  }
}

function fillSelect(sel: HTMLSelectElement, options: readonly string[]): void {
  sel.innerHTML = '';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  }
}

function attachIdentity(): void {
  nameEl.addEventListener('input', () => {
    def().name = nameEl.value;
    refreshDerived();
  });
  cooldownEl.addEventListener('input', () => {
    def().cooldownSeconds = numOr(cooldownEl.value, 0, true);
    refreshDerived();
  });
  priorityEl.addEventListener('input', () => {
    def().priority = numOr(priorityEl.value, 0, true);
    refreshDerived();
  });
  rangeEl.addEventListener('input', () => {
    def().rangeCells = intOr(rangeEl.value, 0);
    refreshDerived();
  });
  minRangeEl.addEventListener('input', () => {
    def().minRangeCells = intOr(minRangeEl.value, 0);
    refreshDerived();
  });
  orphanEl.addEventListener('change', () => {
    def().orphanPolicy = orphanEl.value as AbilityDef['orphanPolicy'];
    refreshDerived();
  });
  speedScaledEl.addEventListener('change', () => {
    def().speedScaled = speedScaledEl.checked;
    refreshDerived();
  });
  ignoresLosEl.addEventListener('change', () => {
    // Optional field — true emits the flag, false drops it back to the implicit default.
    if (ignoresLosEl.checked) def().ignoresLineOfSight = true;
    else delete def().ignoresLineOfSight;
    refreshDerived();
  });
}

function attachTargetKind(): void {
  targetKindEl.addEventListener('change', () => {
    def().target = defaultTarget(targetKindEl.value as TargetKind);
    renderTargetFields();
    refreshDerived();
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
    a.download = 'abilities.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- Selection / sync ----
function def(): AbilityDef {
  return working[activeId]!;
}

function selectAbility(id: string): void {
  activeId = id;
  syncForm();
  refreshTabs();
  refreshDerived();
}

function syncForm(): void {
  const d = def();
  idEl.value = d.id;
  nameEl.value = d.name;
  cooldownEl.value = String(d.cooldownSeconds);
  priorityEl.value = String(d.priority);
  rangeEl.value = String(d.rangeCells);
  minRangeEl.value = String(d.minRangeCells);
  orphanEl.value = d.orphanPolicy;
  speedScaledEl.checked = d.speedScaled;
  ignoresLosEl.checked = d.ignoresLineOfSight === true;
  targetKindEl.value = d.target.kind;
  renderTargetFields();
}

/** Build the per-kind target sub-fields (rebuilt on ability select + kind change). */
function renderTargetFields(): void {
  targetFieldsEl.innerHTML = '';
  const t = def().target;
  if (t.kind === 'lowestHpAlly') {
    numberField(targetFieldsEl, 'Range (cells)', t.rangeCells, 0, (v) => {
      (def().target as Extract<TargetSelector, { kind: 'lowestHpAlly' }>).rangeCells = v;
    });
  } else if (t.kind === 'aoe') {
    selectField(targetFieldsEl, 'Shape', AOE_SHAPES, t.shape, (v) => {
      (def().target as Extract<TargetSelector, { kind: 'aoe' }>).shape = v as 'square' | 'line' | 'cross';
    });
    numberField(targetFieldsEl, 'Radius', t.radius, 0, (v) => {
      (def().target as Extract<TargetSelector, { kind: 'aoe' }>).radius = v;
    });
    selectField(targetFieldsEl, 'Anchor', AOE_ANCHORS, t.anchor, (v) => {
      (def().target as Extract<TargetSelector, { kind: 'aoe' }>).anchor = v as 'caster' | 'targetCell';
    });
    selectField(targetFieldsEl, 'Affects', AFFECTS, t.affects, (v) => {
      (def().target as Extract<TargetSelector, { kind: 'aoe' }>).affects = v as 'enemies' | 'allies' | 'all';
    });
    numberField(targetFieldsEl, 'Ring ×', t.ringMultiplier, 0, (v) => {
      (def().target as Extract<TargetSelector, { kind: 'aoe' }>).ringMultiplier = v;
    }, true);
  } else {
    const span = document.createElement('span');
    span.className = 'hint';
    span.textContent = t.kind === 'self' ? 'No parameters (the caster).' : 'No parameters (the committed target).';
    targetFieldsEl.appendChild(span);
  }
}

// ---- Refresh ----
function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
  refreshTabs();
  effectsJsonEl.textContent = JSON.stringify({ timeline: def().timeline, effects: def().effects }, null, 2);
}

function refreshTabs(): void {
  for (const btn of Array.from(tabsEl.children) as HTMLButtonElement[]) {
    const id = btn.dataset.id!;
    btn.textContent = working[id]!.name;
    btn.title = id;
    btn.classList.toggle('active', id === activeId);
  }
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const issues: string[] = [];
  for (const [key, d] of Object.entries(working)) {
    if (d.id !== key) issues.push(`${key}: id "${d.id}" must match its catalog key`);
    const result = AbilityDefSchema.safeParse(d);
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
  exportEl.value = formatAbilitiesJson(working);
}

function refreshPreview(): void {
  const d = def();
  previewEl.innerHTML = '';
  addPreview('Target', describeTarget(d.target));
  addPreview('Cadence', `${d.cooldownSeconds}s${d.speedScaled ? ' (speed-scaled)' : ' (flat)'} · priority ${d.priority}`);
  addPreview('Range', d.minRangeCells > 0 ? `${d.minRangeCells}–${d.rangeCells}` : String(d.rangeCells));
  addPreview('Timeline', d.timeline.map((p) => `${p.phase} ${p.seconds === 'fill' ? 'fill' : `${p.seconds}s`}${p.scalesWithSpeed ? '*' : ''}`).join(' · '));
  for (const e of d.effects) addPreview(`@ ${e.phase}`, describeOp(e.op));
  if (d.effects.length === 0) addPreview('Effects', '— none');
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
      body: JSON.stringify({ file: 'abilities.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      saveStatusEl.textContent =
        `Saved to config/abilities.json at ${new Date().toLocaleTimeString()}. An open game tab hot-reloads the new values.`;
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
  working = structuredClone(ABILITY_DEFS);
  if (!(activeId in working)) activeId = Object.keys(working)[0]!;
  selectAbility(activeId);
  saveStatusEl.textContent = 'Reverted to the committed config (not yet saved).';
  saveStatusEl.className = 'hint';
}

// ---- Describe helpers (structure preview) ----
function describeTarget(t: TargetSelector): string {
  switch (t.kind) {
    case 'self':
      return 'self';
    case 'enemyInRange':
      return 'enemy in range';
    case 'aoe':
      return `aoe ${t.shape} r${t.radius} @${t.anchor} → ${t.affects}${t.ringMultiplier !== 1 ? ` (ring ×${t.ringMultiplier})` : ''}`;
    case 'lowestHpAlly':
      return `lowest-HP ally within ${t.rangeCells}`;
  }
}

function describeOp(op: EffectOp): string {
  switch (op.kind) {
    case 'damage':
      return `damage ${op.might}+${op.scaling}${op.bypassDefense ? ' (bypass)' : ''}${op.evadable ? '' : ' · unmissable'}`;
    case 'heal':
      return `heal ${op.might}+${op.scaling}`;
    case 'move':
      return `move ${op.mode} ${op.cells}`;
    case 'applyStatus':
      return `applyStatus ${op.statusId}`;
    case 'chain':
      return `chain ×${op.maxJumps} r${op.rangeCells} falloff ${op.falloff} → [${op.ops.map(describeOp).join(', ')}]`;
    case 'summon':
      return `summon ${op.summon.count}× ${op.summon.archetype} (max ${op.summon.maxLive})`;
  }
}

// ---- Small helpers ----
function numberField(
  parent: HTMLElement,
  label: string,
  value: number,
  min: number,
  onChange: (v: number) => void,
  float = false,
): void {
  const wrap = document.createElement('label');
  wrap.className = 'inline';
  wrap.append(`${label} `);
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.step = float ? '0.05' : '1';
  input.value = String(value);
  input.addEventListener('input', () => {
    onChange(float ? numOr(input.value, min) : intOr(input.value, min));
    refreshDerived();
  });
  wrap.appendChild(input);
  parent.appendChild(wrap);
}

function selectField(
  parent: HTMLElement,
  label: string,
  options: readonly string[],
  value: string,
  onChange: (v: string) => void,
): void {
  const wrap = document.createElement('label');
  wrap.className = 'inline';
  wrap.append(`${label} `);
  const sel = document.createElement('select');
  fillSelect(sel, options);
  sel.value = value;
  sel.addEventListener('change', () => {
    onChange(sel.value);
    refreshDerived();
  });
  wrap.appendChild(sel);
  parent.appendChild(wrap);
}

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

/** Parse an int, falling back to `min` (and clamping below it) on a bad value. */
function intOr(raw: string, min: number): number {
  const num = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(num) ? Math.max(min, num) : min;
}

/** Parse a float; `clampMin` keeps it ≥ `min` (e.g. nonnegative cooldown). */
function numOr(raw: string, min: number, clampMin = false): number {
  const num = Number.parseFloat(raw.trim());
  if (!Number.isFinite(num)) return min;
  return clampMin ? Math.max(min, num) : num;
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
  if (!el) throw new Error(`attack-editor: missing element "${selector}"`);
  return el;
}
