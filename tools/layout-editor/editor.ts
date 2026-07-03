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
  LAYOUT_IDS,
  LAYOUT_MIN_SIDE,
  LAYOUT_MAX_SIDE,
  LayoutsSchema,
  SPAWN_REGION_TILE_COUNT,
  SPAWN_REGION_MIN_TILES,
  SPAWN_REGION_MAX_TILES,
  type LayoutDef,
  type SpawnAvailability,
  type SpawnRegion,
  type Theme,
} from '../../src/config/layouts';
// §40g-2 — footprint geometry (39a), reused for rubble placement fit + render.
// Pure + World-free, so the editor imports it straight (no sim-world runtime dep).
// §40g-2b adds `anchorFootprint` here for the spawn-room deploy-fit warning.
import { footprintCells } from '../../src/sim/occupancy';
import { formatLayoutJson, formatLayoutsJson } from './format';
// T3 — the "add to sector" toggle. The sector FILE is fetched live (not
// imported) so the layout editor never gains a runtime dependency on
// sectors.json and stays off its rebuild chain. (NB: this does NOT prevent a
// reload — Vite broadcasts a full-reload to every dev client when sectors.json
// changes, so a write reloads this tab anyway; SECTOR_ADD_STASH_KEY masks that.)
// `formatSectorsJson`'s sectors import is type-only (erased), so it stays
// dependency-free too.
import { formatSectorsJson } from '../sector-editor/format';
import { addLayoutToSectorPools } from '../sector-editor/poolEdit';
import type { SectorDef } from '../../src/config/sectors';

/** §40g — a cell's TERRAIN kind. Walls + half-cover are no longer cell kinds:
 *  they moved to the `neutrals` overlay so a neutral can sit ON a terrain tile
 *  (a destructible wall on sand). Terrain stays mutex per cell. */
type Cell =
  | 'floor'
  | 'water'
  | 'chasm'
  | 'fire'
  | 'healing'
  // §37f — the five §37b terrain tiles (camelCase cell value == schema field name).
  | 'deepWater'
  | 'hills'
  | 'ice'
  | 'sand'
  | 'mud';
type Layer = 'terrain' | 'neutral-units' | 'spawn-regions';
/** §40g — the value stored in the `neutrals` OVERLAY grid: one 1×1 neutral per
 *  cell (mutex among wall/half-cover). Rubble is NOT here — it's a multi-tile
 *  list (`rubble`), so its sub-tool lives in `NeutralTool` but not this grid. */
type NeutralKind = 'wall' | 'halfCover';
/** D6 + §40g-2 — the sub-tool within the neutral-units layer. The layer radio
 *  picks the layer; this radio picks which neutral it paints: a 1×1 wall/
 *  half-cover (into the overlay grid) or a footprinted `rubble` block (into the
 *  `rubble` list). */
type NeutralTool = 'wall' | 'halfCover' | 'rubble';
/** §40g-2 — a destructible rubble placement authored in the editor: its footprint
 *  MIN corner `{x,y}` + `size` (1..3). `hp` is the optional per-instance pool
 *  override (absent ⇒ the catalog default for the size). Mirrors
 *  `RubbleCoordSchema`; emitted to the layout's `rubble` array. */
interface RubblePlacement {
  x: number;
  y: number;
  size: number;
  hp?: number;
}
/** D7.C: sub-tool within the terrain layer. Mirrors the D6 neutral-row
 *  pattern — same shape, same mid-stroke commit rule. Tile-kind stays
 *  mutex per cell (paint-chasm over a water cell wins; the layer system
 *  is a UX overlay, not a multi-layer per-cell data model). */
type TerrainKind =
  | 'water'
  | 'chasm'
  | 'fire'
  | 'healing'
  // §37f — the five §37b terrain tiles as paintable sub-tools.
  | 'deepWater'
  | 'hills'
  | 'ice'
  | 'sand'
  | 'mud';

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

/** Saving rewrites config/layouts.json, which Vite HMR turns into a full page
 *  reload (the json → layouts.ts → editor.ts chain has no clean HMR boundary).
 *  To mask it, a successful Save stashes the saved id + status here; the next
 *  boot consumes the stash, re-loads that (now-on-disk) layout into the canvas,
 *  and re-shows the confirmation — so a save feels seamless. Session-scoped so
 *  it never leaks across browser sessions. */
const SAVE_STASH_KEY = 'layoutEditor.justSaved';

/** A successful "add to sector" write ALSO reloads this page: sectors.json is
 *  imported by src/config/sectors.ts with no HMR boundary, so Vite broadcasts a
 *  full-reload to every connected dev client — including this one, even though it
 *  only fetches the file (the import-vs-fetch choice keeps editor.ts off the
 *  rebuild CHAIN, but Vite's global reload broadcast still hits it). Mirror the
 *  Save stash so the "Added…" confirmation survives the reload instead of
 *  vanishing the instant it appears. Session-scoped, same as above. */
const SECTOR_ADD_STASH_KEY = 'layoutEditor.sectorAdded';

let gridW = DEFAULT_SIDE;
let gridH = DEFAULT_SIDE;
let grid: Cell[][] = makeEmptyGrid(gridW, gridH);
/** §40g — the neutral OVERLAY, parallel to `grid`. `null` = no obstacle; a
 *  `NeutralKind` = a wall/half-cover sitting ON whatever terrain `grid` holds at
 *  that cell. Kept separate from the terrain grid so the two layers coexist. */
let neutrals: (NeutralKind | null)[][] = makeEmptyNeutrals(gridW, gridH);
let cellEls: HTMLDivElement[][] = [];
let activeLayer: Layer = 'terrain';
let activeNeutralKind: NeutralTool = 'wall';
let activeTerrainKind: TerrainKind = 'water';
/** §40g-2 — authored rubble blocks (a list, not a per-cell overlay — each is a
 *  footprinted entity). Placement / erase / render / export / load / resize all
 *  keep this in sync alongside `grid` + `neutrals`. */
