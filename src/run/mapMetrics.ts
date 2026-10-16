/**
 * The sector map's metrics, as pure functions over a `NodeMap`. Each
 * measures one complaint the map's generator was rebuilt to answer:
 *
 * 1. Early availability (no early elite, rest or shop): `firstHopByKind`,
 *    the first hop holding each kind.
 * 2. Coverage (the special nodes all on one path): `pathFractionByKind`,
 *    the share of routes from the root to the terminal that visit a node of
 *    the kind (one minus the share avoiding it, by a DP), and
 *    `choiceCoverageByKind`, the share of first choices that can still
 *    reach the kind.
 * 3. Branch divergence (paths that play the same, or rejoin at once): for
 *    each pair of a branching node's children, the rejoin distance (hops
 *    from the branch to the first shared node) and whether the nodes only
 *    one side reaches differ in their kinds.
 *
 * Besides those: `expectedRouteComposition` (each kind's expected count on
 * a uniformly random route, the terms of the events-to-combat ratio),
 * `battlelessMiddleHops`, and the edge-shear pair (`meanEdgeShear`,
 * `diagonalMajorityShare`).
 *
 * Uniform over routes is a corpus baseline, not a model of a player, who
 * steers; the sheet's thresholds are signed against it, and the fuzz
 * walker measures steered play.
 *
 * Deterministic, drawing nothing. Read by the signed sheet's gates
 * (`tests/nodemap-metrics.test.ts`) and by `tools/nodemap-viz`'s overlay
 * and report.
 */

import type { NodeMap, NodeKind } from './NodeMap';

/** The kinds placed by quota, the ones the availability and coverage
 *  complaints are about; battle and boss are structural (everywhere, and
 *  the terminal). */
export const SPECIAL_KINDS: readonly NodeKind[] = ['rest', 'elite', 'port', 'event'];

interface RejoinPair {
  /** The branching node's hop. */
  readonly branchHop: number;
  /** Hops from the branch node to the first hop where the two children's
   *  reachable sets intersect (≥ 2 by construction; the terminal
   *  guarantees existence). */
  readonly rejoinDistance: number;
  /** Nodes reachable from exactly one of the two children, strictly
   *  before the rejoin hop (the two sides are disjoint there by
   *  definition of the rejoin). */
  readonly exclusiveNodes: number;
  /** True when the two exclusive sides differ as multisets of kinds: the
   *  branch offers different content, not only different node ids. */
  readonly kindDivergent: boolean;
}

export interface MapMetrics {
  /** First hop hosting each kind; absent = the map has none. */
  readonly firstHopByKind: ReadonlyMap<NodeKind, number>;
  /** Fraction of root→terminal routes visiting ≥1 node of the kind.
   *  Only kinds present in the map appear. */
  readonly pathFractionByKind: ReadonlyMap<NodeKind, number>;
  /** Fraction of hop-1 nodes (the first real route choice) from which a
   *  node of the kind is still reachable. Only kinds present appear;
   *  empty when the map has no hop 1 (hopCount 1). */
  readonly choiceCoverageByKind: ReadonlyMap<NodeKind, number>;
  /** Expected count of each kind on a uniformly-random route (linearity
   *  over nodes: Σ pathsThrough(n)/totalPaths). Sums to hopCount. */
  readonly expectedRouteComposition: ReadonlyMap<NodeKind, number>;
  /** Total root→terminal routes (the DP denominator). */
  readonly totalRoutes: number;
  /** One entry per unordered child-pair of every branching node. */
  readonly rejoinPairs: readonly RejoinPair[];
  /** Middle hops (the band: not hop 0, hop 1 or the boss's) with no battle
   *  node. The generator's battle floor holds it at 0, a C row of the
   *  sheet. */
  readonly battlelessMiddleHops: number;
  /** The edge shear: the mean over all edges of the child's x less the
   *  parent's, with x normalized to `index / (width − 1)` and 0.5 on a hop
   *  of width 1. 0 is no handedness; the sheet holds the corpus mean within
   *  ±0.02. 0 on a map with no edges. */
  readonly meanEdgeShear: number;
  /** The drift's coherence within one map: the share of diagonal edges (a
   *  nonzero dx in the centred, fixed-pitch model) that point the map's
   *  majority way. 0.5 is perfectly mixed, 1 every diagonal one way, and
   *  0.5 on a map with none. Handedness over the corpus and drift within a
   *  map are different facts: the braid is unbiased pooled, yet the median
   *  map measured about 0.59, its sign at random. */
  readonly diagonalMajorityShare: number;
}

