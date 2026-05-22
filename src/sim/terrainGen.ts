/**
 * Per-encounter terrain generator. Given an encounter's RNG fork and the
 * terrain config, returns a freshly-built TileGrid plus a list of wall
 * coordinates. Walls are returned as raw `GridCoord`s rather than spawned
 * directly — the caller (battle setup) is responsible for turning them
 * into neutral-team Units via `spawnWall`. That seam keeps the generator
 * independent of World construction and easy to test in isolation.
 *
 * Hybrid model: when `layoutId` is null the generator uses the procedural
 * density-driven path; when non-null it dispatches to the hand-authored
 * library at `src/sim/layouts.ts`. `Run` rolls a 50/50 split between the
 * two at encounter creation time, so a given playthrough sees a mix of
 * procedural variety and tactically-tuned set pieces.
 *
 * Determinism contract: same `(rng state, gridSize, config, layoutId)` →
 * identical `GeneratedTerrain`. Tests rely on this so the fuzz harness
 * can replay any seed; the integration commit feeds in a per-encounter
 * RNG fork so terrain doesn't perturb the battle RNG stream.
 */

import { TileGrid } from './TileGrid';
import type { TerrainConfig } from '../config/terrain';
import type { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { getLayout, type LayoutDef } from './layouts';

export interface GeneratedTerrain {
  readonly tileGrid: TileGrid;
  readonly walls: readonly GridCoord[];
}

/** Grid size that hand-authored layouts are designed against. Layouts
 *  refuse to resolve at other sizes — see `src/sim/layouts.ts`. */
const LAYOUT_GRID_SIZE = 12;

export function generateTerrain(
  rng: RNG,
  gridSize: number,
  config: TerrainConfig,
  layoutId: string | null = null,
): GeneratedTerrain {
  if (layoutId !== null) {
    const layout = getLayout(layoutId);
    if (!layout) {
      throw new Error(`generateTerrain: unknown layoutId="${layoutId}"`);
    }
    return generateFromLayout(layout, gridSize, config);
  }
  return generateProcedural(rng, gridSize, config);
}

/**
 * Resolve a hand-authored layout into a `GeneratedTerrain`. Validates
 * that the layout's wall coordinates respect the reserved spawn rows and
 * the configured grid size; a violation is a layout-authoring bug, so
 * the dispatcher throws rather than silently rescuing it (the procedural
 * path's `ensureConnectivity` wall-peel doesn't apply here — hand
 * authored means hand verified).
 */
function generateFromLayout(
  layout: LayoutDef,
  gridSize: number,
  config: TerrainConfig,
): GeneratedTerrain {
  if (gridSize !== LAYOUT_GRID_SIZE) {
    throw new Error(
      `generateTerrain: layout "${layout.id}" requires gridSize=${LAYOUT_GRID_SIZE} (got ${gridSize})`,
    );
  }
  const reservedRows = new Set(config.spawnRowsClear);
  for (const w of layout.walls) {
    if (reservedRows.has(w.y)) {
      throw new Error(
        `generateTerrain: layout "${layout.id}" places a wall on reserved spawn row ${w.y}`,
      );
    }
    if (w.x < 0 || w.y < 0 || w.x >= gridSize || w.y >= gridSize) {
      throw new Error(
        `generateTerrain: layout "${layout.id}" places a wall at out-of-bounds (${w.x},${w.y})`,
      );
    }
  }

  const tileGrid = new TileGrid(gridSize, gridSize);
  if (layout.water) {
    for (const w of layout.water) tileGrid.setKind(w, 'shallow_water');
  }
  return { tileGrid, walls: layout.walls.slice() };
}

function generateProcedural(
  rng: RNG,
  gridSize: number,
  config: TerrainConfig,
): GeneratedTerrain {
  const total = gridSize * gridSize;
  const targetWalls = Math.floor(total * config.wallDensity);
  const targetWater = Math.floor(total * config.shallowWaterDensity);

  // Build candidate pool: every cell EXCEPT the spawn rows. Shuffling once
  // and slicing off two disjoint chunks (walls then water) gives both
  // distributions for free, with zero overlap by construction.
  const reservedRows = new Set(config.spawnRowsClear);
  const candidates: GridCoord[] = [];
  for (let y = 0; y < gridSize; y++) {
    if (reservedRows.has(y)) continue;
    for (let x = 0; x < gridSize; x++) {
      candidates.push({ x, y });
    }
  }
  shuffleInPlace(candidates, rng);

  let walls: GridCoord[] = candidates.slice(0, Math.min(targetWalls, candidates.length));
  const tileGrid = new TileGrid(gridSize, gridSize);
  const waterStart = walls.length;
  const waterEnd = Math.min(candidates.length, waterStart + targetWater);
  for (let i = waterStart; i < waterEnd; i++) {
    tileGrid.setKind(candidates[i]!, 'shallow_water');
  }

  if (config.ensureConnectivity) {
    walls = openCutsUntilConnected(walls, gridSize, config.spawnRowsClear);
  }

  return { tileGrid, walls };
}

/**
 * Fisher–Yates shuffle in place. Uses the supplied RNG so the result is
 * deterministic per seed.
 */
function shuffleInPlace<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Connectivity guard. Probes a path from the lowest spawn row to the
 * highest using 8-dir BFS over the unblocked cells; if blocked, drops
 * walls one at a time (in input order) until the path opens. Worst case
 * removes every wall, which is fine — degenerate seeds turn into bare
 * arenas rather than unplayable battles.
 *
 * Input order is deterministic (Fisher–Yates output), so the "which wall
 * gets removed first" choice is also deterministic per seed.
 */
function openCutsUntilConnected(
  walls: readonly GridCoord[],
  gridSize: number,
  spawnRowsClear: readonly number[],
): GridCoord[] {
  if (spawnRowsClear.length < 2) return walls.slice();
  const center = Math.floor(gridSize / 2);
  const start: GridCoord = { x: center, y: Math.min(...spawnRowsClear) };
  const goal: GridCoord = { x: center, y: Math.max(...spawnRowsClear) };

  const remaining = walls.slice();
  while (!hasPath(start, goal, remaining, gridSize)) {
    if (remaining.length === 0) return remaining;
    remaining.shift();
  }
  return remaining;
}

function hasPath(
  start: GridCoord,
  goal: GridCoord,
  walls: readonly GridCoord[],
  gridSize: number,
): boolean {
  const blocked = new Set<string>();
  for (const w of walls) blocked.add(`${w.x},${w.y}`);
  if (blocked.has(`${goal.x},${goal.y}`)) return false;

  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue: GridCoord[] = [start];
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (c.x === goal.x && c.y === goal.y) return true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        const k = `${nx},${ny}`;
        if (visited.has(k) || blocked.has(k)) continue;
        visited.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}
