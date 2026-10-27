/**
 * The roster table's coverage guard: the prior table's tripwire
 * (prior-table-coverage.test.ts) for the other derived artifact the board
 * reads. The table is a measurement of the catalog and the sector map, and
 * its builder throws only on an archetype it does not know, so a catalog or
 * map that moves after the table was measured goes unseen until a
 * `--roster=sampled` read draws from it. This test sees it on `npm test`.
 *
 * Contract, derived from config and never from a hard-coded id list:
 *   1. every draftable archetype is in some recorded roster, or has a
 *      PENDING acknowledgment below with its reason;
 *   2. every archetype in the table still exists;
 *   3. every bucket names a shipped character, a sector position the map
 *      walks, and a hop inside that sector's length;
 *   4. the sector ids the table was built over are the ones the map walks
 *      now, since a bucket key holds a sector's position, not its id
 *      (`makeRosterSampler` refuses the same mismatch at launch);
 *   5. a PENDING acknowledgment is still needed, and names something real.
 *
 * The expectations are read from the raw config files, not through the
 * builder's `sectorPositions`. The rebuild recipe and the invalidation
 * triggers are BALANCE §"The derived-artifact registry".
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../src/config/characters';
import { ALL_ARCHETYPES, DRAFTABLE_ARCHETYPES } from '../src/sim/archetypes';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE_PATH = 'tests/fuzz/board/roster-table.json';

interface RosterTableShape {
  readonly provenance: { readonly measurementHead: string; readonly sectors?: readonly string[] };
  readonly rows: Readonly<Record<string, readonly { readonly archetypes: readonly string[] }[]>>;
}

interface Catalog {
  readonly draftable: readonly string[];
  readonly archetypes: readonly string[];
  readonly characters: readonly string[];
  /** The sector ids the map walks, by position, with each sector's length. */
  readonly walk: readonly { readonly id: string; readonly length: number }[];
}

/**
 * What cannot be in the table yet, each with its reason and what clears it.
 * An entry is `unit:<archetype>` or `sectors`; an entry that is no longer
 * needed fails (5). Empty while the table covers the catalog.
 */
const PENDING: ReadonlyMap<string, string> = new Map();

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;
}

/** The shipped catalog: the map walked from its source along its edges, a
 *  node's candidates all listed, so a map whose position names more than
 *  one sector cannot equal any table's list. */
function shippedCatalog(): Catalog {
  const map = readJson<{
    nodes: { id: string; sectors: string[] }[];
    edges: { from: string; to: string }[];
    sources: string[];
  }>('config/sector-map.json');
  const lengths = new Map(readJson<{ id: string; length: number }[]>('config/sectors.json').map((s) => [s.id, s.length]));
  const walk: { id: string; length: number }[] = [];
  const seen = new Set<string>();
  for (let node: string | undefined = map.sources[0]; node !== undefined && !seen.has(node); ) {
    seen.add(node);
    for (const id of map.nodes.find((n) => n.id === node)?.sectors ?? []) walk.push({ id, length: lengths.get(id) ?? 0 });
    const from: string = node;
    node = map.edges.find((e) => e.from === from)?.to;
  }
  return {
    draftable: DRAFTABLE_ARCHETYPES,
    archetypes: ALL_ARCHETYPES,
    characters: CHARACTERS.map((c) => c.id),
    walk,
  };
}

/** Each kind of gap the table has against a catalog, as sorted lists. */
function coverageGaps(table: RosterTableShape, catalog: Catalog, pending: ReadonlyMap<string, string>) {
  const inTable = new Set<string>();
  for (const rows of Object.values(table.rows)) for (const r of rows) for (const a of r.archetypes) inTable.add(a);
  const known = new Set(catalog.archetypes);
  const characters = new Set(catalog.characters);
  const walkIds = catalog.walk.map((s) => s.id);
  const sectorsMatch = JSON.stringify(table.provenance.sectors ?? null) === JSON.stringify(walkIds);
  const badBuckets = Object.keys(table.rows).filter((key) => {
    const [character, sector, hop] = key.split('|') as [string, string, string];
    const s = catalog.walk[Number(sector)];
    return !characters.has(character) || s === undefined || !(Number(hop) >= 0 && Number(hop) < s.length);
  });
  const needed = new Set([
    ...catalog.draftable.filter((a) => !inTable.has(a)).map((a) => `unit:${a}`),
    ...(sectorsMatch ? [] : ['sectors']),
  ]);
  return {
    missing: catalog.draftable.filter((a) => !inTable.has(a) && !pending.has(`unit:${a}`)).sort(),
    stale: [...inTable].filter((a) => !known.has(a)).sort(),
    badBuckets: badBuckets.sort(),
    sectors: sectorsMatch || pending.has('sectors') ? null : { table: table.provenance.sectors ?? null, map: walkIds },
    unneededPending: [...pending.keys()].filter((k) => !needed.has(k)).sort(),
  };
}

