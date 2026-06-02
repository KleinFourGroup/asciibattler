/**
 * Run-level node map: a layered DAG the player traverses one floor at a time.
 * MVP scope is intentionally narrow — every node is a battle, no rest / shop /
 * elite kinds (see DESIGN.md "Run structure"; node kinds land in G3).
 *
 * Layout (G2): `FLOOR_COUNT` floors total. Floor 0 and the last floor are
 * single nodes (root / terminal). Middle floors are `MIDDLE_WIDTH_MIN`..
 * `MIDDLE_WIDTH_MAX` nodes wide, drawn from the supplied RNG and bounded by a
 * total-node budget (`TARGET_TOTAL_MAX`).
 *
 * Planarity (G2): the map is drawn with each floor's nodes in a fixed
 * left-to-right order — that order *is* the `floors[f]` array index, which the
 * renderer reads directly. Edge generation guarantees **no two edges cross**
 * given that ordering: per adjacent floor pair, each parent is assigned a
 * *contiguous* interval of children, with the intervals monotone
 * non-decreasing and gap-free across parents (sorted by x). That staircase
 * structure is planar by construction, and it simultaneously guarantees full
 * connectivity (every child has ≥1 parent → reachable from root; every parent
 * has ≥1 child → co-reachable to terminal) and a hard `MAX_OUT_DEGREE` cap
 * (interval width ≤ D) with no orphan-backfill pass that could violate it.
 *
 * Centering (G2): each interval's END is biased toward the parent's *diagonal
 * slot* (its proportional column in the child floor) rather than left to run
 * free. That keeps a parent's children near its own column, so per-floor lean
 * stays gentle and in-degree spreads evenly instead of piling onto one node.
 * A 50/50 per-pair horizontal mirror then cancels the small residual lean so
 * there's no global left/right bias. (An earlier free-running sweep leaned
 * systematically rightward; see git history if the funkier look is ever
 * wanted back.)
 *
 * Seed-stability contract: draws happen **widths-then-edges**; per floor pair
 * the parent sweep runs first (each parent **`a` before `b`**), then a single
 * **mirror bit** (only when both floors are wider than 1). The number and
 * order of RNG draws *is* the seed→map mapping; reordering them silently
 * remaps every seed.
 *
 * NB: no max-*in*-degree is assumed. Boundary children may collect several
 * parents (the merges/diamonds that give the map variety). Adding an in-degree
 * cap later would break feasibility of wide→narrow transitions — see the
 * `n ≤ m·D` feasibility note in `generate`.
 */

import { RNG } from '../core/RNG';
import { NODE_MAP } from '../config/nodemap';
import type { RunConfig } from './RunConfig';

export type NodeKind = 'battle';

export interface MapNode {
  readonly id: number;
  readonly floor: number;
  readonly kind: NodeKind;
}

export interface MapEdge {
  readonly from: number;
  readonly to: number;
}

export interface NodeMap {
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  readonly rootId: number;
  readonly terminalId: number;
  /** Node ids grouped by floor index; `floors[f]` are the ids on floor `f`. */
  readonly floors: readonly (readonly number[])[];
}

// Shape parameters live in config/nodemap.json. Bound to locals here so
// the existing call sites read the same way.
const {
  floorCount: FLOOR_COUNT,
  middleWidthMin: MIDDLE_WIDTH_MIN,
  middleWidthMax: MIDDLE_WIDTH_MAX,
  targetTotalMax: TARGET_TOTAL_MAX,
  maxOutDegree: MAX_OUT_DEGREE,
} = NODE_MAP;

