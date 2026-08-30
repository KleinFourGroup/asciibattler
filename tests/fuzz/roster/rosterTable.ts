/**
 * 87c — the per-hop ROSTER TABLE (round-6-spec §87 / the 2026-08-29
 * shape-lock, WORKLOG §87): whole recorded roster rows, with multiplicity,
 * keyed (character, sector, hop), built from the 87a `rosters.csv`
 * sidecars and committed with provenance — the `prior:table` pipeline
 * pattern, with one upgrade: provenance comes from the 86e1 per-batch
 * `manifest.json` (machine HEAD + dirty flag), not from batch-dir naming
 * (the 87b board dirs are renamed to instrument ids and carry no
 * `YYYYMMDD-HHMMSS-<head>` segment — the manifest is the stronger surface
 * anyway).
 *
 * WHOLE rows are the contract (the 87 kickoff): a sampled roster is one
 * composition a real ARM run actually fielded entering that (sector, hop)
 * — archetypes index-paired with levels, never marginals recombined. Rows
 * dedupe to (composition → n) per bucket; sampling weights by n, so the
 * empirical frequency IS the draw distribution.
 *
 * `--roster=sampled:<hop>` (act-1 default, sector 0) /
 * `sampled:<sector>:<hop>` draws ONE row per SEED via
 * `deriveRng(seed, 'rosterSample')` — harness-side, no serialized stream,
 * so `--jobs` shards reproduce the serial draw byte-identically (the
 * derivation is a pure function of the seed). Loud-throw contract: a
 * missing table file, an unknown (character, sector, hop) bucket, or a
 * malformed spec throws at launch — never a silent natural-roster run.
 */

import { readFileSync } from 'node:fs';
import { deriveRng } from '../../../src/core/RNG';
import { ALL_ARCHETYPES, type Archetype } from '../../../src/sim/archetypes';
import type { RosterEntry } from '../../../src/run/RunConfig';

/** The committed artifact the sampled mode reads (the signed-sheet pattern). */
export const ROSTER_TABLE_PATH = 'tests/fuzz/board/roster-table.json';

/** One parsed rosters.csv data row (the 87a sidecar schema). */
export interface RosterCsvRow {
  readonly seed: number;
  readonly strategy: string;
  readonly character: string;
  readonly sector: number;
  readonly hop: number;
  readonly archetypes: readonly string[];
  readonly levels: readonly number[];
}

/** One deduped composition in a bucket: index-paired lists + multiplicity. */
export interface RosterTableRow {
  readonly archetypes: readonly Archetype[];
  readonly levels: readonly number[];
  /** How many recorded battles fielded exactly this composition. */
  readonly n: number;
}

export interface RosterProvenance {
  /** The HEAD the ROWS were MEASURED at — from the source batches' 86e1
   *  manifests (full sha), same-HEAD enforced across every source. */
  readonly measurementHead: string;
  /** The HEAD the table was BUILT at (`git rev-parse`) — builder-code
   *  version, distinct from the rows' HEAD by design (the 85g2 split). */
  readonly buildHead: string;
  readonly builtAt: string;
  /** The sidecars swept — repo-root-relative, forward slashes. */
  readonly sources: readonly string[];
  readonly note?: string;
}

export interface RosterTable {
  readonly provenance: RosterProvenance;
  /** Total battle rows pooled (Σ n over every bucket). */
  readonly battles: number;
  /** `${character}|${sector}|${hop}` → rows, n-desc then composition-asc
   *  (deterministic — the table byte-reproduces from the same sources). */
  readonly rows: Readonly<Record<string, readonly RosterTableRow[]>>;
}

/** The bucket key. Hop numbering resets per sector (gotcha #120), so the
 *  key is always the (sector, hop) pair — never bare hop. */
export function rosterKeyOf(character: string, sector: number, hop: number): string {
  return `${character}|${sector}|${hop}`;
}

const CSV_HEADER = 'seed,strategy,character,sector,hop,archetypes,levels';

/** Parse one rosters.csv (87a schema). Loud on a wrong header or a
 *  malformed row — a schema drift should fail the build, not thin it. */
