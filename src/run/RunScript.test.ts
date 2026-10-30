// The scripted run's list (RunScript.ts): the old dials as its cases, and
// the most specific entry winning at an address.
import { describe, expect, it } from 'vitest';
import { dialEntries, scriptItem, scriptKind, type ScriptEntry } from './RunScript';

describe('the old dials as entries', () => {
  it('puts the three forced ids at every hop of every act, and the first-node stamp at the starting act\'s root', () => {
    const entries = dialEntries(
      { forcedLayoutId: 'river', forcedEncounterId: 'artillery', forcedEventId: 'mines', firstNodeKind: 'elite' },
      1,
    );
    expect(entries).toEqual([
      { act: 'all', hop: 'all', layout: 'river' },
      { act: 'all', hop: 'all', encounter: 'artillery' },
      { act: 'all', hop: 'all', event: 'mines' },
      { act: 1, hop: 1, kind: 'elite' },
    ]);
    expect(dialEntries({ firstNodeKind: 'rest' }, 2)).toEqual([{ act: 2, hop: 1, kind: 'rest' }]);
  });

  it('gives an empty list for no dials', () => {
    expect(dialEntries(undefined, 1)).toEqual([]);
    expect(dialEntries({ seed: 3, hopCount: 2 }, 1)).toEqual([]);
  });
});

describe('the most specific entry wins', () => {
  const entries: ScriptEntry[] = [
    { act: 'all', hop: 'all', layout: 'river' },
    { act: 2, hop: 'all', layout: 'labyrinth' },
    { act: 2, hop: 4, layout: 'isthmus' },
    { act: 1, hop: 3, kind: 'port' },
  ];

  it('a numbered hop over its act, and an act over every act', () => {
    expect(scriptItem(entries, 'layout', 2, 4)).toBe('isthmus');
    expect(scriptItem(entries, 'layout', 2, 5)).toBe('labyrinth');
    expect(scriptItem(entries, 'layout', 1, 4)).toBe('river');
  });

  it('whatever order the entries come in', () => {
    expect(scriptItem([...entries].reverse(), 'layout', 2, 4)).toBe('isthmus');
    expect(scriptItem([...entries].reverse(), 'layout', 3, 1)).toBe('river');
  });

  it('an item no entry sets is undefined, as is a kind away from its hop', () => {
    expect(scriptItem(entries, 'encounter', 2, 4)).toBeUndefined();
    expect(scriptKind(entries, 1, 3)).toBe('port');
    expect(scriptKind(entries, 2, 3)).toBeUndefined();
    expect(scriptKind(entries, 1, 4)).toBeUndefined();
  });
});
