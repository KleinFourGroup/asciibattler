import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { SoundKey } from './AudioPlayer';
import {
  EVENT_SOUNDS,
  SILENT_EVENTS,
  attachEventSounds,
  audibleDeath,
  positiveAmount,
  type GameEventKey,
} from './eventSounds';

/**
 * THE COVERAGE PIN (§104 — a permanent gate, never relax): every event in
 * the catalog is either cued or on the silent list with a reason. The
 * catalog is a type (an interface with an index signature — no runtime
 * keys), so the key set is parsed from the `events.ts` SOURCE TEXT: a
 * surface the registry does not consult. tsc enforces the same thing
 * through `SILENT_EVENTS`' annotation; this is the independent half, on the
 * `npm test` path, and it names the offender.
 */
function parseEventKeys(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => /^export interface GameEvents\b/.test(l));
  if (start < 0) throw new Error('GameEvents interface not found');
  const keys: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^}/.test(line)) return keys;
    // A member sits at EXACTLY two spaces; payload fields nest deeper. Quoted
    // ('unit:died') and bare (tick) forms both count — the bare one is what
    // the spec's 47 missed.
    const m = /^ {2}(?:'([^']+)'|([A-Za-z_$][\w$]*))\??:/.exec(line);
    if (m) keys.push((m[1] ?? m[2])!);
  }
  throw new Error('GameEvents interface never closed');
}

function undispositioned(catalog: readonly string[]): {
  missing: string[];
  stale: string[];
  both: string[];
} {
  const cued = Object.keys(EVENT_SOUNDS);
  const silent = Object.keys(SILENT_EVENTS);
  const all = new Set([...cued, ...silent]);
  return {
    missing: catalog.filter((k) => !all.has(k)),
    stale: [...all].filter((k) => !catalog.includes(k)),
    both: cued.filter((k) => silent.includes(k)),
  };
}

const eventsSource = readFileSync(
  fileURLToPath(new URL('../core/events.ts', import.meta.url)),
  'utf8',
);

describe('the event-sound coverage pin', () => {
  it('every catalog event is cued or silent-with-a-reason, never both', () => {
    const catalog = parseEventKeys(eventsSource);
    expect(
      undispositioned(catalog),
      'a new bus event must pick EVENT_SOUNDS or SILENT_EVENTS (src/audio/eventSounds.ts); a retired one must leave both',
    ).toEqual({ missing: [], stale: [], both: [] });
  });

  it('the parser walks the whole interface (first member, last member, no duplicates)', () => {
    const catalog = parseEventKeys(eventsSource);
    // The interface's first member is the bare `tick`, its last the quoted
    // `pools:chipped` — a parser that stops early or skips a form loses one.
    expect(catalog[0]).toBe('tick');
    expect(catalog).toContain('pools:chipped');
    expect(new Set(catalog).size).toBe(catalog.length);
  });

  it('self-check: a doctored catalog FAILS the pin (both member forms)', () => {
    const doctored = eventsSource.replace(
      /^export interface GameEvents\b.*$/m,
      (head) => `${head}\n  'probe:quoted': { n: number };\n  probeBare: { n: number };`,
    );
    const catalog = parseEventKeys(doctored);
    expect(undispositioned(catalog).missing).toEqual(['probe:quoted', 'probeBare']);
    // …and a catalog that LOST an event leaves its entry stale.
    const shrunk = parseEventKeys(eventsSource).filter((k) => k !== 'unit:dashed');
    expect(undispositioned(shrunk).stale).toEqual(['unit:dashed']);
  });
});

describe('the predicates', () => {
  const death = (team: GameEvents['unit:died']['team'], campId: number | null) =>
    ({ team, campId }) as GameEvents['unit:died'];

  it('audibleDeath: walls stay silent, camp members and both sides cry', () => {
    expect(audibleDeath(death('neutral', null))).toBe(false);
    expect(audibleDeath(death('neutral', 3))).toBe(true);
    expect(audibleDeath(death('player', null))).toBe(true);
    expect(audibleDeath(death('enemy', null))).toBe(true);
  });

  it('positiveAmount: a zero heal (gotcha #80) is silent', () => {
    const heal = (amount: number) => ({ amount }) as GameEvents['unit:healed'];
    expect(positiveAmount(heal(0))).toBe(false);
    expect(positiveAmount(heal(1))).toBe(true);
  });
});

describe('attachEventSounds', () => {
  function rig(): { bus: EventBus<GameEvents>; plays: SoundKey[]; detach: () => void } {
    const bus = new EventBus<GameEvents>();
    const plays: SoundKey[] = [];
    const detach = attachEventSounds(bus, { play: (key) => void plays.push(key) });
    return { bus, plays, detach };
  }
  /** A payload every predicate in the table passes. */
  const PASSING = { team: 'player', campId: null, amount: 1 } as never;

  it('each cued event plays exactly its key, once', () => {
    for (const key of Object.keys(EVENT_SOUNDS) as (keyof typeof EVENT_SOUNDS)[]) {
      const { bus, plays } = rig();
      bus.emit(key, PASSING);
      expect(plays, key).toEqual([EVENT_SOUNDS[key].sound]);
    }
  });

  it('a payload its predicate rejects plays nothing', () => {
    const { bus, plays } = rig();
    bus.emit('unit:died', { team: 'neutral', campId: null } as GameEvents['unit:died']);
    bus.emit('unit:healed', { amount: 0 } as GameEvents['unit:healed']);
    expect(plays).toEqual([]);
  });

  it('no silent event plays anything', () => {
    const { bus, plays } = rig();
    for (const key of Object.keys(SILENT_EVENTS) as GameEventKey[]) bus.emit(key, PASSING);
    expect(plays).toEqual([]);
  });

  it('the detach unsubscribes every cue', () => {
    const { bus, plays, detach } = rig();
    detach();
    for (const key of Object.keys(EVENT_SOUNDS) as GameEventKey[]) bus.emit(key, PASSING);
    expect(plays).toEqual([]);
  });
});
