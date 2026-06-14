/**
 * Map-Gen Prototype tool (M6). Now wired to the PRODUCTION generator in
 * `src/sim/proceduralMap.ts` (the old standalone `generator.ts` copy was
 * deleted on the port). Dev-only; visit
 * http://localhost:5173/tools/mapgen-prototype/ (or the dev-preview port).
 *
 * Two modes:
 *   - MANUAL (default): the sliders drive a `ResolvedMapParams` directly; reroll
 *     varies the structure at fixed knobs.
 *   - ROLL FROM CONFIG: each seed samples a `ResolvedMapParams` from the live
 *     `config/terrain.json#procedural` envelope (exactly as the game does at
 *     encounter time — one RNG, sample-then-generate), so the Variety strip
 *     shows the real seed-to-seed spread. The sampled knobs are reflected back
 *     into the (disabled) sliders so you can see what each map rolled.
 */

import { RNG } from '../../src/core/RNG';
import { TERRAIN } from '../../src/config/terrain';
import {
  generateProceduralMap,
  sampleProceduralParams,
  type ProceduralMapResult,
  type ResolvedMapParams,
  type Symmetry,
} from '../../src/sim/proceduralMap';

const PALETTE = {
  board: '#0d0a1c',
  floor: '#1d1838',
  wall: '#ff6ac1',
  water: '#33c6f4',
  spawn: '#2fe0a0',
  choke: '#ffd23f',
};

