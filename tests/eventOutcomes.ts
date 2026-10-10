/**
 * An event with its wording taken away: what each choice can do, in what
 * order, at what odds, and where it leads. Two versions of an event with the
 * same form give a player and a bot the same decisions with the same
 * results, however the pages between them are written.
 *
 * A page that offers one choice, with no condition and one outcome, decides
 * nothing: it is a page that tells what happened. The form folds such a page
 * into the choice that led to it, and its effects follow that choice's own.
 * So these three read the same:
 *
 *   a choice with two effects that returns to the map;
 *   the same choice leading to a page whose one choice returns to the map;
 *   the choice with the first effect, and the page's one choice with the second.
 *
 * What the form keeps: each deciding page's choices in their order (a bot
 * picks by position), each choice's condition, each outcome's share of the
 * roll in the list's order (the roll walks the list), the effects in order,
 * a fight's encounter and its pinned rewards, and the event's eligibility and
 * whether it repeats. What it drops: names, texts, labels, choice ids, page
 * ids and the pages that decide nothing.
 *
 * What it cannot say: on which click an effect lands. A run closed on a
 * telling page has the effects of the choice before it and not the page's
 * own, and the form reads both placements as one.
 *
 * It is for events without a loop; a page that leads back to itself throws.
 */

import type {
  EventChoice,
  EventCondition,
  EventDef,
  EventEffectOp,
  EventNext,
  EventPage,
  EventTerminal,
} from '../src/config/events';

export type OutcomeNode =
  | { readonly end: EventTerminal }
  | { readonly choices: readonly OutcomeChoice[] };

export interface OutcomeChoice {
  readonly condition: EventCondition | null;
  readonly branches: readonly OutcomeBranch[];
}

export interface OutcomeBranch {
  /** This outcome's part of the choice's roll, 0 to 1. */
  readonly share: number;
  readonly effects: readonly EventEffectOp[];
  readonly then: OutcomeNode;
}

export interface EventOutcomes {
  readonly eligibility: readonly EventCondition[];
  readonly repeatable: boolean;
  /** Effects that land before the first decision, when the entry page
   *  decides nothing. */
  readonly effects: readonly EventEffectOp[];
  readonly first: OutcomeNode;
}

function decidesNothing(page: EventPage): boolean {
  const only = page.choices[0];
  return (
    page.choices.length === 1 &&
    only !== undefined &&
    only.condition === undefined &&
    only.outcomes.length === 1
  );
}

/** An effect with its defaults written out, so a default spelled in the file
 *  and one left to the schema read the same. */
function spelled(op: EventEffectOp): EventEffectOp {
  if (op.op === 'grantUnit') return { ...op, level: op.level ?? 1 };
  if (op.op === 'removeUnit') return { ...op, pick: op.pick ?? 'random' };
  if (op.op === 'setFlag') return { ...op, value: op.value ?? true };
  return op;
}

function follow(
  event: EventDef,
  next: EventNext,
  effects: readonly EventEffectOp[],
  trail: readonly string[],
): { effects: readonly EventEffectOp[]; then: OutcomeNode } {
  if (typeof next !== 'string') return { effects, then: { end: next } };
  if (trail.includes(next)) {
    throw new Error(`event '${event.id}': page '${next}' leads back to itself`);
  }
  const page = event.pages[next];
  if (page === undefined) throw new Error(`event '${event.id}': no page '${next}'`);
  const here = [...trail, next];
  const only = page.choices[0];
  if (decidesNothing(page) && only !== undefined) {
    const outcome = only.outcomes[0]!;
    return follow(event, outcome.next, [...effects, ...(outcome.effects ?? []).map(spelled)], here);
  }
  return { effects, then: { choices: page.choices.map((choice) => choiceOf(event, choice, here)) } };
}

function choiceOf(event: EventDef, choice: EventChoice, trail: readonly string[]): OutcomeChoice {
  const total = choice.outcomes.reduce((sum, outcome) => sum + (outcome.weight ?? 1), 0);
  return {
    condition: choice.condition ?? null,
    branches: choice.outcomes.map((outcome) => {
      const followed = follow(event, outcome.next, (outcome.effects ?? []).map(spelled), trail);
      return {
        // Rounded so 3 of 4 and 6 of 8 are the same number.
        share: Math.round(((outcome.weight ?? 1) / total) * 1e12) / 1e12,
        effects: followed.effects,
        then: followed.then,
      };
    }),
  };
}

export function eventOutcomes(event: EventDef): EventOutcomes {
  const from = follow(event, event.entry, [], []);
  return {
    eligibility: event.eligibility ?? [],
    repeatable: event.repeatable ?? false,
    effects: from.effects,
    first: from.then,
  };
}
