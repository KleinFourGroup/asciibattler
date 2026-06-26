/**
 * Attack editor (§30a–b). Standalone Vite page — visit
 * http://localhost:5173/tools/attack-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Edits `config/abilities.json` — the single `AbilityDef` catalog every combat
 * verb resolves against (`src/sim/effects/schema.ts`). Offers live schema
 * validation (the real `AbilityDefSchema`, Save disabled while invalid), a
 * structure preview, and save-to-disk via the dev-only `/__save-config` endpoint
 * through the byte-faithful `formatAbilitiesJson` — so a no-op Save is a no-op
 * diff. Copy / Download stay as offline fallbacks.
 *
 *  - §30a: the scalar/identity fields + the target selector.
 *  - §30b: the recursive EFFECT-OP TREE — every effect's `{phase, op}` is form-
 *    edited, all six op kinds (damage / heal / move / applyStatus / chain /
 *    summon), with `chain`'s per-hop ops (damage | applyStatus) nesting and
 *    status-id / summon-archetype dropdowns from the live registries.
 *  - §30c: the TIMELINE editor (editable phases — name / seconds-or-`fill` /
 *    `scalesWithSpeed`, add / remove) + a live RESOLUTION-OUTLINE preview that
 *    shares the real resolvers (`resolvePhases` / `resolveCadenceTicks` for the
 *    tick layout, `resolveScalars` for the cast-time damage / heal / crit numbers
 *    — never re-implemented here) against an editable sample caster with
 *    archetype-base-stat presets.
 */

import './editor.css';
import { ABILITY_DEFS } from '../../src/config/abilities';
import { STATUS_DEFS } from '../../src/config/statuses';
import { ARCHETYPES } from '../../src/config/archetypes';
import { STATS } from '../../src/config/stats';
import { TICK_SECONDS } from '../../src/config';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import type { UnitStats } from '../../src/sim/Unit';
import {
  AbilityDefSchema,
  ScalingStatSchema,
  type AbilityDef,
  type EffectOp,
  type ChainInnerOp,
  type ScaledValue,
  type TargetSelector,
} from '../../src/sim/effects/schema';
import { resolveCadenceTicks, resolvePhases } from '../../src/sim/effects/timeline';
import {
  evalScaled,
  resolveDamageScalars,
  resolveHealAmount,
  type ScalingSource,
} from '../../src/sim/effects/resolveScalars';
import { formatAbilitiesJson } from './format';

// Small enum mirrors of the schema unions (the schema doesn't export the raw
// arrays). A drift from the schema is caught by the live validation below —
// these only populate the <select> choices.
const PHASE_NAMES = ['windup', 'release', 'travel', 'impact', 'recovery'] as const;
const ORPHAN_POLICIES = ['commit-at-cast', 'fizzle', 'ground-target', 're-home'] as const;
const TARGET_KINDS = ['self', 'enemyInRange', 'aoe', 'lowestHpAlly'] as const;
const AOE_SHAPES = ['square', 'line', 'cross'] as const;
const AOE_ANCHORS = ['caster', 'targetCell'] as const;
const AFFECTS = ['enemies', 'allies', 'all'] as const;
const DAMAGE_SCALING = ['strength', 'ranged', 'magic', 'none'] as const;
const HEAL_SCALING = ['magic', 'none'] as const;
// Only the shipped caster-reposition modes — knockback / pull are a reserved
// Cluster-2 seam (boot-rejected if authored), so the editor doesn't offer them.
const MOVE_MODES = ['advance', 'retreat'] as const;
const TOP_OP_KINDS = ['damage', 'heal', 'move', 'applyStatus', 'chain', 'summon'] as const;
const INNER_OP_KINDS = ['damage', 'applyStatus'] as const; // a chain's per-hop payload

const STATUS_IDS = Object.keys(STATUS_DEFS);
const ARCHETYPE_IDS = [...ALL_ARCHETYPES] as string[];

type TargetKind = (typeof TARGET_KINDS)[number];
type OpKind = (typeof TOP_OP_KINDS)[number];

// The five caster stats the resolution preview reads: `speed` drives the tick
// timeline (`resolvePhases`); the scaling stats + `luck` drive the damage / heal /
// crit scalars (`resolveScalars`). The other six `UnitStats` fields never enter
// cast-time resolution, so the sample caster only knobs these.
const SAMPLE_STATS = ['speed', 'strength', 'ranged', 'magic', 'luck'] as const;
type SampleStat = (typeof SAMPLE_STATS)[number];
// `level` rides alongside the stat knobs (it's NOT a `UnitStats` field): the §31
// `ScaledValue` evaluator reads it for `stat:'level'` scaling (summon level), so the
// preview needs a sample level to resolve those.
type SampleCaster = Record<SampleStat, number> & { level: number };

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

