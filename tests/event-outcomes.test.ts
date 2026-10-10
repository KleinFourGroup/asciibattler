/**
 * The three first events keep their outcomes.
 *
 * `corrupted-shrine`, `whispering-terminal` and
 * `whispering-terminal-collects` were written before the outcome page was
 * the house style (DESIGN "Events"). Rewriting them in it adds pages and
 * changes every word, and must change nothing a choice does.
 * `event-outcomes-frozen.json` is the three as they stood before the rewrite
 * (commit 545df7a), and each is compared here with the catalog's own through
 * `eventOutcomes`, the form in `eventOutcomes.ts`.
 *
 * The comparison is only worth its planted changes: the second block edits a
 * copy of a frozen event in each way an outcome can change and the form must
 * see every one, and the third makes the edits a rewrite is free to make and
 * the form must see none.
 *
 * A later change that means to alter one of the three freezes it again:
 * replace its entry in the frozen file in the same commit.
 */

import { describe, expect, it } from 'vitest';
import { EventsSchema, getEvent, type EventDef } from '../src/config/events';
import frozenJson from './event-outcomes-frozen.json';
import { eventOutcomes } from './eventOutcomes';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
type Draft = Mutable<EventDef>;

const FROZEN: readonly EventDef[] = EventsSchema.parse(frozenJson);

function frozen(id: string): EventDef {
  const hit = FROZEN.find((event) => event.id === id);
  if (hit === undefined) throw new Error(`no frozen event '${id}'`);
  return hit;
}

/** A copy of a frozen event with one edit made to it. */
function edited(id: string, edit: (draft: Draft) => void): EventDef {
  const draft = structuredClone(frozen(id)) as Draft;
  edit(draft);
  return draft;
}

const RETURN = { kind: 'return-to-map' } as const;
const SHRINE = 'corrupted-shrine';
const TERMINAL = 'whispering-terminal';
const COLLECTS = 'whispering-terminal-collects';

describe('the three first events keep their outcomes', () => {
  it('the frozen file holds the three', () => {
    expect(FROZEN.map((event) => event.id)).toEqual([SHRINE, TERMINAL, COLLECTS]);
  });

  for (const was of FROZEN) {
    it(`${was.id} decides what it decided before`, () => {
      const now = getEvent(was.id);
      expect(now, `${was.id} is gone from the catalog`).toBeDefined();
      expect(eventOutcomes(now!)).toEqual(eventOutcomes(was));
    });
  }
});

describe('the form sees a change of outcome', () => {
  const differs = (id: string, edit: (draft: Draft) => void): void => {
    expect(eventOutcomes(edited(id, edit))).not.toEqual(eventOutcomes(frozen(id)));
  };
  // The shrine's first page: scoop (3 to 1), the offering (gated), pass by.
  const scoop = (d: Draft) => d.pages['start']!.choices[0]!;
  const offering = (d: Draft) => d.pages['start']!.choices[1]!;
  const fight = (d: Draft) => d.pages['guardians']!.choices[0]!.outcomes[0]!;

  it('an amount', () => {
    differs(SHRINE, (d) => {
      scoop(d).outcomes[0]!.effects = [{ op: 'gainBits', amount: 13 }];
    });
  });
  it('the odds of a roll', () => {
    differs(SHRINE, (d) => {
      scoop(d).outcomes[0]!.weight = 2;
    });
  });
  it('where a roll leads', () => {
    differs(SHRINE, (d) => {
      scoop(d).outcomes[1]!.next = RETURN;
    });
  });
  it('the order of two effects', () => {
    differs(SHRINE, (d) => {
      offering(d).outcomes[0]!.effects!.reverse();
    });
  });
  it('an effect dropped', () => {
    differs(SHRINE, (d) => {
      offering(d).outcomes[0]!.effects!.pop();
    });
  });
  it('a condition dropped', () => {
    differs(SHRINE, (d) => {
      delete offering(d).condition;
    });
  });
  it("a condition's amount", () => {
    differs(SHRINE, (d) => {
      offering(d).condition = { kind: 'bitsAtLeast', amount: 5 };
    });
  });
  it('two choices changing places', () => {
    differs(SHRINE, (d) => {
      d.pages['start']!.choices.reverse();
    });
  });
  it('another encounter', () => {
    differs(SHRINE, (d) => {
      fight(d).next = { kind: 'start-encounter', encounterId: 'bandit-king' };
    });
  });
  it("a fight's pinned reward dropped", () => {
    differs(SHRINE, (d) => {
      const next = fight(d).next;
      if (typeof next === 'string' || next.kind !== 'start-encounter') throw new Error('not a fight');
      delete next.rewardOverride;
    });
  });
  it('a flag no longer set', () => {
    differs(TERMINAL, (d) => {
      d.pages['start']!.choices[0]!.outcomes[0]!.effects!.shift();
    });
  });
  it('the eligibility dropped', () => {
    differs(COLLECTS, (d) => {
      delete d.eligibility;
    });
  });
  it('an event made repeatable', () => {
    differs(COLLECTS, (d) => {
      d.repeatable = true;
    });
  });
  it('a telling page whose one choice adds an effect', () => {
    differs(COLLECTS, (d) => {
      d.pages['start']!.choices[1]!.outcomes[0]!.next = 'told';
      d.pages['told'] = {
        text: 'x',
        choices: [{ label: 'x', outcomes: [{ effects: [{ op: 'damagePool', amount: 1 }], next: RETURN }] }],
      };
    });
  });
  it('a telling page given a second choice, which makes it a decision', () => {
    differs(COLLECTS, (d) => {
      d.pages['start']!.choices[1]!.outcomes[0]!.next = 'told';
      d.pages['told'] = {
        text: 'x',
        choices: [
          { label: 'x', outcomes: [{ next: RETURN }] },
          { label: 'y', outcomes: [{ next: RETURN }] },
        ],
      };
    });
  });
});

