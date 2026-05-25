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
 * neutral units (walls), spawn regions. Only the active layer accepts
 * edits; other layers render dimmed so the author still sees overall
 * composition. Left-click paints the active layer's primary kind;
 * right-click erases the active layer's content at the cell.
 * Shift+click is retired — the active-layer radio replaces it as the
 * kind picker. The pre-D5 reserved-row diagonal-stripe overlay is
 * retired (the D5 schema's `SpawnRegion[]` is canonical now).
 *
 * D5.D.B — spawn-region painting. While on the spawn-regions layer,
 * left-click paints the cell into the *active region* (FIFO 8-tile
 * cap — a 9th paint evicts the oldest tile); right-click removes the
 * tile from the active region. Active region picked via a region
 * pill row; "+ Add region" appends a new empty region; "Delete
 * region" removes the active one (zod requires ≥2, so deletes
 * below 2 are blocked). Availability radio (player/enemy/both)
 * mutates the active region in place. Each region's color comes
 * from a fixed 4-color palette indexed by region position; multi-
 * region membership renders as corner-tag badges so overlap is
 * visible.
 *
 * D3 — variable map sizes. Width and Height dropdowns (8–32 each)
 * rebuild the DOM grid in place; cells that still fit are preserved
 * and any wall/water outside the new bounds is dropped (with a
 * validation warning so the author notices). Spawn regions reset to
 * the procedural default on resize since their tiles may now be out
 * of bounds.
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
  type SpawnAvailability,
  type SpawnRegion,
} from '../../src/config/layouts';

type Cell = 'floor' | 'wall' | 'water' | 'halfCover';
type Layer = 'terrain' | 'neutral-units' | 'spawn-regions';
/** D6: sub-tool within the neutral-units layer. The layer radio picks
 *  the layer; this radio picks which kind of neutral entity that
 *  layer paints. */
type NeutralKind = 'wall' | 'halfCover';

interface Coord {
  readonly x: number;
  readonly y: number;
}

/** zod requires this many spawn regions at minimum (see
 *  LayoutSchema). Deletes that would drop below it are blocked in
 *  the UI rather than allowed-then-flagged. */
const MIN_SPAWN_REGIONS = 2;
/** Per-region color palette index. Multi-region overlap renders by
 *  region position MOD this count; layouts in practice have ≤4. */
const REGION_COLOR_COUNT = 4;

const DEFAULT_SIDE = 12;

let gridW = DEFAULT_SIDE;
let gridH = DEFAULT_SIDE;
let grid: Cell[][] = makeEmptyGrid(gridW, gridH);
let cellEls: HTMLDivElement[][] = [];
let activeLayer: Layer = 'terrain';
let activeNeutralKind: NeutralKind = 'wall';
/** Spawn regions for export. D5.D.A: initialized + reset to the
 *  procedural default (two top/bottom 'both' bands); loaded layouts
 *  populate from their JSON. D5.D.B: painting + add/delete + the
 *  availability radio all mutate this array in place. */
let spawns: SpawnRegion[] = defaultSpawns(gridW, gridH);
let activeRegionIdx = 0;
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
const neutralRowEl = mustQuery<HTMLDivElement>('#neutral-row');
const neutralKindRadioEls = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="neutral-kind"]'),
);
const regionRowEl = mustQuery<HTMLDivElement>('#region-row');
const regionPickerEl = mustQuery<HTMLDivElement>('#region-picker');
const availabilityRadioEls = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="availability"]'),
);
const addRegionBtn = mustQuery<HTMLButtonElement>('#add-region-btn');
const deleteRegionBtn = mustQuery<HTMLButtonElement>('#delete-region-btn');

