/**
 * Run-level node map: a small layered DAG the player traverses one floor at a
 * time. MVP scope is intentionally narrow — every node is a battle, no rest /
 * shop / elite kinds (see DESIGN.md "Run structure").
 *
 * Layout: `FLOOR_COUNT` floors total. Floor 0 and the last floor are single
 * nodes (root / terminal). Middle floors are 2–3 nodes wide, drawn from the
 * supplied RNG. That puts the total node count in [8, 10], which sits inside
 * the 7–10 target DESIGN tightened to at CHECKPOINT 5.
 *
 * Edge generation goes parent-first: each parent picks 1–2 distinct children
 * from the next floor, then any orphaned child gets a backfill edge from a
 * random parent. The result is a DAG where every node is reachable from the
 * root AND can reach the terminal, with some branching but no chaos.
 */

import { RNG } from '../core/RNG';
import { NODE_MAP } from '../config/nodemap';

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

export function generate(rng: RNG): NodeMap {
  const floors: number[][] = [];
  const nodes: MapNode[] = [];
  let nextId = 0;
  let placedSoFar = 0;

  for (let f = 0; f < FLOOR_COUNT; f++) {
    let width: number;
    if (f === 0 || f === FLOOR_COUNT - 1) {
      width = 1;
    } else {
      // Cap so later floors can still hit their minimum width without
      // blowing past TARGET_TOTAL_MAX. Without this, three middle floors
      // independently rolling MIDDLE_WIDTH_MAX would yield 11 nodes.
      const remainingMiddleFloors = FLOOR_COUNT - 2 - f;
      const minNodesAfter = remainingMiddleFloors * MIDDLE_WIDTH_MIN + 1;
      const budget = TARGET_TOTAL_MAX - placedSoFar - minNodesAfter;
      const cap = Math.max(MIDDLE_WIDTH_MIN, Math.min(MIDDLE_WIDTH_MAX, budget));
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
  }

  const edges: MapEdge[] = [];
  for (let f = 0; f < FLOOR_COUNT - 1; f++) {
    const parents = floors[f]!;
    const children = floors[f + 1]!;
    const inbound = new Set<number>();

    for (const p of parents) {
      const maxOut = Math.min(MAX_OUT_DEGREE, children.length);
      const outDegree = rng.int(1, maxOut);
      for (const c of pickDistinct(rng, children, outDegree)) {
        edges.push({ from: p, to: c });
        inbound.add(c);
      }
    }

    // Backfill: any child with no inbound edge gets one from a random parent.
    // Without this, the parent-first loop above can leave a child orphaned
    // when each parent's random picks all happen to miss it.
    for (const c of children) {
      if (!inbound.has(c)) {
        edges.push({ from: rng.pick(parents), to: c });
        inbound.add(c);
      }
    }
  }

  return {
    nodes,
    edges,
    rootId: floors[0]![0]!,
    terminalId: floors[FLOOR_COUNT - 1]![0]!,
    floors,
  };
}

/**
 * Fisher–Yates partial shuffle: returns `n` distinct elements of `arr` in
 * random order. Trusts `n <= arr.length`.
 */
function pickDistinct(rng: RNG, arr: readonly number[], n: number): number[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
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
