import { describe, it, expect } from 'vitest';
import { TileGrid, TILE_DEFS, tileDef, type TileKind } from './TileGrid';

describe('TileDef table (§37a — the seam)', () => {
  // The byte-identical guarantee: the generalized table must reproduce the
  // exact pre-37a costs. Listed literally (NOT read from the table under test)
  // so a typo in TILE_DEFS is caught rather than tautologically passed.
  const EXISTING_COSTS: Record<TileKind, number> = {
    floor: 1,
    shallow_water: 2,
    chasm: Infinity,
    fire: 1,
    healing: 1,
  };

  it('resolves every existing kind to its pre-37a cost', () => {
    for (const kind of Object.keys(EXISTING_COSTS) as TileKind[]) {
      expect(tileDef(kind).cost).toBe(EXISTING_COSTS[kind]);
      expect(TILE_DEFS[kind].cost).toBe(EXISTING_COSTS[kind]);
    }
  });

  it('passability is consistent with cost (finite cost ⇒ passable)', () => {
    for (const kind of Object.keys(TILE_DEFS) as TileKind[]) {
      expect(TILE_DEFS[kind].passable).toBe(isFinite(TILE_DEFS[kind].cost));
    }
  });

  it('carries no combat mods or status hooks on the existing kinds (byte-identical)', () => {
    for (const kind of Object.keys(EXISTING_COSTS) as TileKind[]) {
      const def = TILE_DEFS[kind];
      expect(def.evasionMod).toBeUndefined();
      expect(def.accuracyMod).toBeUndefined();
      expect(def.statusOnEnter).toBeUndefined();
      expect(def.statusRemovedOnEnter).toBeUndefined();
    }
  });

  it('defAt resolves a cell to its TileDef and throws out of bounds', () => {
    const g = new TileGrid(2, 2);
    g.setKind({ x: 1, y: 0 }, 'chasm');
    expect(g.defAt({ x: 0, y: 0 })).toBe(TILE_DEFS.floor);
    expect(g.defAt({ x: 1, y: 0 })).toBe(TILE_DEFS.chasm);
    expect(() => g.defAt({ x: -1, y: 0 })).toThrow();
  });
});

describe('TileGrid', () => {
  it('defaults every cell to floor', () => {
    const g = new TileGrid(4, 3);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 4; x++) {
        expect(g.kindAt({ x, y })).toBe('floor');
        expect(g.costAt({ x, y })).toBe(1);
      }
    }
  });

  it('reports shallow_water as twice the cost of floor', () => {
    const g = new TileGrid(2, 2);
    g.setKind({ x: 1, y: 1 }, 'shallow_water');
    expect(g.kindAt({ x: 1, y: 1 })).toBe('shallow_water');
    expect(g.costAt({ x: 1, y: 1 })).toBe(2);
    expect(g.costAt({ x: 0, y: 0 })).toBe(1);
  });

  it('reports chasm as Infinity cost (data-driven block)', () => {
    const g = new TileGrid(2, 2);
    g.setKind({ x: 1, y: 1 }, 'chasm');
    expect(g.kindAt({ x: 1, y: 1 })).toBe('chasm');
    expect(g.costAt({ x: 1, y: 1 })).toBe(Infinity);
  });

  it('reports fire + healing as normal floor cost (surface effect, not obstacle)', () => {
    const g = new TileGrid(2, 2);
    g.setKind({ x: 0, y: 0 }, 'fire');
    g.setKind({ x: 1, y: 0 }, 'healing');
    expect(g.kindAt({ x: 0, y: 0 })).toBe('fire');
    expect(g.kindAt({ x: 1, y: 0 })).toBe('healing');
    expect(g.costAt({ x: 0, y: 0 })).toBe(1);
    expect(g.costAt({ x: 1, y: 0 })).toBe(1);
  });

  it('throws on out-of-bounds read/write', () => {
    const g = new TileGrid(3, 3);
    expect(() => g.kindAt({ x: -1, y: 0 })).toThrow();
    expect(() => g.kindAt({ x: 3, y: 0 })).toThrow();
    expect(() => g.setKind({ x: 0, y: 5 }, 'shallow_water')).toThrow();
  });

  it('costAt returns Infinity out of bounds so pathfinding can short-circuit', () => {
    const g = new TileGrid(2, 2);
    expect(g.costAt({ x: -1, y: 0 })).toBe(Infinity);
    expect(g.costAt({ x: 2, y: 0 })).toBe(Infinity);
  });

  it('cells() yields width * height entries in row-major order', () => {
    const g = new TileGrid(3, 2);
    g.setKind({ x: 1, y: 0 }, 'shallow_water');
    const seen = Array.from(g.cells());
    expect(seen.length).toBe(6);
    expect(seen[0]).toEqual({ x: 0, y: 0, kind: 'floor' });
    expect(seen[1]).toEqual({ x: 1, y: 0, kind: 'shallow_water' });
    expect(seen[3]).toEqual({ x: 0, y: 1, kind: 'floor' });
  });

  it('round-trips through toJSON / fromJSON', () => {
    const g = new TileGrid(4, 4);
    g.setKind({ x: 1, y: 2 }, 'shallow_water');
    g.setKind({ x: 3, y: 3 }, 'shallow_water');
    g.setKind({ x: 2, y: 0 }, 'chasm');
    g.setKind({ x: 0, y: 3 }, 'fire');
    g.setKind({ x: 0, y: 2 }, 'healing');
    const restored = TileGrid.fromJSON(g.toJSON());
    expect(restored.width).toBe(4);
    expect(restored.height).toBe(4);
    expect(restored.kindAt({ x: 1, y: 2 })).toBe('shallow_water');
    expect(restored.kindAt({ x: 3, y: 3 })).toBe('shallow_water');
    expect(restored.kindAt({ x: 2, y: 0 })).toBe('chasm');
    expect(restored.costAt({ x: 2, y: 0 })).toBe(Infinity);
    expect(restored.kindAt({ x: 0, y: 3 })).toBe('fire');
    expect(restored.kindAt({ x: 0, y: 2 })).toBe('healing');
    expect(restored.kindAt({ x: 0, y: 0 })).toBe('floor');
  });

  it('rejects mismatched snapshot dimensions', () => {
    expect(() => TileGrid.fromJSON({ width: 3, height: 3, kinds: ['floor'] })).toThrow();
  });
});