populateSizeSelects();
buildGrid();
populateLoadSelect();
attachMetaWatchers();
attachToolButtons();
attachSizeWatchers();
attachLayerWatchers();
attachNeutralKindWatchers();
attachRegionControls();
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
 *
 * **Y-axis convention** — rows are appended in reverse y order so
 * y=0 lands at the BOTTOM of the CSS grid (last-appended →
 * bottom row under `grid-auto-flow: row`). This matches the game's
 * bottom-left origin: `gridToWorld` in BattleRenderer.ts maps
 * cell.y=0 to +Z (the camera-near edge of the frame), so an
 * asymmetric layout painted with y=0 at the visual bottom of the
 * editor renders the same way in-game. Pre-fix, asymmetric
 * layouts (river, anything off-center) appeared vertically
 * mirrored between editor and game.
 *
 * `cellEls[y][x]` stays indexed normally so click handlers + cell
 * lookups don't have to know about the DOM order.
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

  // Pre-allocate cellEls so we can index by [y][x] normally while
  // appending DOM children in reverse y order (see docstring).
  cellEls = [];
  for (let y = 0; y < gridH; y++) cellEls.push([] as HTMLDivElement[]);

  for (let y = gridH - 1; y >= 0; y--) {
    for (let x = 0; x < gridW; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener('mousedown', (e) => onCellMouseDown(e, { x, y }));
      cell.addEventListener('mouseenter', () => onCellMouseEnter({ x, y }));
      cell.addEventListener('contextmenu', (e) => e.preventDefault());
      gridEl.appendChild(cell);
      cellEls[y]!.push(cell);
    }
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
  // default so the export stays valid. (Possible refinement later:
  // keep painted regions that still fit, drop ones that don't, with
  // a clip warning of their own — not in D5.D scope.)
  spawns = defaultSpawns(gridW, gridH);
  activeRegionIdx = 0;
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

// ---- Drag-paint stroke (D2 + D5.D.A + D5.D.B) ----
//
// A stroke runs from a mousedown on a cell to the next global mouseup.
// The stroke's kind is fixed at mousedown from the (active layer,
// mouse button) pair: left-click paints the active layer's primary
// kind (terrain → water, neutral units → wall, spawn-regions → tile
// into the active region with FIFO 8-cap); right-click erases the
// active layer's content at the cell.
//
// Validation + JSON export refresh once per stroke (on mouseup), not
// per cell — keeps the export panel from flickering during a drag and
// matches the roadmap's "stroke determinism" note.
type StrokeKind =
  | 'paint-wall'
  | 'paint-halfCover'
  | 'paint-water'
  | 'erase-wall'
  | 'erase-halfCover'
  | 'erase-water'
  | 'paint-region'
  | 'erase-region'
  | 'noop';

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
  //
  // D6: neutral-units layer further splits by `activeNeutralKind`
  // (wall vs halfCover). Erase respects the sub-tool too — erasing
  // while half-cover is selected only clears half-cover cells, leaving
  // walls untouched (mirrors the per-layer erase scope rule from
  // gotcha #65).
  const erasing = e.button === 2;
  switch (activeLayer) {
    case 'terrain':
      return erasing ? 'erase-water' : 'paint-water';
    case 'neutral-units':
      if (activeNeutralKind === 'halfCover') {
        return erasing ? 'erase-halfCover' : 'paint-halfCover';
      }
      return erasing ? 'erase-wall' : 'paint-wall';
    case 'spawn-regions':
      // No-op if there's no active region (deleted last, picker
      // empty). UI prevents going below MIN_SPAWN_REGIONS, so this
      // is defensive.
      if (!hasActiveRegion()) return 'noop';
      return erasing ? 'erase-region' : 'paint-region';
  }
}

function applyStrokeTo(c: Coord): void {
  if (activeStroke === null || activeStroke === 'noop') return;
  const key = `${c.x},${c.y}`;
  if (strokeAppliedCells.has(key)) return;
  strokeAppliedCells.add(key);

  switch (activeStroke) {
    case 'paint-water':
    case 'paint-wall':
    case 'paint-halfCover':
    case 'erase-water':
    case 'erase-wall':
    case 'erase-halfCover':
      applyTerrainStroke(c);
      return;
    case 'paint-region':
      applyPaintRegion(c);
      return;
    case 'erase-region':
      applyEraseRegion(c);
      return;
  }
}

