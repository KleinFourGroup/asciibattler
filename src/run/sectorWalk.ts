/**
 * T2 — the RNG-driven walk over the sector-selection meta-DAG
 * (`config/sectorMap.ts`). Pure functions: given a `SectorMap` + an `RNG`, pick
 * the run's first sector, test for completion, and advance to a successor. `Run`
 * drives these at construction (first sector) and on clearing a sector terminal
 * (next sector). Kept separate from the schema/data so the traversal is
 * unit-testable with fixture DAGs (the `NodeMap.generate` / `enemyBudget`
 * pattern: pure run-side logic over validated config).
 */

import type { RNG } from '../core/RNG';
import type { SectorMap } from '../config/sectorMap';

/** A walk result: which DAG node the run is at + which sector it chose there. */
export interface SectorPick {
  readonly sectorNodeId: string;
  readonly sectorId: string;
}

/**
 * Pick one element. **Zero draws when there's no choice** (a singleton list):
 * a forced pick shouldn't consume entropy, which keeps the run's RNG stream
 * byte-identical when a list is degenerate — the property that lets the shipped
 * one-source/one-sector DAG leave node-map generation unperturbed vs the pre-T2
 * single-map run. Delegates to `rng.pick` (which throws on empty) otherwise.
 */
export function pickOne<T>(arr: readonly T[], rng: RNG): T {
  return arr.length === 1 ? arr[0]! : rng.pick(arr);
}

/**
 * Weighted pick: choose one item with probability proportional to `weightOf`.
 * Consumes exactly ONE `rng.next()` for a real choice (same draw count as
 * `pickOne`'s `rng.pick`, so swapping uniform→weighted doesn't shift the
 * surrounding stream) and ZERO on a singleton (same no-choice-no-entropy
 * property — GOTCHAS #111). Used by the sector layout-pool roll, where each
 * `{ layoutId, weight? }` entry's `weight ?? 1` biases the pick (T1's reserved
 * seam, deployed: e.g. "The Start" weights procedural up so it appears more
 * often than a flat 1/|pool|). Weights are positive (zod-validated), so the
 * total is always > 0; the trailing return is float-rounding safety.
 */
export function pickWeighted<T>(arr: readonly T[], weightOf: (item: T) => number, rng: RNG): T {
  if (arr.length === 1) return arr[0]!;
  const weights = arr.map(weightOf);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < arr.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return arr[i]!;
  }
  return arr[arr.length - 1]!;
}

function nodeSectors(map: SectorMap, nodeId: string): readonly string[] {
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`sectorWalk: no node "${nodeId}" in sector-map`);
  return node.sectors;
}

/** Resolve a DAG node to a concrete `{ sectorNodeId, sectorId }` (sector pick). */
function pickSectorAt(map: SectorMap, nodeId: string, rng: RNG): SectorPick {
  const sectorId = pickOne(nodeSectors(map, nodeId), rng);
  return { sectorNodeId: nodeId, sectorId };
}

/** The run's first sector: a random source node → a random sector there. */
export function pickStartSector(map: SectorMap, rng: RNG): SectorPick {
  const sourceId = pickOne(map.sources, rng);
  return pickSectorAt(map, sourceId, rng);
}

/** True when `nodeId` is a run-complete terminal (a sink). */
export function isSectorSink(map: SectorMap, nodeId: string): boolean {
  return map.sinks.includes(nodeId);
}

/**
 * Advance from a (non-sink) node to a successor: a random outgoing edge → its
 * node → a random sector there. Throws if the node has no successor — guarded at
 * load (a non-sink dead-end is rejected by the schema), so this only fires if a
 * caller advances past a sink (which `isSectorSink` is there to prevent).
 */
export function pickNextSector(map: SectorMap, fromNodeId: string, rng: RNG): SectorPick {
  const successors = map.edges.filter((e) => e.from === fromNodeId).map((e) => e.to);
  if (successors.length === 0) {
    throw new Error(`sectorWalk: node "${fromNodeId}" has no successor (advanced past a sink?)`);
  }
  const nextId = pickOne(successors, rng);
  return pickSectorAt(map, nextId, rng);
}

/**
 * 84b — the SHORTEST remaining path from `fromNodeId` to any sink, measured
 * in node entries: every successor node on the path contributes the length
 * of its cheapest sector (`lengthOf`, min over the node's candidates), the
 * current node contributes nothing (its own remainder is the caller's — Run
 * reads it off the live node-map). A sink returns 0. "Shortest" is the signed
 * rule for a branching DAG (round-6-spec §Kickoff resolutions) — moot on the
 * shipped linear map, where the one path IS the walk. Pure; memoized over
 * the schema-guaranteed acyclic graph; throws on an unknown node (the
 * `nodeSectors` guard) or a non-sink dead end (rejected at load, so a
 * throw here is drift, never a runtime branch).
 */
export function remainingSectorHops(
  map: SectorMap,
  fromNodeId: string,
  lengthOf: (sectorId: string) => number,
): number {
  const memo = new Map<string, number>();
  const visit = (nodeId: string): number => {
    const cached = memo.get(nodeId);
    if (cached !== undefined) return cached;
    nodeSectors(map, nodeId); // the unknown-node guard, even at a sink
    if (isSectorSink(map, nodeId)) {
      memo.set(nodeId, 0);
      return 0;
    }
    const successors = map.edges.filter((e) => e.from === nodeId).map((e) => e.to);
    if (successors.length === 0) {
      throw new Error(`sectorWalk: node "${nodeId}" is neither a sink nor has a successor`);
    }
    let best = Infinity;
    for (const next of successors) {
      const own = Math.min(...nodeSectors(map, next).map(lengthOf));
      best = Math.min(best, own + visit(next));
    }
    memo.set(nodeId, best);
    return best;
  };
  return visit(fromNodeId);
}
