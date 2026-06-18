/**
 * Run Launcher (G5). Standalone Vite page — visit
 * http://localhost:5173/tools/run-config/ after `npm run dev`. Not part of the
 * production build (no entry in vite.config.ts) — the `tools/` tree is served
 * statically by the dev server and never lands in `dist/`.
 *
 * A GUI over G1's RunConfig: pick seed / hops / map width / layout and build
 * a starting roster (per-unit archetype + level), and the page emits a launch
 * URL for the game. It is the browser sibling of `tools/run-config/cli.ts` — so
 * an eyeball test is a click + paste, not a hand-typed query string.
 *
 * Single source of truth: the form is round-tripped through the SAME
 * `parseRunConfig` → `runConfigToQueryString` pair the game (Game.ts) and the
 * CLI use. So the launcher validates / clamps / drops fields exactly as the
 * game will — there is no second copy of the rules here.
 */

import './launcher.css';
import {
  parseRunConfig,
  runConfigToQueryString,
  RUN_CONFIG_PARAMS,
  type RunConfig,
} from '../../src/run/RunConfig';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import { LAYOUT_IDS } from '../../src/sim/layouts';
import { LEVELING } from '../../src/config/leveling';
import { NODE_MAP } from '../../src/config/nodemap';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`launcher: missing #${id}`);
  return el as T;
}

const seedInput = byId<HTMLInputElement>('seed');
const hopsInput = byId<HTMLInputElement>('hops');
const widthInput = byId<HTMLInputElement>('width');
const layoutSelect = byId<HTMLSelectElement>('layout');
const rosterRows = byId<HTMLDivElement>('roster-rows');
const launchUrl = byId<HTMLTextAreaElement>('launch-url');
const launchLink = byId<HTMLAnchorElement>('launch-link');
const copyBtn = byId<HTMLButtonElement>('copy-url');
const summary = byId<HTMLPreElement>('summary');

function option(value: string, label: string): HTMLOptionElement {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

// ---- static population ----------------------------------------------------

byId('level-cap').textContent = String(LEVELING.levelCap);
hopsInput.placeholder = `default ${NODE_MAP.hopCount}`;
widthInput.placeholder = `default ${NODE_MAP.middleWidthMax}`;
seedInput.placeholder = 'blank → game picks one';

layoutSelect.append(option('', '— procedural (random) —'));
for (const id of LAYOUT_IDS) layoutSelect.append(option(id, id));

// ---- roster builder -------------------------------------------------------

function addRosterRow(archetype: string = ALL_ARCHETYPES[0]!, level = 1): void {
  const row = document.createElement('div');
  row.className = 'roster-row';

  const arch = document.createElement('select');
  arch.className = 'roster-archetype';
  for (const a of ALL_ARCHETYPES) arch.append(option(a, a));
  arch.value = archetype;
  arch.addEventListener('change', recompute);

  const lvlLabel = document.createElement('label');
  lvlLabel.className = 'lvl';
  lvlLabel.append(document.createTextNode('Lv'));
  const lvl = document.createElement('input');
  lvl.type = 'number';
  lvl.className = 'roster-level';
  lvl.min = '1';
  lvl.max = String(LEVELING.levelCap);
  lvl.value = String(level);
  lvl.addEventListener('input', recompute);
  lvlLabel.append(lvl);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'small-btn danger-outline';
  remove.textContent = '✕';
  remove.title = 'Remove this unit';
  remove.addEventListener('click', () => {
    row.remove();
    recompute();
  });

  row.append(arch, lvlLabel, remove);
  rosterRows.append(row);
}

/** Build the `roster=` token string from the current rows, omitting `:level`
 *  for level-1 units to match `runConfigToQueryString`'s own shorthand. */
function readRosterParam(): string {
  const tokens: string[] = [];
  for (const row of rosterRows.querySelectorAll<HTMLDivElement>('.roster-row')) {
    const archetype = row.querySelector<HTMLSelectElement>('.roster-archetype')!.value;
    const level = row.querySelector<HTMLInputElement>('.roster-level')!.value.trim();
    tokens.push(level !== '' && level !== '1' ? `${archetype}:${level}` : archetype);
  }
  return tokens.join(',');
}

// ---- recompute ------------------------------------------------------------

function setIf(params: URLSearchParams, key: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed !== '') params.set(key, trimmed);
}

function recompute(): void {
  const params = new URLSearchParams();
  setIf(params, RUN_CONFIG_PARAMS.seed, seedInput.value);
  setIf(params, RUN_CONFIG_PARAMS.hops, hopsInput.value);
  setIf(params, RUN_CONFIG_PARAMS.width, widthInput.value);
  setIf(params, RUN_CONFIG_PARAMS.layout, layoutSelect.value);
  setIf(params, RUN_CONFIG_PARAMS.roster, readRosterParam());

  // Round-trip through the game's own validator so the launcher drops /
  // clamps / normalizes exactly as the game will at load.
  const config = parseRunConfig(params);
  const query = runConfigToQueryString(config);
  const url = `${location.origin}/${query ? `?${query}` : ''}`;

  launchUrl.value = url;
  launchLink.href = url;
  renderSummary(config);
}

function renderSummary(config: RunConfig): void {
  const roster =
    config.startingRoster && config.startingRoster.length > 0
      ? config.startingRoster.map((e) => `${e.archetype} Lv${e.level}`).join(', ')
      : 'default rolled team';
  summary.textContent = [
    `seed:    ${config.seed ?? '(game picks at launch)'}`,
    `hops:    ${config.hopCount ?? `default (${NODE_MAP.hopCount})`}`,
    `width:   ${config.mapMaxWidth ?? `default (${NODE_MAP.middleWidthMax})`}`,
    `layout:  ${config.forcedLayoutId ?? 'procedural (random per battle)'}`,
    `roster:  ${roster}`,
  ].join('\n');
}

// ---- wiring ---------------------------------------------------------------

for (const el of [seedInput, hopsInput, widthInput]) {
  el.addEventListener('input', recompute);
}
layoutSelect.addEventListener('change', recompute);

byId<HTMLButtonElement>('random-seed').addEventListener('click', () => {
  // Tool-side randomness only (the ban on Math.random is scoped to
  // src/sim + src/run); the chosen seed is pinned into the URL so the run
  // stays reproducible.
  seedInput.value = String(Math.floor(Math.random() * 2 ** 31));
  recompute();
});

byId<HTMLButtonElement>('add-unit').addEventListener('click', () => {
  addRosterRow();
  recompute();
});

byId<HTMLButtonElement>('clear-roster').addEventListener('click', () => {
  rosterRows.replaceChildren();
  recompute();
});

copyBtn.addEventListener('click', () => {
  const original = copyBtn.textContent;
  const flash = (label: string) => {
    copyBtn.textContent = label;
    setTimeout(() => {
      copyBtn.textContent = original;
    }, 1200);
  };
  navigator.clipboard.writeText(launchUrl.value).then(
    () => flash('Copied!'),
    () => {
      // Clipboard blocked (no gesture / permission): select the text so the
      // user can copy it manually, and say so.
      launchUrl.focus();
      launchUrl.select();
      flash('Select+copy');
    },
  );
});

// Start with no roster rows (blank → default team, the common case) and an
// initial URL reflecting all-defaults.
recompute();
