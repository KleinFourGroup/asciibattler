/**
 * Balance Sweep launcher (H7d). Standalone Vite page — visit
 * http://localhost:5173/tools/sweep-gui/ after `npm run dev`. Not part of the
 * production build (the `tools/` tree is served statically by the dev server and
 * never lands in `dist/`).
 *
 * A GUI command-builder over the fuzz CLI (`tests/fuzz/cli.ts`): pick a
 * balance-sweep grid (knob + range, optional 2nd knob, tier, jobs, dry-run) or a
 * search (preset + overrides), and the page emits the `npm run fuzz -- …` command
 * to paste into a terminal. The balance sweep runs in Node (tsx), so — unlike the
 * run launcher's clickable URL — this can only hand you the command.
 *
 * Single source of truth: the knob menu + the argv come from
 * `tests/fuzz/sweepCommand.ts` (`SWEEP_KNOBS` enumerated from the live config
 * objects, `buildFuzzArgs` mirroring the CLI's flags), so the GUI can't offer a
 * knob the CLI rejects and the command is assembled in exactly one place.
 */

import './sweep.css';
import {
  SWEEP_KNOBS,
  TIER_NAMES,
  buildFuzzArgs,
  formatFuzzCommand,
  type SweepMode,
  type KnobInfo,
} from '../../tests/fuzz/sweepCommand';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`sweep-gui: missing #${id}`);
  return el as T;
}

const modeSelect = byId<HTMLSelectElement>('mode');
const modeHint = byId<HTMLParagraphElement>('mode-hint');
const sweepCard = byId<HTMLElement>('sweep-card');
const searchCard = byId<HTMLElement>('search-card');

const knobSelect = byId<HTMLSelectElement>('knob');
const knob2Select = byId<HTMLSelectElement>('knob2');
const rangeMin = byId<HTMLInputElement>('range-min');
const rangeMax = byId<HTMLInputElement>('range-max');
const rangeSteps = byId<HTMLInputElement>('range-steps');
const range2Label = byId<HTMLLabelElement>('range2-label');
const range2Min = byId<HTMLInputElement>('range2-min');
const range2Max = byId<HTMLInputElement>('range2-max');
const range2Steps = byId<HTMLInputElement>('range2-steps');
const tierSelect = byId<HTMLSelectElement>('tier');
const jobsInput = byId<HTMLInputElement>('jobs');
const dryRunInput = byId<HTMLInputElement>('dry-run');

const presetSelect = byId<HTMLSelectElement>('preset');
const vectorsInput = byId<HTMLInputElement>('vectors');
const seedsInput = byId<HTMLInputElement>('seeds');

const floorsInput = byId<HTMLInputElement>('floors');
const rosterInput = byId<HTMLInputElement>('roster');
const samplerSeedInput = byId<HTMLInputElement>('sampler-seed');

const commandBox = byId<HTMLTextAreaElement>('command');
const copyBtn = byId<HTMLButtonElement>('copy-cmd');

