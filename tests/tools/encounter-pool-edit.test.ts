/**
 * V2 placement — the encounter-editor "add to sector" toggle's decision logic.
 * The UI fetches the live sectors.json and writes it through `formatSectorsJson`
 * (both verified elsewhere); this pins the in-between merge — append vs skip, the
 * hop gate, and that the result stays schema-valid — headless, since the DOM
 * round-trip itself is a native-browser check. Mirrors sector-pool-edit.test.ts
 * (its layout-pool twin) over the encounter pool.
 */

import { describe, it, expect } from 'vitest';
import { addEncounterToSectorPools } from '../../tools/sector-editor/poolEdit';
import { SectorsSchema, PROCEDURAL_LAYOUT_ID, type SectorDef } from '../../src/config/sectors';
import { ENCOUNTER_IDS } from '../../src/config/encounters';

const REAL = ENCOUNTER_IDS[0]!; // a real catalog encounter id (e.g. 'brigands')
const OTHER = ENCOUNTER_IDS[1] ?? ENCOUNTER_IDS[0]!; // a second id; falls back if the catalog is tiny

/** Two fixture sectors: 'a' has no encounters; 'b' already lists OTHER. A valid
 *  layout pool is required by the schema, so each ships one procedural board. */
function makeSectors(): SectorDef[] {
  return SectorsSchema.parse([
    {
      id: 'a',
      title: 'Alpha',
      description: 'd',
      length: 3,
      theme: 'default',
      layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }],
      encounters: [],
    },
    {
      id: 'b',
      title: 'Beta',
      description: 'd',
      length: 3,
      theme: 'default',
      layouts: [{ layoutId: PROCEDURAL_LAYOUT_ID }],
      encounters: [{ encounterId: OTHER }],
    },
  ]);
}

describe('addEncounterToSectorPools', () => {
  it('appends an encounter absent from the pool', () => {
    const sectors = makeSectors();
    const res = addEncounterToSectorPools(sectors, REAL, ['a']);
    expect(res.added).toEqual(['Alpha']);
    expect(res.skipped).toEqual([]);
    expect(sectors[0]!.encounters.map((e) => e.encounterId)).toEqual([REAL]);
  });

  it('skips a pool that already lists the encounter (idempotent, no duplicate)', () => {
    const sectors = makeSectors();
    const res = addEncounterToSectorPools(sectors, OTHER, ['b']);
    expect(res.added).toEqual([]);
    expect(res.skipped).toEqual(['Beta']);
    // 'b' is unchanged — OTHER appears exactly once.
    expect(sectors[1]!.encounters.filter((e) => e.encounterId === OTHER)).toHaveLength(1);
  });

  it('includes the hop gate when given, omits it when not', () => {
    const gated = makeSectors();
    addEncounterToSectorPools(gated, REAL, ['a'], 2);
    expect(gated[0]!.encounters.at(-1)).toEqual({ encounterId: REAL, minHop: 2 });

    const ungated = makeSectors();
    addEncounterToSectorPools(ungated, REAL, ['a']);
    expect(ungated[0]!.encounters.at(-1)).toEqual({ encounterId: REAL });
  });

  it('handles a mix of added + skipped across sectors', () => {
    const sectors = makeSectors();
    // OTHER is absent from 'a' (added) but present in 'b' (skipped).
    const res = addEncounterToSectorPools(sectors, OTHER, ['a', 'b']);
    expect(res.added).toEqual(['Alpha']);
    expect(res.skipped).toEqual(['Beta']);
  });

  it('ignores an unknown sector id', () => {
    const sectors = makeSectors();
    const res = addEncounterToSectorPools(sectors, REAL, ['ghost']);
    expect(res.added).toEqual([]);
    expect(res.skipped).toEqual([]);
  });

  it('leaves the sectors schema-valid', () => {
    const sectors = makeSectors();
    addEncounterToSectorPools(sectors, REAL, ['a'], 1);
    expect(() => SectorsSchema.parse(sectors)).not.toThrow();
  });
});
