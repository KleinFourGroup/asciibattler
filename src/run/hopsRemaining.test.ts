/**
 * 84b — `Run.hopsRemaining` (derived, never serialized) + the pure DAG
 * helper it leans on (`remainingSectorHops`). The §84 instrument's
 * per-remaining-hop normalization and the §85 prior's state scaling read
 * this; the pins are config-derived (the balance-proof rule) — every
 * expectation is computed from the sector defs / the live node-map, never
 * a hardcoded 11 or 22.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Run } from './Run';
import { PRE_ROOT_NODE_ID } from './NodeMap';
import { remainingSectorHops } from './sectorWalk';
import { SectorMapSchema, SECTOR_MAP, type SectorMap } from '../config/sectorMap';
import { SECTOR_IDS, getSector } from '../config/sectors';

const S = SECTOR_IDS[0]!;

function fresh(config?: ConstructorParameters<typeof Run>[2]): Run {
  return new Run(20260822, new EventBus<GameEvents>(), config);
}

/** The shipped DAG's remaining path from a node, at authored lengths. */
function shippedRemaining(fromNodeId: string): number {
  return remainingSectorHops(SECTOR_MAP, fromNodeId, (id) => getSector(id)!.length);
}

describe('remainingSectorHops — the pure DAG read', () => {
  const lengths: Record<string, number> = { [S]: 7 };
  const lengthOf = (id: string): number => lengths[id]!;

  it('a sink has nothing ahead', () => {
    const single: SectorMap = SectorMapSchema.parse({
      nodes: [{ id: 'start', sectors: [S] }],
      edges: [],
      sources: ['start'],
      sinks: ['start'],
    });
    expect(remainingSectorHops(single, 'start', lengthOf)).toBe(0);
  });

  it('a chain sums every successor at full length; the from-node contributes nothing', () => {
    const chain: SectorMap = SectorMapSchema.parse({
      nodes: [
        { id: 'a', sectors: [S] },
        { id: 'b', sectors: [S] },
        { id: 'c', sectors: [S] },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
      sources: ['a'],
      sinks: ['c'],
    });
    expect(remainingSectorHops(chain, 'a', lengthOf)).toBe(14);
    expect(remainingSectorHops(chain, 'b', lengthOf)).toBe(7);
    expect(remainingSectorHops(chain, 'c', lengthOf)).toBe(0);
  });

  it('a branching DAG reads the SHORTEST path (the signed rule)', () => {
    // a → b → d (long) and a → c → d (short); lengths differ per sector id,
    // so the two sector ids on node c are distinguishable.
    const ids = SECTOR_IDS.length > 1 ? [SECTOR_IDS[0]!, SECTOR_IDS[1]!] : [S, S];
    const byId: Record<string, number> = { [ids[0]!]: 10, [ids[1]!]: 3 };
    const branching: SectorMap = SectorMapSchema.parse({
      nodes: [
        { id: 'a', sectors: [ids[0]] },
        { id: 'b', sectors: [ids[0]] },
        { id: 'c', sectors: ids[0] === ids[1] ? [ids[0]] : [ids[0], ids[1]] },
        { id: 'd', sectors: [ids[0]] },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ],
      sources: ['a'],
      sinks: ['d'],
    });
    const cheapest = ids[0] === ids[1] ? 10 : 3; // node c's min-length sector
    expect(remainingSectorHops(branching, 'a', (id) => byId[id]!)).toBe(cheapest + 10);
  });

  it('throws on an unknown node', () => {
    expect(() => shippedRemaining('nope')).toThrow(/no node/);
  });
});

describe('Run.hopsRemaining — the live read', () => {
  it('pre-root: the whole current map + the shipped DAG remainder', () => {
    const run = fresh();
    expect(run.currentNodeId).toBe(PRE_ROOT_NODE_ID);
    expect(run.hopsRemaining).toBe(
      run.nodeMap.hops.length + shippedRemaining(run.currentSectorNodeId),
    );
  });

  it('entering the root (hop 0) spends one entry', () => {
    const run = fresh();
    const before = run.hopsRemaining;
    run.dispatch({ kind: 'enterNode', nodeId: run.nodeMap.rootId });
    expect(run.currentHop).toBe(0);
    expect(run.hopsRemaining).toBe(before - 1);
    expect(run.hopsRemaining).toBe(
      run.nodeMap.hops.length - 1 + shippedRemaining(run.currentSectorNodeId),
    );
  });

  it('a hopCount probe: its terminal is the run terminal — nothing beyond the map', () => {
    const run = fresh({ hopCount: 3 });
    expect(run.nodeMap.hops.length).toBe(3);
    expect(run.hopsRemaining).toBe(3);
  });

  it('sectorHops overrides EVERY sector on the path', () => {
    const run = fresh({ sectorHops: 2 });
    const futureSectors = remainingSectorHops(SECTOR_MAP, run.currentSectorNodeId, () => 1);
    expect(run.nodeMap.hops.length).toBe(2);
    expect(run.hopsRemaining).toBe(2 + 2 * futureSectors);
  });

  it('a fixture DAG override is read through (a three-sector chain)', () => {
    const chain: SectorMap = SectorMapSchema.parse({
      nodes: [
        { id: 'a', sectors: [S] },
        { id: 'b', sectors: [S] },
        { id: 'c', sectors: [S] },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
      sources: ['a'],
      sinks: ['c'],
    });
    const run = fresh({ sectorMap: chain });
    expect(run.hopsRemaining).toBe(run.nodeMap.hops.length + 2 * getSector(S)!.length);
  });

  it('is derived — not on the wire', () => {
    const run = fresh();
    expect('hopsRemaining' in run.toJSON()).toBe(false);
  });
});
