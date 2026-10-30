// The scripted run's list (RunScript.ts) and its URL form (`parseScript`,
// RunConfig.ts): the old dials as its cases, the most specific entry winning
// at an address, the kinds a numbered hop's entries give it, what a list may
// not say, and the parse with its inverse. The old dials' own tests, in
// RunConfig.test.ts, stay as they were.
import { describe, expect, it } from 'vitest';
import { getEncounter } from '../config/encounters';
import { parseRunConfig, parseScript, runConfigToQueryString } from './RunConfig';
import {
  dialEntries,
  hopKind,
  scriptConflicts,
  scriptItem,
  scriptToString,
  scriptedEvent,
  type EncounterKindOf,
  type ScriptEntry,
} from './RunScript';

const kindOf: EncounterKindOf = (id) => getEncounter(id)?.kind;

describe('the old dials as entries', () => {
  it('puts the three forced ids at every hop of every act, and the first-node stamp at the starting act\'s root', () => {
    const entries = dialEntries({
      forcedLayoutId: 'river',
      forcedEncounterId: 'artillery',
      forcedEventId: 'mines',
      firstNodeKind: 'elite',
    });
    expect(entries).toEqual([
      { hop: 'all', layout: 'river' },
      { hop: 'all', encounter: 'artillery' },
      { hop: 'all', event: 'mines' },
      { hop: 1, kind: 'elite' },
    ]);
  });

  it('gives an empty list for no dials', () => {
    expect(dialEntries(undefined)).toEqual([]);
    expect(dialEntries({ seed: 3, hopCount: 2 })).toEqual([]);
  });
});

describe('the most specific entry wins', () => {
  const entries: ScriptEntry[] = [
    { hop: 'all', layout: 'river' },
    { act: 2, hop: 'all', layout: 'labyrinth' },
    { act: 2, hop: 4, layout: 'isthmus' },
    { hop: 4, layout: 'icebergs' },
  ];

  it('a numbered hop over its act, and an act over every act', () => {
    expect(scriptItem(entries, 'layout', 2, 4, 1)).toBe('isthmus');
    expect(scriptItem(entries, 'layout', 2, 5, 1)).toBe('labyrinth');
    expect(scriptItem(entries, 'layout', 1, 5, 1)).toBe('river');
  });

  it('a bare numbered hop is in the act the run starts in', () => {
    expect(scriptItem(entries, 'layout', 1, 4, 1)).toBe('icebergs');
    expect(scriptItem(entries, 'layout', 3, 4, 3)).toBe('icebergs');
    expect(scriptItem(entries, 'layout', 3, 4, 1)).toBe('river');
  });

  it('whatever order the entries come in', () => {
    expect(scriptItem([...entries].reverse(), 'layout', 2, 4, 1)).toBe('isthmus');
    expect(scriptItem([...entries].reverse(), 'layout', 3, 1, 1)).toBe('river');
    expect(scriptItem(entries, 'encounter', 2, 4, 1)).toBeUndefined();
  });
});

describe('the kind a numbered hop is given', () => {
  it('named, or implied by a named event or a normal or elite encounter; a boss implies none', () => {
    const at = (e: ScriptEntry): string | undefined => hopKind([e], 1, 3, 1, kindOf);
    expect(at({ hop: 3, kind: 'rest' })).toBe('rest');
    expect(at({ hop: 3, event: 'mines' })).toBe('event');
    expect(at({ hop: 3, encounter: 'brigands' })).toBe('battle');
    expect(at({ hop: 3, encounter: 'brigand-champions' })).toBe('elite');
    expect(at({ hop: 3, encounter: 'banditQueen' })).toBeUndefined();
    expect(at({ hop: 'all', encounter: 'brigands' })).toBeUndefined();
    expect(at({ hop: 4, kind: 'rest' })).toBeUndefined();
  });

  it('a named event always opens only on a numbered hop', () => {
    expect(scriptedEvent([{ hop: 3, event: 'mines' }], 1, 3, 1)).toBe(true);
    expect(scriptedEvent([{ hop: 'all', event: 'mines' }], 1, 3, 1)).toBe(false);
  });
});

describe('what a list may not say', () => {
  const problems = (entries: ScriptEntry[]): string[] => scriptConflicts(entries, 1, kindOf);

  it('a kind on a starred address, an item twice, a hop with two kinds', () => {
    expect(problems([{ hop: 'all', kind: 'rest' }])).toEqual(['*: a kind (rest) needs a numbered hop']);
    expect(problems([{ hop: 3, layout: 'river' }, { act: 1, hop: 3, layout: 'isthmus' }])).toEqual([
      '1.3: layout is set twice',
    ]);
    expect(problems([{ hop: 3, kind: 'rest', encounter: 'brigands' }])).toEqual(['3: two kinds (rest, battle)']);
  });

  it('nothing in a list that holds', () => {
    expect(
      problems([
        { hop: 'all', layout: 'river' },
        { hop: 3, kind: 'elite', encounter: 'brigand-champions', layout: 'isthmus' },
        { act: 2, hop: 3, kind: 'rest' },
      ]),
    ).toEqual([]);
  });
});