let rubble: RubblePlacement[] = [];
/** §40g-2 — the active rubble brush size (1..3) + optional HP override (null =
 *  the size's catalog default). Driven by the rubble sub-tool controls. */
let activeRubbleSize = 1;
let activeRubbleHp: number | null = null;
/** D8 — currently-edited layout's visual theme. Drives both the JSON
 *  export's `theme` field and a `data-theme` attribute on the grid for
 *  the live floor-color preview. */
let activeTheme: Theme = 'grassland';
/** Spawn regions for export. D5.D.A: initialized + reset to the
 *  procedural default (two top/bottom 'both' bands); loaded layouts
 *  populate from their JSON. D5.D.B: painting + add/delete + the
 *  availability radio all mutate this array in place. */
let spawns: SpawnRegion[] = defaultSpawns(gridW, gridH);
let activeRegionIdx = 0;
/** Number of cells dropped on the most recent resize. Surfaced as a
 *  validation warning so the author doesn't lose paint silently. */
let lastClipCount = 0;
/** M5 — the merge base for Save: the committed layouts at boot, plus any
 *  layouts saved this session (overwrite-in-place or append). loadLayout, the
 *  load-select dropdown, the id-collision validation, and Save all read this,
 *  so a just-saved layout is immediately loadable + overwritable. */
let working: LayoutDef[] = LAYOUTS.map(cloneLayout);

function cloneLayout(layout: LayoutDef): LayoutDef {
  return structuredClone(layout) as LayoutDef;
}

function makeEmptyGrid(w: number, h: number): Cell[][] {
  const g: Cell[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < w; x++) row.push('floor');
    g.push(row);
  }
  return g;
}

/** §40g — the empty neutral overlay (all `null`), same dimensions as `grid`. */
function makeEmptyNeutrals(w: number, h: number): (NeutralKind | null)[][] {
  const g: (NeutralKind | null)[][] = [];
  for (let y = 0; y < h; y++) {
    const row: (NeutralKind | null)[] = [];
    for (let x = 0; x < w; x++) row.push(null);
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
const metaThemeEl = mustQuery<HTMLSelectElement>('#meta-theme');
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
// §40g-2 — the rubble sub-tool controls (size + HP), shown only while `rubble` is
// the active neutral kind.
const rubbleControlsEl = mustQuery<HTMLDivElement>('#rubble-controls');
const rubbleSizeSelectEl = mustQuery<HTMLSelectElement>('#rubble-size');
const rubbleHpInputEl = mustQuery<HTMLInputElement>('#rubble-hp');
const terrainRowEl = mustQuery<HTMLDivElement>('#terrain-row');
const terrainKindRadioEls = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="terrain-kind"]'),
);
const regionRowEl = mustQuery<HTMLDivElement>('#region-row');
const regionPickerEl = mustQuery<HTMLDivElement>('#region-picker');
const availabilityRadioEls = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="availability"]'),
);
const addRegionBtn = mustQuery<HTMLButtonElement>('#add-region-btn');
const deleteRegionBtn = mustQuery<HTMLButtonElement>('#delete-region-btn');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
// T3 — "add to sector" controls.
const sectorChecksEl = mustQuery<HTMLDivElement>('#sector-checks');
const sectorMinHopEl = mustQuery<HTMLInputElement>('#sector-minhop');
const addToSectorsBtn = mustQuery<HTMLButtonElement>('#add-to-sectors-btn');
const sectorAddStatusEl = mustQuery<HTMLParagraphElement>('#sector-add-status');

