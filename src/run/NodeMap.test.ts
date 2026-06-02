import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { NODE_MAP } from '../config/nodemap';
import { generate, dump, type NodeMap, type MapEdge } from './NodeMap';

// Balance-proof: derive every bound from the config the generator actually
// reads, so a config/nodemap.json tweak is a one-file edit, not test churn.
const { floorCount, middleWidthMin, middleWidthMax, targetTotalMax, maxOutDegree } = NODE_MAP;
// A map is root(1) + (floorCount-2) middle floors at ≥ middleWidthMin + terminal(1).
const MIN_TOTAL = 1 + (floorCount - 2) * middleWidthMin + 1;

describe('NodeMap.generate', () => {
  describe('shape', () => {
    it('node count stays within the config-derived budget', () => {
      // Sweep seeds to catch a bad bound, not just the lucky one.
      for (let s = 0; s < 100; s++) {
        const map = generate(new RNG(s));
        expect(map.nodes.length).toBeGreaterThanOrEqual(MIN_TOTAL);
        expect(map.nodes.length).toBeLessThanOrEqual(targetTotalMax);
      }
    });

    it('has the configured floor count', () => {
      expect(generate(new RNG(1)).floors).toHaveLength(floorCount);
    });

    it('has a single root on floor 0', () => {
      const map = generate(new RNG(1));
      expect(map.floors[0]).toEqual([map.rootId]);
      expect(nodeById(map, map.rootId).floor).toBe(0);
    });

    it('has a single terminal on the last floor', () => {
      const map = generate(new RNG(1));
      const lastFloor = map.floors[map.floors.length - 1]!;
      expect(lastFloor).toEqual([map.terminalId]);
      expect(nodeById(map, map.terminalId).floor).toBe(map.floors.length - 1);
    });

    it('every middle floor width is within [middleWidthMin, middleWidthMax]', () => {
      for (let s = 0; s < 50; s++) {
        const map = generate(new RNG(s));
        for (let f = 1; f < map.floors.length - 1; f++) {
          expect(map.floors[f]!.length).toBeGreaterThanOrEqual(middleWidthMin);
          expect(map.floors[f]!.length).toBeLessThanOrEqual(middleWidthMax);
        }
      }
    });

    it('root and the first battle floor are always battle nodes', () => {
      // Root (floor 0) is an inert battle (rendered @); floor 1 is the first
      // battle and never rest-eligible — so single-hop-from-root navigation
      // always lands on a battle. Boss/rest land in the `node kinds (G3)`
      // block below.
      for (let s = 0; s < 50; s++) {
        const map = generate(new RNG(s));
        for (const n of map.nodes) {
          if (n.floor === 0 || n.floor === 1) expect(n.kind).toBe('battle');
        }
      }
    });
  });

  describe('node kinds (G3)', () => {
    // Balance-proof: spacing bound comes from the config the generator reads.
    const { restMinSpacing } = NODE_MAP;

    it('the terminal is the one and only boss', () => {
      for (let s = 0; s < 100; s++) {
        const map = generate(new RNG(s));
        const bosses = map.nodes.filter((n) => n.kind === 'boss');
        expect(bosses).toHaveLength(1);
        expect(bosses[0]!.id).toBe(map.terminalId);
      }
    });

    it('every node kind is battle | rest | boss', () => {
      for (let s = 0; s < 50; s++) {
        const map = generate(new RNG(s));
        for (const n of map.nodes) {
          expect(['battle', 'rest', 'boss']).toContain(n.kind);
        }
      }
    });

    it('rest nodes only sit on eligible middle floors [2, floorCount-2]', () => {
      for (let s = 0; s < 100; s++) {
        const map = generate(new RNG(s));
        const lastFloor = map.floors.length - 1;
        for (const n of map.nodes) {
          if (n.kind === 'rest') {
            expect(n.floor).toBeGreaterThanOrEqual(2);
            expect(n.floor).toBeLessThanOrEqual(lastFloor - 1);
          }
        }
      }
    });

    it('at most one rest per floor, and rest floors respect the min spacing', () => {
      for (let s = 0; s < 100; s++) {
        const map = generate(new RNG(s));
        const perFloor = new Map<number, number>();
        for (const n of map.nodes) {
          if (n.kind === 'rest') perFloor.set(n.floor, (perFloor.get(n.floor) ?? 0) + 1);
        }
        for (const count of perFloor.values()) expect(count).toBe(1);
        const restFloors = [...perFloor.keys()].sort((a, b) => a - b);
        for (let i = 1; i < restFloors.length; i++) {
          expect(restFloors[i]! - restFloors[i - 1]!).toBeGreaterThanOrEqual(restMinSpacing);
        }
      }
    });

    it('rest scatter is reachable: some seeds produce at least one rest', () => {
      let withRest = 0;
      for (let s = 0; s < 100; s++) {
        if (generate(new RNG(s)).nodes.some((n) => n.kind === 'rest')) withRest++;
      }
      expect(withRest).toBeGreaterThan(0);
    });

    it('rest nodes stay root-reachable and co-reachable to the boss', () => {
      // Kinds are a tail pass over the finished structure, so connectivity is
      // untouched — pin it so a future placement change can't strand a rest.
      for (let s = 0; s < 50; s++) {
        const map = generate(new RNG(s));
        const fromRoot = reachableFrom(map, map.rootId);
        const toBoss = coReachableTo(map, map.terminalId);
        for (const n of map.nodes) {
          if (n.kind === 'rest') {
            expect(fromRoot.has(n.id)).toBe(true);
            expect(toBoss.has(n.id)).toBe(true);
          }
        }
      }
    });

    it('floorCount <= 3 produces no rest nodes (empty eligible band)', () => {
      for (const fc of [1, 2, 3]) {
        for (let s = 0; s < 20; s++) {
          const map = generate(new RNG(s), { floorCount: fc });
          expect(map.nodes.some((n) => n.kind === 'rest')).toBe(false);
        }
      }
    });
  });

  describe('planarity (G2)', () => {
    it('no two edges cross given the per-floor x-ordering', () => {
      // The headline G2 guard: with x = index within floors[f], no pair of
      // edges on the same adjacent floor pair geometrically inverts. This both
      // pins the property and documents what "planar" means here.
      for (let s = 0; s < 100; s++) {
        const map = generate(new RNG(s));
        const bad = crossings(map);
        expect(bad, `seed ${s}: ${bad.join('; ')}`).toEqual([]);
      }
    });

    it('out-degree never exceeds maxOutDegree', () => {
      // No orphan-backfill pass exists to violate this — the interval width is
      // hard-capped at D. Sweep to prove it.
      for (let s = 0; s < 100; s++) {
        const map = generate(new RNG(s));
        expect(maxOutDegreeOf(map)).toBeLessThanOrEqual(maxOutDegree);
      }
    });
  });

  describe('connectivity', () => {
    it('edges only connect adjacent floors', () => {
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s));
        const floorOf = new Map(map.nodes.map((n) => [n.id, n.floor]));
        for (const e of map.edges) {
          expect(floorOf.get(e.to)! - floorOf.get(e.from)!).toBe(1);
        }
      }
    });

    it('every non-root node has at least one incoming edge', () => {
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s));
        const inbound = new Set(map.edges.map((e) => e.to));
        for (const n of map.nodes) {
          if (n.id !== map.rootId) expect(inbound.has(n.id)).toBe(true);
        }
      }
    });

    it('every non-terminal node has at least one outgoing edge', () => {
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s));
        const outbound = new Set(map.edges.map((e) => e.from));
        for (const n of map.nodes) {
          if (n.id !== map.terminalId) expect(outbound.has(n.id)).toBe(true);
        }
      }
    });

    it('every node is reachable from the root', () => {
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s));
        expect(reachableFrom(map, map.rootId).size).toBe(map.nodes.length);
      }
    });

    it('terminal is reachable from every node', () => {
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s));
        expect(coReachableTo(map, map.terminalId).size).toBe(map.nodes.length);
      }
    });

    it('edges between the same pair are not duplicated', () => {
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s));
        const seen = new Set<string>();
        for (const e of map.edges) {
          const key = `${e.from}->${e.to}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    });

    it('branches: average out-degree exceeds 1 across a seed sweep', () => {
      // Soft sanity: the contiguous-interval sweep should produce real
      // fan-out, not a pure chain. Aggregate over seeds so a single
      // narrow-map seed can't flake it.
      let edges = 0;
      let nonTerminal = 0;
      for (let s = 0; s < 50; s++) {
        const map = generate(new RNG(s));
        edges += map.edges.length;
        nonTerminal += map.nodes.filter((n) => n.id !== map.terminalId).length;
      }
      expect(edges / nonTerminal).toBeGreaterThan(1);
    });
  });

  describe('RunConfig overrides (G1)', () => {
    it('honors floorCount and stays a valid planar DAG at 1 / 2 / 3 floors', () => {
      for (const fc of [1, 2, 3]) {
        for (let s = 0; s < 10; s++) {
          const map = generate(new RNG(s), { floorCount: fc });
          expect(map.floors).toHaveLength(fc);
          expect(nodeById(map, map.rootId).floor).toBe(0);
          expect(nodeById(map, map.terminalId).floor).toBe(fc - 1);
          // The full invariant set: reachable, co-reachable, planar, capped.
          expect(reachableFrom(map, map.rootId).size).toBe(map.nodes.length);
          expect(coReachableTo(map, map.terminalId).size).toBe(map.nodes.length);
          expect(crossings(map)).toEqual([]);
          expect(maxOutDegreeOf(map)).toBeLessThanOrEqual(maxOutDegree);
          const floorOf = new Map(map.nodes.map((n) => [n.id, n.floor]));
          for (const e of map.edges) {
            expect(floorOf.get(e.to)! - floorOf.get(e.from)!).toBe(1);
          }
        }
      }
    });

    it('floorCount 1 is a single root==terminal node with no edges', () => {
      const map = generate(new RNG(0), { floorCount: 1 });
      expect(map.nodes).toHaveLength(1);
      expect(map.rootId).toBe(map.terminalId);
      expect(map.edges).toHaveLength(0);
    });

    it('floorCount 2 is root -> terminal: the minimal one-battle run', () => {
      const map = generate(new RNG(0), { floorCount: 2 });
      expect(map.nodes).toHaveLength(2);
      expect(map.edges).toEqual([{ from: map.rootId, to: map.terminalId }]);
    });

    it('mapMaxWidth caps middle-floor width and stays planar', () => {
      const maxWidth = 4;
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s), { floorCount: 5, mapMaxWidth: maxWidth });
        for (let f = 1; f < map.floors.length - 1; f++) {
          expect(map.floors[f]!.length).toBeLessThanOrEqual(maxWidth);
        }
        expect(crossings(map)).toEqual([]);
        expect(maxOutDegreeOf(map)).toBeLessThanOrEqual(maxOutDegree);
      }
    });

    it('no config is byte-identical to an empty config (default path)', () => {
      for (let s = 0; s < 20; s++) {
        expect(generate(new RNG(s))).toEqual(generate(new RNG(s), {}));
      }
    });
  });

  describe('determinism', () => {
    it('same seed → identical map', () => {
      const a = generate(new RNG(42));
      const b = generate(new RNG(42));
      expect(a).toEqual(b);
    });

    it('different seeds → different maps', () => {
      const a = generate(new RNG(1));
      const b = generate(new RNG(2));
      expect(dump(a)).not.toEqual(dump(b));
    });
  });

  describe('dump', () => {
    it('renders root, terminal, floors, and edges', () => {
      const map = generate(new RNG(1));
      const text = dump(map);
      expect(text).toContain('NodeMap');
      expect(text).toContain('(root)');
      expect(text).toContain('(boss)');
      expect(text).toContain('Floor 0:');
      expect(text).toContain('Edges:');
    });
  });
});

function nodeById(map: NodeMap, id: number) {
  const n = map.nodes.find((n) => n.id === id);
  if (!n) throw new Error(`no node with id ${id}`);
  return n;
}

/** x-position of every node = its index within its floor's left-to-right array. */
function xOf(map: NodeMap): Map<number, number> {
  const x = new Map<number, number>();
  for (const floor of map.floors) {
    for (let i = 0; i < floor.length; i++) x.set(floor[i]!, i);
  }
  return x;
}

/**
 * Every pair of edges (on the same adjacent floor pair) that geometrically
 * crosses, given the per-floor x-ordering. Empty array ⇒ planar.
 */
function crossings(map: NodeMap): string[] {
  const x = xOf(map);
  const floorOf = new Map(map.nodes.map((n) => [n.id, n.floor]));
  const byFloor = new Map<number, MapEdge[]>();
  for (const e of map.edges) {
    const f = floorOf.get(e.from)!;
    const list = byFloor.get(f) ?? [];
    list.push(e);
    byFloor.set(f, list);
  }
  const out: string[] = [];
  for (const group of byFloor.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const e1 = group[i]!;
        const e2 = group[j]!;
        const xa = x.get(e1.from)!;
        const xb = x.get(e1.to)!;
        const xc = x.get(e2.from)!;
        const xd = x.get(e2.to)!;
        if ((xa < xc && xb > xd) || (xa > xc && xb < xd)) {
          out.push(`${e1.from}->${e1.to} x ${e2.from}->${e2.to}`);
        }
      }
    }
  }
  return out;
}

function maxOutDegreeOf(map: NodeMap): number {
  const deg = new Map<number, number>();
  for (const e of map.edges) deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
  let max = 0;
  for (const d of deg.values()) max = Math.max(max, d);
  return max;
}

function reachableFrom(map: NodeMap, start: number): Set<number> {
  const adj = new Map<number, number[]>();
  for (const e of map.edges) {
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  const visited = new Set<number>();
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return visited;
}

/** Reverse-BFS: the set of nodes that can reach `target` (co-reachability). */
function coReachableTo(map: NodeMap, target: number): Set<number> {
  const radj = new Map<number, number[]>();
  for (const e of map.edges) {
    const list = radj.get(e.to) ?? [];
    list.push(e.from);
    radj.set(e.to, list);
  }
  const visited = new Set<number>();
  const stack = [target];
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const prev of radj.get(cur) ?? []) stack.push(prev);
  }
  return visited;
}
