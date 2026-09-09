/**
 * 74h — event editor formatter fidelity (the encounter-editor pattern).
 * The editor's Save (and Copy / Download) write the file through
 * `formatEventsJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed catalog reproduces `config/events.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — so a Save
 *     with no edits is a no-op diff, and an edited Save touches only changed
 *     lines.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`EventsSchema`) to a value deep-equal to the source — the formatter
 *     drops/reorders nothing the loader cares about.
 *
 * Both derive from the live catalog + schema (never hardcoded event values).
 * A third case exercises the grammar breadth the shipped catalog doesn't yet
 * use — every effect op, the recursive `not` condition, `art`, multi-element
 * eligibility, `rewardOverride`, weighted multi-outcome lists — so the
 * formatter is covered before §74i's content round authors those constructs.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EVENTS, EventsSchema, type EventDef } from '../../src/config/events';
import { formatEventsJson, slugifyChoiceLabel, stampChoiceIds } from '../../tools/event-editor/format';

describe('stampChoiceIds (§95a — the locale address segment)', () => {
  it('is a no-op on the committed catalog: every shipped choice already carries an id', () => {
    const copy = EventsSchema.parse(JSON.parse(formatEventsJson(EVENTS)));
    expect(stampChoiceIds(copy)).toBe(0);
    for (const event of copy) {
      for (const page of Object.values(event.pages)) {
        for (const choice of page.choices) expect(choice.id).toBeDefined();
      }
    }
  });

  it('slugs the label, falls back to the index, de-duplicates within a page, and never rewrites an existing id', () => {
    expect(slugifyChoiceLabel('Scoop the bowl!')).toBe('scoop-the-bowl');
    expect(slugifyChoiceLabel('  ¿Qué?  ')).toBe('qu');
    const fixture: EventDef[] = EventsSchema.parse([
      {
        id: 'x',
        name: 'X',
        entry: 'p',
        pages: {
          p: {
            text: 't',
            choices: [
              { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
              { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
              { id: 'kept', label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
              { label: '!!!', outcomes: [{ next: { kind: 'return-to-map' } }] },
            ],
          },
        },
      },
    ]);
    expect(stampChoiceIds(fixture)).toBe(3);
    expect(fixture[0]!.pages.p!.choices.map((c) => c.id)).toEqual(['leave', 'leave-2', 'kept', 'choice-3']);
    // Idempotent: a second pass stamps nothing.
    expect(stampChoiceIds(fixture)).toBe(0);
  });

  it('rejects two choices sharing an id on one page (the address guard)', () => {
    expect(() =>
      EventsSchema.parse([
        {
          id: 'x',
          name: 'X',
          entry: 'p',
          pages: {
            p: {
              text: 't',
              choices: [
                { id: 'same', label: 'A', outcomes: [{ next: { kind: 'return-to-map' } }] },
                { id: 'same', label: 'B', outcomes: [{ next: { kind: 'return-to-map' } }] },
              ],
            },
          },
        },
      ]),
    ).toThrow(/duplicate choice id 'same'/);
  });
});

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatEventsJson', () => {
  it('reproduces the committed config/events.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/events.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatEventsJson(EVENTS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal catalog', () => {
    const reparsed = EventsSchema.parse(JSON.parse(formatEventsJson(EVENTS)));
    expect(reparsed).toEqual(EVENTS);
  });

  it('formats the full grammar breadth + optional keys, round-tripping deep-equal', () => {
    // A synthetic event exercising every effect op, the recursive `not`
    // combinator, `art`, a multi-element eligibility list, weighted
    // multi-outcome choices, and both terminal shapes (rewardOverride
    // included). Parse it through the schema first so the fixture can't
    // drift from the real shape, then assert the formatter round-trips it.
    // Synthetic cross-catalog ids are fine — referential integrity is the
    // separate boot assert (`assertEventRefs`), not the schema.
    const fixture: EventDef[] = EventsSchema.parse([
      {
        id: 'grammar-demo',
        name: 'Grammar Demo',
        repeatable: true,
        eligibility: [
          { kind: 'flagSet', flag: 'demo:seen' },
          { kind: 'not', condition: { kind: 'hasDaemon', daemonId: 'janus' } },
        ],
        entry: 'start',
        pages: {
          start: {
            text: 'the start page',
            art: 'demo-shrine',
            choices: [
              {
                label: 'Weighted fork',
                condition: {
                  kind: 'not',
                  condition: { kind: 'not', condition: { kind: 'cacheHasRoom' } },
                },
                outcomes: [
                  {
                    weight: 2,
                    effects: [
                      { op: 'gainBits', amount: 5 },
                      { op: 'spendBits', amount: 1 },
                      { op: 'healPool', amount: 2 },
                      { op: 'damagePool', amount: 1 },
                      { op: 'addPacket', packetId: 'patch' },
                      { op: 'removePacket', packetId: 'patch' },
                      { op: 'addDaemon', daemonId: 'janus' },
                      { op: 'removeDaemon', daemonId: 'janus' },
                      { op: 'grantUnit', archetype: 'bandit', level: 3 },
                      { op: 'grantUnit', archetype: 'bandit' },
                      { op: 'removeUnit', pick: 'weakest' },
                      { op: 'removeUnit' },
                      { op: 'setFlag', flag: 'demo:done', value: 7 },
                      { op: 'setFlag', flag: 'demo:seen' },
                    ],
                    next: 'second',
                  },
                  { weight: 1, next: { kind: 'return-to-map' } },
                ],
              },
              {
                label: 'Conditioned exits',
                condition: { kind: 'flagIs', flag: 'demo:mode', value: 'hard' },
                outcomes: [
                  {
                    next: {
                      kind: 'start-encounter',
                      encounterId: 'deserters',
                      rewardOverride: [
                        { table: 'bits-large', trigger: { chance: 1 } },
                        { table: 'packets-elite', trigger: { chance: 0.5 } },
                      ],
                    },
                  },
                ],
              },
              {
                label: 'Plain exit',
                outcomes: [{ next: { kind: 'return-to-map' } }],
              },
            ],
          },
          second: {
            text: 'the second page',
            choices: [
              {
                label: 'Fight, no override',
                outcomes: [
                  { effects: [{ op: 'setFlag', flag: 'demo:fought', value: true }], next: { kind: 'start-encounter', encounterId: 'deserters' } },
                ],
              },
              { label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] },
            ],
          },
        },
      },
    ]);
    const reparsed = EventsSchema.parse(JSON.parse(formatEventsJson(fixture)));
    expect(reparsed).toEqual(fixture);
  });
});