describe('the URL form', () => {
  it('parses the worked URLs', () => {
    expect(parseScript('3:event=cadre-1;6:event=cadre-2;9:event=cadre-3', []).entries).toEqual([
      { hop: 3, event: 'cadre-1' },
      { hop: 6, event: 'cadre-2' },
      { hop: 9, event: 'cadre-3' },
    ]);
    expect(
      parseScript('2:encounter=brigands,layout=river;4:encounter=brigand-champions,layout=labyrinth;11:encounter=bandit-king,layout=isthmus', [])
        .entries,
    ).toEqual([
      { hop: 2, encounter: 'brigands', layout: 'river' },
      { hop: 4, encounter: 'brigand-champions', layout: 'labyrinth' },
      { hop: 11, encounter: 'bandit-king', layout: 'isthmus' },
    ]);
    expect(parseScript('*:layout=procedural; 2.*:layout=river ;2.5:rest', []).entries).toEqual([
      { hop: 'all', layout: 'procedural' },
      { act: 2, hop: 'all', layout: 'river' },
      { act: 2, hop: 5, kind: 'rest' },
    ]);
  });

  it('drops what it cannot read, naming each drop', () => {
    const { entries, warnings } = parseScript(
      'x:rest;0:rest;3:encounter=no-such,layout=river;*:elite;4:sing;5:rest,encounter=brigands',
      [],
    );
    expect(entries).toEqual([{ hop: 3, layout: 'river' }]);
    expect(warnings).toEqual([
      'script: dropped "x:rest": no address (a hop, act.hop, * or act.*, from 1) before a ":"',
      'script: dropped "0:rest": no address (a hop, act.hop, * or act.*, from 1) before a ":"',
      'script: dropped "encounter=no-such" from "3:encounter=no-such,layout=river": no such encounter',
      'script: dropped "elite" from "*:elite": a kind needs a numbered hop',
      'script: dropped "*:elite": nothing left to set',
      'script: dropped "sing" from "4:sing": not a kind (battle, elite, event, rest, port) or an item (encounter=, layout=, event=, port=)',
      'script: dropped "4:sing": nothing left to set',
      'script: dropped "5:rest,encounter=brigands": 5: two kinds (rest, battle)',
    ]);
  });

  it('parses a port\'s goods, each resolved as a daemon, a packet or an archetype', () => {
    expect(parseScript('2:port=rogue:3/healer/overclock/venom/mars', []).entries).toEqual([
      {
        hop: 2,
        port: [
          { kind: 'unit', archetype: 'rogue', level: 3 },
          { kind: 'unit', archetype: 'healer' },
          { kind: 'packet', id: 'overclock' },
          { kind: 'packet', id: 'venom' },
          { kind: 'daemon', id: 'mars' },
        ],
      },
    ]);
    const { entries, warnings } = parseScript('3:port=rogue/rogue/rogue/rogue/rogue/rogue/mars:2/nobody', []);
    expect(entries).toEqual([{ hop: 3, port: Array.from({ length: 5 }, () => ({ kind: 'unit', archetype: 'rogue' })) }]);
    expect(warnings).toEqual([
      'script: dropped "port=rogue/rogue/rogue/rogue/rogue/rogue/mars:2/nobody" from "3:port=rogue/rogue/rogue/rogue/rogue/rogue/mars:2/nobody": port good "rogue": a port holds 5 of its kind',
      'script: dropped "port=rogue/rogue/rogue/rogue/rogue/rogue/mars:2/nobody" from "3:port=rogue/rogue/rogue/rogue/rogue/rogue/mars:2/nobody": port good "mars:2": only a unit takes a level',
      'script: dropped "port=rogue/rogue/rogue/rogue/rogue/rogue/mars:2/nobody" from "3:port=rogue/rogue/rogue/rogue/rogue/rogue/mars:2/nobody": port good "nobody" is no daemon, packet or archetype',
    ]);
    expect(hopKind(parseScript('2:port=mars', []).entries, 1, 2, 1, kindOf)).toBe('port');
  });

  it('drops an entry that contradicts an old dial', () => {
    const config = parseRunConfig(new URLSearchParams('layout=river&script=*:layout=isthmus;3:rest'));
    expect(config.forcedLayoutId).toBe('river');
    expect(config.script).toEqual([{ hop: 3, kind: 'rest' }]);
    expect(config.scriptWarnings).toEqual(['script: dropped "*:layout=isthmus": *: layout is set twice']);
  });

  it('writes back what it parsed', () => {
    const text =
      '3:rest;2.4:elite,encounter=brigand-champions,layout=river;*:event=mines;2.*:layout=procedural;5:port=rogue:3/healer/patch/mars';
    const entries = parseScript(text, []).entries;
    expect(scriptToString(entries)).toBe(text);
    expect(parseScript(scriptToString(entries), []).entries).toEqual(entries);
  });
});

describe('every old URL form round-trips, and writes back in its old form', () => {
  const OLD = [
    'layout=river',
    'layout=procedural',
    'encounter=artillery',
    'event=mines',
    'firstNode=elite',
    'firstNode=event&event=mines',
    'firstNode=rest&hops=2',
    'seed=7&hops=3&layout=procedural&encounter=brigands&roster=rogue:3,healer',
    'sectorHops=2&character=priest&bits=300&escalation=2&daemon=none&width=3',
  ];

  it.each(OLD)('%s', (query) => {
    const config = parseRunConfig(new URLSearchParams(query));
    const back = runConfigToQueryString(config);
    expect(back).not.toContain('script=');
    expect(parseRunConfig(new URLSearchParams(back))).toEqual(config);
    // The control: the dial was read, so the round trip held something.
    expect(Object.keys(config).length).toBeGreaterThan(0);
  });

  it('and a script beside them round-trips too', () => {
    const query = 'seed=7&layout=river&script=3:rest;2.4:encounter=brigand-champions';
    const config = parseRunConfig(new URLSearchParams(query));
    const back = runConfigToQueryString(config);
    expect(new URLSearchParams(back).get('layout')).toBe('river');
    expect(parseRunConfig(new URLSearchParams(back))).toEqual(config);
  });
});
