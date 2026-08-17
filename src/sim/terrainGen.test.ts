import { describe, it, expect } from 'vitest';
import { generateTerrain, generateFromLayout } from './terrainGen';
import { RNG } from '../core/RNG';
import type { GridCoord } from '../core/types';
import { TERRAIN, type TerrainConfig, type ThemeTilesConfig } from '../config/terrain';
import { getLayout, THEMES, type LayoutDef, type SpawnRegion, type Theme } from './layouts';
import type { TileGrid } from './TileGrid';

const G = 12;

const BASE: TerrainConfig = {
  proceduralMinSize: 10,
  proceduralMaxSize: 20,
  procedural: TERRAIN.procedural,
};

describe('§40d — rubble surfaces through generateFromLayout', () => {
  const fixture: LayoutDef = {
    id: 'rubble-fixture',
    name: 'Rubble Fixture',
    description: '§40d — a hand-built layout with rubble for the mapping test.',
    gridW: 10,
    gridH: 10,
    theme: 'grassland',
    walls: [],
    rubble: [{ x: 1, y: 1, size: 2, hp: 99 }, { x: 5, y: 5 }],
    spawns: [
      { availability: 'player', tiles: [{ x: 0, y: 0 }] },
      { availability: 'enemy', tiles: [{ x: 9, y: 9 }] },
    ],
  };

  it('carries each rubble placement (size + hp) into GeneratedTerrain, verbatim', () => {
    const { rubble } = generateFromLayout(fixture, 10, 10);
    expect(rubble).toEqual([{ x: 1, y: 1, size: 2, hp: 99 }, { x: 5, y: 5 }]);
  });

  it('procedural terrain surfaces no rubble (hand-authored-only)', () => {
    expect(generateTerrain(new RNG(1), G, G, BASE).rubble).toEqual([]);
  });
});

