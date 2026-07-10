/**
 * 49g — packet editor formatter fidelity (the archetype/sector/encounter/
 * reward pattern). The editor's Save (and Copy / Download) write the file
 * through `formatPacketsJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed catalog reproduces `config/packets.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — a Save with
 *     no edits is a no-op diff.
 *  2. The formatted output round-trips through the REAL game schema
 *     (`PacketsSchema` + `normalizePacket`) to a value deep-equal to the
 *     source — the emitter drops/reorders nothing the loader cares about.
 *
 * Both derive from the live catalog + schema (never hardcoded packet values).
 * A third case exercises the optional injected-rule axes the committed
 * catalog doesn't author (chance / filter / magnitude / durationSeconds),
 * so the formatter is covered before content demands them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PACKETS, PacketsSchema, normalizePacket } from '../../src/config/packets';
import { formatPacketsJson } from '../../tools/packet-editor/format';

function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

/** Parse a formatted document through the REAL loader path (schema →
 *  normalize), the exact transform src/config/packets.ts applies at boot. */
function reload(formatted: string) {
  return PacketsSchema.parse(JSON.parse(formatted)).packets.map(normalizePacket);
}

describe('formatPacketsJson', () => {
  it('reproduces the committed config/packets.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/packets.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatPacketsJson(PACKETS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal catalog', () => {
    expect(reload(formatPacketsJson(PACKETS))).toEqual(PACKETS);
  });

  it('formats the optional injected-rule axes (chance/filter/magnitude/duration), round-tripping deep-equal', () => {
    // Parse the fixture through the schema first so it can't drift from the
    // real shape, then assert the formatter round-trips it.
    const fixture = PacketsSchema.parse({
      packets: [
        {
          id: 'axes-demo',
          name: 'Axes Demo',
          description: 'Every optional injected-rule knob at once.',
          usableIn: ['preTurn'],
          target: 'none',
          effect: {
            op: 'injectRule',
            rule: {
              on: 'dealHit',
              chance: 0.25,
              filter: { archetype: 'rogue', crit: true },
              effect: {
                op: 'applyStatus',
                statusId: 'poison',
                magnitude: 2,
                durationSeconds: 4,
                applyTo: 'target',
              },
            },
            duration: 'run',
          },
        },
        {
          id: 'mul-demo',
          name: 'Mul Demo',
          description: 'A mul-carrying buff mod.',
          usableIn: ['outOfBattle'],
          target: 'unit',
          effect: {
            op: 'applyBuff',
            buff: {
              key: 'demo',
              mods: { strength: { add: 2, mul: 1.5 }, defense: { mul: 0.5 } },
              merge: 'replace',
            },
            duration: 'encounter',
          },
        },
      ],
    }).packets.map(normalizePacket);
    expect(reload(formatPacketsJson(fixture))).toEqual(fixture);
  });
});