const el = <T extends HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} missing`);
  return e as T;
};
const numVal = (id: string): number => Number((el<HTMLInputElement>(id)).value);

// Slider ids that map onto `ResolvedMapParams` (excludes width/height/symmetry).
const SLIDERS = [
  'crossbars',
  'gapsPerBar',
  'gapWidth',
  'fordChance',
  'crossbarWaver',
  'windowChance',
  'dividers',
  'coverDensity',
  'poolDensity',
  'noiseScale',
  'wallCapFraction',
];

function readParams(): ResolvedMapParams {
  return {
    symmetry: (el<HTMLSelectElement>('symmetry')).value as Symmetry,
    crossbars: numVal('crossbars'),
    gapsPerBar: numVal('gapsPerBar'),
    gapWidth: numVal('gapWidth'),
    fordChance: numVal('fordChance'),
    crossbarWaver: numVal('crossbarWaver'),
    dividers: numVal('dividers'),
    coverDensity: numVal('coverDensity'),
    windowChance: numVal('windowChance'),
    poolDensity: numVal('poolDensity'),
    noiseScale: numVal('noiseScale'),
    wallCapFraction: numVal('wallCapFraction'),
  };
}

/** Push a sampled param set back into the controls (for the "from config"
 *  display). */
function reflectParams(p: ResolvedMapParams): void {
  (el<HTMLSelectElement>('symmetry')).value = p.symmetry;
  const setSlider = (id: string, v: number): void => {
    (el<HTMLInputElement>(id)).value = String(v);
  };
  setSlider('crossbars', p.crossbars);
  setSlider('gapsPerBar', p.gapsPerBar);
  setSlider('gapWidth', p.gapWidth);
  setSlider('fordChance', p.fordChance);
  setSlider('crossbarWaver', p.crossbarWaver);
  setSlider('windowChance', p.windowChance);
  setSlider('dividers', p.dividers);
  setSlider('coverDensity', p.coverDensity);
  setSlider('poolDensity', p.poolDensity);
  setSlider('noiseScale', p.noiseScale);
  setSlider('wallCapFraction', p.wallCapFraction);
  syncSliderLabels();
}

function fromConfig(): boolean {
  return (el<HTMLInputElement>('fromConfig')).checked;
}

/**
 * Build a map for a given seed, mirroring production: one RNG, sample-then-
 * generate when in config mode. Returns the result + the params used (so the
 * main render can reflect them into the controls).
 */
function buildMap(seed: number, W: number, H: number): { map: ProceduralMapResult; params: ResolvedMapParams } {
  const rng = new RNG(seed);
  const params = fromConfig() ? sampleProceduralParams(rng, TERRAIN.procedural) : readParams();
  const map = generateProceduralMap(rng, W, H, params);
  return { map, params };
}

function render(canvas: HTMLCanvasElement, map: ProceduralMapResult, cell: number, outline: boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = map.tileGrid.width;
  const H = map.tileGrid.height;
  canvas.width = W * cell;
  canvas.height = H * cell;

  const wallSet = new Set(map.walls.map((c) => `${c.x},${c.y}`));
  const halfSet = new Set(map.halfCovers.map((c) => `${c.x},${c.y}`));
  const spawnSet = new Set(map.spawnRegions.flatMap((r) => r.tiles).map((c) => `${c.x},${c.y}`));
  const chokeSet = new Set(map.chokeCells.map((c) => `${c.x},${c.y}`));
  const waterSet = new Set<string>();
  for (const c of map.tileGrid.cells()) if (c.kind === 'shallow_water') waterSet.add(`${c.x},${c.y}`);

  ctx.fillStyle = PALETTE.board;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gap = cell > 9 ? 1 : 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = `${x},${y}`;
      const half = halfSet.has(k);
      let color = PALETTE.floor;
      if (spawnSet.has(k)) color = PALETTE.spawn;
      else if (wallSet.has(k)) color = PALETTE.wall;
      else if (!half && waterSet.has(k)) color = PALETTE.water;
      ctx.fillStyle = color;
      ctx.fillRect(x * cell + gap, y * cell + gap, cell - gap, cell - gap);
      if (half) {
        // Hollow: floor fill + wall-colour border → "you can shoot over it".
        ctx.strokeStyle = PALETTE.wall;
        ctx.lineWidth = Math.max(1, cell * 0.16);
        ctx.strokeRect(x * cell + gap + 1, y * cell + gap + 1, cell - gap - 2, cell - gap - 2);
      }
      if (outline && chokeSet.has(k)) {
        ctx.strokeStyle = PALETTE.choke;
        ctx.lineWidth = Math.max(1, cell * 0.12);
        ctx.strokeRect(x * cell + gap + 1, y * cell + gap + 1, cell - gap - 2, cell - gap - 2);
      }
    }
  }
}

function renderStats(map: ProceduralMapResult): void {
  const s = map.stats;
  const stat = (label: string, value: string): string =>
    `<div class="stat"><span class="lbl">${label}</span><span class="num">${value}</span></div>`;
  el('stats').innerHTML =
    stat('Walls', `${s.walls}`) +
    stat('Half-cover', `${s.halfCovers}`) +
    stat('Obstacle %', `${(s.obstacleFraction * 100).toFixed(1)}%`) +
    stat('Water', `${s.water}`) +
    stat('Chokepoints', `${s.chokepoints}`) +
    stat('Connected', s.connected ? '✓' : '✗') +
    stat('Carved', `${s.carved}`);
}

let seed = Date.now() >>> 0;

function mainCellSize(W: number, H: number): number {
  return Math.max(8, Math.floor(560 / Math.max(W, H)));
}

function rerenderMain(): void {
  el('seed-val').textContent = String(seed);
  const W = numVal('width');
  const H = numVal('height');
  const { map, params } = buildMap(seed, W, H);
  if (fromConfig()) reflectParams(params); // show what this seed rolled
  render(el<HTMLCanvasElement>('main-canvas'), map, mainCellSize(W, H), true);
  renderStats(map);
  renderThumbs(W, H);
}

function renderThumbs(W: number, H: number): void {
  const host = el('thumbs');
  host.innerHTML = '';
  for (let k = 1; k <= 8; k++) {
    const thumbSeed = (seed + k * 0x9e3779b1) >>> 0;
    const { map } = buildMap(thumbSeed, W, H);
    const canvas = document.createElement('canvas');
    const cell = Math.max(4, Math.floor(150 / Math.max(W, H)));
    render(canvas, map, cell, false);
    canvas.className = 'thumb';
    canvas.title = `seed ${thumbSeed} — load`;
    canvas.addEventListener('click', () => {
      seed = thumbSeed;
      rerenderMain();
    });
    host.appendChild(canvas);
  }
}

function syncSliderLabels(): void {
  for (const id of SLIDERS) {
    const out = document.getElementById(`${id}-o`);
    if (out) out.textContent = (el<HTMLInputElement>(id)).value;
  }
}

/** Disable the knob controls in config mode (they become a read-only readout of
 *  the sampled values); width/height/seed stay live. */
function syncControlsEnabled(): void {
  const disabled = fromConfig();
  for (const id of [...SLIDERS, 'symmetry']) {
    (el<HTMLInputElement | HTMLSelectElement>(id)).disabled = disabled;
  }
}

function init(): void {
  syncSliderLabels();
  syncControlsEnabled();
  // Any knob change re-renders with the current seed (manual mode only).
  const ids = ['width', 'height', 'symmetry', ...SLIDERS];
  for (const id of ids) {
    el(id).addEventListener('input', () => {
      syncSliderLabels();
      rerenderMain();
    });
  }
  el('fromConfig').addEventListener('change', () => {
    syncControlsEnabled();
    rerenderMain();
  });
  el('reroll').addEventListener('click', () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    rerenderMain();
  });
  rerenderMain();
}

init();