describe('generateTerrain (procedural)', () => {
  it('emits two `both` spawn regions on the literal top + bottom edges', () => {
    const { spawnRegions } = generateTerrain(new RNG(42), G, G, BASE);
    expect(spawnRegions.length).toBe(2);
    for (const region of spawnRegions) {
      expect(region.availability).toBe('both');
      expect(region.tiles.length).toBe(8);
    }
    // Top band on y=0, bottom band on y=gridH-1.
    const ys = spawnRegions.map((r) => r.tiles[0]!.y);
    expect(ys).toContain(0);
    expect(ys).toContain(G - 1);
  });

  it('leaves every spawn-region tile free of obstacles and water', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { tileGrid, walls, halfCovers, spawnRegions } = generateTerrain(new RNG(seed), G, G, BASE);
      const spawnTiles = collectSpawnTiles(spawnRegions);
      const obstacleSet = new Set([...walls, ...halfCovers].map((c) => `${c.x},${c.y}`));
      for (const t of spawnTiles) {
        expect(tileGrid.kindAt(t)).toBe('floor');
        expect(obstacleSet.has(`${t.x},${t.y}`)).toBe(false);
      }
    }
  });

  it('places walls, half-cover, and water on mutually disjoint cells', () => {
    const { tileGrid, walls, halfCovers } = generateTerrain(new RNG(7), G, G, BASE);
    const seen = new Set<string>();
    for (const c of [...walls, ...halfCovers]) {
      const k = `${c.x},${c.y}`;
      // Obstacle cells are never watered, and never doubled up.
      expect(tileGrid.kindAt(c)).toBe('floor');
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('keeps total obstacles under the configured wall cap', () => {
    // Derived from the config (balance-proof): the generator trims obstacles
    // to at most `wallCapFraction` of the board, and the connectivity guard
    // only ever converts obstacles to water, so the count can't exceed it.
    const cap = Math.floor(TERRAIN.procedural.wallCapFraction * G * G);
    for (let seed = 0; seed < 50; seed++) {
      const { walls, halfCovers } = generateTerrain(new RNG(seed), G, G, BASE);
      expect(walls.length + halfCovers.length).toBeLessThanOrEqual(cap);
    }
  });

  it('always connects the two spawn regions (the connectivity guard fires)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const terrain = generateTerrain(new RNG(seed), G, G, BASE);
      expect(spawnRegionsConnected(terrain, G, G)).toBe(true);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateTerrain(new RNG(99), G, G, BASE);
    const b = generateTerrain(new RNG(99), G, G, BASE);
    expect(a.walls).toEqual(b.walls);
    expect(a.halfCovers).toEqual(b.halfCovers);
    expect(a.tileGrid.toJSON()).toEqual(b.tileGrid.toJSON());
    expect(a.spawnRegions).toEqual(b.spawnRegions);
  });

  it('produces varied terrain across seeds', () => {
    const fingerprints = new Set<string>();
    for (let seed = 0; seed < 16; seed++) {
      const t = generateTerrain(new RNG(seed), G, G, BASE);
      fingerprints.add(JSON.stringify([t.walls, t.halfCovers, t.tileGrid.toJSON().kinds]));
    }
    expect(fingerprints.size).toBeGreaterThan(1);
  });

  it('honors rectangular dimensions (D3): gridW != gridH paints in-bounds only', () => {
    const gridW = 15;
    const gridH = 10;
    const { tileGrid, walls, halfCovers, spawnRegions } = generateTerrain(new RNG(7), gridW, gridH, BASE);
    expect(tileGrid.width).toBe(gridW);
    expect(tileGrid.height).toBe(gridH);
    for (const c of [...walls, ...halfCovers]) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(gridW);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(gridH);
    }
    const spawnTiles = collectSpawnTiles(spawnRegions);
    const obstacleSet = new Set([...walls, ...halfCovers].map((c) => `${c.x},${c.y}`));
    for (const t of spawnTiles) {
      expect(obstacleSet.has(`${t.x},${t.y}`)).toBe(false);
    }
  });

  it('dispatches to the hand-authored library when layoutId is set', () => {
    // The test cares about the dispatch PATH, not labyrinth's specific size — read
    // the layout's OWN dimensions (never a hardcoded G) so resizing the shipped
    // layout doesn't break this (generateTerrain hard-requires the layout's dims).
    // Assert the emitted wall count matches the layout's declared walls — a tight
    // fingerprint distinguishing library dispatch from the procedural path.
    const layout = getLayout('labyrinth')!;
    const { walls } = generateTerrain(new RNG(1), layout.gridW, layout.gridH, BASE, 'labyrinth');
    expect(walls.length).toBe(layout.walls.length);
  });

  it('layout dispatch returns the layout-declared spawn regions verbatim', () => {
    const layout = getLayout('labyrinth')!;
    const { spawnRegions } = generateTerrain(new RNG(1), layout.gridW, layout.gridH, BASE, 'labyrinth');
    // "Verbatim" — the dispatch hands back the layout's own spawn regions unchanged;
    // compare against the declaration itself rather than a hardcoded tile count.
    expect(spawnRegions).toEqual(layout.spawns);
  });

  it('layout dispatch ignores the RNG (same layoutId → same walls regardless of seed)', () => {
    const layout = getLayout('labyrinth')!;
    const a = generateTerrain(new RNG(1), layout.gridW, layout.gridH, BASE, 'labyrinth');
    const b = generateTerrain(new RNG(999), layout.gridW, layout.gridH, BASE, 'labyrinth');
    expect(a.walls).toEqual(b.walls);
  });

  it('throws on an unknown layoutId', () => {
    expect(() => generateTerrain(new RNG(1), G, G, BASE, 'nonexistent')).toThrow(/unknown layoutId/i);
  });
});

