/**
 * 50f — price editor formatter fidelity (the archetype/sector/encounter/
 * reward/packet pattern). The editor's Save (and Copy / Download) write the
 * file through `formatPricesJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed book reproduces `config/prices.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — a Save with
 *     no edits is a no-op diff.
 *  2. The formatted output round-trips through the REAL game schema
 *     (`PricesSchema`) to a value deep-equal to the source — the emitter
 *     drops/reorders nothing the loader cares about.
 *
 * Both derive from the live book + schema (never hardcoded price values).
 * A third case exercises the override-book branches the committed file
 * doesn't author (a POPULATED daemons.byId, an EMPTY packets.byId), so the
 * formatter is covered before content demands them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRICES, PricesSchema } from '../../src/config/prices';
import { formatPricesJson } from '../../tools/price-editor/format';

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

/** Parse a formatted document through the REAL loader path — the exact
 *  transform src/config/prices.ts applies at boot. */
function reload(formatted: string) {
  return PricesSchema.parse(JSON.parse(formatted));
}

describe('formatPricesJson', () => {
  it('reproduces the committed config/prices.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/prices.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatPricesJson(PRICES))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal book', () => {
    expect(reload(formatPricesJson(PRICES))).toEqual(PRICES);
  });

  it('formats the override branches the committed book leaves empty, round-tripping deep-equal', () => {
    // Parse the fixture through the schema first so it can't drift from the
    // real shape, then assert the formatter round-trips it. Flips the
    // committed file's coverage: packets.byId EMPTY, daemons.byId POPULATED
    // (multiple entries — exercises the comma tail).
    const fixture = PricesSchema.parse({
      units: {
        baseByArchetype: { mercenary: 10, healer: 40 },
        levelGrowth: 1.5,
        jitter: 0.25,
      },
      packets: { default: 12, byId: {} },
      daemons: { default: 50, byId: { moneta: 90, laverna: 35 } },
      sellFraction: 0.4,
      unitRemovalPrice: 8,
      portStock: { units: 3, packets: 4, daemons: 1 },
    });
    expect(reload(formatPricesJson(fixture))).toEqual(fixture);
  });
});