populateSizeSelects();
buildGrid();
// D8 — sync the grid's data-theme to the initial activeTheme so the CSS
// floor-color rule picks up before the first refresh.
gridEl.dataset.theme = activeTheme;
populateLoadSelect();
attachMetaWatchers();
attachToolButtons();
attachSizeWatchers();
attachLayerWatchers();
attachTerrainKindWatchers();
attachNeutralKindWatchers();
attachRubbleControls();
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
restoreAfterSave();
restoreAfterSectorAdd();

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
 * handlers. Cells are kept **square**: the cell side is the smaller of
 * the width-fit (≈ half the viewport, clamped to the pane) and the
 * height-fit (the viewport minus page chrome), so the whole grid stays
 * visible without scrolling whatever the aspect ratio — a tall layout
 * shrinks to a narrower square-celled column rather than stretching its
 * cells to flat rectangles, and a wide one shrinks horizontally.
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
  // Square cells: fit BOTH budgets and take the smaller side so nothing
  // scrolls and cells never stretch to rectangles.
  //   - width budget: ~half the viewport, clamped to the grid-pane column
  //     so a narrow window doesn't blow out the layout.
  //   - height budget: the viewport minus page chrome (header, size-row,
  //     legend, padding).
  // Minimum 6px so cells stay clickable on extreme tall/wide grids.
  const pane = gridEl.parentElement!;
  const targetGridW = Math.min(window.innerWidth * 0.5, pane.clientWidth);
  const availH = Math.max(120, window.innerHeight - 220);
  const cell = Math.max(
    6,
    Math.min(Math.floor(targetGridW / gridW), Math.floor(availH / gridH)),
  );
  gridEl.style.width = `${gridW * cell}px`;
  gridEl.style.height = `${gridH * cell}px`;

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
  // §40g — resize the neutral overlay in lockstep with the terrain grid.
  const nextNeutrals: (NeutralKind | null)[][] = [];
  for (let y = 0; y < newH; y++) {
    const row: (NeutralKind | null)[] = [];
    for (let x = 0; x < newW; x++) {
      const existing = y < neutrals.length && x < neutrals[y]!.length ? neutrals[y]![x]! : null;
      row.push(existing);
    }
    nextNeutrals.push(row);
  }
  // Count any non-empty cell (terrain OR neutral) that USED to exist but is now
  // outside the new bounds, so the resize clip warning covers both layers.
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y]!.length; x++) {
      if (y >= newH || x >= newW) {
        if (grid[y]![x] !== 'floor' || neutrals[y]![x] !== null) clipped++;
      }
    }
  }
  grid = next;
  neutrals = nextNeutrals;
  gridW = newW;
  gridH = newH;
  // §40g-2 — drop any rubble whose footprint no longer fits inside the new bounds
  // (folded into the same clip warning as the terrain/neutral layers).
  const keptRubble = rubble.filter(
    (r) => r.x >= 0 && r.y >= 0 && r.x + r.size - 1 < newW && r.y + r.size - 1 < newH,
  );
  clipped += rubble.length - keptRubble.length;
  rubble = keptRubble;
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
  | 'paint-chasm'
  | 'paint-fire'
  | 'paint-healing'
  | 'erase-wall'
  | 'erase-halfCover'
  | 'erase-water'
  | 'erase-chasm'
  | 'erase-fire'
  | 'erase-healing'
  // §37f — the five new terrain tiles.
  | 'paint-deepWater'
  | 'paint-hills'
  | 'paint-ice'
  | 'paint-sand'
  | 'paint-mud'
  | 'erase-deepWater'
  | 'erase-hills'
  | 'erase-ice'
  | 'erase-sand'
  | 'erase-mud'
  // §40g-2 — rubble is a footprinted list entity, placed/removed one per click.
  | 'paint-rubble'
  | 'erase-rubble'
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
  //
  // D7.C: terrain layer further splits by `activeTerrainKind`
  // (water vs chasm vs fire vs healing). Same per-sub-tool erase rule:
  // erasing while fire is selected only clears fire cells, leaving
  // water / chasm / healing untouched.
  const erasing = e.button === 2;
  switch (activeLayer) {
    case 'terrain':
      switch (activeTerrainKind) {
        case 'water': return erasing ? 'erase-water' : 'paint-water';
        case 'chasm': return erasing ? 'erase-chasm' : 'paint-chasm';
        case 'fire': return erasing ? 'erase-fire' : 'paint-fire';
        case 'healing': return erasing ? 'erase-healing' : 'paint-healing';
        case 'deepWater': return erasing ? 'erase-deepWater' : 'paint-deepWater';
        case 'hills': return erasing ? 'erase-hills' : 'paint-hills';
        case 'ice': return erasing ? 'erase-ice' : 'paint-ice';
        case 'sand': return erasing ? 'erase-sand' : 'paint-sand';
        case 'mud': return erasing ? 'erase-mud' : 'paint-mud';
      }
      // Unreachable — TerrainKind is exhaustive. Fall through for
      // safety; equivalent to "no-op" semantics.
      return 'noop';
    case 'neutral-units':
      if (activeNeutralKind === 'rubble') {
        return erasing ? 'erase-rubble' : 'paint-rubble';
      }
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
    // §40g — wall/half-cover strokes write the NEUTRAL overlay; every other
    // paint/erase writes the terrain grid. The two layers are independent, so a
    // wall stroke no longer wipes the terrain under it (and vice versa).
    case 'paint-wall':
    case 'paint-halfCover':
    case 'erase-wall':
    case 'erase-halfCover':
      applyNeutralStroke(c);
      return;
    case 'paint-rubble':
    case 'erase-rubble':
      applyRubbleStroke(c);
      return;
    case 'paint-water':
    case 'paint-chasm':
    case 'paint-fire':
    case 'paint-healing':
    case 'paint-deepWater':
    case 'paint-hills':
    case 'paint-ice':
    case 'paint-sand':
    case 'paint-mud':
    case 'erase-water':
    case 'erase-chasm':
    case 'erase-fire':
    case 'erase-healing':
    case 'erase-deepWater':
    case 'erase-hills':
    case 'erase-ice':
    case 'erase-sand':
    case 'erase-mud':
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
  // Terrain kind stays mutex per cell (paint-chasm over a water cell wins);
  // each erase-X only clears its OWN kind (erase-fire leaves water/chasm/healing
  // alone). §40g — walls/half-cover moved to `applyNeutralStroke`, so a terrain
  // stroke no longer touches the neutral overlay at all.
  let next: Cell | null = null;
  switch (activeStroke) {
    case 'paint-water':
      next = 'water';
      break;
    case 'paint-chasm':
      next = 'chasm';
      break;
    case 'paint-fire':
      next = 'fire';
      break;
    case 'paint-healing':
      next = 'healing';
      break;
    case 'paint-deepWater':
      next = 'deepWater';
      break;
    case 'paint-hills':
      next = 'hills';
      break;
    case 'paint-ice':
      next = 'ice';
      break;
    case 'paint-sand':
      next = 'sand';
      break;
    case 'paint-mud':
      next = 'mud';
      break;
    case 'erase-water':
      if (current === 'water') next = 'floor';
      break;
    case 'erase-chasm':
      if (current === 'chasm') next = 'floor';
      break;
    case 'erase-fire':
      if (current === 'fire') next = 'floor';
      break;
    case 'erase-healing':
      if (current === 'healing') next = 'floor';
      break;
    case 'erase-deepWater':
      if (current === 'deepWater') next = 'floor';
      break;
    case 'erase-hills':
      if (current === 'hills') next = 'floor';
      break;
    case 'erase-ice':
      if (current === 'ice') next = 'floor';
      break;
    case 'erase-sand':
      if (current === 'sand') next = 'floor';
      break;
    case 'erase-mud':
      if (current === 'mud') next = 'floor';
      break;
  }
  if (next === null || next === current) return;
  grid[c.y]![c.x] = next;
  strokeDirty = true;
  refreshCell(c);
}

