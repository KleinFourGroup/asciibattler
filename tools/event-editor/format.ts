/**
 * Pure formatter for `config/events.json` — the event editor's Save / Copy /
 * Download all emit through here so a written file is byte-for-byte the shape
 * a hand-edit would produce (no noisy whitespace diffs). Node-safe (types
 * only) so it can be unit-tested against the committed file
 * (tests/tools/event-editor.test.ts) — the encounter-editor pattern.
 *
 * The page-map grammar is flat (74a — pages cross-reference by id, no
 * recursion), so unlike the wave formatter this never recurses structurally;
 * the one recursive emit is the `not` condition combinator, which stays
 * INLINE at any depth. The style mirrors `config/events.json` exactly:
 *
 *  - 2-space indent throughout; no trailing newline (the save endpoint
 *    appends one, matching every other editor's emit convention).
 *  - Event key order: `id / name / repeatable? / eligibility? / entry /
 *    pages`; page:
 *    `text / art? / choices`; choice: `label / condition? / outcomes`;
 *    outcome: `weight? / effects? / next`. Optional keys appear only when
 *    present (authored-field fidelity — the 74c reward-formatter rule).
 *  - LEAF objects stay inline on one line: every condition (recursively,
 *    `not` included), every effect op, and the `return-to-map` terminal.
 *    The `start-encounter` terminal EXPANDS (kind / encounterId /
 *    rewardOverride?, one per line) — it's the committed file's one big
 *    terminal.
 *  - Single-element `effects` / `eligibility` arrays stay inline
 *    (`[{ … }]`); multi-element expand one inline element per line.
 *  - An outcome is inline iff it has no `effects` and its `next` is a page
 *    id or `return-to-map` (`{ "weight": 1, "next": "guardians" }`); a
 *    single-element `outcomes` array whose outcome is inline stays inline
 *    as a whole (`[{ "next": { "kind": "return-to-map" } }]`).
 *
 * The leaf-inline / composite-expand split is what keeps a hand-authored
 * event readable; the byte-for-byte test pins it so the formatter and the
 * checked-in file can never drift.
 */

import type {
  EventCondition,
  EventDef,
  EventEffectOp,
  EventNext,
  EventOutcome,
  EventChoice,
  EventPage,
} from '../../src/config/events';

const IND = '  ';

/** A `{ ... }` block: each inner line is already indented to `pad + IND`; the
 *  opening brace sits where the caller places it, and the closing brace
 *  aligns back to `pad`. */
function objBlock(pad: string, innerLines: string[]): string {
  return `{\n${innerLines.join(',\n')}\n${pad}}`;
}

/** A `[ ... ]` block: each element string is already indented to `pad + IND`;
 *  the closing bracket aligns back to `pad`. */
function arrBlock(pad: string, elems: string[]): string {
  return `[\n${elems.join(',\n')}\n${pad}]`;
}

/** One condition, inline — recursing for `not` (inline at any depth). Fields
 *  are emitted explicitly per kind (never via Object.entries) so the byte
 *  shape can't depend on zod's parse-time key ordering. */
function inlineCondition(cond: EventCondition): string {
  switch (cond.kind) {
    case 'bitsAtLeast':
    case 'poolHealthAtLeast':
    case 'poolHealthAtMost':
      return `{ "kind": ${JSON.stringify(cond.kind)}, "amount": ${JSON.stringify(cond.amount)} }`;
    case 'hasDaemon':
      return `{ "kind": "hasDaemon", "daemonId": ${JSON.stringify(cond.daemonId)} }`;
    case 'hasPacket':
      return `{ "kind": "hasPacket", "packetId": ${JSON.stringify(cond.packetId)} }`;
    case 'cacheHasRoom':
      return `{ "kind": "cacheHasRoom" }`;
    case 'rosterSizeAtLeast':
    case 'rosterSizeAtMost':
      return `{ "kind": ${JSON.stringify(cond.kind)}, "count": ${JSON.stringify(cond.count)} }`;
    case 'characterIs':
      return `{ "kind": "characterIs", "characterId": ${JSON.stringify(cond.characterId)} }`;
    case 'flagSet':
      return `{ "kind": "flagSet", "flag": ${JSON.stringify(cond.flag)} }`;
    case 'flagIs':
      return `{ "kind": "flagIs", "flag": ${JSON.stringify(cond.flag)}, "value": ${JSON.stringify(cond.value)} }`;
    case 'not':
      return `{ "kind": "not", "condition": ${inlineCondition(cond.condition)} }`;
  }
}

