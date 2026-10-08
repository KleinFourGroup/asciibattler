import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../config/characters';
import { ENCOUNTER_IDS } from '../config/encounters';
import { ESCALATION_MAX } from '../config/escalation';
import { RUN_CONFIG_PARAMS, parseRunConfig, runConfigToQueryString } from '../run/RunConfig';
import { memoryAdapter } from './adapter';
import {
  PROGRESS_SECTION,
  bestWinAfter,
  escalationCeiling,
  levelWithinCeiling,
  runCounts,
  type BestWin,
} from './progress';
import { createStore } from './store';

// 116j, 117d — the progress section over the memory adapter, and the
// Escalation unlock rules. Stored text is planted in and read back from
// `adapter.entries`.

const KEY = 'asciibattler:progress';
const planted = (data: unknown) => memoryAdapter({ [KEY]: JSON.stringify({ v: 1, build: 'b', data }) });
const read = (data: unknown) => createStore({ adapter: planted(data), build: 'b' }).read(PROGRESS_SECTION);

describe('the progress section', () => {
  it('has these fields, by these exact names', () => {
    // Permanent: each is a key in players' browsers.
    expect(PROGRESS_SECTION.name).toBe('progress');
    expect(PROGRESS_SECTION.policy).toBe('lenient');
    expect(Object.keys(PROGRESS_SECTION.fields)).toEqual(['creditsSeen', 'bestWin']);
  });

  it('reads a new player as not having seen the credits and having won nothing', () => {
    expect(createStore({ adapter: memoryAdapter(), build: 'b' }).read(PROGRESS_SECTION)).toEqual({
      creditsSeen: false,
      bestWin: {},
    });
  });

  it('keeps the flag across a reload', () => {
    const adapter = memoryAdapter();
    expect(createStore({ adapter, build: 'b' }).patch(PROGRESS_SECTION, { creditsSeen: true })).toBe(true);
    expect(JSON.parse(adapter.entries.get(KEY)!)).toEqual({ v: 1, build: 'b', data: { creditsSeen: true, bestWin: {} } });
    expect(createStore({ adapter, build: 'b' }).read(PROGRESS_SECTION)).toEqual({ creditsSeen: true, bestWin: {} });
  });

  it('gives a value that is not a boolean its fallback', () => {
    for (const bad of ['yes', 1, null]) {
      expect(read({ creditsSeen: bad }), String(bad)).toEqual({ creditsSeen: false, bestWin: {} });
    }
  });

  it('reads a store written before the record existed, and keeps its flag', () => {
    expect(read({ creditsSeen: true })).toEqual({ creditsSeen: true, bestWin: {} });
  });
});

describe('117d — the record of wins, as stored', () => {
  it('keeps the wins across a reload, as this text', () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter, build: 'b' });
    expect(store.patch(PROGRESS_SECTION, { bestWin: { soldier: 2, gambler: 0 } })).toBe(true);
    expect(adapter.entries.get(KEY)).toBe('{"v":1,"build":"b","data":{"creditsSeen":false,"bestWin":{"soldier":2,"gambler":0}}}');
    expect(createStore({ adapter, build: 'b' }).read(PROGRESS_SECTION).bestWin).toEqual({ soldier: 2, gambler: 0 });
  });

  it('drops an entry that is not a level won, and keeps the others', () => {
    const bestWin = read({
      creditsSeen: true,
      bestWin: { soldier: 3, gambler: '2', a: -1, b: 1.5, c: null, d: true, e: [1], f: {}, priest: 0 },
    });
    // One bad entry costs that entry, not every character's wins, and not the flag.
    expect(bestWin).toEqual({ creditsSeen: true, bestWin: { soldier: 3, priest: 0 } });
  });

  it('gives a value that is not a record its fallback, and keeps the flag', () => {
    for (const bad of [3, 'soldier', null, true, [['soldier', 3]]]) {
      expect(read({ creditsSeen: true, bestWin: bad }), JSON.stringify(bad)).toEqual({ creditsSeen: true, bestWin: {} });
    }
  });

  it('keeps a character this build does not know and a level above its ladder', () => {
    // A later build's entries survive this build's next write.
    const adapter = planted({ bestWin: { 'some-later-character': 1, soldier: ESCALATION_MAX + 4 } });
    const store = createStore({ adapter, build: 'b' });
    store.patch(PROGRESS_SECTION, { creditsSeen: true });
    expect(JSON.parse(adapter.entries.get(KEY)!).data.bestWin).toEqual({
      'some-later-character': 1,
      soldier: ESCALATION_MAX + 4,
    });
  });
});

