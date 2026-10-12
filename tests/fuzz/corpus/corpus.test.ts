import { describe, expect, it } from 'vitest';
import type { JournalEntry, RunJournal } from '../../../src/journal/journal';
import { JournalDivergence } from '../../../src/journal/replayJournal';
import { CORPUS, loadBaseline, loadJournal, reachDifferences, replayReach, rowId, storedIds } from './corpus';

// THE JOURNAL CORPUS (corpus.ts): every stored journal, replayed on this
// tree, reaches what it reached when it was recorded, event for event. A
// failure here means behaviour changed. If the change was meant, corpus.ts
// says which of `--rebaseline` and `--record` applies, and what has to be
// shown first.

const baseline = loadBaseline();
const ids = CORPUS.map(rowId);

describe('the journal corpus', () => {
  it('the table, the stored journals and the baseline name the same runs', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(storedIds()).toEqual([...ids].sort());
    expect(Object.keys(baseline).sort()).toEqual([...ids].sort());
    expect(ids.length).toBeGreaterThanOrEqual(30);
  });

  it.each(ids)('%s reaches its baseline', (id) => {
    const { reach } = replayReach(loadJournal(id));
    expect(reachDifferences(baseline[id]!, reach)).toEqual([]);
    expect(reach).toEqual(baseline[id]);
  });

  it('the corpus reaches a win, a loss, every phase a command is sent in, and the kinds the survey found', () => {
    const reaches = Object.values(baseline);
    expect(new Set(reaches.map((r) => r.end))).toEqual(new Set(['defeat', 'victory']));
    const changed = new Set(
      reaches.flatMap((r) => Object.entries(r.commands).flatMap(([kind, [, n]]) => (n > 0 ? [kind] : []))),
    );
    // Written from the recording of 2026-10-11: 17 of the 21 kinds. The four
    // missing are port trades no seed of the survey's grid completes.
    expect([...changed].sort()).toEqual([
      'acceptReward',
      'advanceTurn',
      'buyPortPacket',
      'chooseEventOption',
      'chooseRecruit',
      'chooseRestOption',
      'declineReward',
      'discardPacket',
      'dismissPromotion',
      'dismissSectorCleared',
      'empowerUnit',
      'enterNode',
      'leavePort',
      'passGrant',
      'passRecruit',
      'redrawCards',
      'usePacket',
    ]);
  });

  describe('the instrument catches its plants', () => {
    const id = rowId(CORPUS.find((row) => row.quick && row.driver === 'player')!);
    /** The stored journal with its entries passed through `edit`. */
    const edited = (edit: (entries: JournalEntry[]) => void): RunJournal => {
      const journal = loadJournal(id);
      const entries = journal.segments[0]!.entries.map((e) => ({ ...e })) as JournalEntry[];
      edit(entries);
      return { ...journal, segments: [{ ...journal.segments[0]!, entries }] };
    };

    it('an order dropped from a journal changes what it reaches', () => {
      const dropped = edited((entries) => {
        const at = entries.findIndex((e) => e.t === 'order' && e.command.kind === 'setObjective' && e.command.team === 'player');
        expect(at).toBeGreaterThanOrEqual(0);
        entries.splice(at, 1);
      });
      let differences: string[];
      try {
        differences = reachDifferences(baseline[id]!, replayReach(dropped).reach);
      } catch (error) {
        if (!(error instanceof JournalDivergence)) throw error;
        differences = [error.message];
      }
      expect(differences).not.toEqual([]);
    });

    it('a baseline with one battle’s digest changed is reported as that battle', () => {
      const then = baseline[id]!;
      const battles = then.battles.map((digest, i) => (i === 2 ? '00000000' : digest));
      expect(reachDifferences({ ...then, battles }, then)).toEqual(['the events of battle 3 differ']);
    });
  });
});
