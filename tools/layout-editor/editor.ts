/**
 * Layout editor (C1d.B + D3 + D5.D). Standalone Vite page — visit
 * http://localhost:5173/tools/layout-editor/ after `npm run dev`. Not
 * included in the production build (no entry in vite.config.ts's
 * rollupOptions.input).
 *
 * Paints terrain + neutral units + spawn regions onto a rectangular
 * arena and exports a JSON snippet shaped like one entry of
 * `config/layouts.json`.
 *
 * D5.D.A — layer system. Three radio-toggle layers: terrain (water),
 * neutral units (walls), spawn regions (D5.D.B adds painting). Only
 * the active layer accepts edits; other layers render dimmed so the
 * author still sees overall composition. Left-click paints the active
 * layer's primary kind; right-click erases the active layer's content
 * at the cell. Shift+click is retired — the active-layer radio replaces
 * it as the kind picker. The pre-D5 reserved-row diagonal-stripe
 * overlay is retired with this commit (the D5 schema's `SpawnRegion[]`
 * is the canonical spawn reservation now).
 *
 * D5.D.A also auto-populates the exported `spawns` field with two
 * `availability: 'both'` 8-tile bands on the top + bottom edges, so a
 * new layout authored before D5.D.B's painting UI lands still validates
 * at module load. Loaded layouts preserve their authored spawns through
 * the round trip.
 *
 * D3 — variable map sizes. Width and Height dropdowns (8–32 each)
 * rebuild the DOM grid in place; cells that still fit are preserved
 * and any wall/water outside the new bounds is dropped (with a
 * validation warning so the author notices).
 *
 * Output is export-only: the editor prints the JSON to a textarea with
 * Copy + Download buttons; the author pastes it into
 * config/layouts.json by hand. Avoids the Vite-middleware complexity of
 * direct-write (decision recorded in ROADMAP C1d).
 *
 * Shares the schema, palette, and terrain-config knobs with the game
 * code via relative imports — same source of truth, no drift.
 */

import './editor.css';
import {
  LAYOUTS,
  LAYOUT_MIN_SIDE,
  LAYOUT_MAX_SIDE,
  SPAWN_REGION_TILE_COUNT,
  type LayoutDef,
  type SpawnRegion,
} from '../../src/config/layouts';

type Cell = 'floor' | 'wall' | 'water';
type Layer = 'terrain' | 'neutral-units' | 'spawn-regions';

interface Coord {
  readonly x: number;
  readonly y: number;
}

const DEFAULT_SIDE = 12;

let gridW = DEFAULT_SIDE;
let gridH = DEFAULT_SIDE;
let grid: Cell[][] = makeEmptyGrid(gridW, gridH);
let cellEls: HTMLDivElement[][] = [];
let activeLayer: Layer = 'terrain';
/** Spawn regions for export. D5.D.A: initialized + reset to the
 *  procedural default (two top/bottom 'both' bands); loaded layouts
 *  populate from their JSON. D5.D.B will add a painting UI that
 *  mutates this state directly. */
let spawns: SpawnRegion[] = defaultSpawns(gridW, gridH);
/** Number of cells dropped on the most recent resize. Surfaced as a
 *  validation warning so the author doesn't lose paint silently. */
let lastClipCount = 0;

function makeEmptyGrid(w: number, h: number): Cell[][] {
  const g: Cell[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < w; x++) row.push('floor');
    g.push(row);
  }
  return g;
}

const gridEl = mustQuery<HTMLDivElement>('#grid');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const metaIdEl = mustQuery<HTMLInputElement>('#meta-id');
const metaNameEl = mustQuery<HTMLInputElement>('#meta-name');
const metaDescriptionEl = mustQuery<HTMLTextAreaElement>('#meta-description');
const loadSelectEl = mustQuery<HTMLSelectElement>('#load-select');
const loadBtn = mustQuery<HTMLButtonElement>('#load-btn');
const clearBtn = mustQuery<HTMLButtonElement>('#clear-btn');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');
const gridWSelectEl = mustQuery<HTMLSelectElement>('#grid-w');
const gridHSelectEl = mustQuery<HTMLSelectElement>('#grid-h');
const layerRadioEls = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="layer"]'),
);