export function parseRostersCsv(text: string, source = 'rosters.csv'): RosterCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines[0] !== CSV_HEADER) {
    throw new Error(`roster:table: ${source} header is '${lines[0] ?? ''}' — expected '${CSV_HEADER}'`);
  }
  const rows: RosterCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    if (parts.length !== 7) {
      throw new Error(`roster:table: malformed row in ${source} (${parts.length} fields): ${line}`);
    }
    const [seed, strategy, character, sector, hop, archetypes, levels] = parts as [
      string, string, string, string, string, string, string,
    ];
    const row: RosterCsvRow = {
      seed: Number(seed),
      strategy,
      character,
      sector: Number(sector),
      hop: Number(hop),
      archetypes: archetypes.split('|'),
      levels: levels.split('|').map(Number),
    };
    if (
      !Number.isInteger(row.seed) ||
      !Number.isInteger(row.sector) ||
      !Number.isInteger(row.hop) ||
      // hop >= 0: act-2 ENTRY battles record hop 0 (the sector's root node
      // is battled on arrival before the first hop advance — observed
      // systematically in the 87b bank at (1, 0); sector 0 starts at 1).
      row.hop < 0 ||
      row.sector < 0 ||
      row.levels.some((l) => !Number.isInteger(l) || l < 1)
    ) {
      throw new Error(`roster:table: malformed row in ${source}: ${line}`);
    }
    if (row.archetypes.length !== row.levels.length) {
      throw new Error(
        `roster:table: archetypes/levels length mismatch in ${source} ` +
          `(${row.archetypes.length} vs ${row.levels.length}): ${line}`,
      );
    }
    rows.push(row);
  }
  return rows;
}

/** Build the table from parsed sidecar rows. Pure; the CLI supplies
 *  provenance. Refuses empty input and unknown archetypes (a wrong-batch
 *  or schema-drift mistake, never an empty/poisoned table). */
export function buildRosterTable(
  csvRows: readonly RosterCsvRow[],
  provenance: RosterProvenance,
): RosterTable {
  if (csvRows.length === 0) {
    throw new Error('roster:table: 0 roster rows — wrong dirs, or a pre-87a batch?');
  }
  const known = new Set<string>(ALL_ARCHETYPES);
  // bucket key → composition signature → count (+ the parsed lists once).
  const buckets = new Map<string, Map<string, { archetypes: readonly Archetype[]; levels: readonly number[]; n: number }>>();
  for (const r of csvRows) {
    for (const a of r.archetypes) {
      if (!known.has(a)) {
        throw new Error(
          `roster:table: unknown archetype '${a}' (seed ${r.seed}, ${r.character}|${r.sector}|${r.hop}) — ` +
            'rows measured against a different catalog?',
        );
      }
    }
    const key = rosterKeyOf(r.character, r.sector, r.hop);
    const sig = `${r.archetypes.join('|')}@${r.levels.join('|')}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = new Map();
      buckets.set(key, bucket);
    }
    const prev = bucket.get(sig);
    if (prev) bucket.set(sig, { ...prev, n: prev.n + 1 });
    else bucket.set(sig, { archetypes: r.archetypes as readonly Archetype[], levels: r.levels, n: 1 });
  }
  const rows: Record<string, readonly RosterTableRow[]> = {};
  // Keys sort lexicographically EXCEPT numeric sector/hop segments sort
  // numerically (hop 10 after hop 9) — a stable, human-scannable file.
  const keyOrder = (k: string): [string, number, number] => {
    const [c, s, h] = k.split('|') as [string, string, string];
    return [c, Number(s), Number(h)];
  };
  const sortedKeys = [...buckets.keys()].sort((a, b) => {
    const [ca, sa, ha] = keyOrder(a);
    const [cb, sb, hb] = keyOrder(b);
    return ca.localeCompare(cb) || sa - sb || ha - hb;
  });
  for (const key of sortedKeys) {
    rows[key] = [...buckets.get(key)!.entries()]
      .sort(([sigA, a], [sigB, b]) => b.n - a.n || sigA.localeCompare(sigB))
      .map(([, r]) => ({ archetypes: r.archetypes, levels: r.levels, n: r.n }));
  }
  return { provenance, battles: csvRows.length, rows };
}

/** The one-HEAD-per-table rule over manifest-derived provenance (pure —
 *  the CLI reads the manifest files). Every source batch must be
 *  manifested (86e1), clean, and at the SAME measurement HEAD; anything
 *  else refuses the build (never a mislabeled or mixed-HEAD table). */
export function resolveMeasurementHead(
  sources: readonly { readonly dir: string; readonly head: string | null; readonly dirty: boolean | null }[],
): string {
  if (sources.length === 0) throw new Error('roster:table: no source batches');
  const heads = new Set<string>();
  for (const s of sources) {
    if (s.head === null) {
      throw new Error(
        `roster:table: ${s.dir} has no usable manifest HEAD — pre-86e1 batches can't feed the roster table (re-measure manifested)`,
      );
    }
    if (s.dirty === true) {
      throw new Error(`roster:table: ${s.dir} was measured on a DIRTY tree — refusing to pool it`);
    }
    heads.add(s.head);
  }
  if (heads.size > 1) {
    throw new Error(
      `roster:table: sources span ${heads.size} measurement HEADs (${[...heads].sort().map((h) => h.slice(0, 7)).join(', ')}) — ` +
        'a roster table pools ONE HEAD (build per-HEAD tables, or re-run the cohort)',
    );
  }
  return [...heads][0]!;
}