const REBUILD_HINT =
  'rebuild the table from a fresh board cohort (the recipe and the invalidation triggers: BALANCE.md "The derived-artifact registry"), or add a PENDING acknowledgment here with the reason';

describe('the roster table covers the catalog and the sector map', () => {
  const table = readJson<RosterTableShape>(TABLE_PATH);
  const catalog = shippedCatalog();
  const gaps = coverageGaps(table, catalog, PENDING);

  it('the catalog it derives from is not empty (the test is not vacuous)', () => {
    expect(catalog.draftable.length).toBeGreaterThan(1);
    expect(catalog.walk.length).toBeGreaterThan(0);
    expect(Object.keys(table.rows).length).toBeGreaterThan(0);
  });

  it('every draftable archetype is in a recorded roster, or acknowledged', () => {
    expect(gaps.missing, `draftable archetypes no recorded roster holds (measured @${table.provenance.measurementHead.slice(0, 7)}): ${gaps.missing.join(', ')}. ${REBUILD_HINT}.`).toEqual([]);
  });

  it('every archetype in the table still exists', () => {
    expect(gaps.stale, `archetypes in the table that the catalog no longer has: ${gaps.stale.join(', ')}. ${REBUILD_HINT}.`).toEqual([]);
  });

  it('every bucket names a shipped character, a sector position and a hop inside it', () => {
    expect(gaps.badBuckets, `buckets the catalog or the map no longer has: ${gaps.badBuckets.join(', ')}. ${REBUILD_HINT}.`).toEqual([]);
  });

  it('the table was built over the sectors the map walks, position by position', () => {
    expect(gaps.sectors, `the table's sector positions differ from the map's, so a bucket would be read for the wrong sector. ${REBUILD_HINT}.`).toBeNull();
  });

  it('every PENDING acknowledgment is still needed', () => {
    expect(gaps.unneededPending, `PENDING entries the table no longer needs, or that name nothing: ${gaps.unneededPending.join(', ')}`).toEqual([]);
  });
});

describe('the guard catches each planted gap', () => {
  const catalog: Catalog = {
    draftable: ['mercenary', 'archer'],
    archetypes: ['mercenary', 'archer', 'bandit'],
    characters: ['soldier'],
    walk: [
      { id: 'first', length: 3 },
      { id: 'second', length: 3 },
    ],
  };
  // `null` for a table with no sector ids (a default parameter would take
  // `undefined` for its default).
  const table = (rows: RosterTableShape['rows'], sectors: readonly string[] | null = ['first', 'second']): RosterTableShape => ({
    provenance: { measurementHead: 'deadbeef', ...(sectors !== null ? { sectors } : {}) },
    rows,
  });
  const whole = { 'soldier|0|1': [{ archetypes: ['mercenary', 'archer'] }] };

  it('finds nothing in a table that covers the catalog', () => {
    expect(coverageGaps(table(whole), catalog, new Map())).toEqual({
      missing: [],
      stale: [],
      badBuckets: [],
      sectors: null,
      unneededPending: [],
    });
  });

  it('a draftable archetype no roster holds, and its acknowledgment', () => {
    const t = table({ 'soldier|0|1': [{ archetypes: ['mercenary'] }] });
    expect(coverageGaps(t, catalog, new Map()).missing).toEqual(['archer']);
    expect(coverageGaps(t, catalog, new Map([['unit:archer', 'why']])).missing).toEqual([]);
  });

  it('an archetype the catalog dropped', () => {
    const t = table({ 'soldier|0|1': [{ archetypes: ['mercenary', 'archer', 'ghost'] }] });
    expect(coverageGaps(t, catalog, new Map()).stale).toEqual(['ghost']);
  });

  it('a bucket with an unknown character, a sector past the walk, or a hop past its sector', () => {
    const t = table({ ...whole, 'priest|0|1': [], 'soldier|2|1': [], 'soldier|1|3': [] });
    expect(coverageGaps(t, catalog, new Map()).badBuckets).toEqual(['priest|0|1', 'soldier|1|3', 'soldier|2|1']);
  });

  it('a map with a new first sector, and a table with no sector ids', () => {
    const moved: Catalog = { ...catalog, walk: [{ id: 'new', length: 3 }, ...catalog.walk] };
    expect(coverageGaps(table(whole), moved, new Map()).sectors).toEqual({ table: ['first', 'second'], map: ['new', 'first', 'second'] });
    expect(coverageGaps(table(whole), moved, new Map([['sectors', 'why']])).sectors).toBeNull();
    expect(coverageGaps(table(whole, null), catalog, new Map()).sectors).not.toBeNull();
  });

  it('an acknowledgment no longer needed, or naming nothing', () => {
    const pending = new Map([
      ['unit:archer', 'covered now'],
      ['unit:phantom', 'never draftable'],
      ['sectors', 'they match'],
    ]);
    expect(coverageGaps(table(whole), catalog, pending).unneededPending).toEqual(['sectors', 'unit:archer', 'unit:phantom']);
  });
});