describe('117d-post — two tabs, a run won in each', () => {
  /** A won run's write as `Game.recordWin` makes it: the rules, inside
   *  `store.update`. */
  const win = (store: ReturnType<typeof createStore>, id: string, level: number): void => {
    store.update(PROGRESS_SECTION, ({ bestWin }) => {
      if (!runCounts(`character=${id}${level > 0 ? `&escalation=${level}` : ''}`, level, escalationCeiling(bestWin, id))) return {};
      const after = bestWinAfter(bestWin, id, level);
      return after === bestWin ? {} : { bestWin: after };
    });
  };
  const tabs = () => {
    const adapter = memoryAdapter();
    const a = createStore({ adapter, build: 'b' });
    const b = createStore({ adapter, build: 'b' });
    // Each tab has drawn character select, so each has read the section.
    a.read(PROGRESS_SECTION);
    b.read(PROGRESS_SECTION);
    const storedNow = () => JSON.parse(adapter.entries.get(KEY)!).data as unknown;
    return { a, b, storedNow };
  };

  it('keeps both wins, and the flag the other tab stored', () => {
    const { a, b, storedNow } = tabs();
    win(a, 'soldier', 0);
    a.update(PROGRESS_SECTION, () => ({ creditsSeen: true }));
    win(b, 'gambler', 0);
    expect(storedNow()).toEqual({ creditsSeen: true, bestWin: { soldier: 0, gambler: 0 } });
  });

  it('a second tab’s win at the level the first tab opened counts, and climbs from the first’s', () => {
    const { a, b, storedNow } = tabs();
    win(a, 'soldier', 0);
    // The second tab's own copy says the Soldier has won nothing, so its
    // ceiling there is 0; the record as stored says 1.
    win(b, 'soldier', 1);
    expect(storedNow()).toEqual({ creditsSeen: false, bestWin: { soldier: 1 } });
  });

  it('a second tab’s lower win does not lower the first’s', () => {
    const { a, b, storedNow } = tabs();
    win(a, 'soldier', 0);
    win(a, 'soldier', 1);
    win(b, 'soldier', 0);
    expect(storedNow()).toEqual({ creditsSeen: false, bestWin: { soldier: 1 } });
  });

  it('the control: written from the tab’s own copy, the second win loses the first', () => {
    const { a, b, storedNow } = tabs();
    win(a, 'soldier', 0);
    b.patch(PROGRESS_SECTION, { bestWin: bestWinAfter(b.read(PROGRESS_SECTION).bestWin, 'gambler', 0) });
    expect(storedNow()).toEqual({ creditsSeen: false, bestWin: { gambler: 0 } });
  });

  it('`Game` writes the progress section through `update` alone', () => {
    // The guard on the path: a `patch` of this section in Game is the
    // write the control above shows losing a win.
    const game = readFileSync('src/Game.ts', 'utf8');
    expect(game).toContain('store.update(PROGRESS_SECTION');
    expect(game.match(/store\.update\(PROGRESS_SECTION/g)).toHaveLength(2);
    expect(game).not.toMatch(/store\.patch\(\s*PROGRESS_SECTION/);
  });
});

describe('117d — the ceiling', () => {
  it('is the level above the best win: these, by hand, on a ladder of five', () => {
    // The table below is written for the shipped ladder.
    expect(ESCALATION_MAX).toBe(5);
    const bestWin: BestWin = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 9 };
    const ceilings = Object.fromEntries(Object.keys(bestWin).map((id) => [id, escalationCeiling(bestWin, id)]));
    expect(ceilings).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 5, g: 5 });
  });

  it('is 0 for a character with no win, whatever the others have won', () => {
    expect(escalationCeiling({}, 'soldier')).toBe(0);
    expect(escalationCeiling({ gambler: 5 }, 'soldier')).toBe(0);
  });

  it('reads only an entry of the record itself', () => {
    // A character id that names something every object has.
    for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(escalationCeiling({}, id), id).toBe(0);
    }
  });

  it('is 0 for every shipped character on a new store', () => {
    const { bestWin } = createStore({ adapter: memoryAdapter(), build: 'b' }).read(PROGRESS_SECTION);
    expect(CHARACTERS.length).toBeGreaterThan(0);
    for (const character of CHARACTERS) expect(escalationCeiling(bestWin, character.id), character.id).toBe(0);
  });
});