function defaultOp(kind: OpKind): EffectOp {
  switch (kind) {
    case 'damage':
      return { kind: 'damage', scaling: 'strength', might: 1, accuracy: 0.6, critBase: 0, critable: true, evadable: true, bypassDefense: false };
    case 'heal':
      return { kind: 'heal', scaling: 'magic', might: 0 };
    case 'move':
      return { kind: 'move', mode: 'advance', cells: 1 };
    case 'applyStatus':
      return { kind: 'applyStatus', statusId: STATUS_IDS[0] ?? 'bleed' };
    case 'chain':
      return { kind: 'chain', maxJumps: 2, rangeCells: 3, falloff: 0.6, hopDelaySeconds: 0.1, ops: [defaultOp('damage') as ChainInnerOp] };
    case 'summon':
      return { kind: 'summon', summon: { archetype: ARCHETYPE_IDS[0] ?? 'ghoul', level: 1, count: 1, maxLive: 3, radiusCells: 2 }, at: { kind: 'self' } };
  }
}

// ---- State ----
let working: Record<string, AbilityDef> = structuredClone(ABILITY_DEFS);
let activeId: string = Object.keys(working)[0]!;
let lastValid = true;
// A neutral, non-zero sample caster (so every scaling kind shows a real base);
// the archetype presets overwrite it with realistic stats on demand.
const sample: SampleCaster = { speed: 5, strength: 5, ranged: 5, magic: 5, luck: 5, level: 5 };

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
const targetHostEl = mustQuery<HTMLDivElement>('#target-host');
const timelineHostEl = mustQuery<HTMLDivElement>('#timeline-host');
const addPhaseBtn = mustQuery<HTMLButtonElement>('#add-phase');
const effectsHostEl = mustQuery<HTMLDivElement>('#effects-host');
const addEffectBtn = mustQuery<HTMLButtonElement>('#add-effect');
const presetEl = mustQuery<HTMLSelectElement>('#sample-preset');
const sampleEls: Record<SampleStat, HTMLInputElement> = {
  speed: mustQuery<HTMLInputElement>('#s-speed'),
  strength: mustQuery<HTMLInputElement>('#s-strength'),
  ranged: mustQuery<HTMLInputElement>('#s-ranged'),
  magic: mustQuery<HTMLInputElement>('#s-magic'),
  luck: mustQuery<HTMLInputElement>('#s-luck'),
};
const sampleLevelEl = mustQuery<HTMLInputElement>('#s-level');
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
attachIdentity();
attachButtons();
buildSampleCaster();
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
    def().priority = numOr(priorityEl.value, 0);
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
    if (ignoresLosEl.checked) def().ignoresLineOfSight = true;
    else delete def().ignoresLineOfSight;
    refreshDerived();
  });
}

