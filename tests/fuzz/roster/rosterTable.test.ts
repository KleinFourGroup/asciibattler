/**
 * 87c — the roster table + the sampled mode. The capture side (87a) is
 * pinned in harness.test.ts / parallelRun.test.ts / mergeStages.test.ts
 * (index-paired arrays, byte-identical sidecars); the surfaces here are
 * the BUILDER (parse → dedupe/multiplicity → deterministic serialization
 * → manifest-derived provenance, all loud-throw) and the SAMPLER (whole
 * recorded rows, multiplicity-weighted, a pure function of the seed — the
 * property the `--jobs` shard reproduction rests on).
 */

import { describe, it, expect } from 'vitest';
import { runOne } from '../harness';
import { makeStrategy } from '../strategies/registry';
import { ALL_ARCHETYPES } from '../../../src/sim/archetypes';
import { deriveRng } from '../../../src/core/RNG';
import {
  buildRosterTable,
  loadRosterTable,
  makeRosterSampler,
  parseRostersCsv,
  resolveMeasurementHead,
  rosterKeyOf,
  sampleRoster,
  type RosterCsvRow,
  type RosterProvenance,
  type RosterTable,
} from './rosterTable';

const A = ALL_ARCHETYPES;
const PROV: RosterProvenance = {
  measurementHead: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  buildHead: 'abc1234',
  builtAt: '2026-08-30T00:00:00.000Z',
  sources: ['tests/fuzz/output/fixture/rosters.csv'],
};

const csvRow = (over: Partial<RosterCsvRow> = {}): RosterCsvRow => ({
  seed: 1,
  strategy: 'arbitrated:scored:fixture',
  character: 'soldier',
  sector: 0,
  hop: 1,
  archetypes: [A[0]!, A[1]!],
  levels: [5, 5],
  ...over,
});

describe('parseRostersCsv', () => {
  const header = 'seed,strategy,character,sector,hop,archetypes,levels';

  it('round-trips the 87a sidecar schema', () => {
    const rows = parseRostersCsv(
      [header, `7,arbitrated:scored:x,gambler,1,3,${A[0]}|${A[1]}|${A[0]},5|6|5`].join('\n'),
    );
    expect(rows).toEqual([
      {
        seed: 7,
        strategy: 'arbitrated:scored:x',
        character: 'gambler',
        sector: 1,
        hop: 3,
        archetypes: [A[0], A[1], A[0]],
        levels: [5, 6, 5],
      },
    ]);
  });

  it('throws loud on a wrong header (schema drift fails the build)', () => {
    expect(() => parseRostersCsv('seed,strategy,ms\n1,x,5')).toThrowError(/header/);
  });

  it('throws loud on a field-count or index-pairing breach', () => {
    expect(() => parseRostersCsv([header, '1,x,soldier,0,1,merc'].join('\n'))).toThrowError(
      /malformed/,
    );
    expect(() =>
      parseRostersCsv([header, `1,x,soldier,0,1,${A[0]}|${A[1]},5`].join('\n')),
    ).toThrowError(/length mismatch/);
  });
});