populateSizeSelects();
buildGrid();
populateLoadSelect();
attachMetaWatchers();
attachToolButtons();
attachSizeWatchers();
attachLayerWatchers();
window.addEventListener('mouseup', endStroke);
// Re-fit the grid when the viewport changes so cells keep filling the
// available pane width. Throttled to a rAF so resize spam doesn't
// rebuild on every event.
let resizePending = false;
window.addEventListener('resize', () => {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => {
    resizePending = false;
    buildGrid();
    refreshGrid();
  });
});
refreshAll();

function populateSizeSelects(): void {
  for (let s = LAYOUT_MIN_SIDE; s <= LAYOUT_MAX_SIDE; s++) {
    const optW = document.createElement('option');
    optW.value = String(s);
    optW.textContent = String(s);
    if (s === gridW) optW.selected = true;
    gridWSelectEl.appendChild(optW);

    const optH = document.createElement('option');
    optH.value = String(s);
    optH.textContent = String(s);
    if (s === gridH) optH.selected = true;
    gridHSelectEl.appendChild(optH);
  }
}

/**
 * Build (or rebuild) the DOM grid for the current `gridW × gridH`.
 * Replaces all children of `#grid` and rebinds the per-cell mouse
 * handlers. The grid is sized to take roughly half of the viewport
 * horizontally; tall grids squish vertically so the whole grid fits
 * without scrolling. Cells are square in the common case (when the
 * height-fit would let them be), and stretched to a flatter
 * rectangle when the height budget is tight — the alternative was
 * shrinking the whole grid to keep cells square, which made tall
 * layouts unusably tiny on the canvas.
 */