/** Draw one whole recorded row from a bucket, weighted by multiplicity.
 *  Loud on an unknown bucket — with the character's available keys named,
 *  so a wrong-hop launch is a one-glance fix. */
export function sampleRoster(
  table: RosterTable,
  character: string,
  sector: number,
  hop: number,
  rng: { int(min: number, max: number): number },
): RosterEntry[] {
  const key = rosterKeyOf(character, sector, hop);
  const bucket = table.rows[key];
  if (bucket === undefined || bucket.length === 0) {
    const available = Object.keys(table.rows).filter((k) => k.startsWith(`${character}|`));
    throw new Error(
      `roster:table: no rows for ${key} — available for '${character}': ` +
        (available.length > 0 ? available.join(', ') : `NONE (characters: ${[...new Set(Object.keys(table.rows).map((k) => k.split('|')[0]!))].join(', ')})`),
    );
  }
  const total = bucket.reduce((s, r) => s + r.n, 0);
  let draw = rng.int(0, total - 1);
  for (const row of bucket) {
    draw -= row.n;
    if (draw < 0) {
      return row.archetypes.map((archetype, i) => ({ archetype, level: row.levels[i]! }));
    }
  }
  /* istanbul ignore next -- unreachable: draw < total by construction */
  throw new Error('roster:table: sample walked past the bucket');
}

/** The run-mode seam: validate the bucket ONCE at launch (loud), then a
 *  per-seed pure draw off the keyed harness stream — `--jobs` shards
 *  reproduce it because it depends on nothing but the seed. */
export function makeRosterSampler(
  table: RosterTable,
  character: string,
  sector: number,
  hop: number,
): (seed: number) => RosterEntry[] {
  // Launch-time bucket check (throws the same loud error a draw would).
  sampleRoster(table, character, sector, hop, { int: () => 0 });
  return (seed: number) => sampleRoster(table, character, sector, hop, deriveRng(seed, 'rosterSample'));
}

/** Load the committed table (CLI-side; tests inject fixtures). A missing/
 *  unparsable file throws loud — a sampled arm with no table is a launch
 *  mistake, never a silent natural-roster run (the prior-table contract). */
export function loadRosterTable(path: string = ROSTER_TABLE_PATH): RosterTable {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(
      `roster:table: cannot read ${path} (${String(e)}) — build it with \`npm run roster:table -- <batch dirs>\``,
    );
  }
  return JSON.parse(text) as RosterTable;
}

/** The stdout summary: per (character, sector), one line per hop. */
export function renderRosterTable(table: RosterTable): string {
  const lines: string[] = [];
  const keys = Object.keys(table.rows);
  lines.push(
    `### Roster table — ${table.battles} battles → ${keys.length} (character, sector, hop) buckets ` +
      `(measured @${table.provenance.measurementHead.slice(0, 7)}, built @${table.provenance.buildHead}, ` +
      `${table.provenance.sources.length} sidecars)`,
  );
  const byPair = new Map<string, string[]>();
  for (const key of keys) {
    const [c, s] = key.split('|') as [string, string];
    const pair = `${c} sector ${s}`;
    if (!byPair.has(pair)) byPair.set(pair, []);
    byPair.get(pair)!.push(key);
  }
  for (const [pair, pairKeys] of byPair) {
    lines.push(`${pair}:`);
    for (const key of pairKeys) {
      const bucket = table.rows[key]!;
      const n = bucket.reduce((s, r) => s + r.n, 0);
      const hop = key.split('|')[2]!;
      lines.push(`  hop ${hop.padStart(2)}: n=${String(n).padStart(4)}  comps=${bucket.length}`);
    }
  }
  return lines.join('\n') + '\n';
}
