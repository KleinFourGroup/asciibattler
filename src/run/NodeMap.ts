/**
 * Run-level node map: a layered DAG the player traverses one hop at a time.
 * Node kinds (G3): the terminal is a `boss` (a regular fight for now, tagged so
 * future mechanics have a hook); `rest` nodes scatter through the middle hops
 * (a non-combat XP grant — see `Run.resolveRest`); everything else is a
 * `battle`. A full event system (shop / elite / etc.) is still future work.
 *
 * Layout (G2): `HOP_COUNT` hops total. Hop 0 and the last hop are
 * single nodes (root / terminal). Middle hops are `MIDDLE_WIDTH_MIN`..
 * `MIDDLE_WIDTH_MAX` nodes wide, drawn from the supplied RNG and bounded by a
 * total-node budget (`TARGET_TOTAL_MAX`).
 *
 * Planarity (G2): the map is drawn with each hop's nodes in a fixed
 * left-to-right order — that order *is* the `hops[f]` array index, which the
 * renderer reads directly. Edge generation guarantees **no two edges cross**
 * given that ordering: per adjacent hop pair, each parent is assigned a
 * *contiguous* interval of children, with the intervals monotone
 * non-decreasing and gap-free across parents (sorted by x). That staircase
 * structure is planar by construction, and it simultaneously guarantees full
 * connectivity (every child has ≥1 parent → reachable from root; every parent
 * has ≥1 child → co-reachable to terminal) and a hard `MAX_OUT_DEGREE` cap
 * (interval width ≤ D) with no orphan-backfill pass that could violate it.
 *
 * Centering (G2): each interval's END is biased toward the parent's *diagonal
 * slot* (its proportional column in the child hop) rather than left to run
 * free. That keeps a parent's children near its own column, so per-hop lean
 * stays gentle and in-degree spreads evenly instead of piling onto one node.
 * A 50/50 per-pair horizontal mirror then cancels the small residual lean so
 * there's no global left/right bias. (An earlier free-running sweep leaned
 * systematically rightward; see git history if the funkier look is ever
 * wanted back.)
 *
 * Seed-stability contract: draws happen **widths → edges → kinds** (G3). The
 * width loop runs first; then per hop pair the parent sweep (each parent
 * **`a` before `b`**) followed by a single **mirror bit** (only when both
 * hops are wider than 1); then the rest-kind scatter pass (one draw per
 * eligible middle hop, plus a node-pick draw only when a rest is placed).
 * The kinds pass runs **after** the full structure is built and appends its
 * draws at the tail, so the width+edge stream — and thus the map *structure*
 * for any seed — is byte-identical to the pre-G3 generator; only which nodes
 * carry the `rest`/`boss` kind is new. (Gameplay still shifts, since rests
 * replace battles on some paths → expected fuzz/determinism baseline reset.)
 * The number and order of RNG draws *is* the seed→map mapping; reordering
 * them silently remaps every seed.
 *
 * NB: no max-*in*-degree is assumed. Boundary children may collect several
 * parents (the merges/diamonds that give the map variety). Adding an in-degree
 * cap later would break feasibility of wide→narrow transitions — see the
 * `n ≤ m·D` feasibility note in `generate`.
 */

import { RNG } from '../core/RNG';
import { NODE_MAP } from '../config/nodemap';
import type { RunConfig } from './RunConfig';

export type NodeKind = 'battle' | 'rest' | 'boss';

/**
 * S2 — the "pre-root" start position. A run begins here (no node entered yet),
 * with the root as its only frontier, so the root is a *selectable* first
 * encounter rather than an inert starting cell. No real node ever carries this
 * id (ids start at 0), so it's an unambiguous sentinel for `Run.currentNodeId`.
 */
export const PRE_ROOT_NODE_ID = -1;

export interface MapNode {
  readonly id: number;
  readonly hop: number;
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
  /** Node ids grouped by hop index; `hops[f]` are the ids on hop `f`. */
  readonly hops: readonly (readonly number[])[];
}

// Shape parameters live in config/nodemap.json. Bound to locals here so
// the existing call sites read the same way.
const {
  hopCount: HOP_COUNT,
  middleWidthMin: MIDDLE_WIDTH_MIN,
  middleWidthMax: MIDDLE_WIDTH_MAX,
  targetTotalMax: TARGET_TOTAL_MAX,
  maxOutDegree: MAX_OUT_DEGREE,
  restChance: REST_CHANCE,
  restMinSpacing: REST_MIN_SPACING,
} = NODE_MAP;