function buildGrid(): void {
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${gridW}, 1fr)`;
  gridEl.style.gridTemplateRows = `repeat(${gridH}, 1fr)`;
  // Horizontal: 50% of viewport width across the grid, clamped to the
  // grid-pane column so a narrow window doesn't blow out the layout.
  const pane = gridEl.parentElement!;
  const targetGridW = Math.min(window.innerWidth * 0.5, pane.clientWidth);
  const cellW = Math.max(8, Math.floor(targetGridW / gridW));
  // Vertical: the viewport minus a budget for the page chrome (header,
  // size-row, legend, padding). If the natural square height (gridH
  // × cellW) fits in that budget, keep cells square; otherwise squish
  // the row height to fit. Minimum 6px so cells stay clickable on
  // extreme tall grids.
  const availH = Math.max(120, window.innerHeight - 220);
  const cellH = Math.max(6, Math.min(cellW, Math.floor(availH / gridH)));
  gridEl.style.width = `${gridW * cellW}px`;
  gridEl.style.height = `${gridH * cellH}px`;

  cellEls = [];
  for (let y = 0; y < gridH; y++) {
    const rowEls: HTMLDivElement[] = [];
    for (let x = 0; x < gridW; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('mousedown', (e) => onCellMouseDown(e, { x, y }));
      cell.addEventListener('mouseenter', () => onCellMouseEnter({ x, y }));
      cell.addEventListener('contextmenu', (e) => e.preventDefault());
      gridEl.appendChild(cell);
      rowEls.push(cell);
    }
    cellEls.push(rowEls);
  }
}

/**
 * Resize the underlying `grid` array to match `gridW × gridH`. Cells
 * outside the new bounds are dropped; cells inside keep their kind.
 * Returns the count of dropped non-floor cells so the validation can
 * flag a clip. Spawn regions reset to the procedural default since
 * the prior tiles may now be out of bounds.
 */
function resizeGridData(newW: number, newH: number): number {
  let clipped = 0;
  const next: Cell[][] = [];
  for (let y = 0; y < newH; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < newW; x++) {
      const existing = y < grid.length && x < grid[y]!.length ? grid[y]![x]! : 'floor';
      row.push(existing);
    }
    next.push(row);
  }
  // Count any non-floor cell that USED to exist but is now outside the
  // new bounds.
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y]!.length; x++) {
      if ((y >= newH || x >= newW) && grid[y]![x] !== 'floor') clipped++;
    }
  }
  grid = next;
  gridW = newW;
  gridH = newH;
  // Spawn regions are tied to specific tiles + the arena's dimensions;
  // resizing may push them out of bounds. Reset to the procedural
  // default so the export stays valid. D5.D.B will refine — keep
  // painted regions that still fit, drop ones that don't, with a clip
  // warning of their own.
  spawns = defaultSpawns(gridW, gridH);
  return clipped;
}

/**
 * The procedural-default spawn region pair: two `availability: 'both'`
 * bands on the literal top + bottom edges (y=0 and y=gridH-1), each
 * `SPAWN_REGION_TILE_COUNT` (8) tiles wide and centered horizontally.
 * Mirrors `defaultProceduralSpawnRegions` in `src/sim/terrainGen.ts`.
 * Both code paths produce identical output for the same dimensions —
 * intentional duplication so the editor stays self-contained.
 */
function defaultSpawns(w: number, h: number): SpawnRegion[] {
  if (w < SPAWN_REGION_TILE_COUNT || h < 2) {
    // Min grid side is 8 (LAYOUT_MIN_SIDE), so this branch is
    // unreachable in practice — guard kept for the same defensive
    // reason as the sim-side helper.
    return [];
  }
  const xStart = Math.floor((w - SPAWN_REGION_TILE_COUNT) / 2);
  const topTiles: Coord[] = [];
  const bottomTiles: Coord[] = [];
  for (let i = 0; i < SPAWN_REGION_TILE_COUNT; i++) {
    topTiles.push({ x: xStart + i, y: 0 });
    bottomTiles.push({ x: xStart + i, y: h - 1 });
  }
  return [
    { tiles: topTiles, availability: 'both' },
    { tiles: bottomTiles, availability: 'both' },
  ];
}

// ---- Drag-paint stroke (D2 + D5.D.A) ----
//
// A stroke runs from a mousedown on a cell to the next global mouseup.
// The stroke's kind is fixed at mousedown from the (active layer,
// mouse button) pair: left-click paints the active layer's primary
// kind (terrain → water, neutral units → wall); right-click erases the
// active layer's content at the cell. Spawn-regions painting lands in
// D5.D.B — for now the layer accepts no input.
//
// Validation + JSON export refresh once per stroke (on mouseup), not
// per cell — keeps the export panel from flickering during a drag and
// matches the roadmap's "stroke determinism" note.
type StrokeKind = 'paint-wall' | 'paint-water' | 'erase-wall' | 'erase-water' | 'noop';

let activeStroke: StrokeKind | null = null;
let strokeDirty = false;
const strokeAppliedCells = new Set<string>();

function onCellMouseDown(e: MouseEvent, c: Coord): void {
  e.preventDefault();
  activeStroke = strokeFromMouseEvent(e);
  strokeDirty = false;
  strokeAppliedCells.clear();
  applyStrokeTo(c);
}

function onCellMouseEnter(c: Coord): void {
  if (activeStroke !== null) applyStrokeTo(c);
}

function endStroke(): void {
  if (activeStroke === null) return;
  activeStroke = null;
  strokeAppliedCells.clear();
  if (strokeDirty) {
    refreshValidation();
    refreshExport();
    strokeDirty = false;
  }
}

function strokeFromMouseEvent(e: MouseEvent): StrokeKind {
  // D5.D.A: the active layer + mouse button uniquely determine the
  // stroke kind. Shift+click is retired — the layer radio is the kind
  // picker now.
  const erasing = e.button === 2;
  switch (activeLayer) {
    case 'terrain':
      return erasing ? 'erase-water' : 'paint-water';
    case 'neutral-units':
      return erasing ? 'erase-wall' : 'paint-wall';
    case 'spawn-regions':
      // D5.D.B will replace this with the per-region paint/erase flow.
      return 'noop';
  }
}

function applyStrokeTo(c: Coord): void {
  if (activeStroke === null || activeStroke === 'noop') return;
  const key = `${c.x},${c.y}`;
  if (strokeAppliedCells.has(key)) return;
  strokeAppliedCells.add(key);

  const current = grid[c.y]![c.x]!;
  // Each stroke kind only touches its layer's content: erase-water
  // leaves walls alone, paint-wall over a water cell wins (cell kinds
  // are still mutex — the layer system is a UX overlay, not a multi-
  // layer per-cell data model in D5.D).
  let next: Cell | null = null;
  switch (activeStroke) {
    case 'paint-water':
      next = 'water';
      break;
    case 'paint-wall':
      next = 'wall';
      break;
    case 'erase-water':
      if (current === 'water') next = 'floor';
      break;
    case 'erase-wall':
      if (current === 'wall') next = 'floor';
      break;
  }
  if (next === null || next === current) return;
  grid[c.y]![c.x] = next;
  strokeDirty = true;
  refreshCell(c);
}

function refreshCell(c: Coord): void {
  const el = cellEls[c.y]![c.x]!;
  const value = grid[c.y]![c.x]!;
  el.classList.remove('wall', 'water', 'invalid');
  if (value === 'wall') el.classList.add('wall');
  if (value === 'water') el.classList.add('water');
}

function refreshGrid(): void {
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) refreshCell({ x, y });
  }
}

function collectCells(kind: Exclude<Cell, 'floor'>): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (grid[y]![x] === kind) out.push({ x, y });
    }
  }
  return out;
}

interface ValidationItem {
  readonly level: 'ok' | 'warn' | 'error';
  readonly text: string;
}

function validate(): ValidationItem[] {
  const items: ValidationItem[] = [];
  const walls = collectCells('wall');
  const water = collectCells('water');

  if (walls.length === 0 && water.length === 0) {
    items.push({ level: 'ok', text: 'Empty grid — paint something.' });
  }

  if (lastClipCount > 0) {
    items.push({
      level: 'warn',
      text: `${lastClipCount} cell(s) dropped on resize — outside the new ${gridW}×${gridH} bounds.`,
    });
  }

  if (!metaIdEl.value.trim()) {
    items.push({ level: 'warn', text: 'Missing id — required.' });
  } else if (!/^[a-z0-9_-]+$/i.test(metaIdEl.value.trim())) {
    items.push({
      level: 'warn',
      text: 'id should be a short slug (letters, digits, underscore, hyphen).',
    });
  } else if (
    LAYOUTS.some((l) => l.id === metaIdEl.value.trim())
  ) {
    items.push({
      level: 'warn',
      text: `id "${metaIdEl.value.trim()}" already exists in config — append-only, pick a new id or overwrite the existing entry manually.`,
    });
  }

  if (!metaNameEl.value.trim()) {
    items.push({ level: 'warn', text: 'Missing name — required.' });
  }
  if (!metaDescriptionEl.value.trim()) {
    items.push({ level: 'warn', text: 'Missing description — required.' });
  }

  // D5.D.A: spawn regions checked against walls + water for overlap.
  // The painting UI (D5.D.B) enforces the 8-tile-per-region cap +
  // valid-pair rule live; for now the auto-default + loaded-layout
  // paths both produce schema-valid spawns, so this only flags
  // unexpected drift (e.g. a load-time overlap that resize didn't
  // catch).
  const blockedSet = new Set<string>();
  for (const w of walls) blockedSet.add(`${w.x},${w.y}`);
  for (const w of water) blockedSet.add(`${w.x},${w.y}`);
  let spawnOverlap = 0;
  for (const region of spawns) {
    for (const t of region.tiles) {
      if (blockedSet.has(`${t.x},${t.y}`)) spawnOverlap++;
    }
  }
  if (spawnOverlap > 0) {
    items.push({
      level: 'error',
      text: `${spawnOverlap} spawn tile(s) overlap walls or water — paint to move them.`,
    });
  }

  if (!isConnected(walls)) {
    items.push({
      level: 'error',
      text: 'Spawn regions are severed — no path between the first two spawn regions.',
    });
  }

  if (items.length === 0 || items.every((i) => i.level === 'ok')) {
    items.push({
      level: 'ok',
      text: `Looks good — ${walls.length} wall(s), ${water.length} water cell(s), ${spawns.length} spawn region(s) on ${gridW}×${gridH}.`,
    });
  }
  return items;
}

function refreshValidation(): void {
  const items = validate();
  validationEl.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.className = item.level;
    li.textContent = item.text;
    validationEl.appendChild(li);
  }
}

/**
 * BFS reachability between the first two spawn regions' centroids.
 * Mirrors `openCutsUntilConnected` in `src/sim/terrainGen.ts` — same
 * king's-move neighborhood as Pathfinding, walls as the only blockers
 * (water is passable, just slow). Returns true when there are fewer
 * than two regions; the schema requires ≥2, so that branch only fires
 * on a transient editor state, never on exported JSON.
 */
function isConnected(walls: readonly Coord[]): boolean {
  if (spawns.length < 2) return true;
  const start = centroidOf(spawns[0]!);
  const goal = centroidOf(spawns[1]!);

  const blocked = new Set<string>();
  for (const w of walls) blocked.add(`${w.x},${w.y}`);
  if (blocked.has(`${goal.x},${goal.y}`)) return false;
  if (blocked.has(`${start.x},${start.y}`)) return false;

  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue: Coord[] = [start];
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (c.x === goal.x && c.y === goal.y) return true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key) || blocked.has(key)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

function centroidOf(region: SpawnRegion): Coord {
  let sx = 0;
  let sy = 0;
  for (const t of region.tiles) {
    sx += t.x;
    sy += t.y;
  }
  return {
    x: Math.round(sx / region.tiles.length),
    y: Math.round(sy / region.tiles.length),
  };
}

function refreshExport(): void {
  const walls = collectCells('wall');
  const water = collectCells('water');
  const payload: LayoutDef = {
    id: metaIdEl.value.trim() || 'unnamed',
    name: metaNameEl.value.trim() || 'Unnamed',
    description: metaDescriptionEl.value.trim() || 'TODO: describe this layout.',
    gridW,
    gridH,
    walls,
    spawns,
  };
  if (water.length > 0) payload.water = water;
  exportEl.value = formatLayoutJson(payload);
}

/**
 * Match the indentation of `config/layouts.json` so a paste keeps the
 * file readable. `JSON.stringify(_, null, 2)` puts every coord on its
 * own line; we collapse coord objects to one line each, and emit each
 * spawn region as a one-line `availability` header followed by its
 * tiles array.
 */
function formatLayoutJson(layout: LayoutDef): string {
  const parts: string[] = [];
  parts.push('{');
  parts.push(`  "id": ${JSON.stringify(layout.id)},`);
  parts.push(`  "name": ${JSON.stringify(layout.name)},`);
  parts.push(`  "description": ${JSON.stringify(layout.description)},`);
  parts.push(`  "gridW": ${layout.gridW},`);
  parts.push(`  "gridH": ${layout.gridH},`);
  parts.push(`  "walls": [`);
  parts.push(...formatCoords(layout.walls));
  parts.push(`  ],`);
  if (layout.water && layout.water.length > 0) {
    parts.push(`  "water": [`);
    parts.push(...formatCoords(layout.water));
    parts.push(`  ],`);
  }
  parts.push(`  "spawns": [`);
  layout.spawns.forEach((region, i) => {
    const sep = i === layout.spawns.length - 1 ? '' : ',';
    parts.push(`    {`);
    parts.push(`      "availability": ${JSON.stringify(region.availability)},`);
    parts.push(`      "tiles": [`);
    parts.push(...region.tiles.map((c, j) => {
      const tileSep = j === region.tiles.length - 1 ? '' : ',';
      return `        { "x": ${c.x}, "y": ${c.y} }${tileSep}`;
    }));
    parts.push(`      ]`);
    parts.push(`    }${sep}`);
  });
  parts.push(`  ]`);
  parts.push('}');
  return parts.join('\n');
}

function formatCoords(coords: readonly Coord[]): string[] {
  return coords.map((c, i) => {
    const sep = i === coords.length - 1 ? '' : ',';
    return `    { "x": ${c.x}, "y": ${c.y} }${sep}`;
  });
}

function refreshAll(): void {
  refreshGrid();
  refreshValidation();
  refreshExport();
}

function populateLoadSelect(): void {
  for (const layout of LAYOUTS) {
    const opt = document.createElement('option');
    opt.value = layout.id;
    opt.textContent = `${layout.name} (${layout.id} · ${layout.gridW}×${layout.gridH})`;
    loadSelectEl.appendChild(opt);
  }
}

function loadLayout(id: string): void {
  const found = LAYOUTS.find((l) => l.id === id);
  if (!found) return;
  gridW = found.gridW;
  gridH = found.gridH;
  grid = makeEmptyGrid(gridW, gridH);
  for (const w of found.walls) grid[w.y]![w.x] = 'wall';
  if (found.water) for (const w of found.water) grid[w.y]![w.x] = 'water';
  // Deep-copy spawns so live editing (D5.D.B) can't mutate the
  // canonical LAYOUTS array.
  spawns = found.spawns.map((r) => ({
    availability: r.availability,
    tiles: r.tiles.map((t) => ({ x: t.x, y: t.y })),
  }));
  metaIdEl.value = found.id;
  metaNameEl.value = found.name;
  metaDescriptionEl.value = found.description;
  gridWSelectEl.value = String(gridW);
  gridHSelectEl.value = String(gridH);
  lastClipCount = 0;
  buildGrid();
  refreshAll();
}

function clearGrid(): void {
  grid = makeEmptyGrid(gridW, gridH);
  spawns = defaultSpawns(gridW, gridH);
  lastClipCount = 0;
  refreshAll();
}

function attachMetaWatchers(): void {
  for (const el of [metaIdEl, metaNameEl, metaDescriptionEl]) {
    el.addEventListener('input', () => {
      refreshValidation();
      refreshExport();
    });
  }
}

function attachToolButtons(): void {
  loadBtn.addEventListener('click', () => loadLayout(loadSelectEl.value));
  clearBtn.addEventListener('click', () => clearGrid());
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(exportEl.value);
    flashButton(copyBtn, 'Copied!');
  });
  downloadBtn.addEventListener('click', () => {
    const id = metaIdEl.value.trim() || 'layout';
    const blob = new Blob([exportEl.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function attachSizeWatchers(): void {
  gridWSelectEl.addEventListener('change', onSizeChange);
  gridHSelectEl.addEventListener('change', onSizeChange);
}

function attachLayerWatchers(): void {
  for (const radio of layerRadioEls) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const value = radio.value as Layer;
      if (value === activeLayer) return;
      // Switching layer mid-stroke would orphan the in-progress paint
      // on the wrong layer — end the stroke synchronously, then swap.
      // Per the D5.D scope: "Can't switch mid-stroke" — we treat the
      // radio click as an implicit mouseup of the active stroke.
      if (activeStroke !== null) endStroke();
      activeLayer = value;
      gridEl.dataset.activeLayer = value;
    });
  }
}

function onSizeChange(): void {
  const newW = Number(gridWSelectEl.value);
  const newH = Number(gridHSelectEl.value);
  if (!Number.isFinite(newW) || !Number.isFinite(newH)) return;
  if (newW === gridW && newH === gridH) return;
  lastClipCount = resizeGridData(newW, newH);
  buildGrid();
  refreshAll();
}

function flashButton(btn: HTMLButtonElement, label: string): void {
  const original = btn.textContent;
  btn.textContent = label;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 800);
}

function mustQuery<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`layout-editor: missing element "${selector}"`);
  return el;
}
