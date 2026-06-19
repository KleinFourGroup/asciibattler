import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { SectorMapSchema, type SectorMap } from '../config/sectorMap';
import { SECTOR_IDS } from '../config/sectors';
import { pickOne, pickStartSector, pickNextSector, isSectorSink } from './sectorWalk';

/**
 * T2 — the sector-DAG walk. Pure RNG-driven traversal over fixture DAGs (the
 * shipped map is single-node; the multi-node behavior is tested with fixtures).
 */

const S = SECTOR_IDS[0]!; // a real sector id for fixtures

/** The shipped-shape one-node DAG (source == sink, one sector). */
const SINGLE: SectorMap = SectorMapSchema.parse({
  nodes: [{ id: 'start', sectors: [S] }],
  edges: [],
  sources: ['start'],
  sinks: ['start'],
});

/** A 3-node diamond-ish DAG: a → {b, c}; b and c are both sinks, each holding a
 *  distinct sector candidate so a pick is observable. */
const BRANCHING: SectorMap = SectorMapSchema.parse({
  nodes: [
    { id: 'a', sectors: [S] },
    { id: 'b', sectors: [S] },
    { id: 'c', sectors: [S] },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
  ],
  sources: ['a'],
  sinks: ['b', 'c'],
});

describe('pickOne — zero draws on a singleton', () => {
  it('returns the sole element without advancing the RNG', () => {
    const rng = new RNG(123);
    const before = rng.toJSON().state;
    expect(pickOne(['only'], rng)).toBe('only');
    expect(rng.toJSON().state).toBe(before); // no draw consumed
  });

  it('draws (advances the RNG) when there is a real choice', () => {
    const rng = new RNG(123);
    const before = rng.toJSON().state;
    pickOne(['a', 'b', 'c'], rng);
    expect(rng.toJSON().state).not.toBe(before);
  });
});

describe('pickStartSector', () => {
  it('on the one-source/one-sector DAG, consumes zero draws (byte-continuity)', () => {
    const rng = new RNG(7);
    const before = rng.toJSON().state;
    const pick = pickStartSector(SINGLE, rng);
    expect(pick).toEqual({ sectorNodeId: 'start', sectorId: S });
    expect(rng.toJSON().state).toBe(before);
  });

  it('is deterministic per seed', () => {
    expect(pickStartSector(BRANCHING, new RNG(42))).toEqual(pickStartSector(BRANCHING, new RNG(42)));
  });

  it('always lands on a declared source node', () => {
    for (let seed = 0; seed < 20; seed++) {
      const pick = pickStartSector(BRANCHING, new RNG(seed));
      expect(BRANCHING.sources).toContain(pick.sectorNodeId);
    }
  });
});

describe('isSectorSink', () => {
  it('flags sinks and only sinks', () => {
    expect(isSectorSink(BRANCHING, 'b')).toBe(true);
    expect(isSectorSink(BRANCHING, 'c')).toBe(true);
    expect(isSectorSink(BRANCHING, 'a')).toBe(false);
  });
});

describe('pickNextSector', () => {
  it('advances along an outgoing edge to a successor node', () => {
    for (let seed = 0; seed < 20; seed++) {
      const next = pickNextSector(BRANCHING, 'a', new RNG(seed));
      expect(['b', 'c']).toContain(next.sectorNodeId);
    }
  });

  it('reaches both successors across seeds (honors the branch)', () => {
    const landed = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      landed.add(pickNextSector(BRANCHING, 'a', new RNG(seed)).sectorNodeId);
    }
    expect(landed).toEqual(new Set(['b', 'c']));
  });

  it('throws when advancing past a node with no successor (a sink)', () => {
    expect(() => pickNextSector(BRANCHING, 'b', new RNG(1))).toThrow(/no successor/);
  });
});

describe('a full walk terminates at a sink', () => {
  it('source → … → sink for every seed', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rng = new RNG(seed);
      let pick = pickStartSector(BRANCHING, rng);
      let steps = 0;
      while (!isSectorSink(BRANCHING, pick.sectorNodeId)) {
        pick = pickNextSector(BRANCHING, pick.sectorNodeId, rng);
        if (++steps > 100) throw new Error('walk did not terminate');
      }
      expect(BRANCHING.sinks).toContain(pick.sectorNodeId);
    }
  });
});