describe('buildRosterTable', () => {
  it('dedupes identical compositions into multiplicity, keyed (character, sector, hop)', () => {
    const table = buildRosterTable(
      [
        csvRow({ seed: 1 }),
        csvRow({ seed: 2 }), // same composition, different seed → n=2
        csvRow({ seed: 3, archetypes: [A[1]!, A[0]!], levels: [5, 5] }), // order matters: a DIFFERENT whole row
        csvRow({ seed: 1, hop: 2 }),
        csvRow({ seed: 1, character: 'gambler' }),
        csvRow({ seed: 1, sector: 1 }),
      ],
      PROV,
    );
    expect(table.battles).toBe(6);
    expect(Object.keys(table.rows)).toEqual([
      rosterKeyOf('gambler', 0, 1),
      rosterKeyOf('soldier', 0, 1),
      rosterKeyOf('soldier', 0, 2),
      rosterKeyOf('soldier', 1, 1),
    ]);
    const bucket = table.rows[rosterKeyOf('soldier', 0, 1)]!;
    // n-desc first: the doubled composition leads.
    expect(bucket).toEqual([
      { archetypes: [A[0], A[1]], levels: [5, 5], n: 2 },
      { archetypes: [A[1], A[0]], levels: [5, 5], n: 1 },
    ]);
  });

  it('sorts hop keys numerically (hop 10 after hop 9) and serializes deterministically', () => {
    const rows = [csvRow({ hop: 10 }), csvRow({ hop: 9 }), csvRow({ hop: 2 })];
    const a = buildRosterTable(rows, PROV);
    const b = buildRosterTable([...rows].reverse(), PROV);
    expect(Object.keys(a.rows)).toEqual([
      rosterKeyOf('soldier', 0, 2),
      rosterKeyOf('soldier', 0, 9),
      rosterKeyOf('soldier', 0, 10),
    ]);
    // Input order must not leak into the artifact (byte-reproducible build).
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('refuses an empty build and an unknown archetype', () => {
    expect(() => buildRosterTable([], PROV)).toThrowError(/0 roster rows/);
    expect(() =>
      buildRosterTable([csvRow({ archetypes: ['gremlin', A[0]!], levels: [5, 5] })], PROV),
    ).toThrowError(/unknown archetype 'gremlin'/);
  });
});

describe('resolveMeasurementHead', () => {
  const src = (over: Partial<{ dir: string; head: string | null; dirty: boolean | null }>) => ({
    dir: 'output/board-x/arm',
    head: 'aaaa111',
    dirty: false,
    ...over,
  });

  it('returns the ONE head every manifested source agrees on', () => {
    expect(resolveMeasurementHead([src({}), src({ dir: 'other' })])).toBe('aaaa111');
  });

  it('refuses unmanifested, dirty, and mixed-HEAD sources', () => {
    expect(() => resolveMeasurementHead([src({ head: null, dirty: null })])).toThrowError(
      /no usable manifest HEAD/,
    );
    expect(() => resolveMeasurementHead([src({ dirty: true })])).toThrowError(/DIRTY tree/);
    expect(() => resolveMeasurementHead([src({}), src({ head: 'bbbb222' })])).toThrowError(
      /ONE HEAD/,
    );
  });
});

describe('sampleRoster / makeRosterSampler', () => {
  const table: RosterTable = buildRosterTable(
    [
      csvRow({ seed: 1 }),
      csvRow({ seed: 2 }),
      csvRow({ seed: 3 }),
      csvRow({ seed: 4, archetypes: [A[1]!, A[1]!], levels: [6, 5] }),
    ],
    PROV,
  );

  it('draws a whole recorded row (archetype + level pairs, never recombined)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const roster = sampleRoster(table, 'soldier', 0, 1, deriveRng(seed, 'rosterSample'));
      const sig = roster.map((e) => `${e.archetype}:${e.level}`).join(',');
      expect([`${A[0]}:5,${A[1]}:5`, `${A[1]}:6,${A[1]}:5`]).toContain(sig);
    }
  });

  it('is a pure function of the seed (the --jobs shard-reproduction property)', () => {
    const s1 = makeRosterSampler(table, 'soldier', 0, 1);
    const s2 = makeRosterSampler(table, 'soldier', 0, 1);
    for (const seed of [1, 2, 41, 999]) {
      expect(s1(seed)).toEqual(s2(seed));
      expect(s1(seed)).toEqual(s1(seed));
    }
  });

  it('weights the draw by multiplicity (n=3 vs n=1 over a fixed seed window)', () => {
    let majority = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const roster = sampleRoster(table, 'soldier', 0, 1, deriveRng(seed, 'rosterSample'));
      if (roster[0]!.archetype === A[0]) majority++;
    }
    // Expected 150/200; the window is deterministic, so the band can't flake.
    expect(majority).toBeGreaterThan(120);
    expect(majority).toBeLessThan(180);
  });

  it('throws loud on an unknown bucket, naming what IS available', () => {
    expect(() => makeRosterSampler(table, 'soldier', 0, 7)).toThrowError(/no rows for soldier\|0\|7/);
    expect(() => makeRosterSampler(table, 'priest', 0, 1)).toThrowError(/NONE \(characters: soldier\)/);
  });

  it('loadRosterTable throws loud on a missing file (never a silent natural-roster run)', () => {
    expect(() => loadRosterTable('tests/fuzz/output/no-such-roster-table.json')).toThrowError(
      /cannot read .*roster-table\.json.*npm run roster:table/,
    );
  });
});

describe('sampled roster → harness (the whole-row contract end to end)', () => {
  it("a sampled row IS the run's starting composition (first-battle capture matches)", () => {
    const sampled = [
      { archetype: A[0]!, level: 2 },
      { archetype: A[1]!, level: 3 },
      { archetype: A[0]!, level: 2 },
    ];
    const result = runOne(11, makeStrategy('greedy')!, {
      runConfig: { hopCount: 2, startingRoster: sampled },
    });
    expect(result.battles.length).toBeGreaterThan(0);
    const first = result.battles[0]!;
    const got = first.playerArchetypes
      .map((a, i) => `${a}:${first.playerLevels[i]}`)
      .sort();
    const want = sampled.map((e) => `${e.archetype}:${e.level}`).sort();
    expect(got).toEqual(want);
  });
});
