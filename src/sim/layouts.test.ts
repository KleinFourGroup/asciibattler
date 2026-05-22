import { describe, it, expect } from 'vitest';
import { LAYOUT_IDS, getLayout, type LayoutDef } from './layouts';
import { generateTerrain } from './terrainGen';
import { RNG } from '../core/RNG';
import type { TerrainConfig } from '../config/terrain';

const G = 12;

const BASE: TerrainConfig = {
  wallDensity: 0.06,
  shallowWaterDensity: 0.04,
  spawnRowsClear: [1, 2, 9, 10],
  ensureConnectivity: true,
};

describe('layouts library', () => {
  it('exposes at least two layouts', () => {
    // The 50/50 mix in Run only pulls its weight if the library is bigger
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

      it('places no walls on reserved spawn rows', () => {
        for (const w of layout.walls) {
          expect(BASE.spawnRowsClear).not.toContain(w.y);
        }
      });

      it('places every wall inside the grid', () => {
        for (const w of layout.walls) {
          expect(w.x).toBeGreaterThanOrEqual(0);
          expect(w.y).toBeGreaterThanOrEqual(0);
          expect(w.x).toBeLessThan(G);
          expect(w.y).toBeLessThan(G);
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
        expect(hasPathThrough(layout.walls, G, BASE.spawnRowsClear)).toBe(true);
      });

      it('resolves through generateTerrain to the same wall set', () => {
        const { walls } = generateTerrain(new RNG(1), G, BASE, id);
        expect(walls.length).toBe(layout.walls.length);
        for (const w of layout.walls) {
          expect(walls).toContainEqual(w);
        }
      });
    });
  }

  it('generateTerrain throws when grid size mismatches the layout assumption', () => {
    expect(() => generateTerrain(new RNG(1), 10, BASE, 'corridor')).toThrow(/requires gridSize/);
  });
});

function hasPathThrough(
  walls: readonly { x: number; y: number }[],
  gridSize: number,
  spawnRowsClear: readonly number[],
): boolean {
  const center = Math.floor(gridSize / 2);
  const start = { x: center, y: Math.min(...spawnRowsClear) };
  const goal = { x: center, y: Math.max(...spawnRowsClear) };
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
