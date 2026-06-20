/**
 * V2 — encounter editor formatter fidelity (the archetype/sector-editor pattern).
 * The editor's Save (and Copy / Download) write the file through
 * `formatEncountersJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed catalog reproduces `config/encounters.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — so a Save with
 *     no edits is a no-op diff, and an edited Save touches only changed lines.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`EncountersSchema`) to a value deep-equal to the source — the recursive
 *     pretty-printer drops/reorders nothing the loader cares about.
 *
 * Both derive from the live catalog + schema (never hardcoded encounter values).
 * A third case exercises the recursive grammar (pick / loop / stages + the
 * optional-key paths) that the shipped catalog doesn't yet use, so the formatter
 * is covered before V2's catalog (and W's bosses) author those constructs.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, EncountersSchema, type Encounter } from '../../src/config/encounters';
import { formatEncountersJson } from '../../tools/encounter-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatEncountersJson', () => {
  it('reproduces the committed config/encounters.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/encounters.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatEncountersJson(ENCOUNTERS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal catalog', () => {
    const reparsed = EncountersSchema.parse(JSON.parse(formatEncountersJson(ENCOUNTERS)));
    expect(reparsed).toEqual(ENCOUNTERS);
  });

  it('formats the full recursive grammar + optional keys, round-tripping deep-equal', () => {
    // A synthetic encounter exercising every grammar node (pick / loop / stages,
    // nested) plus the optional `layouts` / `description` keys — none of which the
    // shipped catalog uses yet. Parse it through the schema first so the fixture
    // can't drift from the real shape, then assert the formatter round-trips it.
    const fixture: Encounter[] = EncountersSchema.parse([
      {
        id: 'grammar-demo',
        name: 'Grammar Demo',
        description: 'Exercises pick / loop / stages.',
        healthPool: 12,
        kind: 'boss',
        layouts: ['river', 'labyrinth'],
        waves: [
          {
            kind: 'pick',
            options: [
              {
                entry: {
                  kind: 'wave',
                  spec: {
                    levelBudget: { kind: 'fixed', value: 6 },
                    count: { kind: 'fixed', value: 3 },
                    units: [{ archetype: 'bandit', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
                  },
                },
                weight: 2,
              },
              {
                entry: {
                  kind: 'loop',
                  repeat: 2,
                  body: [
                    {
                      kind: 'wave',
                      spec: {
                        levelBudget: { kind: 'mean', factor: 1 },
                        count: { kind: 'hand', factor: 1 },
                        units: [{ archetype: 'ranged', count: { kind: 'fixed', value: 1 }, level: { kind: 'fixed', value: 3 } }],
                      },
                    },
                  ],
                },
                weight: 1,
              },
            ],
          },
          {
            kind: 'stages',
            stages: [
              {
                until: { kind: 'enemyPoolAtOrBelow', fraction: 0.5 },
                body: [
                  {
                    kind: 'wave',
                    spec: {
                      levelBudget: { kind: 'median', factor: 1.2 },
                      count: { kind: 'fixed', value: 2 },
                      units: [{ archetype: 'mage', count: { kind: 'weight', weight: 1 }, level: { kind: 'weight', weight: 1 } }],
                    },
                  },
                ],
              },
              {
                body: [
                  {
                    kind: 'wave',
                    spec: {
                      levelBudget: { kind: 'mean', factor: 2 },
                      count: { kind: 'fixed', value: 1 },
                      units: [{ archetype: 'catapult', count: { kind: 'fixed', value: 1 }, level: { kind: 'weight', weight: 1 } }],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const reparsed = EncountersSchema.parse(JSON.parse(formatEncountersJson(fixture)));
    expect(reparsed).toEqual(fixture);
  });
});
