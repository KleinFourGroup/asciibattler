/**
 * 77b — the metrics module's contract, proven on hand-built maps with
 * pencil-and-paper answers first (no generator in the loop), then sanity
 * bounds over the live generator. These are the metrics' OWN tests; the
 * threshold acceptance gates over the reworked generator land at 77e
 * (nodemap-metrics.test.ts), after the 77c signing.
 */

import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { generate, type NodeMap, type MapNode, type MapEdge, type NodeKind } from './NodeMap';
import { computeMapMetrics, SPECIAL_KINDS } from './mapMetrics';

/** Assemble a NodeMap literal from per-hop kind lists + explicit edges. */
function build(hopKinds: NodeKind[][], edgePairs: Array<[number, number]>): NodeMap {
  const nodes: MapNode[] = [];
  const hops: number[][] = [];
  let id = 0;
  for (let f = 0; f < hopKinds.length; f++) {
    const ids: number[] = [];
    for (const kind of hopKinds[f]!) {
      nodes.push({ id, hop: f, kind });
      ids.push(id);
      id++;
    }
    hops.push(ids);
  }
  const edges: MapEdge[] = edgePairs.map(([from, to]) => ({ from, to }));
  return {
    nodes,
    edges,
    rootId: hops[0]![0]!,
    terminalId: hops[hopKinds.length - 1]![0]!,
    hops,
  };
}

// The 4-node diamond: root → (battle | rest) → boss.
const DIAMOND = build(
  [['battle'], ['battle', 'rest'], ['boss']],
  [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
  ],
);

// Two length-2 branches, no shared node until the terminal:
// root → (a | b), a → a2, b → b2, (a2, b2) → boss. One side all-battle,
// the other rest-then-port.
const LONG_FORK = build(
  [['battle'], ['battle', 'rest'], ['battle', 'port'], ['boss']],
  [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 5],
  ],
);

// The same long fork with BOTH sides all-battle — divergent in ids,
// identical in content.
const TWIN_FORK = build(
  [['battle'], ['battle', 'battle'], ['battle', 'battle'], ['boss']],
  [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 5],
  ],
);

describe('computeMapMetrics — hand-built fixtures', () => {
  it('diamond: path fraction, first hop, composition, and the distance-2 rejoin', () => {
    const m = computeMapMetrics(DIAMOND);
    expect(m.totalRoutes).toBe(2);
    expect(m.firstHopByKind.get('rest')).toBe(1);
    expect(m.pathFractionByKind.get('rest')).toBeCloseTo(0.5);
    expect(m.pathFractionByKind.get('boss')).toBeCloseTo(1);
    // First-choice coverage: the rest branch keeps rest, the battle branch
    // loses it — 1 of 2 choices retain.
    expect(m.choiceCoverageByKind.get('rest')).toBeCloseTo(0.5);
    expect(m.choiceCoverageByKind.get('boss')).toBeCloseTo(1);
    // Uniform-route expectation: half the routes see the rest.
    expect(m.expectedRouteComposition.get('rest')).toBeCloseTo(0.5);
    expect(m.expectedRouteComposition.get('battle')).toBeCloseTo(1.5); // root + half
    // One branch pair, rejoining at the boss two hops out; the two
    // exclusive sides are {battle} vs {rest} — content-divergent.
    expect(m.rejoinPairs).toHaveLength(1);
    expect(m.rejoinPairs[0]!.rejoinDistance).toBe(2);
    expect(m.rejoinPairs[0]!.exclusiveNodes).toBe(2);
    expect(m.rejoinPairs[0]!.kindDivergent).toBe(true);
  });

  it('long fork: distance-3 rejoin with four exclusive nodes, content-divergent', () => {
    const m = computeMapMetrics(LONG_FORK);
    expect(m.totalRoutes).toBe(2);
    expect(m.rejoinPairs).toHaveLength(1);
    expect(m.rejoinPairs[0]!.rejoinDistance).toBe(3);
    expect(m.rejoinPairs[0]!.exclusiveNodes).toBe(4);
    expect(m.rejoinPairs[0]!.kindDivergent).toBe(true);
    // rest and port each sit on exactly one of the two routes.
    expect(m.pathFractionByKind.get('rest')).toBeCloseTo(0.5);
    expect(m.pathFractionByKind.get('port')).toBeCloseTo(0.5);
    // …and they share a side, so ONE first choice retains both.
    expect(m.choiceCoverageByKind.get('rest')).toBeCloseTo(0.5);
    expect(m.choiceCoverageByKind.get('port')).toBeCloseTo(0.5);
  });

  it('twin fork: structurally divergent but content-identical (kindDivergent false)', () => {
    const m = computeMapMetrics(TWIN_FORK);
    expect(m.rejoinPairs).toHaveLength(1);
    expect(m.rejoinPairs[0]!.rejoinDistance).toBe(3);
    expect(m.rejoinPairs[0]!.kindDivergent).toBe(false);
  });

  it('battle-less middle hops: counted over the scatter band only', () => {
    // Hop 2 is all-special (rest+port): one battle-less middle hop. Hop 1
    // is outside the band by definition (scatter never lands there).
    const stacked = build(
      [['battle'], ['battle', 'battle'], ['rest', 'port'], ['battle'], ['boss']],
      [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 4],
        [3, 5],
        [4, 5],
        [5, 6],
      ],
    );
    expect(computeMapMetrics(stacked).battlelessMiddleHops).toBe(1);
    expect(computeMapMetrics(DIAMOND).battlelessMiddleHops).toBe(0);
  });

  it('degenerate hopCount-1 map (root == terminal) yields empty/zero metrics', () => {
    const solo = build([['boss']], []);
    const m = computeMapMetrics(solo);
    expect(m.totalRoutes).toBe(1);
    expect(m.rejoinPairs).toHaveLength(0);
    expect(m.choiceCoverageByKind.size).toBe(0);
    expect(m.battlelessMiddleHops).toBe(0);
    expect(m.expectedRouteComposition.get('boss')).toBeCloseTo(1);
    expect(m.meanEdgeShear).toBe(0);
    expect(m.diagonalMajorityShare).toBe(0.5);
  });
});

