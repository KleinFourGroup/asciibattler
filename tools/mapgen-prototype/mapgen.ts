/**
 * Map-Gen Prototype tool (M6 follow-up). Wires the control panel to
 * `generateMap` and renders the result to a canvas + a variety strip.
 * Dev-only, eyeball-tuned; visit http://localhost:5173/tools/mapgen-prototype/
 * (or the dev-preview port). See `generator.ts` for the algorithm + the port
 * plan into `src/sim/`.
 */

import { generateMap, type MapGenConfig, type GeneratedProtoMap } from './generator';

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

const SLIDERS = [
  'crossbars',
  'gapsPerBar',
  'gapWidth',
  'fordChance',
  'crossbarWaver',
  'dividers',
  'coverDensity',
  'halfCoverFraction',
  'poolDensity',
  'noiseScale',
  'wallCapFraction',
];

function readConfig(seed: number): MapGenConfig {
  return {
    width: numVal('width'),
    height: numVal('height'),
    seed,
    symmetry: (el<HTMLSelectElement>('symmetry')).value as MapGenConfig['symmetry'],
    crossbars: numVal('crossbars'),
    gapsPerBar: numVal('gapsPerBar'),
    gapWidth: numVal('gapWidth'),
    fordChance: numVal('fordChance'),
    crossbarWaver: numVal('crossbarWaver'),
    dividers: numVal('dividers'),
    coverDensity: numVal('coverDensity'),
    halfCoverFraction: numVal('halfCoverFraction'),
    poolDensity: numVal('poolDensity'),
    noiseScale: numVal('noiseScale'),
    wallCapFraction: numVal('wallCapFraction'),
  };
}

function render(canvas: HTMLCanvasElement, map: GeneratedProtoMap, cell: number, outline: boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = map.width;
  const H = map.height;
  canvas.width = W * cell;
  canvas.height = H * cell;

  const wallSet = new Set(map.walls.map((c) => `${c.x},${c.y}`));
  const halfSet = new Set(map.halfCovers.map((c) => `${c.x},${c.y}`));
  const spawnSet = new Set(
    [...map.spawnTop, ...map.spawnBottom].map((c) => `${c.x},${c.y}`),
  );
  const chokeSet = new Set(map.chokeCells.map((c) => `${c.x},${c.y}`));

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
      else if (!half && map.kinds[y]![x] === 'shallow_water') color = PALETTE.water;
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

function renderStats(map: GeneratedProtoMap): void {
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
  const cfg = readConfig(seed);
  const map = generateMap(cfg);
  render(el<HTMLCanvasElement>('main-canvas'), map, mainCellSize(cfg.width, cfg.height), true);
  renderStats(map);
  renderThumbs(cfg);
}

function renderThumbs(base: MapGenConfig): void {
  const host = el('thumbs');
  host.innerHTML = '';
  for (let k = 1; k <= 8; k++) {
    const thumbSeed = (seed + k * 0x9e3779b1) >>> 0;
    const map = generateMap({ ...base, seed: thumbSeed });
    const canvas = document.createElement('canvas');
    const cell = Math.max(4, Math.floor(150 / Math.max(map.width, map.height)));
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

function init(): void {
  syncSliderLabels();
  // Any control change re-renders with the current seed.
  const ids = ['width', 'height', 'symmetry', ...SLIDERS];
  for (const id of ids) {
    el(id).addEventListener('input', () => {
      syncSliderLabels();
      rerenderMain();
    });
  }
  el('reroll').addEventListener('click', () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    rerenderMain();
  });
  rerenderMain();
}

init();
