/**
 * 77b — the three sector-map metrics, as pure functions over a `NodeMap`.
 * Each operationalizes one sentence of the cluster-5 spec's map-gen
 * complaints (cluster-5-spec §Sector Map Generation Rework):
 *
 *  1. EARLY AVAILABILITY — "fairly common for there to be no early elite,
 *     rest, or shop": `firstHopByKind` (the first hop hosting each kind).
 *  2. PATH-KIND COVERAGE — "these nodes all on the same path":
 *     `pathFractionByKind` (the fraction of root→terminal routes visiting
 *     ≥1 node of the kind, by avoid-DP) and `choiceCoverageByKind` (the
 *     fraction of first-choice branches that keep access to the kind).
 *  3. BRANCH DIVERGENCE — "paths play out identically, sometimes almost
 *     immediately rejoining": per branching child-pair, the rejoin
 *     distance (hops from the branch point to the first shared node) plus
 *     content differentiation (do the branch-exclusive nodes differ in
 *     kind composition).
 *
 * Plus two ratio reads the §77e passes will own: `expectedRouteComposition`
 * (expected per-kind node counts on a uniformly-random route — the
 * events-to-combat ratio's numerator/denominator) and
 * `battlelessMiddleHops` (the known 74e width-2 stacking artifact, counted).
 *
 * Route-uniformity caveat: "uniform over routes" is a corpus baseline, not
 * a player model — players steer. Good enough to sign thresholds against
 * (77c); the fuzz walker measures the steered reality.
 *
 * Everything here is deterministic and RNG-free; consumed by the
 * nodemap-viz overlay, the 77b baseline report, and (at 77e) the
 * `nodemap-metrics.test.ts` acceptance gates.
 */

import type { NodeMap, NodeKind } from './NodeMap';

/** The scatterable kinds — the ones the availability/coverage complaints
 *  are about. Battle/boss are structural (everywhere / the terminal). */
export const SPECIAL_KINDS: readonly NodeKind[] = ['rest', 'elite', 'port', 'event'];

export interface RejoinPair {
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
  /** True when the two exclusive sides differ as kind MULTISETS — the
   *  branch offers different content, not just different node ids. */
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
  /** Middle hops (excluding hop 0, hop 1, and the boss hop — the scatter
   *  band) with zero battle nodes: the 74e stacking artifact. */
  readonly battlelessMiddleHops: number;
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

  // --- the 74e stacking artifact ---
  let battlelessMiddleHops = 0;
  for (let f = 2; f <= hopCount - 2; f++) {
    if (map.hops[f]!.every((id) => kindOf.get(id) !== 'battle')) battlelessMiddleHops++;
  }

  return {
    firstHopByKind,
    pathFractionByKind,
    choiceCoverageByKind,
    expectedRouteComposition,
    totalRoutes,
    rejoinPairs,
    battlelessMiddleHops,
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
