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