/**
 * §40g — a neutral (wall / half-cover) stroke writes the `neutrals` OVERLAY, not
 * the terrain grid. One neutral per cell (mutex among wall/half-cover — paint-wall
 * over a half-cover cell wins), independent of the terrain beneath it. Each
 * erase-X only clears its own kind (erase-halfCover leaves a wall alone), mirroring
 * the per-sub-tool erase rule terrain uses.
 */
function applyNeutralStroke(c: Coord): void {
  const current = neutrals[c.y]![c.x]!;
  let next: NeutralKind | null | undefined;
  switch (activeStroke) {
    case 'paint-wall':
      next = 'wall';
      break;
    case 'paint-halfCover':
      next = 'halfCover';
      break;
    case 'erase-wall':
      if (current === 'wall') next = null;
      break;
    case 'erase-halfCover':
      if (current === 'halfCover') next = null;
      break;
  }
  if (next === undefined || next === current) return;
  // §40g-2 — don't paint a 1×1 neutral onto a rubble footprint cell (neutrals are
  // mutex; the schema would reject the overlap). Erasing (next === null) is fine.
  if (next !== null && rubbleIndexAt(c.x, c.y) >= 0) return;
  neutrals[c.y]![c.x] = next;
  strokeDirty = true;
  refreshCell(c);
}

/**
 * §40g-2 — the index of the rubble whose N×N footprint covers `(x,y)`, or −1.
 * The rubble list is small, so a linear scan per query is fine at editor scale.
 */
function rubbleIndexAt(x: number, y: number): number {
  return rubble.findIndex(
    (r) => x >= r.x && x < r.x + r.size && y >= r.y && y < r.y + r.size,
  );
}

/** §40g-2 — true if any NEUTRAL (a 1×1 wall/half-cover OR a rubble footprint)
 *  already occupies `(x,y)`. The mutex a rubble placement must clear. */
function cellHasNeutral(x: number, y: number): boolean {
  return neutrals[y]![x] !== null || rubbleIndexAt(x, y) >= 0;
}

/**
 * §40g-2 — a rubble stroke places (or erases) ONE block per click. Unlike the
 * per-cell paints, a drag doesn't stamp a block per entered cell — it'd spam
 * overlapping placements — so we act only on the stroke's first cell (the
 * mousedown cell, when `strokeAppliedCells` still holds just it).
 */
function applyRubbleStroke(c: Coord): void {
  if (strokeAppliedCells.size !== 1) return;
  if (activeStroke === 'paint-rubble') placeRubble(c);
  else eraseRubbleAt(c);
}

/**
 * §40g-2 — place a rubble block with `c` as its MIN corner (extending +x/+y, the
 * §39 footprint convention — WYSIWYG: the clicked cell is the block's top-left).
 * Placed only if the WHOLE footprint is in-bounds and clear of every other neutral
 * (wall / half-cover / other rubble); otherwise a no-op (the brush won't paint
 * where the schema would reject). Terrain underneath is fine (§40g).
 */
function placeRubble(c: Coord): void {
  const size = activeRubbleSize;
  const cells = footprintCells(c, size);
  const fits = cells.every(
    (f) => f.x >= 0 && f.y >= 0 && f.x < gridW && f.y < gridH && !cellHasNeutral(f.x, f.y),
  );
  if (!fits) return;
  const placement: RubblePlacement = { x: c.x, y: c.y, size };
  if (activeRubbleHp !== null) placement.hp = activeRubbleHp;
  rubble.push(placement);
  strokeDirty = true;
  for (const f of cells) refreshCell(f);
}

/** §40g-2 — remove the rubble block covering `c` (any of its footprint cells), and
 *  repaint the freed cells. No-op if the cell holds no rubble. */
function eraseRubbleAt(c: Coord): void {
  const idx = rubbleIndexAt(c.x, c.y);
  if (idx < 0) return;
  const removed = rubble[idx]!;
  const cells = footprintCells({ x: removed.x, y: removed.y }, removed.size);
  rubble.splice(idx, 1);
  strokeDirty = true;
  for (const f of cells) refreshCell(f);
}