function applyTerrainStroke(c: Coord): void {
  const current = grid[c.y]![c.x]!;
  // Each stroke kind only touches its layer's content: erase-water
  // leaves walls alone, paint-wall over a water cell wins (cell kinds
  // are still mutex — the layer system is a UX overlay, not a multi-
  // layer per-cell data model in D5.D). D6 extends the same rule to
  // half-cover: erase-halfCover leaves walls + water alone.
  let next: Cell | null = null;
  switch (activeStroke) {
    case 'paint-water':
      next = 'water';
      break;
    case 'paint-wall':
      next = 'wall';
      break;
    case 'paint-halfCover':
      next = 'halfCover';
      break;
    case 'erase-water':
      if (current === 'water') next = 'floor';
      break;
    case 'erase-wall':
      if (current === 'wall') next = 'floor';
      break;
    case 'erase-halfCover':
      if (current === 'halfCover') next = 'floor';
      break;
  }
  if (next === null || next === current) return;
  grid[c.y]![c.x] = next;
  strokeDirty = true;
  refreshCell(c);
}

function applyPaintRegion(c: Coord): void {
  const region = spawns[activeRegionIdx];
  if (!region) return;
  // Already in the region → no-op (don't FIFO-bump on re-paint over
  // a tile the active stroke already owns).
  if (region.tiles.some((t) => t.x === c.x && t.y === c.y)) return;
  region.tiles.push({ x: c.x, y: c.y });
  let evicted: Coord | null = null;
  if (region.tiles.length > SPAWN_REGION_TILE_COUNT) {
    evicted = region.tiles.shift() ?? null;
  }
  strokeDirty = true;
  refreshCell(c);
  if (evicted) refreshCell(evicted);
  // The pill's tile-count badge changes on every paint — refresh
  // mid-stroke so the author sees the cap-fill happen live, even
  // though the export panel waits until mouseup.
  refreshRegionPicker();
}

function applyEraseRegion(c: Coord): void {
  const region = spawns[activeRegionIdx];
  if (!region) return;
  const before = region.tiles.length;
  region.tiles = region.tiles.filter((t) => t.x !== c.x || t.y !== c.y);
  if (region.tiles.length === before) return;
  strokeDirty = true;
  refreshCell(c);
  refreshRegionPicker();
}

function hasActiveRegion(): boolean {
  return activeRegionIdx >= 0 && activeRegionIdx < spawns.length;
}