/** One effect op, inline. Optional fields (`level` / `pick` / `value`) are
 *  emitted only when authored — absent stays absent (the defaults live in
 *  the executor, not the file). */
function inlineOp(op: EventEffectOp): string {
  switch (op.op) {
    case 'gainBits':
    case 'spendBits':
    case 'healPool':
    case 'damagePool':
      return `{ "op": ${JSON.stringify(op.op)}, "amount": ${JSON.stringify(op.amount)} }`;
    case 'addPacket':
    case 'removePacket':
      return `{ "op": ${JSON.stringify(op.op)}, "packetId": ${JSON.stringify(op.packetId)} }`;
    case 'addDaemon':
    case 'removeDaemon':
      return `{ "op": ${JSON.stringify(op.op)}, "daemonId": ${JSON.stringify(op.daemonId)} }`;
    case 'grantUnit': {
      const level = op.level === undefined ? '' : `, "level": ${JSON.stringify(op.level)}`;
      return `{ "op": "grantUnit", "archetype": ${JSON.stringify(op.archetype)}${level} }`;
    }
    case 'removeUnit': {
      const pick = op.pick === undefined ? '' : `, "pick": ${JSON.stringify(op.pick)}`;
      return `{ "op": "removeUnit"${pick} }`;
    }
    case 'setFlag': {
      const value = op.value === undefined ? '' : `, "value": ${JSON.stringify(op.value)}`;
      return `{ "op": "setFlag", "flag": ${JSON.stringify(op.flag)}${value} }`;
    }
  }
}

/** Is this `next` inline-able? Page-id strings and `return-to-map` are;
 *  `start-encounter` expands. */
function nextIsInline(next: EventNext): boolean {
  return typeof next === 'string' || next.kind === 'return-to-map';
}

/** A `next` value. `pad` is the indent of the opening brace when the
 *  start-encounter block expands. */
function nextValue(pad: string, next: EventNext): string {
  if (typeof next === 'string') return JSON.stringify(next);
  if (next.kind === 'return-to-map') return `{ "kind": "return-to-map" }`;
  const childPad = pad + IND;
  const lines = [
    `${childPad}"kind": "start-encounter"`,
    `${childPad}"encounterId": ${JSON.stringify(next.encounterId)}`,
  ];
  if (next.rewardOverride !== undefined) {
    lines.push(`${childPad}"rewardOverride": ${JSON.stringify(next.rewardOverride)}`);
  }
  return objBlock(pad, lines);
}

/** An inline-element array: single element stays on one line (`[{ … }]`),
 *  multi expands one element per line (the effects/eligibility convention). */
function inlineElemArray(pad: string, elems: string[]): string {
  if (elems.length === 1) return `[${elems[0]}]`;
  return arrBlock(
    pad,
    elems.map((e) => pad + IND + e),
  );
}

/** An outcome is inline iff it carries no effects and its next is inline. */
function outcomeIsInline(outcome: EventOutcome): boolean {
  return outcome.effects === undefined && nextIsInline(outcome.next);
}

/** One inline outcome: `{ "weight": 1, "next": "guardians" }`. */
function inlineOutcome(outcome: EventOutcome): string {
  const parts: string[] = [];
  if (outcome.weight !== undefined) parts.push(`"weight": ${JSON.stringify(outcome.weight)}`);
  parts.push(`"next": ${nextValue('', outcome.next)}`);
  return `{ ${parts.join(', ')} }`;
}