export function generate(rng: RNG, config?: RunConfig, lengthOverride?: number): NodeMap {
  // G1: RunConfig overrides the shape per-run; absent fields fall back to the
  // config/nodemap.json defaults, so a no-config call is byte-identical to
  // pre-G1. Only `hopCount` + `mapMaxWidth` are tunable here; the min width,
  // total cap, and out-degree stay on the JSON defaults.
  // T2: `lengthOverride` is the current SECTOR's `length` — the per-sector hop
  // count that replaces the single global default once a run is a *sequence* of
  // sectors. Precedence `config.hopCount > sector.length > JSON default` keeps
  // the dev `?hops=N` flag authoritative; "The Start" (length 11 == HOP_COUNT)
  // leaves the default path byte-identical.
  const hopCount = config?.hopCount ?? lengthOverride ?? HOP_COUNT;
  const maxWidth = config?.mapMaxWidth ?? MIDDLE_WIDTH_MAX;

  const hops: number[][] = [];
  const nodes: MapNode[] = [];
  let nextId = 0;
  let placedSoFar = 0;
  let prevWidth = 1; // hop 0 is the single root node

  for (let f = 0; f < hopCount; f++) {
    let width: number;
    if (f === 0 || f === hopCount - 1) {
      width = 1;
    } else {
      // Cap so later hops can still hit their minimum width without blowing
      // past TARGET_TOTAL_MAX (budget term), AND so the *next* hop stays
      // coverable under the out-degree cap (`prevWidth * MAX_OUT_DEGREE`): m
      // parents each spanning ≤ D contiguous children can cover at most m·D
      // children, so the edge sweep below needs `n ≤ m·D`. With D=3 this only
      // ever binds on hop 1 (root width 1 → hop 1 ≤ 3); 2·3 = 6 ≥ maxWidth
      // thereafter.
      const remainingMiddleHops = hopCount - 2 - f;
      const minNodesAfter = remainingMiddleHops * MIDDLE_WIDTH_MIN + 1;
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
      nodes.push({ id, hop: f, kind: 'battle' });
    }
    hops.push(ids);
    placedSoFar += width;
    prevWidth = width;
  }

  const edges: MapEdge[] = [];
  for (let f = 0; f < hopCount - 1; f++) {
    const parents = hops[f]!;
    const children = hops[f + 1]!;
    const m = parents.length;
    const n = children.length;
    const D = MAX_OUT_DEGREE;
    // Feasibility guard: the contiguous-interval sweep can only cover n
    // children with m parents capped at D each when n ≤ m·D. The width loop's
    // `prevWidth * D` cap guarantees this; assert so a future config change
    // surfaces loudly instead of producing infeasible bounds.
    if (n > m * D) {
      throw new Error(`NodeMap: hop ${f + 1} (${n} nodes) not coverable by hop ${f} (${m}×${D})`);
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
      // Interval start. Hoped at `prevB` (overlap ≤ 1) and the lookahead
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
        // in the child hop) instead of letting it run free, so children stay
        // near the parent's own column — gentle per-hop lean, in-degree
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
    // hop's in-degree hub lands on) without changing magnitude, cancelling
    // any global left/right bias. Skipped when either hop is width 1 (a
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

  // G3 node kinds — a tail pass over the finished structure (see the
  // seed-stability contract above). The terminal is the boss; rests scatter
  // through the eligible middle hops `[2, hopCount-2]` — never hop 0
  // (root), hop 1 (so the player always fights before the first rest), or
  // the boss hop. One `rng.next()` per eligible hop decides whether it
  // hosts a rest (subject to `REST_MIN_SPACING` between rest hops); when it
  // does, one node on that hop is picked uniformly, so a wide hop keeps a
  // battle sibling (taking the rest is a route choice) while a width-1 hop
  // yields a forced rest.
  const bossId = hops[hopCount - 1]![0]!;
  const restIds = new Set<number>();
  let lastRestHop = -Infinity;
  for (let f = 2; f <= hopCount - 2; f++) {
    const roll = rng.next();
    if (roll < REST_CHANCE && f - lastRestHop >= REST_MIN_SPACING) {
      const ids = hops[f]!;
      const pick = ids[rng.int(0, ids.length - 1)]!;
      restIds.add(pick);
      lastRestHop = f;
    }
  }
  // hopCount === 1 degenerates to root == terminal: `bossId` is the root, so
  // the single node is tagged `boss` — the player's one fight IS the boss, and
  // the map renderer shows its `!` kind glyph (S2 dropped the root `@`-override,
  // so the glyph just follows the kind). No special-case needed.
  const kindedNodes: MapNode[] = nodes.map((n) =>
    n.id === bossId
      ? { ...n, kind: 'boss' }
      : restIds.has(n.id)
        ? { ...n, kind: 'rest' }
        : n,
  );

  return {
    nodes: kindedNodes,
    edges,
    rootId: hops[0]![0]!,
    terminalId: hops[hopCount - 1]![0]!,
    hops,
  };
}

/**
 * Horizontally mirror a child interval `[a, b]` within a hop of width `n`.
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
  lines.push(`NodeMap (${map.nodes.length} nodes, ${map.hops.length} hops)`);
  for (let f = 0; f < map.hops.length; f++) {
    const labeled = map.hops[f]!.map((id) => {
      if (id === map.rootId) return `${id}(root)`;
      if (id === map.terminalId) return `${id}(boss)`;
      const node = map.nodes.find((n) => n.id === id);
      if (node?.kind === 'rest') return `${id}(rest)`;
      return String(id);
    });
    lines.push(`  Hop ${f}: ${labeled.join(', ')}`);
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
