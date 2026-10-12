import { describe, expect, it } from 'vitest';
import type { JournalEntry, JournalSegment, RunJournal } from '../../src/journal/journal';
import { digestReplay, mapValues, type EventMapping } from '../../src/journal/replayDigest';
import { JournalDivergence, JournalRefused, replayJournal } from '../../src/journal/replayJournal';
import { asFile, bytes, driveRun, replayPlants } from '../journalDrive';

// What a tool asks of a replay beyond the game's own contract
// (`ReplayOptions`, src/journal/replayDigest.ts): to go past another config
// hash, to be handed an end whose hash differs, and to see every event. Each
// is held here against a plant it must catch.

const recorded = driveRun({
  start: { kind: 'seed', seed: 7, dials: 'hops=3&character=soldier' },
  plants: replayPlants(),
});
const base = asFile(recorded.journal);
const end = base.segments[0]!.end!;
const withSegment = (patch: Partial<JournalSegment>): RunJournal => ({
  ...base,
  segments: [{ ...base.segments[0]!, ...patch }],
});

describe('replayJournal: the options a tool passes', () => {
  it('refuses another config hash, and replays it to the journal’s end under ignoreConfig', () => {
    const other = withSegment({ configHash: 'ffffffff' });
    expect(() => replayJournal(other)).toThrow(JournalRefused);
    const replay = replayJournal(other, { ignoreConfig: true }).segments[0]!;
    expect(replay.hash).toBe(end.hash);
    expect(replay.endMatches).toBe(true);
    expect(replay.battles).toBe(recorded.battles);
  });

  it('throws on an end whose hash differs, and hands it back under endHash: report', () => {
    const other = withSegment({ end: { ...end, hash: '00000000' } });
    expect(() => replayJournal(other)).toThrow(JournalDivergence);
    const replay = replayJournal(other, { endHash: 'report' }).segments[0]!;
    expect(replay.endMatches).toBe(false);
    expect(replay.hash).toBe(end.hash);
    expect(bytes(replay.run)).toBe(bytes(recorded.run));
  });

  it('still throws under report when a battle ends on another tick', () => {
    const entries = base.segments[0]!.entries.map((e) => ({ ...e })) as JournalEntry[];
    const at = entries.findIndex((e) => e.t === 'battle');
    const battle = entries[at]!;
    if (battle.t !== 'battle') throw new Error('the journal has no battle');
    entries[at] = { ...battle, ticks: battle.ticks + 1 };
    expect(() => replayJournal(withSegment({ entries }), { endHash: 'report' })).toThrow(JournalDivergence);
  });

  it('shows every event to onEvent in order, and replays to the same end with the tap on', () => {
    const names: string[] = [];
    const replay = replayJournal(base, { onEvent: (_segment, name) => names.push(String(name)) }).segments[0]!;
    expect(replay.hash).toBe(end.hash);
    expect(names.filter((n) => n === 'battle:started')).toHaveLength(recorded.battles);
    expect(names.filter((n) => n === 'battle:ended')).toHaveLength(recorded.battles);
    expect(names.indexOf('battle:started')).toBeLessThan(names.indexOf('battle:ended'));
    expect(names.length).toBeGreaterThan(1000);
  });
});

describe('digestReplay: a replay’s events as a few short words', () => {
  const plain = digestReplay(base)[0]!;

  it('gives one digest per battle and reaches the journal’s end', () => {
    expect(plain.battles).toHaveLength(recorded.battles);
    expect(new Set(plain.battles).size).toBe(recorded.battles);
    expect(plain.endMatches).toBe(true);
    expect(plain.endHash).toBe(end.hash);
    expect(JSON.stringify(plain.snapshot)).toBe(bytes(recorded.run));
  });

  it('gives the same digests on a second replay', () => {
    expect(digestReplay(base)[0]).toEqual(plain);
  });

  it('a changed event changes its own battle’s digest and no other', () => {
    let battle = -1;
    let planted = false;
    const plantInSecondBattle: EventMapping = (name, payload) => {
      if (name === 'battle:started') battle++;
      if (battle !== 1 || planted || name !== 'tick') return payload;
      planted = true;
      return { ...(payload as object), planted: true };
    };
    const changed = digestReplay(base, { map: plantInSecondBattle })[0]!;
    expect(planted).toBe(true);
    const differing = plain.battles.flatMap((digest, i) => (digest === changed.battles[i] ? [] : [i]));
    expect(differing).toEqual([1]);
    expect(changed.outside).toBe(plain.outside);
  });

  it('a rename shows in the plain digests, and a mapping back to the old name restores every one', () => {
    // A tree that emits another name for the neutral team, stood in for by a
    // mapping that renames it in every payload.
    const renamed: EventMapping = (_name, payload) =>
      mapValues(payload, (_key, value) => (value === 'neutral' ? 'scenery-planted' : value));
    const back = (to: string): EventMapping => (name, payload) =>
      mapValues(renamed(name, payload), (_key, value) => (value === 'scenery-planted' ? to : value));

    const seen = digestReplay(base, { map: renamed })[0]!;
    expect(seen.battles.some((digest, i) => digest !== plain.battles[i])).toBe(true);

    const restored = digestReplay(base, { map: back('neutral') })[0]!;
    expect(restored.battles).toEqual(plain.battles);
    expect(restored.outside).toBe(plain.outside);

    // A mapping that takes the new name anywhere else is not the old tree.
    const wrong = digestReplay(base, { map: back('enemy') })[0]!;
    expect(wrong.battles).not.toEqual(plain.battles);
  });

  it('replays past another config hash when asked', () => {
    const other = withSegment({ configHash: 'ffffffff' });
    expect(() => digestReplay(other)).toThrow(JournalRefused);
    expect(digestReplay(other, { ignoreConfig: true })[0]!.battles).toEqual(plain.battles);
  });

  it('reports an end whose hash differs, with the snapshot to compare', () => {
    const other = digestReplay(withSegment({ end: { ...end, hash: '00000000' } }))[0]!;
    expect(other.endMatches).toBe(false);
    expect(other.endHash).toBe(end.hash);
    expect(other.battles).toEqual(plain.battles);
  });
});

describe('mapValues', () => {
  it('applies the change to every property and element under its key, deepest first', () => {
    const seen: string[] = [];
    const out = mapValues({ team: 'a', units: [{ team: 'b' }, 3], none: null }, (key, value) => {
      seen.push(key);
      return key === 'team' ? `${String(value)}!` : value;
    });
    expect(out).toEqual({ team: 'a!', units: [{ team: 'b!' }, 3], none: null });
    expect(seen).toEqual(['team', 'team', 'units', 'units', 'units', 'none', '']);
  });
});