export function computeMapMetrics(map: NodeMap): MapMetrics {
  const kindOf = new Map<number, NodeKind>();
  for (const n of map.nodes) kindOf.set(n.id, n.kind);
  const children = new Map<number, number[]>();
  for (const e of map.edges) {
    const list = children.get(e.from) ?? [];
    list.push(e.to);
    children.set(e.from, list);
  }
  const hopCount = map.hops.length;

  // --- path-counting DPs (doubles are fine: ≤ maxOutDegree^hops ≪ 2^53) ---
  const pathsFrom = new Map<number, number>(); // routes node → terminal
  pathsFrom.set(map.terminalId, 1);
  for (let f = hopCount - 2; f >= 0; f--) {
    for (const id of map.hops[f]!) {
      let sum = 0;
      for (const c of children.get(id) ?? []) sum += pathsFrom.get(c) ?? 0;
      pathsFrom.set(id, sum);
    }
  }
  const pathsTo = new Map<number, number>(); // routes root → node
  pathsTo.set(map.rootId, 1);
  for (let f = 1; f < hopCount; f++) {
    for (const id of map.hops[f]!) pathsTo.set(id, 0);
  }
  for (let f = 0; f < hopCount - 1; f++) {
    for (const id of map.hops[f]!) {
      const here = pathsTo.get(id) ?? 0;
      for (const c of children.get(id) ?? []) pathsTo.set(c, (pathsTo.get(c) ?? 0) + here);
    }
  }
  const totalRoutes = pathsFrom.get(map.rootId) ?? 1;

  const kindsPresent = new Set<NodeKind>(kindOf.values());

  // --- 1. early availability ---
  const firstHopByKind = new Map<NodeKind, number>();
  for (const n of map.nodes) {
    const prev = firstHopByKind.get(n.kind);
    if (prev === undefined || n.hop < prev) firstHopByKind.set(n.kind, n.hop);
  }

  // --- 2a. path fraction, by avoid-DP (1 − routes avoiding the kind) ---
  const pathFractionByKind = new Map<NodeKind, number>();
  for (const kind of kindsPresent) {
    const avoid = new Map<number, number>();
    avoid.set(map.terminalId, kindOf.get(map.terminalId) === kind ? 0 : 1);
    for (let f = hopCount - 2; f >= 0; f--) {
      for (const id of map.hops[f]!) {
        if (kindOf.get(id) === kind) {
          avoid.set(id, 0);
          continue;
        }
        let sum = 0;
        for (const c of children.get(id) ?? []) sum += avoid.get(c) ?? 0;
        avoid.set(id, sum);
      }
    }
    pathFractionByKind.set(kind, 1 - (avoid.get(map.rootId) ?? 0) / totalRoutes);
  }

  // --- 2b. first-choice coverage ---
  const choiceCoverageByKind = new Map<NodeKind, number>();
  const hop1 = hopCount >= 2 ? map.hops[1]! : [];
  if (hop1.length > 0) {
    const kindsReachableFrom = (start: number): Set<NodeKind> => {
      const kinds = new Set<NodeKind>();
      let frontier = [start];
      while (frontier.length > 0) {
        const next: number[] = [];
        for (const id of frontier) {
          kinds.add(kindOf.get(id)!);
          for (const c of children.get(id) ?? []) next.push(c);
        }
        frontier = [...new Set(next)];
      }
      return kinds;
    };
    const perChoice = hop1.map((id) => kindsReachableFrom(id));
    for (const kind of kindsPresent) {
      const retaining = perChoice.filter((s) => s.has(kind)).length;
      choiceCoverageByKind.set(kind, retaining / hop1.length);
    }
  }

  // --- ratio read: expected per-kind counts on a uniform route ---
  const expectedRouteComposition = new Map<NodeKind, number>();
  for (const n of map.nodes) {
    const through = ((pathsTo.get(n.id) ?? 0) * (pathsFrom.get(n.id) ?? 0)) / totalRoutes;
    expectedRouteComposition.set(n.kind, (expectedRouteComposition.get(n.kind) ?? 0) + through);
  }

  // --- 3. branch divergence ---
  const rejoinPairs: RejoinPair[] = [];
  for (const n of map.nodes) {
    const kids = children.get(n.id) ?? [];
    if (kids.length < 2) continue;
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        rejoinPairs.push(measureRejoin(map, children, kindOf, n.hop, kids[i]!, kids[j]!));
      }
    }
  }

  // --- middle hops with no battle ---
  let battlelessMiddleHops = 0;
  for (let f = 2; f <= hopCount - 2; f++) {
    if (map.hops[f]!.every((id) => kindOf.get(id) !== 'battle')) battlelessMiddleHops++;
  }

  // --- edge shear and drift coherence (the interface's docs) ---
  const slot = new Map<number, { i: number; w: number }>();
  for (const ids of map.hops) {
    for (let i = 0; i < ids.length; i++) slot.set(ids[i]!, { i, w: ids.length });
  }
  const xNorm = (i: number, w: number): number => (w === 1 ? 0.5 : i / (w - 1));
  const xCentered = (i: number, w: number): number => i - (w - 1) / 2;
  let shearSum = 0;
  let diagPos = 0;
  let diagNeg = 0;
  for (const e of map.edges) {
    const a = slot.get(e.from)!;
    const b = slot.get(e.to)!;
    shearSum += xNorm(b.i, b.w) - xNorm(a.i, a.w);
    const d = xCentered(b.i, b.w) - xCentered(a.i, a.w);
    if (d > 1e-9) diagPos++;
    else if (d < -1e-9) diagNeg++;
  }
  const meanEdgeShear = map.edges.length === 0 ? 0 : shearSum / map.edges.length;
  const diagonalMajorityShare =
    diagPos + diagNeg === 0 ? 0.5 : Math.max(diagPos, diagNeg) / (diagPos + diagNeg);

  return {
    firstHopByKind,
    pathFractionByKind,
    choiceCoverageByKind,
    expectedRouteComposition,
    totalRoutes,
    rejoinPairs,
    battlelessMiddleHops,
    meanEdgeShear,
    diagonalMajorityShare,
  };
}

