/**
 * Layout editor (C1d.B). Standalone Vite page — visit
 * http://localhost:5173/tools/layout-editor/ after `npm run dev`. Not
 * included in the production build (no entry in vite.config.ts's
 * rollupOptions.input).
 *
 * Paints walls + water onto a 12x12 grid, validates against the same
 * invariants the layouts.test.ts suite enforces (in-bounds, no
 * duplicates, spawn-row reservation, spawn-row connectivity), and
 * exports a JSON snippet shaped like one entry of `config/layouts.json`.
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
import { LAYOUTS, type LayoutDef } from '../../src/config/layouts';
import { TERRAIN } from '../../src/config/terrain';

const GRID_SIZE = 12;
const RESERVED_ROWS: ReadonlySet<number> = new Set(TERRAIN.spawnRowsClear);

type Cell = 'floor' | 'wall' | 'water';

interface Coord {
  readonly x: number;
  readonly y: number;
}

const grid: Cell[][] = makeEmptyGrid();

const cellEls: HTMLDivElement[][] = [];

function makeEmptyGrid(): Cell[][] {
  const g: Cell[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < GRID_SIZE; x++) row.push('floor');
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

buildGrid();
populateLoadSelect();
attachMetaWatchers();
attachToolButtons();
refreshAll();

function buildGrid(): void {
  for (let y = 0; y < GRID_SIZE; y++) {
    const rowEls: HTMLDivElement[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
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
  // Stroke commits on the global mouseup so dragging off-grid (or into a
  // gutter between cells) still ends the stroke cleanly.
  window.addEventListener('mouseup', endStroke);
}

// ---- Drag-paint stroke (D2) ----
//
// A stroke runs from a mousedown on a cell to the next global mouseup.
// The stroke's kind is fixed at mousedown — left paints wall, shift+left
// paints water, right erases (clears the active layer's content at the
// crossed cell, which today means setting it back to floor). The kind
// applies to every cell the cursor crosses for the rest of the stroke.
//
// Validation + JSON export refresh once per stroke (on mouseup), not
// per cell — keeps the export panel from flickering during a drag and
// matches the roadmap's "stroke determinism" note.
type StrokeKind = 'paint-wall' | 'paint-water' | 'erase';

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
  if (e.button === 2) return 'erase';
  if (e.shiftKey) return 'paint-water';
  return 'paint-wall';
}

function applyStrokeTo(c: Coord): void {
  if (activeStroke === null) return;
  const key = `${c.x},${c.y}`;
  if (strokeAppliedCells.has(key)) return;
  strokeAppliedCells.add(key);

  const target: Cell =
    activeStroke === 'erase' ? 'floor' : activeStroke === 'paint-water' ? 'water' : 'wall';
  if (grid[c.y]![c.x] === target) return;
  grid[c.y]![c.x] = target;
  strokeDirty = true;
  refreshCell(c);
}

function refreshCell(c: Coord): void {
  const el = cellEls[c.y]![c.x]!;
  const value = grid[c.y]![c.x]!;
  el.classList.remove('wall', 'water', 'spawn', 'invalid');
  if (RESERVED_ROWS.has(c.y) && value === 'floor') el.classList.add('spawn');
  if (value === 'wall') el.classList.add('wall');
  if (value === 'water') el.classList.add('water');
  if (RESERVED_ROWS.has(c.y) && value !== 'floor') el.classList.add('invalid');
}

function refreshGrid(): void {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) refreshCell({ x, y });
  }
}

function collectCells(kind: Exclude<Cell, 'floor'>): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
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

  const spawnViolations = [...walls, ...water].filter((c) => RESERVED_ROWS.has(c.y));
  if (spawnViolations.length > 0) {
    items.push({
      level: 'error',
      text: `${spawnViolations.length} cell(s) on reserved spawn rows — units spawn there and would conflict.`,
    });
  }

  if (!isConnected(walls)) {
    items.push({
      level: 'error',
      text: 'Spawn rows are severed — no path between the top spawn rows and the bottom spawn rows.',
    });
  }

  if (items.length === 0 || items.every((i) => i.level === 'ok')) {
    items.push({
      level: 'ok',
      text: `Looks good — ${walls.length} wall(s), ${water.length} water cell(s).`,
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
 * BFS reachability between the topmost reserved spawn row and the
 * bottommost. Mirrors `layouts.test.ts`'s `hasPathThrough` — same
 * king's-move neighborhood as Pathfinding, walls as the only blockers
 * (water is passable, just slow).
 */
function isConnected(walls: readonly Coord[]): boolean {
  const reserved = [...RESERVED_ROWS].sort((a, b) => a - b);
  if (reserved.length < 2) return true;
  const topRow = reserved[0]!;
  const bottomRow = reserved[reserved.length - 1]!;
  const center = Math.floor(GRID_SIZE / 2);
  const start = { x: center, y: topRow };
  const goal = { x: center, y: bottomRow };

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
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key) || blocked.has(key)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

function refreshExport(): void {
  const walls = collectCells('wall');
  const water = collectCells('water');
  const payload: Partial<LayoutDef> = {
    id: metaIdEl.value.trim() || 'unnamed',
    name: metaNameEl.value.trim() || 'Unnamed',
    description: metaDescriptionEl.value.trim() || 'TODO: describe this layout.',
    walls,
  };
  if (water.length > 0) (payload as { water?: Coord[] }).water = water;
  exportEl.value = formatLayoutJson(payload as LayoutDef);
}

/**
 * Match the indentation of `config/layouts.json` so a paste keeps the
 * file readable. `JSON.stringify(_, null, 2)` puts every coord on its
 * own line; we collapse coord objects to one line each.
 */
function formatLayoutJson(layout: LayoutDef): string {
  const parts: string[] = [];
  parts.push('{');
  parts.push(`  "id": ${JSON.stringify(layout.id)},`);
  parts.push(`  "name": ${JSON.stringify(layout.name)},`);
  parts.push(`  "description": ${JSON.stringify(layout.description)},`);
  parts.push(`  "walls": [`);
  parts.push(...formatCoords(layout.walls));
  const hasWater = layout.water && layout.water.length > 0;
  parts.push(`  ]${hasWater ? ',' : ''}`);
  if (hasWater) {
    parts.push(`  "water": [`);
    parts.push(...formatCoords(layout.water!));
    parts.push(`  ]`);
  }
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
    opt.textContent = `${layout.name} (${layout.id})`;
    loadSelectEl.appendChild(opt);
  }
}

function loadLayout(id: string): void {
  const found = LAYOUTS.find((l) => l.id === id);
  if (!found) return;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) grid[y]![x] = 'floor';
  }
  for (const w of found.walls) grid[w.y]![w.x] = 'wall';
  if (found.water) for (const w of found.water) grid[w.y]![w.x] = 'water';
  metaIdEl.value = found.id;
  metaNameEl.value = found.name;
  metaDescriptionEl.value = found.description;
  refreshAll();
}

function clearGrid(): void {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) grid[y]![x] = 'floor';
  }
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