describe('117d — the picked level, held to the ceiling', () => {
  it('is the pick when the ceiling allows it, else the ceiling', () => {
    expect(levelWithinCeiling(0, 0)).toBe(0);
    expect(levelWithinCeiling(2, 3)).toBe(2);
    expect(levelWithinCeiling(3, 3)).toBe(3);
    expect(levelWithinCeiling(4, 3)).toBe(3);
    expect(levelWithinCeiling(5, 0)).toBe(0);
  });

  it('is 0 for a pick that is not a level', () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(levelWithinCeiling(bad, 5), String(bad)).toBe(0);
    }
  });
});

describe('117d — whether a won run is recorded', () => {
  it('counts a run whose dials hold its character, at any level within the ceiling', () => {
    expect(runCounts('character=soldier', 0, 0)).toBe(true);
    expect(runCounts('character=soldier&escalation=2', 2, 2)).toBe(true);
    expect(runCounts('character=soldier&escalation=1', 1, 3)).toBe(true);
    expect(runCounts('escalation=5&character=gambler', 5, 5)).toBe(true);
  });

  it('refuses a level above the ceiling: one reached by URL without the wins under it', () => {
    expect(runCounts('character=soldier&escalation=1', 1, 0)).toBe(false);
    expect(runCounts('character=soldier&escalation=5', 5, 4)).toBe(false);
  });

  it('refuses a seeded run, typed on the menu or set in the URL', () => {
    expect(runCounts('seed=7&character=soldier', 0, 0)).toBe(false);
    expect(runCounts('seed=1759590000000&character=soldier&escalation=1', 1, 1)).toBe(false);
  });

  /** One value per run dial that the URL parser accepts, written by hand. A
   *  new dial fails the census below until it has its row here. */
  const A_VALUE_PER_DIAL: Record<string, string> = {
    seed: '7',
    hops: '3',
    sectorHops: '4',
    roster: 'archer',
    layout: 'procedural',
    encounter: ENCOUNTER_IDS[0]!,
    firstNode: 'elite',
    width: '3',
    daemon: 'none',
    character: 'soldier',
    bits: '0',
    escalation: '1',
  };

  it('refuses every other run dial, each by name', () => {
    expect(Object.keys(A_VALUE_PER_DIAL).sort()).toEqual(Object.values(RUN_CONFIG_PARAMS).sort());
    const refused: string[] = [];
    for (const [dial, value] of Object.entries(A_VALUE_PER_DIAL)) {
      // The dials as the game spells them for a run with this one dial set.
      const dials = runConfigToQueryString(parseRunConfig(new URLSearchParams({ character: 'soldier', [dial]: value })));
      expect(dials, dial).toContain(`${dial}=`);
      if (!runCounts(dials, dial === 'escalation' ? 1 : 0, 5)) refused.push(dial);
    }
    expect(refused).toEqual(['seed', 'hops', 'sectorHops', 'roster', 'layout', 'encounter', 'firstNode', 'width', 'daemon', 'bits']);
  });

  it('refuses a parameter that is no run dial', () => {
    expect(runCounts('character=soldier&store=full', 0, 0)).toBe(false);
  });

  it('refuses a run with no dials, which is one loaded from a file', () => {
    expect(runCounts('', 0, 0)).toBe(false);
    expect(runCounts('escalation=1', 1, 5)).toBe(false);
  });
});