function refreshCell(c: Coord): void {
  const el = cellEls[c.y]![c.x]!;
  const value = grid[c.y]![c.x]!;
  el.classList.remove(
    'wall',
    'water',
    'halfCover',
    'invalid',
    'active-region-0',
    'active-region-1',
    'active-region-2',
    'active-region-3',
  );
  if (value === 'wall') el.classList.add('wall');
  if (value === 'water') el.classList.add('water');
  if (value === 'halfCover') el.classList.add('halfCover');

  // Tear down any prior region tags + outline. Rebuilt below based
  // on current spawns membership.
  for (const old of Array.from(el.querySelectorAll('.region-tag'))) old.remove();

  let activeMembership = -1;
  spawns.forEach((region, idx) => {
    if (!region.tiles.some((t) => t.x === c.x && t.y === c.y)) return;
    const tag = document.createElement('span');
    tag.className = 'region-tag';
    const colorBucket = idx % REGION_COLOR_COUNT;
    tag.dataset.color = String(colorBucket);
    tag.dataset.corner = String(colorBucket);
    if (idx === activeRegionIdx) {
      tag.classList.add('active');
      activeMembership = colorBucket;
    }
    el.appendChild(tag);
  });
  if (activeMembership >= 0) {
    el.classList.add(`active-region-${activeMembership}`);
  }
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
  const halfCovers = collectCells('halfCover');

  if (walls.length === 0 && water.length === 0 && halfCovers.length === 0) {
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

  // D5.D.B: live spawn-region validation against the D5 schema.
  // Mirrors `src/config/layouts.ts` — flagged as errors here so the
  // author sees them while painting, before the JSON paste at boot
  // would catch them.
  const blockedSet = new Set<string>();
  for (const w of walls) blockedSet.add(`${w.x},${w.y}`);
  for (const w of water) blockedSet.add(`${w.x},${w.y}`);
  for (const hc of halfCovers) blockedSet.add(`${hc.x},${hc.y}`);
  let spawnOverlap = 0;
  for (const region of spawns) {
    for (const t of region.tiles) {
      if (blockedSet.has(`${t.x},${t.y}`)) spawnOverlap++;
    }
  }
  if (spawnOverlap > 0) {
    items.push({
      level: 'error',
      text: `${spawnOverlap} spawn tile(s) overlap walls, water, or half-cover — paint to move them.`,
    });
  }

  // Per-region tile count. The painting flow naturally lands in the
  // [0, 8] range — empty regions on freshly-added pills surface
  // until the author paints 8 tiles in.
  const undersized: number[] = [];
  spawns.forEach((region, idx) => {
    if (region.tiles.length !== SPAWN_REGION_TILE_COUNT) undersized.push(idx);
  });
  if (undersized.length > 0) {
    const lines = undersized
      .map((idx) => `#${idx}: ${spawns[idx]!.tiles.length}/${SPAWN_REGION_TILE_COUNT}`)
      .join(', ');
    items.push({
      level: 'error',
      text: `Region(s) ${lines} — each region needs exactly ${SPAWN_REGION_TILE_COUNT} tiles.`,
    });
  }

  // Valid-pair rule (subsumes "≥1 player-available" and "≥1 enemy-
  // available" — see `LayoutSchema.superRefine` in
  // `src/config/layouts.ts` for the canonical reasoning).
  const playerPool: SpawnRegion[] = [];
  const enemyPool: SpawnRegion[] = [];
  for (const region of spawns) {
    if (region.availability === 'player' || region.availability === 'both') playerPool.push(region);
    if (region.availability === 'enemy' || region.availability === 'both') enemyPool.push(region);
  }
  const hasValidPair = playerPool.some((p) => enemyPool.some((e) => e !== p));
  if (!hasValidPair) {
    items.push({
      level: 'error',
      text: 'No valid (player, enemy) region pair — at least two regions must allow opposing teams.',
    });
  }

  if (spawns.length < MIN_SPAWN_REGIONS) {
    items.push({
      level: 'error',
      text: `Layout needs ≥${MIN_SPAWN_REGIONS} spawn regions (currently ${spawns.length}).`,
    });
  }

  // Connectivity treats half-cover as a path blocker (D6 — pathfinding
  // blocks through it just like walls). The LOS-transparency only
  // affects ranged-attack visibility, not movement reachability.
  if (!isConnected([...walls, ...halfCovers])) {
    items.push({
      level: 'error',
      text: 'Spawn regions are severed — no path between the first two spawn regions.',
    });
  }

  if (items.length === 0 || items.every((i) => i.level === 'ok')) {
    items.push({
      level: 'ok',
      text: `Looks good — ${walls.length} wall(s), ${halfCovers.length} half-cover(s), ${water.length} water cell(s), ${spawns.length} spawn region(s) on ${gridW}×${gridH}.`,
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
  const halfCovers = collectCells('halfCover');
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
  if (halfCovers.length > 0) payload.halfCovers = halfCovers;
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
  if (layout.halfCovers && layout.halfCovers.length > 0) {
    parts.push(`  "halfCovers": [`);
    parts.push(...formatCoords(layout.halfCovers));
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
  refreshRegionUI();
  refreshGrid();
  refreshValidation();
  refreshExport();
}

function populateLoadSelect(): void {
  for (const layout of LAYOUTS) {
    const opt = document.createElement('option');
    opt.value = layout.id;
    // The id is redundant when the human-readable name carries the
    // same info (e.g. "Junction Ambush" vs id "junctionAmbush").
    // Long labels would otherwise push the select past its flex
    // container and crowd the LOAD button.
    opt.textContent = `${layout.name} (${layout.gridW}×${layout.gridH})`;
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
  if (found.halfCovers) for (const c of found.halfCovers) grid[c.y]![c.x] = 'halfCover';
  // Deep-copy spawns so live editing can't mutate the canonical
  // LAYOUTS array.
  spawns = found.spawns.map((r) => ({
    availability: r.availability,
    tiles: r.tiles.map((t) => ({ x: t.x, y: t.y })),
  }));
  activeRegionIdx = 0;
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
  activeRegionIdx = 0;
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
      regionRowEl.hidden = value !== 'spawn-regions';
      // D6 — show the wall/half-cover sub-tool only while the
      // neutral-units layer is active.
      neutralRowEl.hidden = value !== 'neutral-units';
      // Region tag opacity is class-driven via [data-active-layer],
      // but the active-region outline is per-cell — refresh so the
      // outline appears only when spawn-regions is the active layer.
      refreshGrid();
    });
  }
}

function attachNeutralKindWatchers(): void {
  for (const radio of neutralKindRadioEls) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const value = radio.value as NeutralKind;
      if (value === activeNeutralKind) return;
      // Same mid-stroke rule as layer-switch: synchronously commit
      // before swapping the active sub-tool.
      if (activeStroke !== null) endStroke();
      activeNeutralKind = value;
    });
  }
}