function attachButtons(): void {
  addEffectBtn.addEventListener('click', () => {
    def().effects.push({ phase: timelinePhases()[0] ?? 'impact', op: defaultOp('damage') });
    structuralChange();
  });
  addPhaseBtn.addEventListener('click', () => {
    def().timeline.push({ phase: nextUnusedPhase(), seconds: 0, scalesWithSpeed: false });
    timelineChange();
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
  renderTargetSelector(targetHostEl, () => def().target, (t) => (def().target = t));
  renderTimelineEditor();
  renderEffects();
}

/** A timeline structural change (add / remove a phase, or rename one): rebuild the
 *  timeline rows AND the effect tree (its per-effect phase dropdown reads the
 *  timeline's phases), then refresh the export / validation / preview. */
function timelineChange(): void {
  renderTimelineEditor();
  renderEffects();
  refreshDerived();
}

/** A structural mutation already applied to `working`: rebuild the effect tree
 *  DOM, then refresh the export / validation / preview. */
function structuralChange(): void {
  renderEffects();
  refreshDerived();
}

// ---- Reusable target-selector widget (the ability's `target` AND a summon's
//      `at` anchor both render through this). Self-manages its own subtree:
//      a kind change swaps in a fresh default and re-renders in place. ----
function renderTargetSelector(
  host: HTMLElement,
  get: () => TargetSelector,
  set: (t: TargetSelector) => void,
): void {
  host.innerHTML = '';
  const row = el('div', 'field-row');
  const lbl = el('span', 'field-label', 'Selector');
  const sel = selectEl(TARGET_KINDS, get().kind);
  sel.addEventListener('change', () => {
    set(defaultTarget(sel.value as TargetKind));
    renderTargetSelector(host, get, set);
    refreshDerived();
  });
  row.append(lbl, sel);
  host.appendChild(row);

  const fields = el('div', 'field-grid');
  host.appendChild(fields);
  const t = get();
  if (t.kind === 'lowestHpAlly') {
    numberField(fields, 'Range (cells)', t.rangeCells, 1, (v) => {
      asKind(get(), 'lowestHpAlly').rangeCells = v;
    });
  } else if (t.kind === 'aoe') {
    selectField(fields, 'Shape', AOE_SHAPES, t.shape, (v) => (asKind(get(), 'aoe').shape = v as 'square' | 'line' | 'cross'));
    numberField(fields, 'Radius', t.radius, 0, (v) => (asKind(get(), 'aoe').radius = v));
    selectField(fields, 'Anchor', AOE_ANCHORS, t.anchor, (v) => (asKind(get(), 'aoe').anchor = v as 'caster' | 'targetCell'));
    selectField(fields, 'Affects', AFFECTS, t.affects, (v) => (asKind(get(), 'aoe').affects = v as 'enemies' | 'allies' | 'all'));
    numberField(fields, 'Ring ×', t.ringMultiplier, 0, (v) => (asKind(get(), 'aoe').ringMultiplier = v), true);
  } else {
    const span = el('span', 'hint', t.kind === 'self' ? 'No parameters (the caster).' : 'No parameters (the committed target).');
    fields.appendChild(span);
  }
}

// ---- Timeline editor ----
type Phase = AbilityDef['timeline'][number]['phase'];

function renderTimelineEditor(): void {
  timelineHostEl.innerHTML = '';
  const timeline = def().timeline;
  timeline.forEach((p, i) => {
    const row = el('div', 'phase-row');

    const psel = selectEl(PHASE_NAMES, p.phase);
    psel.addEventListener('change', () => {
      p.phase = psel.value as Phase;
      timelineChange(); // the effect tree's phase options follow the timeline
    });
    row.appendChild(labelWrap('Phase', psel));

    const isFill = p.seconds === 'fill';
    const secInput = document.createElement('input');
    secInput.type = 'number';
    secInput.min = '0';
    secInput.step = '0.05';
    secInput.value = isFill ? '' : String(p.seconds);
    secInput.disabled = isFill;
    secInput.addEventListener('input', () => {
      p.seconds = numOr(secInput.value, 0, true);
      refreshDerived();
    });
    row.appendChild(labelWrap('Seconds', secInput));

    // `fill` ⇄ a fixed numeric duration. Switching to fill clears the
    // `scalesWithSpeed` flag (the schema rejects the combo) and disables both
    // the seconds + scales controls; the re-render reflects it.
    const fillWrap = el('label', 'inline');
    const fillCb = document.createElement('input');
    fillCb.type = 'checkbox';
    fillCb.checked = isFill;
    fillCb.addEventListener('change', () => {
      if (fillCb.checked) {
        p.seconds = 'fill';
        p.scalesWithSpeed = false;
      } else {
        p.seconds = 0;
      }
      timelineChange();
    });
    fillWrap.append(fillCb, ' fill');
    row.appendChild(fillWrap);

    const scalesWrap = el('label', 'inline');
    const scalesCb = document.createElement('input');
    scalesCb.type = 'checkbox';
    scalesCb.checked = p.scalesWithSpeed;
    scalesCb.disabled = isFill;
    scalesCb.addEventListener('change', () => {
      p.scalesWithSpeed = scalesCb.checked;
      refreshDerived();
    });
    scalesWrap.append(scalesCb, ' ⚡ speed');
    row.appendChild(scalesWrap);

    row.append(el('span', 'spacer'));
    // The schema requires ≥ 1 phase — never let the last one be removed.
    if (timeline.length > 1) {
      row.appendChild(miniBtn('Remove phase', 'del', () => {
        timeline.splice(i, 1);
        timelineChange();
      }));
    }
    timelineHostEl.appendChild(row);
  });
}

function timelinePhases(): Phase[] {
  const out: Phase[] = [];
  for (const p of def().timeline) if (!out.includes(p.phase)) out.push(p.phase);
  return out;
}

/** The first phase name not already in the timeline (for + phase), else `impact`. */
function nextUnusedPhase(): Phase {
  const used = new Set(def().timeline.map((p) => p.phase));
  return PHASE_NAMES.find((p) => !used.has(p)) ?? 'impact';
}

// ---- The effect-op tree ----
function renderEffects(): void {
  effectsHostEl.innerHTML = '';
  const d = def();
  d.effects.forEach((entry, i) => {
    const box = el('div', 'effect-entry');
    const head = el('div', 'entry-head');
    const phases = timelinePhases();
    const psel = selectEl(phases.includes(entry.phase) ? phases : [entry.phase, ...phases], entry.phase);
    psel.addEventListener('change', () => {
      entry.phase = psel.value as AbilityDef['effects'][number]['phase'];
      refreshDerived();
    });
    head.append(labelWrap('Phase', psel), el('span', 'spacer'),
      miniBtn('Remove effect', 'del', () => {
        d.effects.splice(i, 1);
        structuralChange();
      }));
    box.appendChild(head);
    const opHost = el('div', '');
    renderOp(opHost, entry.op, {
      inner: false,
      replace: (next) => {
        entry.op = next;
        structuralChange();
      },
    });
    box.appendChild(opHost);
    effectsHostEl.appendChild(box);
  });
  if (d.effects.length === 0) effectsHostEl.appendChild(el('p', 'hint', 'No effects yet — add one.'));
}

interface OpCtx {
  inner: boolean;
  replace: (next: EffectOp) => void;
  onRemove?: (() => void) | undefined;
}

function renderOp(host: HTMLElement, op: EffectOp, ctx: OpCtx): void {
  const box = el('div', `op-box${ctx.inner ? ' inner' : ''}`);
  const head = el('div', 'op-head');
  const kinds = ctx.inner ? INNER_OP_KINDS : TOP_OP_KINDS;
  const ksel = selectEl(kinds, op.kind);
  ksel.addEventListener('change', () => ctx.replace(defaultOp(ksel.value as OpKind)));
  head.append(labelWrap('Op', ksel));
  if (ctx.onRemove) head.append(el('span', 'spacer'), miniBtn('Remove', 'del', ctx.onRemove));
  box.appendChild(head);

  const body = el('div', 'field-grid');
  box.appendChild(body);

  switch (op.kind) {
    case 'damage':
      selectField(body, 'Scaling', DAMAGE_SCALING, op.scaling, (v) => (op.scaling = v as typeof op.scaling));
      numberField(body, 'Might', op.might, 0, (v) => (op.might = v), true);
      numberField(body, 'Accuracy', op.accuracy, 0, (v) => (op.accuracy = v), true);
      numberField(body, 'Crit base', op.critBase, 0, (v) => (op.critBase = v), true);
      checkboxField(body, 'Critable', op.critable, (v) => (op.critable = v));
      checkboxField(body, 'Evadable', op.evadable, (v) => (op.evadable = v));
      checkboxField(body, 'Bypass defense', op.bypassDefense, (v) => (op.bypassDefense = v));
      break;
    case 'heal':
      selectField(body, 'Scaling', HEAL_SCALING, op.scaling, (v) => (op.scaling = v as typeof op.scaling));
      numberField(body, 'Might', op.might, 0, (v) => (op.might = v), true);
      break;
    case 'move':
      selectField(body, 'Mode', MOVE_MODES, op.mode, (v) => (op.mode = v as typeof op.mode));
      numberField(body, 'Cells', op.cells, 1, (v) => (op.cells = v));
      box.appendChild(el('p', 'hint', 'Caster-reposition only — knockback / pull are a reserved Cluster-2 seam.'));
      break;
    case 'applyStatus':
      selectField(body, 'Status', STATUS_IDS, op.statusId, (v) => (op.statusId = v));
      // §31d: magnitude/duration are `ScalarOrScaled` — the toggle widget edits both
      // arms (plain number ↔ scaled), defaulting to plain. Both optional → empty
      // clears to undefined (the status def's magnitude 1 / base duration governs).
      scaledValueField(body, 'Magnitude', op.magnitude, { optional: true }, (v) =>
        v === undefined ? delete op.magnitude : (op.magnitude = v),
      );
      scaledValueField(body, 'Duration (s)', op.durationSeconds, { optional: true }, (v) =>
        v === undefined ? delete op.durationSeconds : (op.durationSeconds = v),
      );
      break;
    case 'chain': {
      numberField(body, 'Max jumps', op.maxJumps, 1, (v) => (op.maxJumps = v));
      numberField(body, 'Range (cells)', op.rangeCells, 1, (v) => (op.rangeCells = v));
      numberField(body, 'Falloff', op.falloff, 0, (v) => (op.falloff = v), true);
      numberField(body, 'Hop delay (s)', op.hopDelaySeconds, 0, (v) => (op.hopDelaySeconds = v), true);
      const innerWrap = el('div', 'inner-ops');
      innerWrap.appendChild(el('div', 'inner-label', 'Per-hop ops (damage / applyStatus):'));
      op.ops.forEach((io, i) => {
        const ihost = el('div', '');
        renderOp(ihost, io, {
          inner: true,
          replace: (next) => {
            op.ops[i] = next as (typeof op.ops)[number];
            structuralChange();
          },
          onRemove: op.ops.length > 1 ? () => {
            op.ops.splice(i, 1);
            structuralChange();
          } : undefined,
        });
        innerWrap.appendChild(ihost);
      });
      const addRow = el('div', 'row');
      addRow.appendChild(miniBtn('+ hop op', '', () => {
        op.ops.push(defaultOp('damage') as (typeof op.ops)[number]);
        structuralChange();
      }));
      innerWrap.appendChild(addRow);
      box.appendChild(innerWrap);
      break;
    }
    case 'summon': {
      const spec = op.summon;
      selectField(body, 'Archetype', ARCHETYPE_IDS, spec.archetype, (v) => (spec.archetype = v));
      // §31d: level is `ScalarOrScaled` — the toggle edits plain ↔ scaled (required,
      // int-rounded ≥1 like the sim). Default 1 is omitted by the formatter.
      scaledValueField(body, 'Level', spec.level, { optional: false, round: true }, (v) => {
        if (v !== undefined) spec.level = v;
      });
      numberField(body, 'Count', spec.count, 1, (v) => (spec.count = v));
      numberField(body, 'Max live', spec.maxLive, 1, (v) => (spec.maxLive = v));
      numberField(body, 'Radius', spec.radiusCells, 1, (v) => (spec.radiusCells = v));
      box.appendChild(el('div', 'inner-label', 'Place at (anchor):'));
      const atHost = el('div', '');
      renderTargetSelector(atHost, () => op.at, (t) => (op.at = t));
      box.appendChild(atHost);
      break;
    }
  }
  host.appendChild(box);
}

// ---- Refresh (NB: does NOT rebuild the effect tree — scalar edits keep their
//      live inputs; structural changes call structuralChange() instead) ----
function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
  refreshTabs();
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

// ---- Resolution-outline preview (shares the real resolvers) ----
function refreshPreview(): void {
  const d = def();
  previewEl.innerHTML = '';
  const source = sampleSource();
  const speed = sample.speed;

  addPreview('Target', describeTarget(d.target));
  addPreview('Range', d.minRangeCells > 0 ? `${d.minRangeCells}–${d.rangeCells} cells` : `${d.rangeCells} cells`);

  // Cadence + the phase timeline resolved to TICKS at the sample speed — through
  // the same `resolveCadenceTicks` / `resolvePhases` the sim uses (never re-derived).
  const cadence = resolveCadenceTicks(d, speed);
  addPreview('Cadence', `${cadence}t · ${secs(cadence)}s${d.speedScaled ? ' speed-scaled' : ' flat'} · prio ${d.priority}`);
  const phases = resolvePhases(d, speed);
  addPreview('Timeline', phases.map((p) => `${p.phase} ${p.ticks}t (${secs(p.ticks)}s)`).join(' · '));

  // Each effect resolved against the sample caster (the cast-time scalars).
  for (const e of d.effects) addPreview(`@ ${e.phase}`, outlineOp(e.op, source));
  if (d.effects.length === 0) addPreview('Effects', '— none');
}

/** Build a full `UnitStats` from the five sample knobs (the other six fields never
 *  enter cast-time resolution, so they stay 0). */
function sampleStats(): UnitStats {
  return {
    constitution: 0,
    strength: sample.strength,
    ranged: sample.ranged,
    magic: sample.magic,
    luck: sample.luck,
    defense: 0,
    precision: 0,
    evasion: 0,
    speed: sample.speed,
    mobility: 0,
    power: 0,
  };
}

/** One effect op's resolved outline against the sample caster (cast-time scalars +
 *  any §31 scaled magnitude / duration / level). */
function outlineOp(op: EffectOp, source: ScalingSource): string {
  const stats = source.effectiveStats;
  switch (op.kind) {
    case 'damage':
      return outlineDamage(op, stats, 1);
    case 'heal':
      return `heal ${resolveHealAmount(op, stats)} (${op.might}+${op.scaling})`;
    case 'move':
      return `move ${op.mode} ${op.cells} cell${op.cells === 1 ? '' : 's'}`;
    case 'applyStatus':
      return outlineApplyStatus(op, source);
    case 'chain':
      return outlineChain(op, source);
    case 'summon': {
      const s = op.summon;
      // Mirror the sim's int-round-≥1 capture so the preview level matches the spawn.
      const lvlN = Math.max(1, Math.round(evalScaled(s.level, source) ?? 1));
      const lvl = typeof s.level === 'number' ? `${lvlN}` : `${lvlN} (${displayScaledValue(s.level)})`;
      return `summon ${s.count}× ${s.archetype} (lvl ${lvl}, max ${s.maxLive}) @ ${op.at.kind}`;
    }
  }
}

/** A damage op resolved to its hit / crit numbers (`falloff` applies the chain
 *  cumulative reduction; 1 for a top-level op). Mirrors the interpreter's
 *  round-once arithmetic (`round(base × critFactor)`). */
function outlineDamage(
  op: Extract<EffectOp, { kind: 'damage' }>,
  stats: UnitStats,
  falloff: number,
): string {
  const { baseDamage, critChance } = resolveDamageScalars(op, stats);
  const hit = Math.round(baseDamage * falloff);
  const flags: string[] = [];
  if (op.bypassDefense) flags.push('bypass def');
  flags.push(op.evadable ? `acc ${pct(op.accuracy)}` : 'unmissable');
  let out = `${hit} dmg`;
  if (op.critable && critChance > 0) {
    out += ` · crit ${pct(critChance)} → ${Math.round(baseDamage * falloff * STATS.critMult)}`;
  }
  return `${out} · ${flags.join(', ')}`;
}

/** An applyStatus op resolved to its status name + the §31 resolved magnitude /
 *  duration vs the sample caster (a scaled value also shows its formula; the
 *  duration falls back to the status def's base when not overridden). */
function outlineApplyStatus(
  op: Extract<EffectOp | ChainInnerOp, { kind: 'applyStatus' }>,
  source: ScalingSource,
): string {
  const sd = STATUS_DEFS[op.statusId as keyof typeof STATUS_DEFS];
  const name = sd?.name ?? op.statusId;
  const bits = [`apply ${name}`];
  if (op.magnitude !== undefined && !(typeof op.magnitude === 'number' && op.magnitude === 1)) {
    const m = evalScaled(op.magnitude, source) ?? 1;
    const suffix = typeof op.magnitude === 'number' ? '' : ` (${displayScaledValue(op.magnitude)})`;
    bits.push(`×${trimNum(m)}${suffix}`);
  }
  const dur = op.durationSeconds !== undefined ? evalScaled(op.durationSeconds, source) : sd?.durationSeconds;
  if (dur !== undefined) {
    const suffix =
      op.durationSeconds !== undefined && typeof op.durationSeconds !== 'number'
        ? ` (${displayScaledValue(op.durationSeconds)})`
        : '';
    bits.push(`${secsNum(dur)}s${suffix}`);
  }
  return bits.join(' · ');
}

/** A chain op resolved across its jumps: the per-hop damage falloff sequence + any
 *  status riders. Uses `resolveDamageScalars` per inner op (the real resolver). */
function outlineChain(op: Extract<EffectOp, { kind: 'chain' }>, source: ScalingSource): string {
  const stats = source.effectiveStats;
  const parts = op.ops.map((io) => {
    if (io.kind === 'damage') {
      const { baseDamage, critChance } = resolveDamageScalars(io, stats);
      const seq = Array.from({ length: op.maxJumps }, (_, j) =>
        Math.round(baseDamage * Math.pow(op.falloff, j)),
      );
      const crit = io.critable && critChance > 0 ? ` (crit ${pct(critChance)})` : '';
      return `dmg ${seq.join('→')}${crit}`;
    }
    return `+${outlineApplyStatus(io, source)}`;
  });
  const delay = op.hopDelaySeconds > 0 ? `${secsNum(op.hopDelaySeconds)}s/hop` : 'instant';
  return `chain ×${op.maxJumps} r${op.rangeCells} (${delay}) · ${parts.join(' · ')}`;
}

// ---- Sample caster (preview knobs + archetype presets) ----
function buildSampleCaster(): void {
  presetEl.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— custom —';
  presetEl.appendChild(placeholder);
  for (const id of ARCHETYPE_IDS) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    presetEl.appendChild(opt);
  }
  presetEl.addEventListener('change', () => {
    const id = presetEl.value;
    if (!id || !(id in ARCHETYPES)) return;
    const base = ARCHETYPES[id as keyof typeof ARCHETYPES].baseStats;
    for (const k of SAMPLE_STATS) sample[k] = base[k];
    syncSampleInputs();
    refreshPreview();
  });
  for (const k of SAMPLE_STATS) {
    sampleEls[k].addEventListener('input', () => {
      sample[k] = intOr(sampleEls[k].value, 0);
      presetEl.value = ''; // a manual edit diverges from any preset
      refreshPreview();
    });
  }
  // `level` isn't an archetype base stat, so presets leave it alone — but it's
  // knobbable for `stat:'level'` (summon-level) scaling previews. Floor at 1.
  sampleLevelEl.addEventListener('input', () => {
    sample.level = intOr(sampleLevelEl.value, 1);
    presetEl.value = '';
    refreshPreview();
  });
  syncSampleInputs();
}

function syncSampleInputs(): void {
  for (const k of SAMPLE_STATS) sampleEls[k].value = String(sample[k]);
  sampleLevelEl.value = String(sample.level);
}

/** §31d — the sample caster as a `ScalingSource` (level + effectiveStats), so the
 *  preview resolves a `ScaledValue` through the same `evalScaled` the sim uses. */
function sampleSource(): ScalingSource {
  return { level: sample.level, effectiveStats: sampleStats() };
}

function secs(ticks: number): string {
  return trimNum(ticks * TICK_SECONDS);
}
function secsNum(seconds: number): string {
  return trimNum(seconds);
}
function trimNum(n: number): string {
  return Number(n.toFixed(2)).toString();
}
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
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

// ---- Field-builder helpers ----
function fillSelect(sel: HTMLSelectElement, options: readonly string[]): void {
  sel.innerHTML = '';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  }
}