function applyPaintRegion(c: Coord): void {
  const region = spawns[activeRegionIdx];
  if (!region) return;
  // Already in the region → no-op (don't FIFO-bump on re-paint over
  // a tile the active stroke already owns).
  if (region.tiles.some((t) => t.x === c.x && t.y === c.y)) return;
  region.tiles.push({ x: c.x, y: c.y });
  let evicted: Coord | null = null;
  if (region.tiles.length > SPAWN_REGION_MAX_TILES) {
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
    'chasm',
    'fire',
    'healing',
    'deepWater',
    'hills',
    'ice',
    'sand',
    'mud',
    'rubble',
    'invalid',
    'active-region-0',
    'active-region-1',
    'active-region-2',
    'active-region-3',
  );
  el.title = '';
  // §40g — terrain kind (from `grid`) and the neutral overlay (from `neutrals`)
  // are painted as INDEPENDENT classes, so a `sand wall` cell carries both. The
  // CSS renders the terrain as the cell background + glyph and the neutral as an
  // inset badge on top, so the author sees the tile beneath the obstacle.
  if (value === 'water') el.classList.add('water');
  if (value === 'chasm') el.classList.add('chasm');
  if (value === 'fire') el.classList.add('fire');
  if (value === 'healing') el.classList.add('healing');
  if (value === 'deepWater') el.classList.add('deepWater');
  if (value === 'hills') el.classList.add('hills');
  if (value === 'ice') el.classList.add('ice');
  if (value === 'sand') el.classList.add('sand');
  if (value === 'mud') el.classList.add('mud');
  const neutral = neutrals[c.y]![c.x]!;
  if (neutral === 'wall') el.classList.add('wall');
  if (neutral === 'halfCover') el.classList.add('halfCover');
  // §40g-2 — a cell inside a rubble footprint gets the rubble badge (mutually
  // exclusive with wall/half-cover). The title carries its size + HP so the
  // author can hover any cell of the block to read its stats.
  const rIdx = rubbleIndexAt(c.x, c.y);
  if (rIdx >= 0) {
    const r = rubble[rIdx]!;
    el.classList.add('rubble');
    el.title = `rubble ${r.size}×${r.size}${r.hp != null ? `, hp ${r.hp}` : ' (default hp)'}`;
  }

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

/** §40g — collect the neutral OVERLAY cells of a given kind (wall / half-cover),
 *  the neutral-layer counterpart to `collectCells` (which now scans terrain only). */
function collectNeutrals(kind: NeutralKind): Coord[] {
  const out: Coord[] = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (neutrals[y]![x] === kind) out.push({ x, y });
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
  const walls = collectNeutrals('wall');
  const water = collectCells('water');
  const halfCovers = collectNeutrals('halfCover');
  const chasms = collectCells('chasm');
  const fires = collectCells('fire');
  const healings = collectCells('healing');
  const deepWater = collectCells('deepWater');
  const hills = collectCells('hills');
  const ice = collectCells('ice');
  const sand = collectCells('sand');
  const mud = collectCells('mud');
  // §40g-2 — every cell covered by a rubble footprint (a unit can't stand there,
  // so these block spawns + pathing, like walls).
  const rubbleCells = rubble.flatMap((r) => footprintCells({ x: r.x, y: r.y }, r.size));

  if (
    walls.length === 0 && water.length === 0 && halfCovers.length === 0 &&
    chasms.length === 0 && fires.length === 0 && healings.length === 0 &&
    deepWater.length === 0 && hills.length === 0 && ice.length === 0 &&
    sand.length === 0 && mud.length === 0 && rubble.length === 0
  ) {
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
    working.some((l) => l.id === metaIdEl.value.trim())
  ) {
    items.push({
      level: 'warn',
      text: `id "${metaIdEl.value.trim()}" already exists — Save will overwrite that layout in place (after a confirm).`,
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
  // §37g — spawns may sit on any PASSABLE tile (water / fire / healing / hills /
  // ice / sand / mud); reject only cells a unit can't occupy — impassable tiles
  // (chasm, deep water) and neutral-unit cells (wall, half-cover). Mirrors the
  // canonical `spawnBlocked` set in src/config/layouts.ts.
  const spawnBlockedSet = new Set<string>();
  for (const w of walls) spawnBlockedSet.add(`${w.x},${w.y}`);
  for (const hc of halfCovers) spawnBlockedSet.add(`${hc.x},${hc.y}`);
  for (const ch of chasms) spawnBlockedSet.add(`${ch.x},${ch.y}`);
  for (const t of deepWater) spawnBlockedSet.add(`${t.x},${t.y}`);
  // §40g-2 — a rubble block occupies its whole footprint; spawns can't sit on it.
  for (const c of rubbleCells) spawnBlockedSet.add(`${c.x},${c.y}`);
  let spawnOverlap = 0;
  for (const region of spawns) {
    for (const t of region.tiles) {
      if (spawnBlockedSet.has(`${t.x},${t.y}`)) spawnOverlap++;
    }
  }
  if (spawnOverlap > 0) {
    items.push({
      level: 'error',
      text: `${spawnOverlap} spawn tile(s) sit on impassable / occupied cells (wall, half-cover, chasm, deep water, or rubble) — paint to move them.`,
    });
  }

  // Per-region tile count. The paint cap holds the upper bound at
  // SPAWN_REGION_MAX_TILES, so the only invalid case is a region that
  // dropped below SPAWN_REGION_MIN_TILES (e.g. a freshly-added pill with
  // nothing painted yet, or one erased empty).
  const outOfRange: number[] = [];
  spawns.forEach((region, idx) => {
    if (region.tiles.length < SPAWN_REGION_MIN_TILES || region.tiles.length > SPAWN_REGION_MAX_TILES) {
      outOfRange.push(idx);
    }
  });
  if (outOfRange.length > 0) {
    const lines = outOfRange
      .map((idx) => `#${idx}: ${spawns[idx]!.tiles.length}`)
      .join(', ');
    items.push({
      level: 'error',
      text: `Region(s) ${lines} — each region needs ${SPAWN_REGION_MIN_TILES}–${SPAWN_REGION_MAX_TILES} tiles.`,
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

  // Connectivity treats half-cover, chasm, and deep water as path blockers —
  // D6 walls off through half-cover (pathfinding rejects), D7.A makes chasm
  // Infinity-cost (A* skips), and §37b deep water is Infinity-cost too (the
  // 37g fix — it was missing here, so a deep-water-severed map validated as
  // connected). Mirrors the BFS in layouts.test.ts. The LOS-transparency of
  // half-cover + chasm only affects ranged-attack visibility, not movement
  // reachability. Fire + healing + the passable §37 tiles (hills/ice/sand/mud)
  // pass freely — they're costly surface effects, not obstacles.
  // §40g-2 — rubble blocks pathing too (a unit can't walk through a rubble block),
  // so it counts as a connectivity blocker alongside walls/half-cover/chasm/deep water.
  if (!isConnected([...walls, ...halfCovers, ...chasms, ...deepWater, ...rubbleCells])) {
    items.push({
      level: 'error',
      text: 'Spawn regions are severed — no path between the first two spawn regions.',
    });
  }

  if (items.length === 0 || items.every((i) => i.level === 'ok')) {
    const extras: string[] = [];
    if (chasms.length > 0) extras.push(`${chasms.length} chasm`);
    if (fires.length > 0) extras.push(`${fires.length} fire`);
    if (healings.length > 0) extras.push(`${healings.length} healing`);
    if (rubble.length > 0) extras.push(`${rubble.length} rubble`);
    const extrasText = extras.length > 0 ? `, ${extras.join(', ')}` : '';
    items.push({
      level: 'ok',
      text: `Looks good — ${walls.length} wall(s), ${halfCovers.length} half-cover(s), ${water.length} water cell(s)${extrasText}, ${spawns.length} spawn region(s) on ${gridW}×${gridH}.`,
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
  // Save-button enabled state tracks validation — re-evaluated wherever the
  // panel refreshes (meta input, stroke end, region change, resize, load).
  saveBtn.disabled = !isSavable();
}

/**
 * Save eligibility: no `error`-level validation items (overlaps / severed
 * regions / bad region counts), and the required metadata (a slug id, a name,
 * a description) is present. An existing id is NOT a blocker — Save overwrites
 * it behind a confirm. Mirrors the archetype editor's "disable Save unless the
 * real schema would accept it" rule, expressed over the editor's own checks.
 */
function isSavable(): boolean {
  if (validate().some((i) => i.level === 'error')) return false;
  const id = metaIdEl.value.trim();
  if (!id || !/^[a-z0-9_-]+$/i.test(id)) return false;
  if (!metaNameEl.value.trim() || !metaDescriptionEl.value.trim()) return false;
  return true;
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

/**
 * Assemble a `LayoutDef` from the current canvas + metadata. The single source
 * the export snippet AND Save both read. Empty id/name/description fall back to
 * placeholders so the export textarea always shows valid-ish JSON mid-edit;
 * Save is gated on `isSavable()` (real id/name/description present), so those
 * fallbacks never reach a written file.
 */
function buildCurrentLayout(): LayoutDef {
  const walls = collectNeutrals('wall');
  const water = collectCells('water');
  const halfCovers = collectNeutrals('halfCover');
  const chasms = collectCells('chasm');
  const fires = collectCells('fire');
  const healings = collectCells('healing');
  const deepWater = collectCells('deepWater');
  const hills = collectCells('hills');
  const ice = collectCells('ice');
  const sand = collectCells('sand');
  const mud = collectCells('mud');
  const payload: LayoutDef = {
    id: metaIdEl.value.trim() || 'unnamed',
    name: metaNameEl.value.trim() || 'Unnamed',
    description: metaDescriptionEl.value.trim() || 'TODO: describe this layout.',
    gridW,
    gridH,
    theme: activeTheme,
    walls,
    spawns,
  };
  if (water.length > 0) payload.water = water;
  if (halfCovers.length > 0) payload.halfCovers = halfCovers;
  if (chasms.length > 0) payload.chasms = chasms;
  if (fires.length > 0) payload.fires = fires;
  if (healings.length > 0) payload.healings = healings;
  // §37f — the five new terrain tiles, emitted only when painted (matching the
  // optional-array convention so an unused tile never bloats the layout JSON).
  if (deepWater.length > 0) payload.deepWater = deepWater;
  if (hills.length > 0) payload.hills = hills;
  if (ice.length > 0) payload.ice = ice;
  if (sand.length > 0) payload.sand = sand;
  if (mud.length > 0) payload.mud = mud;
  // §40g-2 — rubble blocks. Emit `size` only when > 1 and `hp` only when set, so a
  // 1×1 default-HP block round-trips to a bare `{x,y}` (matching the schema default
  // + the formatter's "only when present" rule).
  if (rubble.length > 0) {
    payload.rubble = rubble.map((r) => ({
      x: r.x,
      y: r.y,
      ...(r.size > 1 ? { size: r.size } : {}),
      ...(r.hp != null ? { hp: r.hp } : {}),
    }));
  }
  return payload;
}

function refreshExport(): void {
  exportEl.value = formatLayoutJson(buildCurrentLayout());
}

function setSaveStatus(text: string, cls: 'hint' | 'hint ok' | 'hint err'): void {
  saveStatusEl.textContent = text;
  saveStatusEl.className = cls;
}

/** Fetch + JSON-parse the live config/sectors.json (the dev server serves it
 *  statically). Fetching rather than importing keeps this page off sectors.json's
 *  rebuild chain — though Vite still broadcasts a full-reload on a write (see
 *  SECTOR_ADD_STASH_KEY), so the fetch buys decoupling, not a reload-free write. */
async function fetchSectors(): Promise<SectorDef[]> {
  const res = await fetch('/config/sectors.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SectorDef[];
}

/** T3 — render one checkbox per sector for the "add to sector pool" control. */
async function loadSectorChecks(): Promise<void> {
  try {
    const sectors = await fetchSectors();
    sectorChecksEl.innerHTML = '';
    if (sectors.length === 0) {
      sectorChecksEl.innerHTML = '<p class="hint">No sectors defined.</p>';
      return;
    }
    for (const s of sectors) {
      const label = document.createElement('label');
      label.className = 'inline';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = s.id;
      label.appendChild(cb);
      label.append(` ${s.title || s.id}`);
      sectorChecksEl.appendChild(label);
    }
  } catch (err) {
    sectorChecksEl.innerHTML = `<p class="hint err">Could not load sectors: ${String(err)}</p>`;
  }
}

/**
 * T3 — append the current layout to each checked sector's pool and write the
 * SECTOR file (the sector owns the sector↔layout edge — see the data model). The
 * layout must be a KNOWN id (saved to layouts.json) so the sector schema can
 * reference it; a pool already listing the layout is skipped (idempotent).
 */
async function addCurrentLayoutToSectors(): Promise<void> {
  const id = buildCurrentLayout().id;
  if (!LAYOUT_IDS.includes(id)) {
    setSectorAddStatus(
      `Save the layout to config first — "${id}" isn't a known layout id yet, so a sector can't reference it.`,
      'hint err',
    );
    return;
  }
  const chosen = Array.from(
    sectorChecksEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
  ).map((cb) => cb.value);
  if (chosen.length === 0) {
    setSectorAddStatus('Pick at least one sector.', 'hint err');
    return;
  }
  const raw = sectorMinHopEl.value.trim();
  const minHop = raw === '' ? undefined : Number.parseInt(raw, 10);
  if (minHop !== undefined && (!Number.isInteger(minHop) || minHop < 0)) {
    setSectorAddStatus('Hop gate must be a non-negative whole number (or blank).', 'hint err');
    return;
  }
  setSectorAddStatus('Saving…', 'hint');
  try {
    const sectors = await fetchSectors();
    const { added, skipped } = addLayoutToSectorPools(sectors, id, chosen, minHop);
    if (added.length === 0) {
      setSectorAddStatus(`Already in: ${skipped.join(', ')}. Nothing to write.`, 'hint');
      return;
    }
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'sectors.json', content: formatSectorsJson(sectors) }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const skipNote = skipped.length > 0 ? ` (skipped, already present: ${skipped.join(', ')})` : '';
      const status = `Added "${id}" to ${added.join(', ')}${skipNote}.`;
      setSectorAddStatus(status, 'hint ok');
      // The write triggers a Vite reload of this tab (see SECTOR_ADD_STASH_KEY) —
      // stash the confirmation so the next boot re-shows it instead of a blank
      // status that reads as "nothing happened".
      try {
        sessionStorage.setItem(SECTOR_ADD_STASH_KEY, JSON.stringify({ status }));
      } catch {
        // sessionStorage unavailable (private mode / quota) — non-fatal; the
        // write still succeeded, the reload just won't auto-restore the status.
      }
    } else {
      setSectorAddStatus(`Save failed: ${data.error ?? res.statusText}`, 'hint err');
    }
  } catch (err) {
    setSectorAddStatus(`Save failed: ${String(err)} — is the dev server running?`, 'hint err');
  }
}

function setSectorAddStatus(text: string, cls: 'hint' | 'hint ok' | 'hint err'): void {
  sectorAddStatusEl.textContent = text;
  sectorAddStatusEl.className = cls;
}

/**
 * M5 — write the current layout straight into `config/layouts.json` via the
 * dev-only `/__save-config` endpoint (the I4 archetype-editor save path; the
 * endpoint already allowlists `layouts.json`). A new id appends; an existing id
 * overwrites that entry IN PLACE behind a confirm (array order is preserved —
 * `LAYOUT_IDS` order seeds rng.pick determinism, so never reorder). The whole
 * merged file is POSTed through `formatLayoutsJson` so the diff stays clean.
 */
async function save(): Promise<void> {
  if (!isSavable()) return;
  const layout = buildCurrentLayout();
  const existingIdx = working.findIndex((l) => l.id === layout.id);
  if (existingIdx >= 0) {
    const prev = working[existingIdx]!;
    const ok = window.confirm(
      `Overwrite the existing "${prev.name}" layout (id "${layout.id}") in config/layouts.json?`,
    );
    if (!ok) {
      setSaveStatus('Save cancelled — the existing layout is untouched.', 'hint');
      return;
    }
  }
  // Merge into a fresh copy: replace in place (existing) or append (new).
  const merged = working.map(cloneLayout);
  if (existingIdx >= 0) merged[existingIdx] = layout;
  else merged.push(layout);
  // Defense in depth: prove the merged array passes the REAL loader schema
  // before writing (the editor's hand-rolled validation mirrors it, but this
  // is the canonical gate — and the only check on the merged whole).
  const parsed = LayoutsSchema.safeParse(merged);
  if (!parsed.success) {
    setSaveStatus(`Save blocked — schema error: ${parsed.error.issues[0]?.message ?? 'invalid'}`, 'hint err');
    return;
  }
  setSaveStatus('Saving…', 'hint');
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'layouts.json', content: formatLayoutsJson(merged) }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      working = merged;
      populateLoadSelect(); // surface a newly-added id in the Load dropdown
      refreshValidation(); // the id-collision note now reflects the saved state
      const verb = existingIdx >= 0 ? 'Overwrote' : 'Added';
      const status =
        `${verb} "${layout.id}" in config/layouts.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new layout.`;
      setSaveStatus(status, 'hint ok');
      // The write triggers a Vite reload of this tab — stash the result so the
      // next boot re-loads this layout into the canvas + re-shows the status.
      try {
        sessionStorage.setItem(SAVE_STASH_KEY, JSON.stringify({ savedId: layout.id, status }));
      } catch {
        // sessionStorage unavailable (private mode / quota) — non-fatal; the
        // save still succeeded, the reload just won't auto-restore the canvas.
      }
    } else {
      setSaveStatus(`Save failed: ${data.error ?? res.statusText}`, 'hint err');
    }
  } catch (err) {
    setSaveStatus(`Save failed: ${String(err)} — is the dev server running?`, 'hint err');
  }
}

/**
 * Boot-time companion to Save: if the previous page life just saved a layout
 * (the Vite reload masked below), consume the stash, re-load that now-on-disk
 * layout into the canvas, and re-show the confirmation. A no-op on a normal
 * cold boot. Robust to a missing/stale id (e.g. the file was hand-edited
 * between save and reload) — it just skips.
 */
function restoreAfterSave(): void {
  let stash: string | null = null;
  try {
    stash = sessionStorage.getItem(SAVE_STASH_KEY);
    if (stash) sessionStorage.removeItem(SAVE_STASH_KEY);
  } catch {
    return; // sessionStorage unavailable — nothing to restore.
  }
  if (!stash) return;
  try {
    const { savedId, status } = JSON.parse(stash) as { savedId?: string; status?: string };
    if (savedId && working.some((l) => l.id === savedId)) {
      loadSelectEl.value = savedId;
      loadLayout(savedId);
      if (status) setSaveStatus(status, 'hint ok');
    }
  } catch {
    // Malformed stash — ignore.
  }
}

/**
 * Boot-time companion to the "add to sector" toggle: a successful pool write
 * reloads this tab (see SECTOR_ADD_STASH_KEY), so re-show the stashed
 * confirmation in the sector-add status line. A no-op on a normal cold boot.
 */
function restoreAfterSectorAdd(): void {
  let stash: string | null = null;
  try {
    stash = sessionStorage.getItem(SECTOR_ADD_STASH_KEY);
    if (stash) sessionStorage.removeItem(SECTOR_ADD_STASH_KEY);
  } catch {
    return; // sessionStorage unavailable — nothing to restore.
  }
  if (!stash) return;
  try {
    const { status } = JSON.parse(stash) as { status?: string };
    if (status) setSectorAddStatus(status, 'hint ok');
  } catch {
    // Malformed stash — ignore.
  }
}

function refreshAll(): void {
  refreshRegionUI();
  refreshGrid();
  refreshValidation();
  refreshExport();
}

function populateLoadSelect(): void {
  // Re-runnable: drop everything past the leading "— pick a layout —"
  // placeholder so a Save that adds an id resurfaces the list cleanly.
  loadSelectEl.length = 1;
  for (const layout of working) {
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
  const found = working.find((l) => l.id === id);
  if (!found) return;
  gridW = found.gridW;
  gridH = found.gridH;
  grid = makeEmptyGrid(gridW, gridH);
  // §40g — walls/half-cover load into the neutral OVERLAY; terrain into `grid`.
  // A neutral coord may now coincide with a terrain tile (both are applied).
  neutrals = makeEmptyNeutrals(gridW, gridH);
  for (const w of found.walls) neutrals[w.y]![w.x] = 'wall';
  if (found.water) for (const w of found.water) grid[w.y]![w.x] = 'water';
  if (found.halfCovers) for (const c of found.halfCovers) neutrals[c.y]![c.x] = 'halfCover';
  if (found.chasms) for (const c of found.chasms) grid[c.y]![c.x] = 'chasm';
  if (found.fires) for (const c of found.fires) grid[c.y]![c.x] = 'fire';
  if (found.healings) for (const c of found.healings) grid[c.y]![c.x] = 'healing';
  if (found.deepWater) for (const c of found.deepWater) grid[c.y]![c.x] = 'deepWater';
  if (found.hills) for (const c of found.hills) grid[c.y]![c.x] = 'hills';
  if (found.ice) for (const c of found.ice) grid[c.y]![c.x] = 'ice';
  if (found.sand) for (const c of found.sand) grid[c.y]![c.x] = 'sand';
  if (found.mud) for (const c of found.mud) grid[c.y]![c.x] = 'mud';
  // §40g-2 — rubble loads into its own list (deep-copied). `size` defaults to 1;
  // `hp` stays optional (absent ⇒ the size's catalog default), so a bare block
  // re-exports bare.
  rubble = (found.rubble ?? []).map((r) => ({
    x: r.x,
    y: r.y,
    size: r.size ?? 1,
    ...(r.hp != null ? { hp: r.hp } : {}),
  }));
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
  activeTheme = found.theme;
  metaThemeEl.value = found.theme;
  gridEl.dataset.theme = found.theme;
  gridWSelectEl.value = String(gridW);
  gridHSelectEl.value = String(gridH);
  lastClipCount = 0;
  buildGrid();
  refreshAll();
}

function clearGrid(): void {
  grid = makeEmptyGrid(gridW, gridH);
  neutrals = makeEmptyNeutrals(gridW, gridH);
  rubble = [];
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
  // D8 — theme dropdown. `change` (not `input`) since <select> fires
  // `change` reliably across browsers on option pick.
  metaThemeEl.addEventListener('change', () => {
    activeTheme = metaThemeEl.value as Theme;
    gridEl.dataset.theme = activeTheme;
    refreshExport();
  });
}

function attachToolButtons(): void {
  loadBtn.addEventListener('click', () => loadLayout(loadSelectEl.value));
  clearBtn.addEventListener('click', () => clearGrid());
  saveBtn.addEventListener('click', () => void save());
  addToSectorsBtn.addEventListener('click', () => void addCurrentLayoutToSectors());
  void loadSectorChecks();
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
      // §40g-2 — and the rubble size/HP controls only when rubble is picked there.
      syncRubbleControls();
      // D7.C — show the water/chasm/fire/healing sub-tool only while the
      // terrain layer is active. Matches the neutral-row pattern.
      terrainRowEl.hidden = value !== 'terrain';
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
      const value = radio.value as NeutralTool;
      if (value === activeNeutralKind) return;
      // Same mid-stroke rule as layer-switch: synchronously commit
      // before swapping the active sub-tool.
      if (activeStroke !== null) endStroke();
      activeNeutralKind = value;
      // §40g-2 — reveal the size/HP controls only while rubble is the sub-tool.
      syncRubbleControls();
    });
  }
}

/** §40g-2 — the rubble size + HP controls show only while the neutral layer is
 *  active AND rubble is the chosen sub-tool. Called on layer + sub-tool changes. */
function syncRubbleControls(): void {
  rubbleControlsEl.hidden = activeLayer !== 'neutral-units' || activeNeutralKind !== 'rubble';
}

/** §40g-2 — read the rubble size selector + HP input into the active brush state.
 *  A blank / non-positive HP means "use the size's catalog default" (null). */
function attachRubbleControls(): void {
  rubbleSizeSelectEl.addEventListener('change', () => {
    activeRubbleSize = Number(rubbleSizeSelectEl.value);
  });
  rubbleHpInputEl.addEventListener('input', () => {
    const v = Number(rubbleHpInputEl.value);
    activeRubbleHp = rubbleHpInputEl.value.trim() !== '' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
  });
}

function attachTerrainKindWatchers(): void {
  for (const radio of terrainKindRadioEls) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const value = radio.value as TerrainKind;
      if (value === activeTerrainKind) return;
      // Same mid-stroke rule as layer-switch + neutral-kind-switch:
      // synchronously commit before swapping the active sub-tool.
      if (activeStroke !== null) endStroke();
      activeTerrainKind = value;
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
    label.textContent = `#${idx} (${region.tiles.length}/${SPAWN_REGION_MAX_TILES})`;
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
