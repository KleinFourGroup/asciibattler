import { describe, it, expect } from 'vitest';
import { SECTOR_MAP, SectorMapSchema } from './sectorMap';
import { SECTOR_IDS } from './sectors';

/**
 * T2 — the sector-selection meta-DAG schema. The structural block pins the
 * shipped one-node DAG; the guard block exercises the four custom validators
 * with hand-built fixtures (never the shipped JSON).
 */

const REAL_SECTOR = SECTOR_IDS[0]!; // a definitionally-valid sector id

describe('sector-map config — the shipped DAG', () => {
  it('parses to a one-node DAG with source == sink', () => {
    expect(SECTOR_MAP.nodes.length).toBe(1);
    expect(SECTOR_MAP.edges.length).toBe(0);
    expect(SECTOR_MAP.sources).toEqual(SECTOR_MAP.sinks);
    const only = SECTOR_MAP.nodes[0]!;
    expect(SECTOR_MAP.sources).toContain(only.id);
    // its sector is real (caught by the schema, asserted here for legibility)
    for (const id of only.sectors) expect(SECTOR_IDS).toContain(id);
  });
});

describe('sector-map schema — validation guards', () => {
  it('accepts a valid multi-node acyclic DAG', () => {
    expect(() =>
      SectorMapSchema.parse({
        nodes: [
          { id: 'a', sectors: [REAL_SECTOR] },
          { id: 'b', sectors: [REAL_SECTOR] },
          { id: 'c', sectors: [REAL_SECTOR] },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'c' },
        ],
        sources: ['a'],
        sinks: ['b', 'c'],
      }),
    ).not.toThrow();
  });

  it('rejects a duplicate node id', () => {
    expect(() =>
      SectorMapSchema.parse({
        nodes: [
          { id: 'a', sectors: [REAL_SECTOR] },
          { id: 'a', sectors: [REAL_SECTOR] },
        ],
        edges: [],
        sources: ['a'],
        sinks: ['a'],
      }),
    ).toThrow(/duplicate sector-map node id/);
  });

  it('rejects an unknown sector id in a node', () => {
    expect(() =>
      SectorMapSchema.parse({
        nodes: [{ id: 'a', sectors: ['no-such-sector'] }],
        edges: [],
        sources: ['a'],
        sinks: ['a'],
      }),
    ).toThrow(/unknown sector id/);
  });

  it('rejects an edge to an unknown node', () => {
    expect(() =>
      SectorMapSchema.parse({
        nodes: [{ id: 'a', sectors: [REAL_SECTOR] }],
        edges: [{ from: 'a', to: 'ghost' }],
        sources: ['a'],
        sinks: ['a'],
      }),
    ).toThrow(/edge to unknown node/);
  });

  it('rejects a source / sink referencing an unknown node', () => {
    expect(() =>
      SectorMapSchema.parse({
        nodes: [{ id: 'a', sectors: [REAL_SECTOR] }],
        edges: [],
        sources: ['ghost'],
        sinks: ['a'],
      }),
    ).toThrow(/source references unknown node/);
  });

  it('rejects a non-sink dead-end (no outgoing edge)', () => {
    expect(() =>
      SectorMapSchema.parse({
        nodes: [
          { id: 'a', sectors: [REAL_SECTOR] },
          { id: 'b', sectors: [REAL_SECTOR] }, // not a sink, no outgoing edge
        ],
        edges: [{ from: 'a', to: 'b' }],
        sources: ['a'],
        sinks: ['a'], // <- 'b' is the real terminal but isn't marked a sink
      }),
    ).toThrow(/non-sink dead-end/);
  });

  it('rejects a cycle', () => {
    expect(() =>
      SectorMapSchema.parse({
        nodes: [
          { id: 'a', sectors: [REAL_SECTOR] },
          { id: 'b', sectors: [REAL_SECTOR] },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
        sources: ['a'],
        sinks: ['b'],
      }),
    ).toThrow(/cycle/);
  });
});
