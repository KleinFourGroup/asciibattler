/**
 * T3 — sector editor formatter fidelity (the archetype/layout-editor pattern).
 * The editor's Save (and the layout-editor "add to sector" toggle) write the
 * file through `formatSectorsJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed config reproduces `config/sectors.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — so a Save with
 *     no edits is a no-op diff, and an edited Save touches only changed lines.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`SectorsSchema`) to a value deep-equal to the source — the formatter
 *     drops/reorders nothing the loader cares about.
 *
 * Both derive from the live config + schema (never hardcoded sector values).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SECTORS, SectorsSchema } from '../../src/config/sectors';
import { formatSectorsJson } from '../../tools/sector-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatSectorsJson', () => {
  it('reproduces the committed config/sectors.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/sectors.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatSectorsJson(SECTORS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal config', () => {
    const reparsed = SectorsSchema.parse(JSON.parse(formatSectorsJson(SECTORS)));
    expect(reparsed).toEqual(SECTORS);
  });

  it('emits optional minHop / weight only when present', () => {
    const formatted = formatSectorsJson([
      {
        id: 's',
        title: 'S',
        description: 'd',
        length: 3,
        theme: 'default',
        layouts: [
          { layoutId: 'procedural', weight: 2 },
          { layoutId: 'labyrinth', minHop: 2 },
          { layoutId: 'river' },
        ],
        encounters: [],
      },
    ]);
    expect(formatted).toContain('{ "layoutId": "procedural", "weight": 2 }');
    expect(formatted).toContain('{ "layoutId": "labyrinth", "minHop": 2 }');
    expect(formatted).toContain('{ "layoutId": "river" }');
    // The fight pool is a first-class slot — always emitted, `[]` when empty.
    expect(formatted).toContain('"encounters": []');
  });

  it('emits a populated encounter pool inline, mirroring the layout pool', () => {
    const formatted = formatSectorsJson([
      {
        id: 's',
        title: 'S',
        description: 'd',
        length: 3,
        theme: 'default',
        layouts: [{ layoutId: 'procedural' }],
        encounters: [
          { encounterId: 'brigands' },
          { encounterId: 'ambush', minHop: 1, weight: 2 },
        ],
      },
    ]);
    expect(formatted).toContain('"encounters": [');
    expect(formatted).toContain('{ "encounterId": "brigands" }');
    expect(formatted).toContain('{ "encounterId": "ambush", "minHop": 1, "weight": 2 }');
  });
});
