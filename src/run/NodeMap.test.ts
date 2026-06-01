import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { generate, dump, type NodeMap } from './NodeMap';

describe('NodeMap.generate', () => {
  describe('shape', () => {
    it('produces 7–10 nodes (DESIGN target)', () => {
      // Sweep seeds to catch a bad bound, not just the lucky one.
      for (let s = 0; s < 50; s++) {
        const map = generate(new RNG(s));
        expect(map.nodes.length).toBeGreaterThanOrEqual(7);
        expect(map.nodes.length).toBeLessThanOrEqual(10);
      }
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

    it('every middle floor has 1–4 nodes', () => {
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s));
        for (let f = 1; f < map.floors.length - 1; f++) {
          expect(map.floors[f]!.length).toBeGreaterThanOrEqual(1);
          expect(map.floors[f]!.length).toBeLessThanOrEqual(4);
        }
      }
    });

    it('all nodes are battle nodes (MVP)', () => {
      const map = generate(new RNG(1));
      for (const n of map.nodes) {
        expect(n.kind).toBe('battle');
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
        // Build reverse-adjacency once, then BFS from terminal back to root.
        const radj = new Map<number, number[]>();
        for (const e of map.edges) {
          const list = radj.get(e.to) ?? [];
          list.push(e.from);
          radj.set(e.to, list);
        }
        const visited = new Set<number>();
        const stack = [map.terminalId];
        while (stack.length) {
          const cur = stack.pop()!;
          if (visited.has(cur)) continue;
          visited.add(cur);
          for (const prev of radj.get(cur) ?? []) stack.push(prev);
        }
        expect(visited.size).toBe(map.nodes.length);
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

    it('branching density is non-trivial (>1 edge per non-terminal on average)', () => {
      // Soft sanity check: with up to 2 outbound per parent, the average
      // out-degree across non-terminal nodes should comfortably exceed 1.
      // If this drops, edge generation has likely become too sparse.
      const map = generate(new RNG(1));
      const nonTerminal = map.nodes.filter((n) => n.id !== map.terminalId).length;
      expect(map.edges.length / nonTerminal).toBeGreaterThan(1);
    });
  });

  describe('RunConfig overrides (G1)', () => {
    it('honors floorCount and stays a valid DAG at 1 / 2 / 3 floors', () => {
      for (const floorCount of [1, 2, 3]) {
        for (let s = 0; s < 10; s++) {
          const map = generate(new RNG(s), { floorCount });
          expect(map.floors).toHaveLength(floorCount);
          expect(nodeById(map, map.rootId).floor).toBe(0);
          expect(nodeById(map, map.terminalId).floor).toBe(floorCount - 1);
          // Reachable from root AND co-reachable to terminal — the DAG invariants.
          expect(reachableFrom(map, map.rootId).size).toBe(map.nodes.length);
          expect(coReachableTo(map, map.terminalId).size).toBe(map.nodes.length);
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

    it('mapMaxWidth caps middle-floor width', () => {
      const maxWidth = 4;
      for (let s = 0; s < 20; s++) {
        const map = generate(new RNG(s), { floorCount: 5, mapMaxWidth: maxWidth });
        for (let f = 1; f < map.floors.length - 1; f++) {
          expect(map.floors[f]!.length).toBeLessThanOrEqual(maxWidth);
        }
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
      expect(text).toContain('(terminal)');
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