/** One expanded outcome block: `weight?` / `effects?` / `next`. */
function outcomeBlock(pad: string, outcome: EventOutcome): string {
  const childPad = pad + IND;
  const lines: string[] = [];
  if (outcome.weight !== undefined) {
    lines.push(`${childPad}"weight": ${JSON.stringify(outcome.weight)}`);
  }
  if (outcome.effects !== undefined) {
    const ops = outcome.effects.map((op) => inlineOp(op));
    lines.push(`${childPad}"effects": ${inlineElemArray(childPad, ops)}`);
  }
  lines.push(`${childPad}"next": ${nextValue(childPad, outcome.next)}`);
  return objBlock(pad, lines);
}

/** The `outcomes` array: a single inline outcome keeps the whole array on
 *  one line; otherwise expand, each element inline where it can be. */
function outcomesValue(pad: string, outcomes: readonly EventOutcome[]): string {
  if (outcomes.length === 1 && outcomeIsInline(outcomes[0]!)) {
    return `[${inlineOutcome(outcomes[0]!)}]`;
  }
  const elems = outcomes.map((o) =>
    outcomeIsInline(o) ? pad + IND + inlineOutcome(o) : pad + IND + outcomeBlock(pad + IND, o),
  );
  return arrBlock(pad, elems);
}

/** One choice block: `label` / `condition?` (inline) / `outcomes`. */
function choiceBlock(pad: string, choice: EventChoice): string {
  const childPad = pad + IND;
  const lines: string[] = [`${childPad}"label": ${JSON.stringify(choice.label)}`];
  if (choice.condition !== undefined) {
    lines.push(`${childPad}"condition": ${inlineCondition(choice.condition)}`);
  }
  lines.push(`${childPad}"outcomes": ${outcomesValue(childPad, choice.outcomes)}`);
  return objBlock(pad, lines);
}

/** One page block: `text` / `art?` / `choices` (always expanded). */
function pageBlock(pad: string, page: EventPage): string {
  const childPad = pad + IND;
  const lines: string[] = [`${childPad}"text": ${JSON.stringify(page.text)}`];
  if (page.art !== undefined) lines.push(`${childPad}"art": ${JSON.stringify(page.art)}`);
  const choiceElems = page.choices.map((c) => childPad + IND + choiceBlock(childPad + IND, c));
  lines.push(`${childPad}"choices": ${arrBlock(childPad, choiceElems)}`);
  return objBlock(pad, lines);
}

/** One event block: `id / name / eligibility? / entry / pages`. Page order
 *  is the record's own insertion order (byte-fidelity to the authored map). */
function eventBlock(pad: string, event: EventDef): string {
  const childPad = pad + IND;
  const lines: string[] = [
    `${childPad}"id": ${JSON.stringify(event.id)}`,
    `${childPad}"name": ${JSON.stringify(event.name)}`,
  ];
  if (event.repeatable !== undefined) {
    lines.push(`${childPad}"repeatable": ${JSON.stringify(event.repeatable)}`);
  }
  if (event.eligibility !== undefined) {
    const conds = event.eligibility.map((c) => inlineCondition(c));
    lines.push(`${childPad}"eligibility": ${inlineElemArray(childPad, conds)}`);
  }
  lines.push(`${childPad}"entry": ${JSON.stringify(event.entry)}`);
  const pageLines = Object.entries(event.pages).map(
    ([pageId, page]) =>
      `${childPad + IND}${JSON.stringify(pageId)}: ${pageBlock(childPad + IND, page)}`,
  );
  lines.push(`${childPad}"pages": ${objBlock(childPad, pageLines)}`);
  return objBlock(pad, lines);
}

/**
 * Format a full event catalog (the whole file) to a JSON string matching
 * `config/events.json`'s layout. No trailing newline.
 */
export function formatEventsJson(events: readonly EventDef[]): string {
  if (events.length === 0) return '[]';
  const elems = events.map((e) => IND + eventBlock(IND, e));
  return arrBlock('', elems);
}
