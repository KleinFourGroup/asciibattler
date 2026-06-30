/**
 * T3 — the layout-editor "add to sector" toggle's decision logic. The UI fetches
 * the live sectors.json and writes it through `formatSectorsJson` (both verified
 * elsewhere); this pins the in-between merge — append vs skip, the hop gate, and
 * that the result stays schema-valid — headless, since the DOM round-trip itself
 * is a native-browser check.
 */

import { describe, it, expect } from 'vitest';
import { addLayoutToSectorPools } from '../../tools/sector-editor/poolEdit';
import { SectorsSchema, PROCEDURAL_LAYOUT_ID, type SectorDef } from '../../src/config/sectors';
import { LAYOUT_IDS } from '../../src/sim/layouts';

const REAL = LAYOUT_IDS[0]!; // a real layout id, distinct from the procedural sentinel

/** Two fixture sectors: 'a' has only procedural; 'b' already lists REAL. */
function makeSectors(): SectorDef[] {
  return SectorsSchema.parse([
    {
      id: 'a',
      title: 'Alpha',
      description: 'd',
      length: 3,
      theme: 'grassland',
      layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }],
    },
    {
      id: 'b',
      title: 'Beta',
      description: 'd',
      length: 3,
      theme: 'grassland',
      layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }, { layoutId: REAL }],
    },
  ]);
}

describe('addLayoutToSectorPools', () => {
  it('appends a layout absent from the pool', () => {
    const sectors = makeSectors();
    const res = addLayoutToSectorPools(sectors, REAL, ['a']);
    expect(res.added).toEqual(['Alpha']);
    expect(res.skipped).toEqual([]);
    expect(sectors[0]!.layouts.map((e) => e.layoutId)).toEqual([PROCEDURAL_LAYOUT_ID, REAL]);
  });

  it('skips a pool that already lists the layout (idempotent, no duplicate)', () => {
    const sectors = makeSectors();
    const res = addLayoutToSectorPools(sectors, REAL, ['b']);
    expect(res.added).toEqual([]);
    expect(res.skipped).toEqual(['Beta']);
    // 'b' is unchanged — REAL appears exactly once.
    expect(sectors[1]!.layouts.filter((e) => e.layoutId === REAL)).toHaveLength(1);
  });

  it('includes the hop gate when given, omits it when not', () => {
    const gated = makeSectors();
    addLayoutToSectorPools(gated, REAL, ['a'], 2);
    expect(gated[0]!.layouts.at(-1)).toEqual({ layoutId: REAL, minHop: 2 });

    const ungated = makeSectors();
    addLayoutToSectorPools(ungated, REAL, ['a']);
    expect(ungated[0]!.layouts.at(-1)).toEqual({ layoutId: REAL });
  });

  it('handles a mix of added + skipped across sectors', () => {
    const sectors = makeSectors();
    const res = addLayoutToSectorPools(sectors, REAL, ['a', 'b']);
    expect(res.added).toEqual(['Alpha']);
    expect(res.skipped).toEqual(['Beta']);
  });

  it('ignores an unknown sector id', () => {
    const sectors = makeSectors();
    const res = addLayoutToSectorPools(sectors, REAL, ['ghost']);
    expect(res.added).toEqual([]);
    expect(res.skipped).toEqual([]);
  });

  it('leaves the sectors schema-valid', () => {
    const sectors = makeSectors();
    addLayoutToSectorPools(sectors, REAL, ['a'], 1);
    expect(() => SectorsSchema.parse(sectors)).not.toThrow();
  });
});
