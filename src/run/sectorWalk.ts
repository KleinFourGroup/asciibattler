/**
 * The walk over the sector map (`config/sectorMap.ts`), a DAG whose nodes
 * each offer one or more sectors: pick the run's first sector, test for the
 * end, and advance to a successor. Pure functions over a validated map and
 * an `RNG`, so the walk is tested with fixture maps; `Run` calls them at
 * construction and when a sector's terminal is cleared. `pickWeighted` also
 * serves the encounter, layout and reward rolls.
 */

import type { RNG } from '../core/RNG';
import type { SectorMap } from '../config/sectorMap';

/** A walk's result: the map node the run is at, and the sector it chose there. */
interface SectorPick {
  readonly sectorNodeId: string;
  readonly sectorId: string;
}

/**
 * Pick one element uniformly. A list of one costs no draw, so a forced pick
 * leaves the stream where it was (gotcha #111); otherwise `rng.pick`, which
 * throws on an empty list.
 */
export function pickOne<T>(arr: readonly T[], rng: RNG): T {
  return arr.length === 1 ? arr[0]! : rng.pick(arr);
}

/**
 * Pick one item with probability in proportion to `weightOf`: one
 * `rng.next()` for a real choice, the draw `pickOne`'s `rng.pick` makes, so
 * a uniform pick can become a weighted one without shifting the stream; none
 * for a list of one (gotcha #111). The encounter and layout rolls
 * (`encounters/selection.ts`) and the reward roll use it. Their weights are
 * positive by schema, so the total is above 0, and the last return covers
 * float rounding. An empty list draws once and returns `undefined`, so a
 * caller whose list can be filtered to nothing checks first. `Run.ts`'s
 * event draws use its own `pickWeightedOneDraw`, which draws for a list of
 * one too.
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

/** Pick a sector at a map node. */
function pickSectorAt(map: SectorMap, nodeId: string, rng: RNG): SectorPick {
  const sectorId = pickOne(nodeSectors(map, nodeId), rng);
  return { sectorNodeId: nodeId, sectorId };
}

/** The run's first sector: a random source node, then a random sector there. */
export function pickStartSector(map: SectorMap, rng: RNG): SectorPick {
  const sourceId = pickOne(map.sources, rng);
  return pickSectorAt(map, sourceId, rng);
}

/** True when `nodeId` is a run-complete terminal (a sink). */
export function isSectorSink(map: SectorMap, nodeId: string): boolean {
  return map.sinks.includes(nodeId);
}

/**
 * Advance from a node that is not a sink: a random outgoing edge, then a
 * random sector at its node. Throws when the node has no successor; the
 * schema rejects a non-sink node with none, so only a caller advancing past
 * a sink reaches it, which `isSectorSink` is there to prevent.
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
 * The shortest remaining path from `fromNodeId` to any sink, in node
 * entries: each successor node on the path adds the length of its shortest
 * sector (`lengthOf`, the least over the node's sectors), and the current
 * node adds nothing, since the current sector's remainder is the caller's
 * (`Run.hopsRemaining` counts it off the live node map). A sink gives 0.
 * Shortest is the rule for a branching map; the shipped map is one path.
 * Memoized over the graph, which the schema keeps acyclic. It throws on an
 * unknown node or a non-sink dead end, both rejected at load, so a throw here
 * means the map got past its schema.
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