function selectEl(options: readonly string[], value: string): HTMLSelectElement {
  const sel = document.createElement('select');
  fillSelect(sel, options);
  sel.value = value;
  return sel;
}

function labelWrap(text: string, control: HTMLElement): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'inline';
  wrap.append(`${text} `, control);
  return wrap;
}

function numberField(
  parent: HTMLElement,
  label: string,
  value: number,
  min: number,
  onChange: (v: number) => void,
  float = false,
): void {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.step = float ? '0.05' : '1';
  input.value = String(value);
  input.addEventListener('input', () => {
    onChange(float ? numOr(input.value, min) : intOr(input.value, min));
    refreshDerived();
  });
  parent.appendChild(labelWrap(label, input));
}

const SCALING_STATS = ScalingStatSchema.options;

/**
 * §31d — edit a `ScalarOrScaled`: a "scaled" checkbox toggles between a plain
 * number (the non-breaking default) and the {base, stat, perPoint, max?} form.
 * Sub-field edits mutate IN PLACE + refresh the preview (no op re-render, so focus
 * is kept); toggling re-renders the op (number↔object is a structural change). A
 * live "= N vs sample" resolves the scaled form through the real `evalScaled`
 * inline, so the author sees the cast-time number while editing.
 *
 * `optional` lets the plain-number arm clear to undefined (applyStatus magnitude /
 * duration → the consumer default governs); a required field (summon level) keeps a
 * number. `round` shows the int-rounded resolution (summon level mirrors the sim).
 */