/** Walk the two children's per-hop reachable frontiers forward until they
 *  intersect (edges only span adjacent hops, so per-hop frontiers ARE the
 *  reachable-set growth). The terminal guarantees termination. */
function measureRejoin(
  map: NodeMap,
  children: ReadonlyMap<number, number[]>,
  kindOf: ReadonlyMap<number, NodeKind>,
  branchHop: number,
  c1: number,
  c2: number,
): RejoinPair {
  let f1 = new Set<number>([c1]);
  let f2 = new Set<number>([c2]);
  const side1: NodeKind[] = [];
  const side2: NodeKind[] = [];
  let exclusiveNodes = 0;
  let hop = branchHop + 1;
  for (;;) {
    const shared = [...f1].some((id) => f2.has(id));
    if (shared) break;
    for (const id of f1) side1.push(kindOf.get(id)!);
    for (const id of f2) side2.push(kindOf.get(id)!);
    exclusiveNodes += f1.size + f2.size;
    const step = (frontier: Set<number>): Set<number> => {
      const next = new Set<number>();
      for (const id of frontier) for (const c of children.get(id) ?? []) next.add(c);
      return next;
    };
    f1 = step(f1);
    f2 = step(f2);
    hop++;
    if (hop > map.hops.length) {
      // Unreachable on a well-formed map (both sides hit the terminal);
      // loud beats silent on a malformed one.
      throw new Error('measureRejoin: frontiers never intersected — malformed NodeMap?');
    }
  }
  const multiset = (kinds: NodeKind[]): string => [...kinds].sort().join(',');
  return {
    branchHop,
    rejoinDistance: hop - branchHop,
    exclusiveNodes,
    kindDivergent: multiset(side1) !== multiset(side2),
  };
}