describe('§81a — per-theme procedural tiles (through generateTerrain)', () => {
  const SEEDS = 40;
  const kindsAcrossSeeds = (theme: Theme): Set<string> => {
    const seen = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const { tileGrid } = generateTerrain(new RNG(seed), G, G, BASE, null, theme);
      for (const c of tileGrid.cells()) seen.add(c.kind);
    }
    return seen;
  };

  it('each theme lands every tile kind its shipped envelope declares (over seeds)', () => {
    // Derived from the config, not hardcoded per theme: a declared knob with a
    // positive max must land its kind somewhere across enough seeds.
    const KNOB_TO_KIND: ReadonlyArray<readonly [keyof ThemeTilesConfig, string]> = [
      ['deepWaterFraction', 'deep_water'],
      ['hills', 'hills'],
      ['ice', 'ice'],
      ['sand', 'sand'],
      ['mud', 'mud'],
      ['fire', 'fire'],
    ];
    for (const theme of THEMES) {
      const declared = TERRAIN.procedural.themeTiles[theme];
      const seen = kindsAcrossSeeds(theme);
      for (const [knob, kind] of KNOB_TO_KIND) {
        const spec = declared[knob];
        if (spec !== undefined && spec.max > 0) {
          expect(seen, `theme "${theme}" should produce ${kind}`).toContain(kind);
        } else {
          expect(seen, `theme "${theme}" must not produce ${kind}`).not.toContain(kind);
        }
      }
    }
  });

  it('fire is volcanic-only in the shipped config (the signed §81 revert, kept sparse)', () => {
    // Guard the DESIGN intent directly, not just the mechanism: only volcanic
    // declares a fire knob today.
    for (const theme of THEMES) {
      const declaresFire = TERRAIN.procedural.themeTiles[theme].fire !== undefined;
      expect(declaresFire, `theme "${theme}" fire declaration`).toBe(theme === 'volcanic');
    }
    // And the scatter stays sparse: within the envelope's max chance ceiling
    // (board share), with real headroom — derived from config, not hardcoded.
    const fireMax = TERRAIN.procedural.themeTiles.volcanic.fire!.max;
    for (let seed = 0; seed < SEEDS; seed++) {
      const t = generateTerrain(new RNG(seed), G, G, BASE, null, 'volcanic');
      expect(t.fires.length).toBeLessThanOrEqual(Math.ceil(G * G * fireMax * 2));
      for (const f of t.fires) expect(t.tileGrid.kindAt(f)).toBe('fire');
    }
  });

  it('is deterministic per (seed, theme) and theme-sensitive for the same seed', () => {
    const a = generateTerrain(new RNG(123), G, G, BASE, null, 'swamp');
    const b = generateTerrain(new RNG(123), G, G, BASE, null, 'swamp');
    expect(a.tileGrid.toJSON()).toEqual(b.tileGrid.toJSON());
    expect(a.walls).toEqual(b.walls);
    // Different theme, same seed → different draw plan (swamp declares three
    // knobs; grassland two) — the grids should diverge across a few seeds.
    let diverged = false;
    for (let seed = 0; seed < 10 && !diverged; seed++) {
      const s = generateTerrain(new RNG(seed), G, G, BASE, null, 'swamp');
      const g = generateTerrain(new RNG(seed), G, G, BASE, null, 'grassland');
      diverged = JSON.stringify(s.tileGrid.toJSON()) !== JSON.stringify(g.tileGrid.toJSON());
    }
    expect(diverged).toBe(true);
  });

  it('spawn bands stay connected on the wettest shipped theme (deep water blocks)', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const t = generateTerrain(new RNG(seed), G, G, BASE, null, 'swamp');
      expect(spawnRegionsConnected(t, G, G, deepWaterCells(t.tileGrid))).toBe(true);
    }
  });

  it('§81b — camp sites ride with the theme pool; the spawnCamps pairing invariant holds', () => {
    // A stocked-pool theme rolls sites on some seeds, and sites ALWAYS come
    // with the pool attached (spawnCamps throws on sites-without-pool).
    let rolled = 0;
    for (let seed = 0; seed < 60; seed++) {
      const t = generateTerrain(new RNG(seed), G, G, BASE, null, 'swamp');
      if (t.campSpawns.length > 0) {
        rolled++;
        expect(t.camps).toEqual(TERRAIN.procedural.camps.pools.swamp);
      } else {
        expect(t.camps).toEqual([]);
      }
    }
    expect(rolled).toBeGreaterThan(0);
  });

  it('§81b — an empty-pool theme (shipped: volcanic) never rolls camp sites', () => {
    expect(TERRAIN.procedural.camps.pools.volcanic).toEqual([]);
    for (let seed = 0; seed < 30; seed++) {
      const t = generateTerrain(new RNG(seed), G, G, BASE, null, 'volcanic');
      expect(t.campSpawns).toEqual([]);
      expect(t.camps).toEqual([]);
    }
  });
});

function collectSpawnTiles(regions: readonly SpawnRegion[]): GridCoord[] {
  const out: GridCoord[] = [];
  for (const region of regions) {
    for (const t of region.tiles) out.push(t);
  }
  return out;
}

/** §81a — the impassable deep-water cells of a grid, in the blocked-set key
 *  format `spawnRegionsConnected` consumes. */
function deepWaterCells(tileGrid: TileGrid): Set<string> {
  const out = new Set<string>();
  for (const c of tileGrid.cells()) if (c.kind === 'deep_water') out.add(`${c.x},${c.y}`);
  return out;
}

/** BFS between the first two spawn-region centroids over passable cells (floor +
 *  water), blocking walls AND half-cover — the generator's own passability.
 *  §81a: pass `extraBlocked` (e.g. deep-water cells) to block tiles too. */
function spawnRegionsConnected(
  terrain: { walls: readonly GridCoord[]; halfCovers: readonly GridCoord[]; spawnRegions: readonly SpawnRegion[] },
  gridW: number,
  gridH: number,
  extraBlocked: ReadonlySet<string> = new Set(),
): boolean {
  const blocked = new Set<string>(extraBlocked);
  for (const c of [...terrain.walls, ...terrain.halfCovers]) blocked.add(`${c.x},${c.y}`);
  const start = centroid(terrain.spawnRegions[0]!);
  const goal = centroid(terrain.spawnRegions[1]!);
  if (blocked.has(`${goal.x},${goal.y}`) || blocked.has(`${start.x},${start.y}`)) return false;

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
