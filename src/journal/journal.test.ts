import { describe, expect, it } from 'vitest';
import { fnv1a } from '../core/fnv1a';
import type { RunSnapshot } from '../run/Run';
import { journalFileName, snapshotHash, type RunJournal } from './journal';

const journalOpenedAt = (openedAt: number): RunJournal => ({
  format: 1,
  segments: [
    {
      build: '0.1.0+abc1234',
      configHash: 'deadbeef',
      openedAt,
      start: { kind: 'seed', seed: 7, dials: 'character=soldier' },
      entries: [],
      end: null,
    },
  ],
});

describe('snapshotHash', () => {
  it('is fnv1a over the snapshot’s JSON text, so key order and every value count', () => {
    const a = { schemaVersion: 46, phase: 'map' } as unknown as RunSnapshot;
    expect(snapshotHash(a)).toBe(fnv1a('{"schemaVersion":46,"phase":"map"}'));
    expect(snapshotHash({ phase: 'map', schemaVersion: 46 } as unknown as RunSnapshot)).not.toBe(snapshotHash(a));
    expect(snapshotHash({ ...a, phase: 'defeat' } as unknown as RunSnapshot)).not.toBe(snapshotHash(a));
  });
});

describe('journalFileName', () => {
  it('names the file by when the run began, in UTC, with no character a file name refuses', () => {
    const name = journalFileName(journalOpenedAt(Date.UTC(2026, 9, 1, 22, 3, 26, 159)));
    expect(name).toBe('asciibattler-journal-2026-10-01T22-03-26-159Z.json');
    expect(name).toMatch(/^[A-Za-z0-9.-]+$/);
  });

  it('two runs begun at different times get different names', () => {
    expect(journalFileName(journalOpenedAt(1_000))).not.toBe(journalFileName(journalOpenedAt(2_000)));
  });
});
