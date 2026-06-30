import { describe, it, expect } from 'vitest';
import {
  LAYOUT_IDS,
  getLayout,
  SPAWN_REGION_TILE_COUNT,
  SPAWN_REGION_MIN_TILES,
  SPAWN_REGION_MAX_TILES,
  THEMES,
  type LayoutDef,
  type SpawnRegion,
} from './layouts';
import { SpawnRegionSchema, ThemeSchema } from '../config/layouts';
import { generateTerrain } from './terrainGen';
import { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { TERRAIN, type TerrainConfig } from '../config/terrain';

const BASE: TerrainConfig = {
  wallDensity: 0.06,
  shallowWaterDensity: 0.04,
  proceduralMinSize: 10,
  proceduralMaxSize: 20,
  ensureConnectivity: true,
  procedural: TERRAIN.procedural,
};

describe('layouts library', () => {
  it('exposes at least two layouts', () => {
    // The 25/75 mix in Run only pulls its weight if the library is bigger
    // than one entry; this is a guard against accidentally shrinking it.
    expect(LAYOUT_IDS.length).toBeGreaterThanOrEqual(2);
  });

  it('getLayout returns undefined for unknown ids', () => {
    expect(getLayout('nope')).toBeUndefined();
  });

  for (const id of LAYOUT_IDS) {
    describe(`layout "${id}"`, () => {
      const layout = getLayout(id) as LayoutDef;

      it('exists and has the matching id field', () => {
        expect(layout).toBeDefined();
        expect(layout.id).toBe(id);
      });

      it('declares D3 grid dimensions in [8, 32]', () => {
        expect(layout.gridW).toBeGreaterThanOrEqual(8);
        expect(layout.gridW).toBeLessThanOrEqual(32);
        expect(layout.gridH).toBeGreaterThanOrEqual(8);
        expect(layout.gridH).toBeLessThanOrEqual(32);
      });

      it('places every wall inside the layout grid', () => {
        for (const w of layout.walls) {
          expect(w.x).toBeGreaterThanOrEqual(0);
          expect(w.y).toBeGreaterThanOrEqual(0);
          expect(w.x).toBeLessThan(layout.gridW);
          expect(w.y).toBeLessThan(layout.gridH);
        }
      });

      it('places no duplicate wall coordinates', () => {
        const seen = new Set<string>();
        for (const w of layout.walls) {
          const k = `${w.x},${w.y}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      });

      it('places every chasm inside the layout grid with no duplicates', () => {
        const seen = new Set<string>();
        for (const c of layout.chasms ?? []) {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThan(layout.gridW);
          expect(c.y).toBeLessThan(layout.gridH);
          const k = `${c.x},${c.y}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      });

      it('places every fire/healing tile inside the layout grid with no duplicates', () => {
        for (const arrName of ['fires', 'healings'] as const) {
          const seen = new Set<string>();
          for (const c of layout[arrName] ?? []) {
            expect(c.x).toBeGreaterThanOrEqual(0);
            expect(c.y).toBeGreaterThanOrEqual(0);
            expect(c.x).toBeLessThan(layout.gridW);
            expect(c.y).toBeLessThan(layout.gridH);
            const k = `${c.x},${c.y}`;
            expect(seen.has(k)).toBe(false);
            seen.add(k);
          }
        }
      });

      it('leaves at least one path between the first two spawn regions', () => {
        // Mirror of terrainGen's connectivity check: hand-authored layouts
        // that sever the board are bugs, not seeds to be rescued. Walls,
        // half-covers, and chasms block movement (chasm = Infinity cost).
        // Fire + healing don't block — they're normal-cost surface effects
        // — so they're not added to the blocker pool.
        const [a, b] = layout.spawns;
        const blockers = [
          ...layout.walls,
          ...(layout.halfCovers ?? []),
          ...(layout.chasms ?? []),
        ];
        expect(
          hasPathBetween(blockers, layout.gridW, layout.gridH, a!, b!),
        ).toBe(true);
      });

      it('resolves through generateTerrain at the layout\'s own dimensions', () => {
        const { walls } = generateTerrain(new RNG(1), layout.gridW, layout.gridH, BASE, id);
        expect(walls.length).toBe(layout.walls.length);
        for (const w of layout.walls) {
          expect(walls).toContainEqual(w);
        }
      });

      // D5: explicit per-layout spawn regions.
      it('declares at least two spawn regions', () => {
        expect(layout.spawns.length).toBeGreaterThanOrEqual(2);
      });

      it('every spawn region holds an in-range count of in-bounds tiles', () => {
        for (const region of layout.spawns) {
          // H2: regions may range MIN..MAX tiles (was a hard 8).
          expect(region.tiles.length).toBeGreaterThanOrEqual(SPAWN_REGION_MIN_TILES);
          expect(region.tiles.length).toBeLessThanOrEqual(SPAWN_REGION_MAX_TILES);
          for (const t of region.tiles) {
            expect(t.x).toBeGreaterThanOrEqual(0);
            expect(t.y).toBeGreaterThanOrEqual(0);
            expect(t.x).toBeLessThan(layout.gridW);
            expect(t.y).toBeLessThan(layout.gridH);
          }
        }
      });

      it('spawn tiles never overlap walls, water, half-covers, chasms, fires, or healings', () => {
        const blocked = new Set<string>();
        for (const w of layout.walls) blocked.add(`${w.x},${w.y}`);
        for (const w of layout.water ?? []) blocked.add(`${w.x},${w.y}`);
        for (const hc of layout.halfCovers ?? []) blocked.add(`${hc.x},${hc.y}`);
        for (const c of layout.chasms ?? []) blocked.add(`${c.x},${c.y}`);
        for (const f of layout.fires ?? []) blocked.add(`${f.x},${f.y}`);
        for (const h of layout.healings ?? []) blocked.add(`${h.x},${h.y}`);
        for (const region of layout.spawns) {
          for (const t of region.tiles) {
            expect(blocked.has(`${t.x},${t.y}`)).toBe(false);
          }
        }
      });

      it('declares a known D8 theme', () => {
        // The zod schema already gates on this at module load, so a
        // failure here would mean the JSON shipped without going through
        // the loader (impossible) — but the explicit assertion documents
        // intent and catches a future refactor that bypasses parsing.
        expect(THEMES).toContain(layout.theme);
      });

      it('admits at least one valid (player, enemy) region pair', () => {
        const playerPool = layout.spawns.filter(
          (r) => r.availability === 'player' || r.availability === 'both',
        );
        const enemyPool = layout.spawns.filter(
          (r) => r.availability === 'enemy' || r.availability === 'both',
        );
        const hasPair = playerPool.some((p) => enemyPool.some((e) => e !== p));
        expect(hasPair).toBe(true);
      });
    });
  }

  it('generateTerrain throws when dimensions mismatch the layout assumption', () => {
    // Pick any registered layout for the dispatcher-behavior check —
    // the test cares that mismatched dimensions throw, not about a
    // specific layout. `labyrinth` happens to be the first in the
    // library; any id would do.
    const layout = getLayout('labyrinth')!;
    expect(() =>
      generateTerrain(new RNG(1), layout.gridW + 1, layout.gridH, BASE, layout.id),
    ).toThrow(/requires gridW/);
    expect(() =>
      generateTerrain(new RNG(1), layout.gridW, layout.gridH + 1, BASE, layout.id),
    ).toThrow(/requires gridW/);
  });
});

describe('§37e — theme palette rename + the three new themes', () => {
  it('the renamed names resolve; the pre-37e names no longer do', () => {
    // The rename is the reason RunSnapshot bumped v23→v24 (theme is serialized);
    // the old strings must HARD-fail so a stale save can't smuggle one past zod.
    expect(ThemeSchema.safeParse('grassland').success).toBe(true);
    expect(ThemeSchema.safeParse('barren').success).toBe(true);
    expect(ThemeSchema.safeParse('default').success).toBe(false); // was → grassland
    expect(ThemeSchema.safeParse('rock').success).toBe(false); // was → barren
  });

  it('the three new themes resolve, and THEMES carries the full set', () => {
    for (const t of ['tundra', 'desert', 'swamp'] as const) {
      expect(ThemeSchema.safeParse(t).success).toBe(true);
      expect(THEMES).toContain(t);
    }
    // THEMES (the picker pool) and the schema enum agree — adding a theme to one
    // without the other would silently shrink the procedural/editor pool.
    expect([...THEMES].sort()).toEqual(
      ['barren', 'desert', 'grassland', 'swamp', 'tundra', 'volcanic'].sort(),
    );
  });
});

describe('SpawnRegion schema tile-count range (H2)', () => {
  // Distinct, in-bounds tiles so only the count is under test (the
  // duplicate-coord refine is exercised separately below).
  const region = (n: number) => ({
    tiles: Array.from({ length: n }, (_, i) => ({ x: i, y: 0 })),
    availability: 'both' as const,
  });

  it('keeps the procedural/editor default inside the allowed range', () => {
    expect(SPAWN_REGION_TILE_COUNT).toBeGreaterThanOrEqual(SPAWN_REGION_MIN_TILES);
    expect(SPAWN_REGION_TILE_COUNT).toBeLessThanOrEqual(SPAWN_REGION_MAX_TILES);
  });

  it('accepts the min, max, and default tile counts', () => {
    for (const n of [SPAWN_REGION_MIN_TILES, SPAWN_REGION_TILE_COUNT, SPAWN_REGION_MAX_TILES]) {
      expect(SpawnRegionSchema.safeParse(region(n)).success).toBe(true);
    }
  });

  it('rejects a region below the min or above the max', () => {
    expect(SpawnRegionSchema.safeParse(region(SPAWN_REGION_MIN_TILES - 1)).success).toBe(false);
    expect(SpawnRegionSchema.safeParse(region(SPAWN_REGION_MAX_TILES + 1)).success).toBe(false);
  });

  it('still rejects duplicate tiles within an in-range region', () => {
    const dup = { tiles: [{ x: 1, y: 1 }, { x: 1, y: 1 }], availability: 'both' as const };
    expect(SpawnRegionSchema.safeParse(dup).success).toBe(false);
  });
});

function hasPathBetween(
  walls: readonly { x: number; y: number }[],
  gridW: number,
  gridH: number,
  a: SpawnRegion,
  b: SpawnRegion,
): boolean {
  const start = centroid(a);
  const goal = centroid(b);
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
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        const k = `${nx},${ny}`;
        if (visited.has(k) || blocked.has(k)) continue;
        visited.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

function centroid(region: SpawnRegion): GridCoord {
  let sx = 0;
  let sy = 0;
  for (const t of region.tiles) {
    sx += t.x;
    sy += t.y;
  }
  return { x: Math.round(sx / region.tiles.length), y: Math.round(sy / region.tiles.length) };
}
