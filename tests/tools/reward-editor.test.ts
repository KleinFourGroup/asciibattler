/**
 * 48e — reward-table editor formatter fidelity (the archetype/sector/encounter
 * pattern). The editor's Save (and Copy / Download) write the file through
 * `formatRewardsJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed registry reproduces `config/rewards.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — so a Save with
 *     no edits is a no-op diff, and an edited Save touches only changed lines.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`RewardTablesSchema`) to a value deep-equal to the source — the emitter
 *     drops/reorders nothing the loader cares about.
 *
 * Both derive from the live registry + schema (never hardcoded table values).
 * A third case exercises all three entry kinds (the committed skeleton is
 * bits-only until 48f authors the launch catalog), so the formatter is covered
 * before the catalog exists.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REWARD_TABLES, RewardTablesSchema } from '../../src/config/rewards';
import { formatRewardsJson } from '../../tools/reward-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatRewardsJson', () => {
  it('reproduces the committed config/rewards.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/rewards.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatRewardsJson(REWARD_TABLES))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal registry', () => {
    const reparsed = RewardTablesSchema.parse(JSON.parse(formatRewardsJson(REWARD_TABLES)));
    expect(reparsed.tables).toEqual(REWARD_TABLES);
  });

  it('formats all three entry kinds, round-tripping deep-equal', () => {
    // Parse the fixture through the schema first so it can't drift from the
    // real shape, then assert the formatter round-trips it. Synthetic
    // packet/daemon ids are fine here — referential integrity is the separate
    // boot asserts (assertRewardDaemonRefs et al.), not the schema.
    const fixture = RewardTablesSchema.parse({
      tables: [
        {
          id: 'kinds-demo',
          entries: [
            { kind: 'bits', weight: 3, min: 10, max: 25 },
            { kind: 'packet', weight: 1, packet: 'overclock' },
            { kind: 'daemon', weight: 0.5, daemon: 'mercury' },
          ],
        },
        {
          id: 'second-table',
          entries: [{ kind: 'bits', weight: 1, min: 0, max: 0 }],
        },
      ],
    });
    const reparsed = RewardTablesSchema.parse(JSON.parse(formatRewardsJson(fixture.tables)));
    expect(reparsed).toEqual(fixture);
  });
});
