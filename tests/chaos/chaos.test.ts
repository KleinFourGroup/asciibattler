import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { JournalEntry, RunJournal } from '../../src/journal/journal';
import { ChaosFailure, KINDS, chaosRun, type ChaosOptions, type ChaosResult } from './chaos';

// 115c — the chaos driver's every-commit seeds (chaos.ts says what it sends
// and checks). `npm run chaos -- --seeds=N` sweeps more. The seeds were
// picked from a sweep for being short (WORKLOG §115c); the Gambler's daemon
// grants a redraw every turn, and her bits buy at ports. A change that moves
// a run's streams makes each seed another walk, and a long one times out
// under the whole suite: the slot with no dials was seed 2 until three events
// gained pages and its walk went from 0.7 s to 4 s, and seed 31 is the
// shortest of 40 that keeps the census below whole (WORKLOG §118d).
const EVERY_COMMIT: ReadonlyArray<readonly [number, string]> = [
  [3, 'hops=3&layout=procedural'],
  [31, ''],
  [6, 'sectorHops=2'],
  [4, 'character=gambler&bits=300'],
];

const dir = mkdtempSync(join(tmpdir(), 'chaos-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** The driver's failure for a planted run, or a test failure if it passed. */
function failureOf(options: ChaosOptions): ChaosFailure {
  try {
    chaosRun({ journalDir: dir, ...options });
  } catch (error) {
    if (error instanceof ChaosFailure) return error;
    throw error;
  }
  throw new Error('the planted run passed');
}

describe('115c — the chaos driver', () => {
  const results: ChaosResult[] = [];

  it.each(EVERY_COMMIT.map(([seed, dials]) => [seed, dials || '(no dials)', dials] as const))(
    'seed %i, %s: green',
    (seed, _name, dials) => {
      const result = chaosRun({ seed, dials, journalDir: dir });
      expect(result.battles).toBeGreaterThan(0);
      expect(result.roundTrips).toBeGreaterThan(result.battles);
      results.push(result);
    },
  );

  it('the census: across those seeds every command kind is sent, and every kind of order', () => {
    expect(results).toHaveLength(EVERY_COMMIT.length);
    const sent = new Set(results.flatMap((r) => Object.keys(r.census)));
    expect(KINDS.filter((k) => !sent.has(k))).toEqual([]);
    const orders = new Set(results.flatMap((r) => Object.keys(r.orders)));
    expect([...orders].sort()).toEqual([
      'atWill',
      'clearObjective',
      'engage enemy',
      'engage neutral',
      'engage tile',
      'focus enemy',
      'focus neutral',
      'focus tile',
      'hold',
    ]);
  });

  describe('each check fails on its plant, naming the seed and writing the journal', () => {
    const [seed, dials] = EVERY_COMMIT[0]!;

    it('a round trip that changes the run', () => {
      const failure = failureOf({ seed, dials, plant: { roundTrip: (snap) => void (snap.bits += 1) } });
      expect(failure.message).toContain(`chaos seed ${seed} (${dials})`);
      expect(failure.message).toContain("the round trip changed the run at the 'map' phase");
      expect(failure.journalPath).not.toBeNull();
      const journal = JSON.parse(readFileSync(failure.journalPath!, 'utf8')) as RunJournal;
      expect(journal.segments[0]!.end!.reason).toBe('abandoned');
    });

    it('two units on one cell', () => {
      const failure = failureOf({ seed, dials, plant: { overlap: { battle: 0, tick: 5 } } });
      expect(failure.message).toContain('battle 0, tick 5: cell(s)');
      expect(existsSync(failure.journalPath!)).toBe(true);
    });

    it('a command that must be a no-op and changed the run', () => {
      const failure = failureOf({ seed, dials, plant: { strictProgress: true } });
      expect(failure.message).toMatch(/an illegal \{"kind":"\w+".*\} in the '\w+' phase changed the run/);
    });

    it('a journal that replays elsewhere', () => {
      const failure = failureOf({
        seed,
        dials,
        plant: {
          journal: (journal) => {
            const entries = journal.segments[0]!.entries as JournalEntry[];
            const at = entries.findIndex((e) => e.t === 'run' && e.command.kind === 'enterNode');
            entries.splice(at, 1);
          },
        },
      });
      // The replay either refuses mid-way or ends on another hash.
      expect(failure.message).toMatch(new RegExp(`^chaos seed ${seed} .*: (replayJournal: |its journal replayed to)`));
    });
  });
});
