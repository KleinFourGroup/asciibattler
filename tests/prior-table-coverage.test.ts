/**
 * 88d2 — the DERIVED-ARTIFACT TRIPWIRE (user-signed 2026-09-01), riding
 * `npm test` so it fires on the forgetful path (AGENTS: put the guard where
 * the MISTAKE happens). The exhibit: 88c daemonized the miner packet into
 * Dis Pater, the daemon entered every pool, and the fold priced the game's
 * strongest-class daemon at ZERO for a whole amendment board — because the
 * committed prior table is a MEASUREMENT of the catalog, and nothing said
 * "the catalog moved; rebuild me". This test does.
 *
 * Contract (config-derived — never a hardcoded id list):
 *   1. every ACQUIRABLE item has a prior-table row, or an explicit PENDING
 *      acknowledgment below (with the reason it cannot be measured yet);
 *   2. every table row names an item that still exists (a stale row —
 *      `packet:miner` after 88c — flags);
 *   3. a PENDING acknowledgment that has gained a row is itself stale.
 *
 * Acquirable = what the acquisition sites the table pools from can offer:
 * ports stock EVERY non-owned daemon and EVERY packet (`Run.rollPortStock`
 * samples the whole catalogs), recruits + ports draw the draftable
 * archetypes. Reward pools are a subset of those catalogs (boot-asserted
 * by `assertReward*Refs`), so the catalogs are the superset that matters.
 *
 * The rebuild recipe + the invalidation triggers live in BALANCE §"The
 * derived-artifact registry" — the failure messages point there.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAEMONS } from '../src/config/daemons';
import { PACKET_IDS } from '../src/config/packets';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../src/config/characters';
import { DRAFTABLE_ARCHETYPES } from '../src/sim/archetypes';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE_PATH = 'tests/fuzz/board/prior-table.json';
const REGISTRY_HEADING = '## The derived-artifact registry';

interface PriorTableShape {
  readonly provenance: { readonly measurementHead?: string; readonly sources: readonly string[] };
  readonly items: Readonly<Record<string, { readonly n: number }>>;
}

/**
 * Items that CANNOT have a row yet, each with the reason and what clears
 * it. Keep this list honest: an entry whose item gains a row fails (3).
 *
 * `daemon:<default character's start daemon>` — every shadow batch to date
 * runs `--character=soldier` (the TRAIN-bank protocol, BALANCE §85g2b), and
 * a run never offers a daemon it already owns (reward exclusion 48b, port
 * stock filters owned) — so the soldier's own idol is structurally
 * unmeasurable on that bank. Clears when a priest/gambler shadow batch feeds
 * a table build. Derived from the character config, not spelled as an id.
 */
function pendingAcknowledgments(): ReadonlyMap<string, string> {
  const soldier = CHARACTERS.find((c) => c.id === DEFAULT_CHARACTER_ID);
  if (!soldier) throw new Error(`no default character '${DEFAULT_CHARACTER_ID}' in the catalog`);
  return new Map([
    [
      `daemon:${soldier.daemon}`,
      `the ${soldier.id}'s start daemon — owned from hop 0 on every all-${soldier.id} shadow batch, so no site ever offers it; clears at the first multi-character shadow build`,
    ],
  ]);
}

function acquirableKeys(): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const d of DAEMONS) keys.add(`daemon:${d.id}`);
  for (const id of PACKET_IDS) keys.add(`packet:${id}`);
  for (const a of DRAFTABLE_ARCHETYPES) keys.add(`unit:${a}`);
  return keys;
}

function loadTable(): PriorTableShape {
  return JSON.parse(readFileSync(join(ROOT, TABLE_PATH), 'utf8')) as PriorTableShape;
}

const REBUILD_HINT = `rebuild the table from a fresh shadow batch (the recipe + the invalidation triggers: BALANCE.md "${REGISTRY_HEADING}"), or add a PENDING acknowledgment here with the reason`;

describe('the prior table covers the acquirable catalog (88d2 — the derived-artifact tripwire)', () => {
  const table = loadTable();
  const rows = new Set(Object.keys(table.items));
  const acquirable = acquirableKeys();
  const pending = pendingAcknowledgments();

  it('the catalogs the test derives from are non-trivial (the test is not vacuous)', () => {
    expect(DAEMONS.length).toBeGreaterThan(1);
    expect(PACKET_IDS.length).toBeGreaterThan(1);
    expect(DRAFTABLE_ARCHETYPES.length).toBeGreaterThan(1);
    expect(rows.size).toBeGreaterThan(0);
  });

  it('every acquirable daemon / packet / draftable archetype has a row or an explicit PENDING acknowledgment', () => {
    const missing = [...acquirable].filter((k) => !rows.has(k) && !pending.has(k)).sort();
    expect(
      missing,
      `acquirable items with NO prior row — the catalog moved after the table was measured (@${table.provenance.measurementHead ?? '?'}), so the fold prices these at 0 (the 88d Dis Pater exhibit): ${missing.join(', ')}. ${REBUILD_HINT}.`,
    ).toEqual([]);
  });

  it('every table row names an item that still exists (no stale rows)', () => {
    const stale = [...rows].filter((k) => !acquirable.has(k)).sort();
    expect(
      stale,
      `prior rows for items no longer in any catalog (the post-88c \`packet:miner\` shape): ${stale.join(', ')}. ${REBUILD_HINT}.`,
    ).toEqual([]);
  });

  it('every PENDING acknowledgment is still unmeasured (an acknowledgment that gained a row is stale)', () => {
    const measured = [...pending.keys()].filter((k) => rows.has(k)).sort();
    expect(
      measured,
      `PENDING items that now HAVE a row — delete their acknowledgment: ${measured.join(', ')}`,
    ).toEqual([]);
  });

  it('every PENDING acknowledgment names an acquirable item (no acknowledgments for phantoms)', () => {
    const phantom = [...pending.keys()].filter((k) => !acquirable.has(k)).sort();
    expect(phantom, `PENDING keys that are not acquirable: ${phantom.join(', ')}`).toEqual([]);
  });

  it('the table carries v2 machine provenance (a measurement HEAD + at least one source)', () => {
    expect(table.provenance.measurementHead, 'no measurementHead — a pre-85g2 table shape').toMatch(/^[0-9a-f]{7,40}$/);
    expect(table.provenance.sources.length).toBeGreaterThan(0);
  });

  it(`BALANCE.md carries the registry section the failure messages point at ("${REGISTRY_HEADING}")`, () => {
    const balance = readFileSync(join(ROOT, 'BALANCE.md'), 'utf8');
    expect(balance.includes(`\n${REGISTRY_HEADING}`), `BALANCE.md lost its "${REGISTRY_HEADING}" section`).toBe(true);
  });
});