describe('117d — the record after a win', () => {
  it('holds the highest level won, per character', () => {
    let bestWin: BestWin = {};
    bestWin = bestWinAfter(bestWin, 'soldier', 0);
    expect(bestWin).toEqual({ soldier: 0 });
    bestWin = bestWinAfter(bestWin, 'gambler', 0);
    bestWin = bestWinAfter(bestWin, 'soldier', 1);
    expect(bestWin).toEqual({ soldier: 1, gambler: 0 });
  });

  it('is the same record after a win at or under the best one', () => {
    const bestWin: BestWin = { soldier: 2 };
    // The same object: `Game` writes only when the record changed, so a win
    // told twice is written once.
    expect(bestWinAfter(bestWin, 'soldier', 2)).toBe(bestWin);
    expect(bestWinAfter(bestWin, 'soldier', 0)).toBe(bestWin);
    expect(bestWinAfter(bestWin, 'soldier', 3)).not.toBe(bestWin);
  });

  it('leaves the record it was given as it was', () => {
    const bestWin: BestWin = Object.freeze({ soldier: 0 });
    expect(bestWinAfter(bestWin, 'gambler', 0)).toEqual({ soldier: 0, gambler: 0 });
    expect(bestWin).toEqual({ soldier: 0 });
  });

  it('a first win at 0 is an entry, which is what tells it from no win', () => {
    expect(Object.hasOwn(bestWinAfter({}, 'soldier', 0), 'soldier')).toBe(true);
    expect(escalationCeiling(bestWinAfter({}, 'soldier', 0), 'soldier')).toBe(1);
  });
});

describe('117d — the ladder, climbed', () => {
  /** A run's end as `Game` handles it: the dials a run at `level` has, the
   *  rule, then the record. */
  const win = (bestWin: BestWin, id: string, level: number, extra = ''): BestWin => {
    const dials = `character=${id}${level > 0 ? `&escalation=${level}` : ''}${extra}`;
    return runCounts(dials, level, escalationCeiling(bestWin, id)) ? bestWinAfter(bestWin, id, level) : bestWin;
  };

  it('each win at the ceiling opens the next level, to the top, for that character alone', () => {
    let bestWin: BestWin = {};
    const ceilings: number[] = [escalationCeiling(bestWin, 'soldier')];
    for (let level = 0; level <= ESCALATION_MAX; level++) {
      bestWin = win(bestWin, 'soldier', level);
      ceilings.push(escalationCeiling(bestWin, 'soldier'));
    }
    expect(ceilings).toEqual([0, 1, 2, 3, 4, 5, 5]);
    expect(bestWin).toEqual({ soldier: 5 });
    expect(escalationCeiling(bestWin, 'gambler')).toBe(0);
  });

  it('a win under the ceiling opens nothing, and a level skipped by URL records nothing', () => {
    const bestWin: BestWin = { soldier: 2 };
    expect(win(bestWin, 'soldier', 1)).toBe(bestWin);
    // The ceiling is 3; a run at 4 was not offered.
    expect(win(bestWin, 'soldier', 4)).toBe(bestWin);
    expect(win(bestWin, 'soldier', 3)).toEqual({ soldier: 3 });
  });

  it('a seeded win at the ceiling records nothing', () => {
    expect(win({}, 'soldier', 0, '&seed=7')).toEqual({});
    expect(win({ soldier: 0 }, 'soldier', 1, '&seed=7')).toEqual({ soldier: 0 });
  });
});
