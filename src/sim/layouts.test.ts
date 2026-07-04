import { describe, it, expect } from 'vitest';
import {
  LAYOUT_IDS,
  getLayout,
  SPAWN_REGION_TILE_COUNT,
  SPAWN_REGION_MIN_TILES,
  SPAWN_REGION_MAX_TILES,
  THEMES,
  type LayoutDef,
} from './layouts';
import { LayoutsSchema, SpawnRegionSchema, ThemeSchema } from '../config/layouts';
import { generateTerrain } from './terrainGen';
import { classifyConnectivity } from './layoutConnectivity';
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

      it('is not severed by indestructible obstacles (auto-target-aware, §40 follow-up)', () => {
        // Hand-authored layouts that HARD-sever the board are bugs, not seeds to be
        // rescued. §40 follow-up: connectivity is now auto-target-aware — rubble is
        // passable (the AI auto-breaks it) and a destructible wall/cover is only a
        // SOFT blocker (a player can manually break it), so a shipped map must merely
        // not be `severed` (a `destructible-dependent` map is a legit author choice,
        // caught behaviorally by layout-deadlock.test.ts if it stalemates). Only
        // INDESTRUCTIBLE walls/half-cover (no hp) + chasm + deep water hard-block; fire
        // / healing / the passable §37 tiles are cost-bearing surface effects, not
        // obstacles.
        const hardBlockers = [
          ...layout.walls.filter((w) => w.hp == null),
          ...(layout.halfCovers ?? []).filter((hc) => hc.hp == null),
          ...(layout.chasms ?? []),
          ...(layout.deepWater ?? []),
        ];
        const destructibleBlockers = [
          ...layout.walls.filter((w) => w.hp != null),
          ...(layout.halfCovers ?? []).filter((hc) => hc.hp != null),
        ];
        expect(
          classifyConnectivity({
            gridW: layout.gridW,
            gridH: layout.gridH,
            spawns: layout.spawns,
            hardBlockers,
            destructibleBlockers,
          }),
        ).not.toBe('severed');
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

      it('spawn tiles never sit on impassable or occupied cells (walls, half-covers, chasms, deep water)', () => {
        // §37g — spawns ARE allowed on passable terrain (water / fire / healing
        // / hills / ice / sand / mud); only impassable cells (chasm, deep water)
        // and neutral-occupied cells (wall, half-cover) are off-limits. This
        // pins that the shipped layouts respect the relaxed rule.
        const blocked = new Set<string>();
        for (const w of layout.walls) blocked.add(`${w.x},${w.y}`);
        for (const hc of layout.halfCovers ?? []) blocked.add(`${hc.x},${hc.y}`);
        for (const c of layout.chasms ?? []) blocked.add(`${c.x},${c.y}`);
        for (const d of layout.deepWater ?? []) blocked.add(`${d.x},${d.y}`);
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

describe('§37g — a spawn region may sit on passable terrain, not impassable/occupied cells', () => {
  // One terrain cell placed at (0,0) — a player-spawn tile in the base — then run
  // through the REAL loader schema. Passable kinds must be ACCEPTED (a unit can
  // stand + fight there, its terrain mods applying live); impassable / neutral-
  // occupied kinds must be REJECTED (it physically can't occupy the cell).
  const bandRow = (y: number): GridCoord[] =>
    Array.from({ length: 8 }, (_, x) => ({ x, y }));
  const base = (field: keyof LayoutDef): LayoutDef => {
    const layout: LayoutDef = {
      id: 'spawn-on-terrain',
      name: 'Spawn On Terrain',
      description: '§37g fixture — a spawn tile coincident with one terrain cell.',
      gridW: 8,
      gridH: 8,
      theme: 'grassland',
      walls: [],
      spawns: [
        { availability: 'player', tiles: bandRow(0) },
        { availability: 'enemy', tiles: bandRow(7) },
      ],
    };
    (layout as Record<string, unknown>)[field] = [{ x: 0, y: 0 }];
    return layout;
  };

  for (const field of ['water', 'fires', 'healings', 'hills', 'ice', 'sand', 'mud'] as const) {
    it(`accepts a spawn tile on passable terrain (${field})`, () => {
      expect(LayoutsSchema.safeParse([base(field)]).success).toBe(true);
    });
  }

  for (const field of ['walls', 'halfCovers', 'chasms', 'deepWater'] as const) {
    it(`rejects a spawn tile on an impassable / occupied cell (${field})`, () => {
      expect(LayoutsSchema.safeParse([base(field)]).success).toBe(false);
    });
  }
});

describe('§40c — optional per-instance wall/cover HP (destructibility)', () => {
  // A minimal valid layout; callers drop in the wall / half-cover set under test.
  const layoutWith = (patch: Record<string, unknown>): Record<string, unknown> => ({
    id: 'destructible-wall',
    name: 'Destructible Wall',
    description: '§40c fixture — a wall carrying a per-instance HP pool.',
    gridW: 8,
    gridH: 8,
    theme: 'grassland',
    walls: [],
    spawns: [
      { availability: 'player', tiles: [{ x: 0, y: 0 }] },
      { availability: 'enemy', tiles: [{ x: 7, y: 7 }] },
    ],
    ...patch,
  });

  it('accepts + preserves an optional wall `hp`; a bare wall stays hp-less', () => {
    const parsed = LayoutsSchema.parse([
      layoutWith({ walls: [{ x: 3, y: 3, hp: 40 }, { x: 4, y: 4 }] }),
    ]);
    expect(parsed[0]!.walls[0]!.hp).toBe(40); // the destructible placement
    expect(parsed[0]!.walls[1]!.hp).toBeUndefined(); // the indestructible default
  });

  it('accepts an optional half-cover `hp` too', () => {
    const parsed = LayoutsSchema.parse([layoutWith({ halfCovers: [{ x: 2, y: 2, hp: 25 }] })]);
    expect(parsed[0]!.halfCovers?.[0]?.hp).toBe(25);
  });

  it('rejects a non-positive wall `hp` (the typo guard)', () => {
    expect(LayoutsSchema.safeParse([layoutWith({ walls: [{ x: 3, y: 3, hp: 0 }] })]).success).toBe(
      false,
    );
    expect(
      LayoutsSchema.safeParse([layoutWith({ walls: [{ x: 3, y: 3, hp: -5 }] })]).success,
    ).toBe(false);
  });
});

describe('§40d — rubble in layouts (destructible multi-tile neutrals)', () => {
  // A minimal valid 8×8 layout; callers drop in the rubble (and any walls) under
  // test. Single-tile spawns at opposite corners keep the valid-pair rule happy.
  const layoutWith = (patch: Record<string, unknown>): Record<string, unknown> => ({
    id: 'rubble-layout',
    name: 'Rubble Layout',
    description: '§40d fixture — a layout carrying destructible rubble.',
    gridW: 8,
    gridH: 8,
    theme: 'grassland',
    walls: [],
    spawns: [
      { availability: 'player', tiles: [{ x: 0, y: 0 }] },
      { availability: 'enemy', tiles: [{ x: 7, y: 7 }] },
    ],
    ...patch,
  });

  it('accepts + preserves rubble size + hp; a bare rubble omits both (defaults)', () => {
    const parsed = LayoutsSchema.parse([
      layoutWith({ rubble: [{ x: 3, y: 3, size: 2, hp: 99 }, { x: 6, y: 1 }] }),
    ]);
    expect(parsed[0]!.rubble?.[0]).toEqual({ x: 3, y: 3, size: 2, hp: 99 });
    // A bare coord parses unchanged — no injected size/hp defaults (they resolve
    // at spawn time: size→1×1, hp→the catalog default).
    expect(parsed[0]!.rubble?.[1]).toEqual({ x: 6, y: 1 });
  });

  it('rejects a rubble footprint that runs off the grid', () => {
    // size 3 at (6,1) → cells x = 6,7,8; x=8 is off an 8-wide grid.
    expect(
      LayoutsSchema.safeParse([layoutWith({ rubble: [{ x: 6, y: 1, size: 3 }] })]).success,
    ).toBe(false);
  });

  it('rejects rubble whose footprint overlaps a wall', () => {
    // 2×2 at (3,3) covers (4,4), where a wall sits.
    expect(
      LayoutsSchema.safeParse([
        layoutWith({ walls: [{ x: 4, y: 4 }], rubble: [{ x: 3, y: 3, size: 2 }] }),
      ]).success,
    ).toBe(false);
  });

  it('rejects two rubble blocks that overlap', () => {
    // (4,4) is a cell of the 2×2 anchored at (3,3).
    expect(
      LayoutsSchema.safeParse([
        layoutWith({ rubble: [{ x: 3, y: 3, size: 2 }, { x: 4, y: 4 }] }),
      ]).success,
    ).toBe(false);
  });

  it('rejects a spawn tile sitting on a rubble footprint cell', () => {
    // rubble on the enemy spawn (7,7).
    expect(LayoutsSchema.safeParse([layoutWith({ rubble: [{ x: 7, y: 7 }] })]).success).toBe(false);
  });

  it('rejects a rubble size outside 1..3 (the typo guard)', () => {
    expect(
      LayoutsSchema.safeParse([layoutWith({ rubble: [{ x: 2, y: 2, size: 4 }] })]).success,
    ).toBe(false);
    expect(
      LayoutsSchema.safeParse([layoutWith({ rubble: [{ x: 2, y: 2, size: 0 }] })]).success,
    ).toBe(false);
  });

  it('accepts a valid multi-tile rubble that fits clear of everything', () => {
    expect(
      LayoutsSchema.safeParse([
        layoutWith({ rubble: [{ x: 3, y: 3, size: 2 }, { x: 6, y: 1 }] }),
      ]).success,
    ).toBe(true);
  });
});

describe('§40g — layered overlap (a neutral may sit on a terrain tile)', () => {
  // A minimal valid 8×8 layout; callers drop in the terrain/neutral sets under
  // test. Single-tile spawns at opposite corners keep the valid-pair rule happy
  // and stay clear of the (3,3)-region the overlap fixtures use.
  const layoutWith = (patch: Record<string, unknown>): Record<string, unknown> => ({
    id: 'layered-overlap',
    name: 'Layered Overlap',
    description: '§40g fixture — a neutral obstacle sharing a cell with terrain.',
    gridW: 8,
    gridH: 8,
    theme: 'grassland',
    walls: [],
    spawns: [
      { availability: 'player', tiles: [{ x: 0, y: 0 }] },
      { availability: 'enemy', tiles: [{ x: 7, y: 7 }] },
    ],
    ...patch,
  });

  // The relaxation: a wall / half-cover / rubble may now coincide with a terrain
  // tile (the obstacle breaks → the tile beneath is revealed). Both passable
  // (sand/water) and impassable (chasm/deepWater) terrain are allowed under it.
  it('accepts a wall on sand (passable terrain)', () => {
    expect(
      LayoutsSchema.safeParse([layoutWith({ walls: [{ x: 3, y: 3 }], sand: [{ x: 3, y: 3 }] })])
        .success,
    ).toBe(true);
  });

  it('accepts a half-cover on water', () => {
    expect(
      LayoutsSchema.safeParse([layoutWith({ halfCovers: [{ x: 3, y: 3 }], water: [{ x: 3, y: 3 }] })])
        .success,
    ).toBe(true);
  });

  it('accepts rubble on mud (the whole footprint over terrain)', () => {
    expect(
      LayoutsSchema.safeParse([
        layoutWith({ rubble: [{ x: 2, y: 2, size: 2 }], mud: [{ x: 2, y: 2 }, { x: 3, y: 3 }] }),
      ]).success,
    ).toBe(true);
  });

  it('accepts a wall on impassable terrain (chasm / deep water)', () => {
    expect(
      LayoutsSchema.safeParse([layoutWith({ walls: [{ x: 3, y: 3 }], chasms: [{ x: 3, y: 3 }] })])
        .success,
    ).toBe(true);
    expect(
      LayoutsSchema.safeParse([
        layoutWith({ walls: [{ x: 3, y: 3 }], deepWater: [{ x: 3, y: 3 }] }),
      ]).success,
    ).toBe(true);
  });

  // The mutex rules that STAY: two obstacles can't share a cell, and two terrain
  // kinds can't share a cell.
  it('still rejects two neutrals on the same cell (wall + half-cover)', () => {
    expect(
      LayoutsSchema.safeParse([
        layoutWith({ walls: [{ x: 3, y: 3 }], halfCovers: [{ x: 3, y: 3 }] }),
      ]).success,
    ).toBe(false);
  });

  it('still rejects two terrain kinds on the same cell (sand + water)', () => {
    expect(
      LayoutsSchema.safeParse([layoutWith({ sand: [{ x: 3, y: 3 }], water: [{ x: 3, y: 3 }] })])
        .success,
    ).toBe(false);
  });

  // A neutral still blocks spawns even when it sits on passable terrain — it's
  // the OBSTACLE the unit can't stand on, regardless of the tile beneath it.
  it('still blocks a spawn tile that sits on a wall-on-sand cell', () => {
    expect(
      LayoutsSchema.safeParse([
        layoutWith({
          walls: [{ x: 0, y: 0 }],
          sand: [{ x: 0, y: 0 }],
        }),
      ]).success,
    ).toBe(false); // the player spawn at (0,0) now sits on a wall
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

// §40 follow-up — the local king-move BFS + centroid helpers were retired: the
// shipped-layout connectivity guard now imports the shared `classifyConnectivity`
// (src/sim/layoutConnectivity.ts), unit-tested in layoutConnectivity.test.ts.