function scaledValueField(
  parent: HTMLElement,
  label: string,
  value: number | ScaledValue | undefined,
  opts: { optional: boolean; round?: boolean },
  onChange: (v: number | ScaledValue | undefined) => void,
): void {
  const scaled = value !== undefined && typeof value !== 'number' ? value : undefined;
  const row = el('div', 'scaled-field');

  const toggle = document.createElement('label');
  toggle.className = 'inline scaled-toggle';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = scaled !== undefined;
  cb.addEventListener('change', () => {
    if (cb.checked) onChange({ base: typeof value === 'number' ? value : 0, stat: 'magic', perPoint: 1 });
    else onChange(scaled ? scaled.base : undefined);
    structuralChange(); // number↔object re-renders the op form
  });
  toggle.append(cb, document.createTextNode(' scaled'));

  if (scaled === undefined) {
    // Plain-number arm.
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '0.05';
    if (opts.optional) input.placeholder = 'default';
    input.value = value === undefined ? '' : String(value);
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      if (raw === '' && opts.optional) onChange(undefined);
      else {
        const num = Number.parseFloat(raw);
        onChange(Number.isFinite(num) ? num : opts.optional ? undefined : 0);
      }
      refreshDerived();
    });
    row.append(labelWrap(label, input), toggle);
    parent.appendChild(row);
    return;
  }

  // Scaled arm: base / stat / perPoint / max + the live resolution.
  const sv = scaled;
  const resolvedEl = el('span', 'scaled-resolved', '');
  const recompute = (): void => {
    const n = evalScaled(sv, sampleSource());
    const shown = n === undefined ? '—' : opts.round ? String(Math.max(1, Math.round(n))) : trimNum(n);
    resolvedEl.textContent = `= ${shown} vs sample`;
  };
  const commit = (): void => {
    onChange(sv);
    recompute();
    refreshDerived();
  };
  const grid = el('div', 'scaled-grid');
  numKnob(grid, 'Base', sv.base, (n) => (sv.base = n), commit);
  const statSel = selectEl(SCALING_STATS, sv.stat);
  statSel.addEventListener('change', () => {
    sv.stat = statSel.value as ScaledValue['stat'];
    commit();
  });
  grid.appendChild(labelWrap('Stat', statSel));
  numKnob(grid, '/point', sv.perPoint, (n) => (sv.perPoint = n), commit);
  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.step = '0.05';
  maxInput.placeholder = 'no max';
  maxInput.value = sv.max === undefined ? '' : String(sv.max);
  maxInput.addEventListener('input', () => {
    const raw = maxInput.value.trim();
    if (raw === '') delete sv.max;
    else {
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num)) sv.max = num;
    }
    commit();
  });
  grid.appendChild(labelWrap('Max', maxInput));

  const head = el('div', 'scaled-head');
  head.append(el('span', 'scaled-label', label), toggle, resolvedEl);
  row.append(head, grid);
  recompute();
  parent.appendChild(row);
}

