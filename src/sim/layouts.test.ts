import { describe, it, expect } from 'vitest';
import {
  LAYOUT_IDS,
  getLayout,
  SPAWN_REGION_TILE_COUNT,
  type LayoutDef,
} from './layouts';
import { generateTerrain, reservedSpawnRows } from './terrainGen';
import { RNG } from '../core/RNG';
import type { TerrainConfig } from '../config/terrain';

const BASE: TerrainConfig = {
  wallDensity: 0.06,
  shallowWaterDensity: 0.04,
  proceduralMinSize: 10,
  proceduralMaxSize: 20,
  ensureConnectivity: true,
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

      it('places no walls on reserved spawn rows', () => {
        const reserved = new Set(reservedSpawnRows(layout.gridH));
        for (const w of layout.walls) {
          expect(reserved.has(w.y)).toBe(false);
        }
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

      it('leaves at least one path between the spawn rows', () => {
        // Mirror of terrainGen's connectivity check: hand-authored layouts
        // that sever the board are bugs, not seeds to be rescued.
        expect(
          hasPathThrough(layout.walls, layout.gridW, layout.gridH, reservedSpawnRows(layout.gridH)),
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

      it('every spawn region has exactly 8 in-bounds tiles', () => {
        for (const region of layout.spawns) {
          expect(region.tiles.length).toBe(SPAWN_REGION_TILE_COUNT);
          for (const t of region.tiles) {
            expect(t.x).toBeGreaterThanOrEqual(0);
            expect(t.y).toBeGreaterThanOrEqual(0);
            expect(t.x).toBeLessThan(layout.gridW);
            expect(t.y).toBeLessThan(layout.gridH);
          }
        }
      });

      it('spawn tiles never overlap walls or water', () => {
        const blocked = new Set<string>();
        for (const w of layout.walls) blocked.add(`${w.x},${w.y}`);
        for (const w of layout.water ?? []) blocked.add(`${w.x},${w.y}`);
        for (const region of layout.spawns) {
          for (const t of region.tiles) {
            expect(blocked.has(`${t.x},${t.y}`)).toBe(false);
          }
        }
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
    const corridor = getLayout('corridor')!;
    expect(() =>
      generateTerrain(new RNG(1), corridor.gridW + 1, corridor.gridH, BASE, 'corridor'),
    ).toThrow(/requires gridW/);
    expect(() =>
      generateTerrain(new RNG(1), corridor.gridW, corridor.gridH + 1, BASE, 'corridor'),
    ).toThrow(/requires gridW/);
  });
});

function hasPathThrough(
  walls: readonly { x: number; y: number }[],
  gridW: number,
  gridH: number,
  reservedRows: readonly number[],
): boolean {
  if (reservedRows.length < 2) return true;
  const center = Math.floor(gridW / 2);
  const start = { x: center, y: Math.min(...reservedRows) };
  const goal = { x: center, y: Math.max(...reservedRows) };
  const blocked = new Set<string>();
  for (const w of walls) blocked.add(`${w.x},${w.y}`);
  if (blocked.has(`${goal.x},${goal.y}`)) return false;

  const visited = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
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
