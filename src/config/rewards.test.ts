import { describe, expect, it } from 'vitest';

import { DAEMONS, type DaemonConfig } from './daemons';
import {
  EncounterRewardRefSchema,
  REWARD_TABLES,
  REWARD_TABLE_IDS,
  RewardTablesSchema,
  assertRewardDaemonRefs,
  rewardTableById,
  type RewardTable,
} from './rewards';

/** Minimal legal file carrying the given entries (the daemons.test.ts
 *  `withRules` fixture shape). */
const withEntries = (entries: unknown[]): unknown => ({
  tables: [{ id: 'test', entries }],
});

const parses = (entries: unknown[]): boolean =>
  RewardTablesSchema.safeParse(withEntries(entries)).success;

describe('the reward-table schema (48a)', () => {
  it('the shipped registry parses and carries the 48a skeleton table', () => {
    expect(REWARD_TABLES.length).toBeGreaterThanOrEqual(1);
    expect(REWARD_TABLE_IDS).toContain('bits-small');
    const skeleton = rewardTableById('bits-small')!;
    expect(skeleton.entries[0]!.kind).toBe('bits');
  });

  it('accepts all three entry kinds (packet = the dormant §49 seam, schema-complete)', () => {
    expect(
      parses([
        { kind: 'bits', weight: 1, min: 5, max: 10 },
        { kind: 'packet', weight: 2, packet: 'redraw-2' },
        { kind: 'daemon', weight: 0.5, daemon: 'moneta' },
      ]),
    ).toBe(true);
  });

  it('accepts a degenerate bits range (min == max — a fixed grant)', () => {
    expect(parses([{ kind: 'bits', weight: 1, min: 7, max: 7 }])).toBe(true);
  });

  it('rejects an inverted bits range (min > max)', () => {
    expect(parses([{ kind: 'bits', weight: 1, min: 10, max: 5 }])).toBe(false);
  });

  it('rejects non-positive weights, non-integer bits, and unknown kinds', () => {
    expect(parses([{ kind: 'bits', weight: 0, min: 1, max: 2 }])).toBe(false);
    expect(parses([{ kind: 'bits', weight: -1, min: 1, max: 2 }])).toBe(false);
    expect(parses([{ kind: 'bits', weight: 1, min: 1.5, max: 2 }])).toBe(false);
    expect(parses([{ kind: 'gold', weight: 1, amount: 5 }])).toBe(false);
  });

  it('rejects an empty entry list and an empty table list', () => {
    expect(parses([])).toBe(false);
    expect(RewardTablesSchema.safeParse({ tables: [] }).success).toBe(false);
  });

  it('rejects duplicate table ids', () => {
    const dup = {
      tables: [
        { id: 'twin', entries: [{ kind: 'bits', weight: 1, min: 1, max: 2 }] },
        { id: 'twin', entries: [{ kind: 'bits', weight: 1, min: 3, max: 4 }] },
      ],
    };
    expect(RewardTablesSchema.safeParse(dup).success).toBe(false);
  });

  it('rewardTableById returns undefined on a miss', () => {
    expect(rewardTableById('no-such-table')).toBeUndefined();
  });
});

describe('the encounter-side reward ref schema (48a)', () => {
  it('accepts a chance-triggered ref and enforces the [0,1] range', () => {
    expect(
      EncounterRewardRefSchema.safeParse({ table: 'bits-small', trigger: { chance: 0.5 } })
        .success,
    ).toBe(true);
    expect(
      EncounterRewardRefSchema.safeParse({ table: 'bits-small', trigger: { chance: 1.5 } })
        .success,
    ).toBe(false);
    expect(EncounterRewardRefSchema.safeParse({ table: 'bits-small' }).success).toBe(false);
  });
});

describe('assertRewardDaemonRefs (the boot check)', () => {
  const tableWith = (entries: RewardTable['entries']): RewardTable => ({
    id: 'synthetic',
    entries,
  });

  it('the shipped registry resolves against the real daemon catalog', () => {
    expect(() => assertRewardDaemonRefs(REWARD_TABLES, DAEMONS)).not.toThrow();
  });

  it('throws on a dangling daemon id', () => {
    const table = tableWith([{ kind: 'daemon', weight: 1, daemon: 'nope' }]);
    expect(() => assertRewardDaemonRefs([table], [])).toThrow(/unknown daemon id 'nope'/);
  });

  it('passes when every daemon ref resolves (and ignores bits/packet entries)', () => {
    const table = tableWith([
      { kind: 'daemon', weight: 1, daemon: 'x' },
      { kind: 'bits', weight: 1, min: 1, max: 2 },
      { kind: 'packet', weight: 1, packet: 'unchecked-until-49' },
    ]);
    const x = { id: 'x', name: 'X', description: 'Fixture.' } as DaemonConfig;
    expect(() => assertRewardDaemonRefs([table], [x])).not.toThrow();
  });
});