describe('the form does not see a change of wording or of pages', () => {
  const same = (id: string, edit: (draft: Draft) => void): void => {
    expect(eventOutcomes(edited(id, edit))).toEqual(eventOutcomes(frozen(id)));
  };

  it('the name, every text, every label and every choice id', () => {
    same(SHRINE, (d) => {
      d.name = 'x';
      for (const page of Object.values(d.pages)) {
        page.text = 'x';
        page.choices.forEach((choice, i) => {
          choice.label = `x${i}`;
          choice.id = `x${i}`;
        });
      }
    });
  });
  it('a telling page between a choice and the map', () => {
    same(COLLECTS, (d) => {
      d.pages['start']!.choices[0]!.outcomes[0]!.next = 'told';
      d.pages['told'] = { text: 'x', choices: [{ label: 'x', outcomes: [{ next: RETURN }] }] };
    });
  });
  it("the effects moved to the telling page's one choice", () => {
    same(COLLECTS, (d) => {
      const outcome = d.pages['start']!.choices[0]!.outcomes[0]!;
      const effects = outcome.effects!;
      delete outcome.effects;
      outcome.next = 'told';
      d.pages['told'] = { text: 'x', choices: [{ label: 'x', outcomes: [{ effects, next: RETURN }] }] };
    });
  });
  it('the first effect on the choice and the second on the telling page', () => {
    same(SHRINE, (d) => {
      const outcome = d.pages['start']!.choices[1]!.outcomes[0]!;
      const [spend, heal] = outcome.effects!;
      outcome.effects = [spend!];
      outcome.next = 'told';
      d.pages['told'] = {
        text: 'x',
        choices: [{ label: 'x', outcomes: [{ effects: [heal!], next: RETURN }] }],
      };
    });
  });
  it('a page under another id', () => {
    same(SHRINE, (d) => {
      d.pages['ambush'] = d.pages['guardians']!;
      delete d.pages['guardians'];
      d.pages['start']!.choices[0]!.outcomes[1]!.next = 'ambush';
    });
  });
  it('the same odds in other numbers', () => {
    same(SHRINE, (d) => {
      const outcomes = d.pages['start']!.choices[0]!.outcomes;
      outcomes[0]!.weight = 6;
      outcomes[1]!.weight = 2;
    });
  });
  it("a flag's default value spelled out", () => {
    same(TERMINAL, (d) => {
      d.pages['start']!.choices[0]!.outcomes[0]!.effects![0] = {
        op: 'setFlag',
        flag: 'whispering-terminal:answered',
        value: true,
      };
    });
  });
});

describe('the form is for events without a loop', () => {
  it('throws on a page that leads back to itself', () => {
    const looped = edited(COLLECTS, (d) => {
      d.pages['start']!.choices[1]!.outcomes[0]!.next = 'start';
    });
    expect(() => eventOutcomes(looped)).toThrow(/leads back to itself/);
  });
});