function option(value: string, label: string): HTMLOptionElement {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

const knobByPath = new Map<string, KnobInfo>(SWEEP_KNOBS.map((k) => [k.path, k]));

// ---- static population ----------------------------------------------------

/** Populate a knob <select> with one <optgroup> per config group; option labels
 *  carry the current value so a sweep range is easy to anchor. `includeNone`
 *  prepends a "no 2nd knob" choice. */
function populateKnobSelect(select: HTMLSelectElement, includeNone: boolean): void {
  if (includeNone) select.append(option('', '— none (single knob) —'));
  let currentGroup = '';
  let group: HTMLOptGroupElement | null = null;
  for (const knob of SWEEP_KNOBS) {
    if (knob.group !== currentGroup) {
      currentGroup = knob.group;
      group = document.createElement('optgroup');
      group.label = knob.group;
      select.append(group);
    }
    group!.append(option(knob.path, `${knob.key} (= ${knob.value})`));
  }
}

populateKnobSelect(knobSelect, false);
populateKnobSelect(knob2Select, true);
for (const t of TIER_NAMES) tierSelect.append(option(t, t));
for (const t of TIER_NAMES) presetSelect.append(option(t, t));

// Sensible defaults: the band knob the H7c sweeps centred on, quick tier.
knobSelect.value = 'difficulty.budgetFactor';
tierSelect.value = 'quick';
presetSelect.value = 'quick';

// ---- range seeding --------------------------------------------------------

/** Seed a range's min/max from a knob's current value (steps=1 → a pinned single
 *  point the user widens). Leaves the steps box for the user to set explicitly. */
function seedRange(path: string, minEl: HTMLInputElement, maxEl: HTMLInputElement, stepsEl: HTMLInputElement): void {
  const knob = knobByPath.get(path);
  if (!knob) return;
  minEl.value = String(knob.value);
  maxEl.value = String(knob.value);
  stepsEl.value = '1';
}

seedRange(knobSelect.value, rangeMin, rangeMax, rangeSteps);

// ---- state assembly -------------------------------------------------------

/** A `min:max:steps` token, defaulting blanks (min/max → the knob's value,
 *  steps → 1) so the emitted range is always valid. */
function rangeToken(
  path: string,
  minEl: HTMLInputElement,
  maxEl: HTMLInputElement,
  stepsEl: HTMLInputElement,
): string {
  const fallback = knobByPath.get(path)?.value ?? 0;
  const min = minEl.value.trim() || String(fallback);
  const max = maxEl.value.trim() || String(fallback);
  const steps = stepsEl.value.trim() || '1';
  return `${min}:${max}:${steps}`;
}

function intOrUndef(el: HTMLInputElement): number | undefined {
  const v = el.value.trim();
  if (v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strOrUndef(value: string): string | undefined {
  const v = value.trim();
  return v === '' ? undefined : v;
}

function recompute(): void {
  const mode = modeSelect.value as SweepMode;
  const knob2 = strOrUndef(knob2Select.value);

  const args = buildFuzzArgs({
    mode,
    knob: knobSelect.value,
    range: rangeToken(knobSelect.value, rangeMin, rangeMax, rangeSteps),
    knob2,
    range2: knob2 ? rangeToken(knob2, range2Min, range2Max, range2Steps) : undefined,
    tier: tierSelect.value,
    jobs: intOrUndef(jobsInput),
    dryRun: dryRunInput.checked,
    preset: presetSelect.value,
    vectors: intOrUndef(vectorsInput),
    seeds: intOrUndef(seedsInput),
    floors: intOrUndef(floorsInput),
    roster: strOrUndef(rosterInput.value),
    samplerSeed: intOrUndef(samplerSeedInput),
  });

  commandBox.value = formatFuzzCommand(args);
}

// ---- visibility -----------------------------------------------------------

const MODE_HINTS: Record<SweepMode, string> = {
  'balance-sweep':
    'Sweep a config knob (or a 2-knob grid) and read the best-achievable win rate + skill gradient at each point — the H7c tuning instrument.',
  search:
    'Random-search the strategy weights for the best-achievable win rate at the CURRENT config — the “did my change move balance?” check (and the overnight verify).',
};

function applyMode(): void {
  const mode = modeSelect.value as SweepMode;
  sweepCard.hidden = mode !== 'balance-sweep';
  searchCard.hidden = mode !== 'search';
  modeHint.textContent = MODE_HINTS[mode];
}

function applyKnob2Visibility(): void {
  range2Label.hidden = knob2Select.value === '';
}

// ---- wiring ---------------------------------------------------------------

modeSelect.addEventListener('change', () => {
  applyMode();
  recompute();
});

knobSelect.addEventListener('change', () => {
  seedRange(knobSelect.value, rangeMin, rangeMax, rangeSteps);
  recompute();
});

knob2Select.addEventListener('change', () => {
  if (knob2Select.value) seedRange(knob2Select.value, range2Min, range2Max, range2Steps);
  applyKnob2Visibility();
  recompute();
});

for (const el of [
  rangeMin,
  rangeMax,
  rangeSteps,
  range2Min,
  range2Max,
  range2Steps,
  jobsInput,
  vectorsInput,
  seedsInput,
  floorsInput,
  rosterInput,
  samplerSeedInput,
]) {
  el.addEventListener('input', recompute);
}
for (const el of [tierSelect, presetSelect]) {
  el.addEventListener('change', recompute);
}
dryRunInput.addEventListener('change', recompute);

copyBtn.addEventListener('click', () => {
  const original = copyBtn.textContent;
  const flash = (label: string): void => {
    copyBtn.textContent = label;
    setTimeout(() => {
      copyBtn.textContent = original;
    }, 1200);
  };
  navigator.clipboard.writeText(commandBox.value).then(
    () => flash('Copied!'),
    () => {
      // Clipboard blocked (no gesture / permission): select so the user can copy
      // manually, and say so.
      commandBox.focus();
      commandBox.select();
      flash('Select+copy');
    },
  );
});

// ---- initial render -------------------------------------------------------

applyMode();
applyKnob2Visibility();
recompute();