describe('edge shear + drift coherence (77e2b — the G2 de-bias instrument)', () => {
  it('the symmetric diamond measures zero shear and perfectly mixed drift', () => {
    // Pencil: xNorm edges −0.5, +0.5, +0.5, −0.5 → mean 0; centered
    // diagonals split 2/2 → majority share exactly 0.5.
    const m = computeMapMetrics(DIAMOND);
    expect(m.meanEdgeShear).toBeCloseTo(0);
    expect(m.diagonalMajorityShare).toBeCloseTo(0.5);
  });

  it('a left-leaning fixture measures negative shear and its majority share', () => {
    // root → {1,2}; 1→3, 2→{3,4}; {3,4} → boss. Pencil (xNorm):
    // −0.5 +0.5 0 −1 0 +0.5 −0.5 → sum −1 over 7 edges. Centered
    // diagonals: neg {0→1, 2→3, 4→5}, pos {0→2, 3→5} → 3/5.
    const handed = build(
      [['battle'], ['battle', 'battle'], ['battle', 'battle'], ['boss']],
      [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3],
        [2, 4],
        [3, 5],
        [4, 5],
      ],
    );
    const m = computeMapMetrics(handed);
    expect(m.meanEdgeShear).toBeCloseTo(-1 / 7);
    expect(m.diagonalMajorityShare).toBeCloseTo(3 / 5);
  });
});

describe('computeMapMetrics — generator sanity bounds', () => {
  it('holds its invariants over a seed sweep of authored-config maps', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const map = generate(new RNG(seed));
      const m = computeMapMetrics(map);
      // Composition sums to one node per hop; boss rides every route.
      let total = 0;
      for (const v of m.expectedRouteComposition.values()) total += v;
      expect(total).toBeCloseTo(map.hops.length);
      expect(m.pathFractionByKind.get('boss')).toBeCloseTo(1);
      expect(m.firstHopByKind.get('battle')).toBe(0); // the natural root
      for (const kind of SPECIAL_KINDS) {
        const first = m.firstHopByKind.get(kind);
        // The scatter band starts at hop 2.
        if (first !== undefined) expect(first).toBeGreaterThanOrEqual(2);
        const frac = m.pathFractionByKind.get(kind);
        if (frac !== undefined) {
          expect(frac).toBeGreaterThan(0);
          expect(frac).toBeLessThanOrEqual(1);
        }
      }
      for (const pair of m.rejoinPairs) {
        expect(pair.rejoinDistance).toBeGreaterThanOrEqual(2);
        expect(pair.exclusiveNodes).toBeGreaterThanOrEqual(2);
      }
      // Default maps branch (the connectivity suite pins avg out-degree>1
      // corpus-wide; per-map, every default-length map has ≥1 wide hop).
      expect(m.rejoinPairs.length).toBeGreaterThan(0);
      // 77e2b — shear is a bounded per-map statistic; coherence is a share.
      expect(Math.abs(m.meanEdgeShear)).toBeLessThanOrEqual(1);
      expect(m.diagonalMajorityShare).toBeGreaterThanOrEqual(0.5);
      expect(m.diagonalMajorityShare).toBeLessThanOrEqual(1);
    }
  });
});
