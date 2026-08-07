/**
 * §74a — the event catalog loader. Structural guards (entry/page refs,
 * exact-optional runtime shape), the termination fixpoint, and the
 * cross-catalog ref asserts — all against synthetic defs; the shipped
 * catalog's own validity is proven by the module-load self-wire (importing
 * `./events` at all would throw on a bad `config/events.json`).
 */

import { describe, expect, it } from 'vitest';
import {
  EVENTS,
  EVENT_IDS,
  EventsSchema,
  getEvent,
  assertEventPagesTerminate,
  assertEventPagesReachable,
  assertEventReservedFlags,
  assertEventRefs,
  visitedFlagFor,
  VISITED_FLAG_PREFIX,
  type EventDef,
  type EventRefCatalogs,
} from './events';

/** A minimal valid single-page event, override-friendly. */
function makeEvent(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'synthetic',
    name: 'Synthetic',
    entry: 'start',
    pages: {
      start: {
        text: 'A test page.',
        choices: [{ label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] }],
      },
    },
    ...overrides,
  };
}

const SYNTH_CATALOGS: EventRefCatalogs = {
  encounterIds: ['known-encounter'],
  rewardTableIds: ['known-table'],
  packetIds: ['known-packet'],
  daemonIds: ['known-daemon'],
  characterIds: ['known-character'],
  unitArchetypes: ['known-archetype'],
};