/** A float sub-input for the scaled-value grid (`set` mutates the field, `commit`
 *  re-resolves the inline number + refreshes the preview). */
function numKnob(parent: HTMLElement, label: string, value: number, set: (n: number) => void, commit: () => void): void {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.05';
  input.value = String(value);
  input.addEventListener('input', () => {
    const num = Number.parseFloat(input.value);
    if (Number.isFinite(num)) {
      set(num);
      commit();
    }
  });
  parent.appendChild(labelWrap(label, input));
}

/** §31 — a `ScaledValue` as a compact `base + perPoint×stat` formula (+ the max
 *  clamp when set), the preview's scaled-form suffix. */
function displayScaledValue(v: ScaledValue): string {
  const max = v.max !== undefined ? ` (max ${v.max})` : '';
  return `${v.base} + ${v.perPoint}×${v.stat}${max}`;
}

function selectField(
  parent: HTMLElement,
  label: string,
  options: readonly string[],
  value: string,
  onChange: (v: string) => void,
): void {
  const sel = selectEl(options, value);
  sel.addEventListener('change', () => {
    onChange(sel.value);
    refreshDerived();
  });
  parent.appendChild(labelWrap(label, sel));
}

function checkboxField(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void): void {
  const wrap = document.createElement('label');
  wrap.className = 'inline';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = value;
  cb.addEventListener('change', () => {
    onChange(cb.checked);
    refreshDerived();
  });
  wrap.append(cb, ` ${label}`);
  parent.appendChild(wrap);
}

function miniBtn(label: string, extraClass: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `mini-btn${extraClass ? ` ${extraClass}` : ''}`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function addPreview(term: string, value: string): void {
  previewEl.appendChild(el('dt', '', term));
  previewEl.appendChild(el('dd', '', value));
}

function addValidation(level: 'ok' | 'error', text: string): void {
  validationEl.appendChild(el('li', level, text));
}

/** Narrow a live `TargetSelector` to one kind for in-place mutation. */
function asKind<K extends TargetSelector['kind']>(t: TargetSelector, kind: K): Extract<TargetSelector, { kind: K }> {
  if (t.kind !== kind) throw new Error(`attack-editor: expected target kind ${kind}, got ${t.kind}`);
  return t as Extract<TargetSelector, { kind: K }>;
}

function intOr(raw: string, min: number): number {
  const num = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(num) ? Math.max(min, num) : min;
}

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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function mustQuery<T extends Element>(selector: string): T {
  const elt = document.querySelector<T>(selector);
  if (!elt) throw new Error(`attack-editor: missing element "${selector}"`);
  return elt;
}