export function generate(rng: RNG, config?: RunConfig): NodeMap {
  // G1: RunConfig overrides the shape per-run; absent fields fall back to the
  // config/nodemap.json defaults, so a no-config call is byte-identical to
  // pre-G1. Only `floorCount` + `mapMaxWidth` are tunable here; the min width,
  // total cap, and out-degree stay on the JSON defaults.
  const floorCount = config?.floorCount ?? FLOOR_COUNT;
  const maxWidth = config?.mapMaxWidth ?? MIDDLE_WIDTH_MAX;

  const floors: number[][] = [];
  const nodes: MapNode[] = [];
  let nextId = 0;
  let placedSoFar = 0;
  let prevWidth = 1; // floor 0 is the single root node

  for (let f = 0; f < floorCount; f++) {
    let width: number;
    if (f === 0 || f === floorCount - 1) {
      width = 1;
    } else {
      // Cap so later floors can still hit their minimum width without blowing
      // past TARGET_TOTAL_MAX (budget term), AND so the *next* floor stays
      // coverable under the out-degree cap (`prevWidth * MAX_OUT_DEGREE`): m
      // parents each spanning ≤ D contiguous children can cover at most m·D
      // children, so the edge sweep below needs `n ≤ m·D`. With D=3 this only
      // ever binds on floor 1 (root width 1 → floor 1 ≤ 3); 2·3 = 6 ≥ maxWidth
      // thereafter.
      const remainingMiddleFloors = floorCount - 2 - f;
      const minNodesAfter = remainingMiddleFloors * MIDDLE_WIDTH_MIN + 1;
      const budget = TARGET_TOTAL_MAX - placedSoFar - minNodesAfter;
      const cap = Math.max(
        MIDDLE_WIDTH_MIN,
        Math.min(maxWidth, budget, prevWidth * MAX_OUT_DEGREE),
      );
      width = rng.int(MIDDLE_WIDTH_MIN, cap);
    }
    const ids: number[] = [];
    for (let i = 0; i < width; i++) {
      const id = nextId++;
      ids.push(id);
      nodes.push({ id, floor: f, kind: 'battle' });
    }
    floors.push(ids);
    placedSoFar += width;
    prevWidth = width;
  }

  const edges: MapEdge[] = [];
  for (let f = 0; f < floorCount - 1; f++) {
    const parents = floors[f]!;
    const children = floors[f + 1]!;
    const m = parents.length;
    const n = children.length;
    const D = MAX_OUT_DEGREE;
    // Feasibility guard: the contiguous-interval sweep can only cover n
    // children with m parents capped at D each when n ≤ m·D. The width loop's
    // `prevWidth * D` cap guarantees this; assert so a future config change
    // surfaces loudly instead of producing infeasible bounds.
    if (n > m * D) {
      throw new Error(`NodeMap: floor ${f + 1} (${n} nodes) not coverable by floor ${f} (${m}×${D})`);
    }

    // Assign each parent (in x-order) a contiguous child interval [a, b].
    // Non-crossing requires consecutive intervals overlap by AT MOST their
    // shared boundary child: `a_{p+1} ∈ {b_p, b_p+1}` (=b_p shares one child →
    // a diamond/merge; =b_p+1 is disjoint). Overlapping by two or more inverts
    // (parent q>p reaching a child left of one of p's). That single rule gives
    // planar + fully connected + out-degree ≤ D by construction — see header.
    const intervals: Array<[number, number]> = [];
    let prevB = -1; // sentinel: no interval yet
    for (let p = 0; p < m; p++) {
      const remaining = m - 1 - p; // parents strictly after p
      // Interval start. Floored at `prevB` (overlap ≤ 1) and the lookahead
      // `n-(remaining+1)*D` (reserve children for the parents after p);
      // capped at `prevB+1` (gap-free coverage). First parent anchors at 0.
      const aMin = Math.max(prevB, n - (remaining + 1) * D);
      const aMax = Math.min(prevB + 1, n - 1);
      const a = p === 0 ? 0 : rng.int(aMin, aMax);
      // Interval end. `n-1-remaining*D` guarantees the remaining parents can
      // still reach the last child; the last parent is forced to close at n-1.
      const bMin = Math.max(a, n - 1 - remaining * D);
      const bMax = Math.min(a + D - 1, n - 1);
      let b: number;
      if (remaining === 0) {
        b = n - 1; // last parent closes at the rightmost child
      } else {
        // Bias the end toward parent p's diagonal slot (its proportional column
        // in the child floor) instead of letting it run free, so children stay
        // near the parent's own column — gentle per-floor lean, in-degree
        // spread evenly rather than piled onto one node. ±1 jitter keeps
        // variety; the clamp preserves the feasible [bMin,bMax], so every
        // invariant still holds.
        const target = Math.round(((p + 1) / m) * n) - 1;
        b = Math.min(bMax, Math.max(bMin, target + (rng.int(0, 2) - 1)));
      }
      intervals.push([a, b]);
      prevB = b;
    }

    // The diagonal centering above still leaves a small residual lean (the
    // forced first/last anchors aren't symmetric). Reflection is a symmetry of
    // the layout — it preserves planarity, coverage, and the out-degree cap —
    // so a 50/50 per-pair mirror negates that residual (and flips which side a
    // floor's in-degree hub lands on) without changing magnitude, cancelling
    // any global left/right bias. Skipped when either floor is width 1 (a
    // no-op). One draw per qualifying pair, after the sweep, to keep the order
    // documented (see the seed-stability contract in the header).
    const flip = m > 1 && n > 1 && rng.int(0, 1) === 1;
    for (let p = 0; p < m; p++) {
      const [a, b] = flip ? reflect(intervals[m - 1 - p]!, n) : intervals[p]!;
      for (let c = a; c <= b; c++) {
        edges.push({ from: parents[p]!, to: children[c]! });
      }
    }
  }

  return {
    nodes,
    edges,
    rootId: floors[0]![0]!,
    terminalId: floors[floorCount - 1]![0]!,
    floors,
  };
}

/**
 * Horizontally mirror a child interval `[a, b]` within a floor of width `n`.
 * Parent `m-1-p`'s interval maps to parent `p`'s slot, so the reflected map is
 * emitted in ascending parent/child order (a clean edge array). Endpoints
 * swap: the left end `a` becomes the right end `n-1-a`, and vice versa.
 */
function reflect([a, b]: [number, number], n: number): [number, number] {
  return [n - 1 - b, n - 1 - a];
}

/** Human-readable dump for eyeball verification of generated maps. */
export function dump(map: NodeMap): string {
  const lines: string[] = [];
  lines.push(`NodeMap (${map.nodes.length} nodes, ${map.floors.length} floors)`);
  for (let f = 0; f < map.floors.length; f++) {
    const labeled = map.floors[f]!.map((id) => {
      if (id === map.rootId) return `${id}(root)`;
      if (id === map.terminalId) return `${id}(terminal)`;
      return String(id);
    });
    lines.push(`  Floor ${f}: ${labeled.join(', ')}`);
  }
  lines.push('Edges:');
  const byFrom = new Map<number, number[]>();
  for (const e of map.edges) {
    const list = byFrom.get(e.from) ?? [];
    list.push(e.to);
    byFrom.set(e.from, list);
  }
  for (const node of map.nodes) {
    const tos = byFrom.get(node.id);
    if (tos) {
      tos.sort((a, b) => a - b);
      lines.push(`  ${node.id} → ${tos.join(', ')}`);
    }
  }
  return lines.join('\n');
}
