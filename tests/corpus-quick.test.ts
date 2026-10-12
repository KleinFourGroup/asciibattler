import { describe, expect, it } from 'vitest';
import { CORPUS, loadBaseline, loadJournal, replayReach, rowId } from './fuzz/corpus/corpus';

// THREE OF THE CORPUS'S JOURNALS, ON EVERY `npm test`. The whole corpus
// (tests/fuzz/corpus/corpus.ts says what it is) replays in the smoke tier,
// which the pre-commit hook runs only when sim, run, core or config paths are
// staged. These three are short, and they are here so that a change which
// alters behaviour from a file the hook doesn't watch still meets a stored
// run: a win and a loss by the seeded player, and a chaos run.

const quick = CORPUS.filter((row) => row.quick);

describe('the journal corpus: the quick rows', () => {
  const baseline = loadBaseline();

  it('are three: two of the seeded player’s runs and one of the chaos driver’s', () => {
    expect(quick.map((row) => row.driver).sort()).toEqual(['chaos', 'player', 'player']);
    expect(new Set(quick.map((row) => baseline[rowId(row)]!.end))).toEqual(new Set(['defeat', 'victory']));
  });

  it.each(quick.map(rowId))(
    '%s reaches its baseline',
    (id) => {
      expect(replayReach(loadJournal(id)).reach).toEqual(baseline[id]);
    },
    30_000,
  );
});
