import { describe, it, expect } from 'vitest';
import {
  SECTORS,
  SECTOR_IDS,
  SectorsSchema,
  PROCEDURAL_LAYOUT_ID,
  getSector,
  layoutPoolAtHop,
  type SectorDef,
} from './sectors';
import { LAYOUT_IDS } from './layouts';
import { FORCE_PROCEDURAL } from '../run/RunConfig';

/**
 * T1 — the Sector schema. The structural block pins facts about the shipped
 * catalog ("The Start" exists + reproduces the uniform pool); the mechanic
 * block exercises the zod schema + the two custom guards with hand-built
 * fixtures (never the shipped JSON, per the balance-proof-test policy).
 */

const REAL_LAYOUT = LAYOUT_IDS[0]!; // a definitionally-valid non-sentinel id

/** A minimal valid sector; override any field. */
function makeSector(overrides: Partial<SectorDef> = {}): unknown {
  return {
    id: 'fixture',
    title: 'Fixture',
    description: 'A test sector.',
    length: 3,
    theme: 'default',
    layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }],
    ...overrides,
  };
}

describe('sectors config — the shipped catalog', () => {
  it('parses + every sector id is unique', () => {
    expect(SECTORS.length).toBeGreaterThan(0);
    expect(new Set(SECTOR_IDS).size).toBe(SECTOR_IDS.length);
  });

  it('ships "The Start" with the full ungated pool (procedural + every layout)', () => {
    const start = getSector('the-start');
    expect(start).toBeDefined();
    const ids = start!.layouts.map((e) => e.layoutId);
    // The procedural sentinel + every authored layout, all ungated.
    expect(ids).toContain(PROCEDURAL_LAYOUT_ID);
    for (const layoutId of LAYOUT_IDS) expect(ids).toContain(layoutId);
    expect(start!.layouts.every((e) => e.minHop === undefined)).toBe(true);
    // length feeds NodeMap.generate's hopCount — positive, matching today's map.
    expect(start!.length).toBeGreaterThan(0);
  });

  it('getSector returns undefined for an unknown id', () => {
    expect(getSector('no-such-sector')).toBeUndefined();
  });
});

describe('sectors config — the procedural sentinel', () => {
  it('matches RunConfig.FORCE_PROCEDURAL (drift guard)', () => {
    // The pool sentinel and the CLI force-flag intentionally share a literal so
    // T2 can resolve one through the other. If either moves, this fails loudly.
    expect(PROCEDURAL_LAYOUT_ID).toBe(FORCE_PROCEDURAL);
  });
});

describe('sectors schema — validation guards', () => {
  it('accepts a minimal sector', () => {
    expect(() => SectorsSchema.parse([makeSector()])).not.toThrow();
  });

  it('accepts a real layout id and the procedural sentinel together', () => {
    expect(() =>
      SectorsSchema.parse([
        makeSector({ layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }, { layoutId: REAL_LAYOUT }] }),
      ]),
    ).not.toThrow();
  });

  it('rejects an unknown layoutId (not a LAYOUT_ID or the sentinel)', () => {
    expect(() =>
      SectorsSchema.parse([makeSector({ layouts: [{ layoutId: 'not-a-real-board' }] })]),
    ).toThrow(/unknown layoutId/);
  });

  it('rejects a pool with no eligible layout at hop 0 (all entries gated above it)', () => {
    expect(() =>
      SectorsSchema.parse([
        makeSector({ length: 3, layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID, minHop: 1 }] }),
      ]),
    ).toThrow(/no eligible layout at hop 0/);
  });

  it('accepts hop gates as long as every reachable hop keeps a candidate', () => {
    // Ungated procedural covers every hop; a gated real layout joins at hop 2.
    expect(() =>
      SectorsSchema.parse([
        makeSector({
          length: 3,
          layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }, { layoutId: REAL_LAYOUT, minHop: 2 }],
        }),
      ]),
    ).not.toThrow();
  });

  it('rejects an empty pool (zod min(1))', () => {
    expect(() => SectorsSchema.parse([makeSector({ layouts: [] })])).toThrow();
  });

  it('rejects a non-positive length', () => {
    expect(() => SectorsSchema.parse([makeSector({ length: 0 })])).toThrow();
  });
});

describe('layoutPoolAtHop — the hop-gated pool query', () => {
  const sector = SectorsSchema.parse([
    makeSector({
      length: 4,
      layouts: [
        { layoutId: PROCEDURAL_LAYOUT_ID },
        { layoutId: REAL_LAYOUT, minHop: 2 },
      ],
    }),
  ])[0]!;

  it('returns only ungated entries below the gate', () => {
    expect(layoutPoolAtHop(sector, 0).map((e) => e.layoutId)).toEqual([PROCEDURAL_LAYOUT_ID]);
    expect(layoutPoolAtHop(sector, 1).map((e) => e.layoutId)).toEqual([PROCEDURAL_LAYOUT_ID]);
  });

  it('includes a gated entry at and above its minHop', () => {
    expect(layoutPoolAtHop(sector, 2).map((e) => e.layoutId)).toEqual([
      PROCEDURAL_LAYOUT_ID,
      REAL_LAYOUT,
    ]);
    expect(layoutPoolAtHop(sector, 3).map((e) => e.layoutId)).toEqual([
      PROCEDURAL_LAYOUT_ID,
      REAL_LAYOUT,
    ]);
  });

  it('is never empty for a reachable hop of a validated sector', () => {
    for (let hop = 0; hop < sector.length; hop++) {
      expect(layoutPoolAtHop(sector, hop).length).toBeGreaterThan(0);
    }
  });
});