function attachRegionControls(): void {
  addRegionBtn.addEventListener('click', () => {
    spawns.push({ tiles: [], availability: 'both' });
    activeRegionIdx = spawns.length - 1;
    refreshRegionUI();
    refreshGrid();
    refreshValidation();
    refreshExport();
  });
  deleteRegionBtn.addEventListener('click', () => {
    if (spawns.length <= MIN_SPAWN_REGIONS) return;
    if (!hasActiveRegion()) return;
    spawns.splice(activeRegionIdx, 1);
    if (activeRegionIdx >= spawns.length) activeRegionIdx = spawns.length - 1;
    refreshRegionUI();
    refreshGrid();
    refreshValidation();
    refreshExport();
  });
  for (const radio of availabilityRadioEls) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      if (!hasActiveRegion()) return;
      const region = spawns[activeRegionIdx]!;
      region.availability = radio.value as SpawnAvailability;
      refreshValidation();
      refreshExport();
    });
  }
}

/**
 * Rebuild the region pill picker from `spawns` and sync the
 * availability radios + Delete button enabled-state to the active
 * region. Called whenever spawns changes shape (add/delete/load/
 * resize/clear) or the active region switches.
 */
function refreshRegionPicker(): void {
  regionPickerEl.innerHTML = '';
  spawns.forEach((region, idx) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'region-pill';
    if (idx === activeRegionIdx) pill.classList.add('active');
    pill.dataset.regionIdx = String(idx);
    const swatch = document.createElement('span');
    swatch.className = 'pill-swatch';
    swatch.style.background = `var(--region-color-${idx % REGION_COLOR_COUNT})`;
    const label = document.createElement('span');
    label.textContent = `#${idx} (${region.tiles.length}/${SPAWN_REGION_TILE_COUNT})`;
    pill.appendChild(swatch);
    pill.appendChild(label);
    pill.addEventListener('click', () => {
      if (idx === activeRegionIdx) return;
      // Mid-stroke region switch implicitly commits the current
      // stroke (per the user's D5.D answer on region-switch:
      // "Can't switch mid-stroke" — closest mapping for click).
      if (activeStroke !== null) endStroke();
      activeRegionIdx = idx;
      refreshRegionUI();
      refreshGrid();
    });
    regionPickerEl.appendChild(pill);
  });
  deleteRegionBtn.disabled = spawns.length <= MIN_SPAWN_REGIONS;
}

function refreshAvailabilityRadios(): void {
  const region = hasActiveRegion() ? spawns[activeRegionIdx]! : null;
  for (const radio of availabilityRadioEls) {
    radio.checked = region !== null && radio.value === region.availability;
    radio.disabled = region === null;
  }
}

function refreshRegionUI(): void {
  refreshRegionPicker();
  refreshAvailabilityRadios();
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