describe('events config', () => {
  it('ships a non-empty catalog with unique ids and a working lookup', () => {
    expect(EVENTS.length).toBeGreaterThan(0);
    expect(new Set(EVENT_IDS).size).toBe(EVENT_IDS.length);
    for (const id of EVENT_IDS) {
      expect(getEvent(id)?.id).toBe(id);
    }
    expect(getEvent('no-such-event')).toBeUndefined();
  });

  it('rejects an entry page that is not in pages', () => {
    const bad = { ...makeEvent(), entry: 'missing' };
    expect(() => EventsSchema.parse([bad])).toThrow(/entry page 'missing'/);
  });

  it('rejects a page-id next that does not resolve', () => {
    const bad = makeEvent({
      pages: {
        start: {
          text: 'A test page.',
          choices: [{ label: 'Onward', outcomes: [{ next: 'nowhere' }] }],
        },
      },
    });
    expect(() => EventsSchema.parse([bad])).toThrow(/next page 'nowhere'/);
  });

  it('rejects a choice with zero outcomes', () => {
    const bad = makeEvent({
      pages: {
        start: { text: 'A test page.', choices: [{ label: 'Empty', outcomes: [] }] },
      },
    });
    expect(() => EventsSchema.parse([bad])).toThrow();
  });

  it('accepts a nested not condition (74c-pre — the recursive combinator)', () => {
    const negated = makeEvent({
      eligibility: [{ kind: 'not', condition: { kind: 'hasDaemon', daemonId: 'known-daemon' } }],
      pages: {
        start: {
          text: 'A test page.',
          choices: [
            {
              label: 'Leave',
              condition: {
                kind: 'not',
                condition: { kind: 'not', condition: { kind: 'flagSet', flag: 'chain:done' } },
              },
              outcomes: [{ next: { kind: 'return-to-map' } }],
            },
            { label: 'Stay', outcomes: [{ next: { kind: 'return-to-map' } }] },
          ],
        },
      },
    });
    const [parsed] = EventsSchema.parse([negated]);
    expect(parsed!.eligibility![0]).toEqual({
      kind: 'not',
      condition: { kind: 'hasDaemon', daemonId: 'known-daemon' },
    });
  });

  it('rejects a not condition wrapping a malformed inner condition', () => {
    const bad = makeEvent({
      eligibility: [
        { kind: 'not', condition: { kind: 'hasDaemon' } } as never, // missing daemonId
      ],
    });
    expect(() => EventsSchema.parse([bad])).toThrow();
  });

  it('keeps absent optional keys absent after parse (exact-optional runtime shape)', () => {
    const [parsed] = EventsSchema.parse([makeEvent()]);
    const outcome = parsed!.pages['start']!.choices[0]!.outcomes[0]!;
    expect('weight' in outcome).toBe(false);
    expect('effects' in outcome).toBe(false);
    expect('eligibility' in parsed!).toBe(false);
  });

  describe('assertEventPagesTerminate', () => {
    it('passes the shipped catalog', () => {
      expect(() => assertEventPagesTerminate(EVENTS)).not.toThrow();
    });

    it('throws naming the stuck pages on an exitless id-ref cycle', () => {
      const looping = makeEvent({
        id: 'looper',
        pages: {
          start: { text: 'a', choices: [{ label: 'To b', outcomes: [{ next: 'b' }] }] },
          b: { text: 'b', choices: [{ label: 'Back', outcomes: [{ next: 'start' }] }] },
        },
      });
      expect(() => assertEventPagesTerminate([looping])).toThrow(
        /event 'looper'.*'start'.*'b'.*cannot reach a terminal/,
      );
    });

    it('throws when a page can only exit through CONDITIONED choices (74b tightening)', () => {
      // Conditions evaluate against mutable run state, so a conditioned exit
      // can vanish mid-event — only an unconditioned exit is a guarantee.
      const gatedExit = makeEvent({
        id: 'gated-exit',
        pages: {
          start: {
            text: 'a',
            choices: [
              {
                label: 'Leave (rich only)',
                condition: { kind: 'bitsAtLeast', amount: 10 },
                outcomes: [{ next: { kind: 'return-to-map' } }],
              },
            ],
          },
        },
      });
      expect(() => assertEventPagesTerminate([gatedExit])).toThrow(
        /event 'gated-exit'.*'start'.*unconditioned/,
      );
    });

    it('accepts a cycle that has an exit somewhere on it', () => {
      const escapable = makeEvent({
        id: 'escapable',
        pages: {
          start: { text: 'a', choices: [{ label: 'To b', outcomes: [{ next: 'b' }] }] },
          b: {
            text: 'b',
            choices: [
              { label: 'Back', outcomes: [{ next: 'start' }] },
              { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
            ],
          },
        },
      });
      expect(() => assertEventPagesTerminate([escapable])).not.toThrow();
    });
  });

  describe('assertEventRefs', () => {
    it('accepts a def whose refs all resolve', () => {
      const ok = makeEvent({
        eligibility: [{ kind: 'hasDaemon', daemonId: 'known-daemon' }],
        pages: {
          start: {
            text: 'a',
            choices: [
              {
                label: 'Fight',
                condition: { kind: 'characterIs', characterId: 'known-character' },
                outcomes: [
                  {
                    effects: [
                      { op: 'addPacket', packetId: 'known-packet' },
                      { op: 'grantUnit', archetype: 'known-archetype' },
                    ],
                    next: {
                      kind: 'start-encounter',
                      encounterId: 'known-encounter',
                      rewardOverride: 'known-table',
                    },
                  },
                ],
              },
            ],
          },
        },
      });
      expect(() => assertEventRefs([ok], SYNTH_CATALOGS)).not.toThrow();
    });

    it.each([
      [
        'an unknown encounter in start-encounter',
        makeEvent({
          pages: {
            start: {
              text: 'a',
              choices: [
                {
                  label: 'Fight',
                  outcomes: [{ next: { kind: 'start-encounter', encounterId: 'ghost' } }],
                },
              ],
            },
          },
        }),
        /unknown encounter id 'ghost'/,
      ],
      [
        'an unknown rewardOverride table',
        makeEvent({
          pages: {
            start: {
              text: 'a',
              choices: [
                {
                  label: 'Fight',
                  outcomes: [
                    {
                      next: {
                        kind: 'start-encounter',
                        encounterId: 'known-encounter',
                        rewardOverride: 'ghost-table',
                      },
                    },
                  ],
                },
              ],
            },
          },
        }),
        /unknown reward table 'ghost-table'/,
      ],
      [
        'an unknown packet in addPacket',
        makeEvent({
          pages: {
            start: {
              text: 'a',
              choices: [
                {
                  label: 'Take',
                  outcomes: [
                    {
                      effects: [{ op: 'addPacket', packetId: 'ghost-packet' }],
                      next: { kind: 'return-to-map' },
                    },
                  ],
                },
              ],
            },
          },
        }),
        /unknown packet id 'ghost-packet'/,
      ],
      [
        'an unknown daemon in eligibility',
        makeEvent({ eligibility: [{ kind: 'hasDaemon', daemonId: 'ghost-daemon' }] }),
        /unknown daemon id 'ghost-daemon'/,
      ],
      [
        'an unknown character in a choice condition',
        makeEvent({
          pages: {
            start: {
              text: 'a',
              choices: [
                {
                  label: 'Gamble',
                  condition: { kind: 'characterIs', characterId: 'ghost-character' },
                  outcomes: [{ next: { kind: 'return-to-map' } }],
                },
              ],
            },
          },
        }),
        /unknown character id 'ghost-character'/,
      ],
      [
        'an unknown daemon inside a not wrapper (74c-pre — the assert recurses)',
        makeEvent({
          eligibility: [
            { kind: 'not', condition: { kind: 'hasDaemon', daemonId: 'ghost-daemon' } },
          ],
        }),
        /unknown daemon id 'ghost-daemon'/,
      ],
      [
        'an unknown archetype in grantUnit',
        makeEvent({
          pages: {
            start: {
              text: 'a',
              choices: [
                {
                  label: 'Recruit',
                  outcomes: [
                    {
                      effects: [{ op: 'grantUnit', archetype: 'ghost-archetype' }],
                      next: { kind: 'return-to-map' },
                    },
                  ],
                },
              ],
            },
          },
        }),
        /unknown archetype 'ghost-archetype'/,
      ],
    ])('throws on %s', (_desc, def, pattern) => {
      expect(() => assertEventRefs([def], SYNTH_CATALOGS)).toThrow(pattern);
    });
  });

  describe('74i — assertEventPagesReachable', () => {
    it('passes a fully-connected page map (multi-hop, cycles included)', () => {
      const ok = makeEvent({
        pages: {
          start: {
            text: 'a',
            choices: [
              { label: 'On', outcomes: [{ next: 'second' }] },
              { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
            ],
          },
          second: {
            text: 'b',
            choices: [
              { label: 'Back', outcomes: [{ next: 'start' }] },
              { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
            ],
          },
        },
      });
      expect(() => assertEventPagesReachable([ok])).not.toThrow();
    });

    it('throws on an orphaned page — the §74i content-review bug class (a mis-wired next)', () => {
      // Both start choices exit; the authored reward page can never play.
      const orphaned = makeEvent({
        pages: {
          start: {
            text: 'a',
            choices: [{ label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] }],
          },
          reward: {
            text: 'dead content',
            choices: [{ label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] }],
          },
        },
      });
      expect(() => assertEventPagesReachable([orphaned])).toThrow(
        /page\(s\) 'reward' are unreachable from entry 'start'/,
      );
    });
  });

  describe('74i — the reserved visited: namespace', () => {
    it('visitedFlagFor composes the prefix', () => {
      expect(visitedFlagFor('corrupted-shrine')).toBe(`${VISITED_FLAG_PREFIX}corrupted-shrine`);
    });

    it('an authored setFlag into visited:* throws; READING visited:* stays legal', () => {
      const writer = makeEvent({
        pages: {
          start: {
            text: 'a',
            choices: [
              {
                label: 'Cheat',
                outcomes: [
                  {
                    effects: [{ op: 'setFlag', flag: 'visited:corrupted-shrine' }],
                    next: { kind: 'return-to-map' },
                  },
                ],
              },
            ],
          },
        },
      });
      expect(() => assertEventReservedFlags([writer])).toThrow(/reserved 'visited:' namespace/);
      // The cross-event READ — the mechanism's sold feature — is untouched.
      const reader = makeEvent({
        eligibility: [{ kind: 'flagSet', flag: 'visited:corrupted-shrine' }],
      });
      expect(() => assertEventReservedFlags([reader])).not.toThrow();
    });
  });

  describe('74i — the repeatable field', () => {
    it('parses optionally and round-trips; absent stays absent (the no-repeat default)', () => {
      const on = EventsSchema.parse([makeEvent({ repeatable: true })]);
      expect(on[0]!.repeatable).toBe(true);
      const off = EventsSchema.parse([makeEvent()]);
      expect('repeatable' in off[0]!).toBe(false);
    });
  });
});
