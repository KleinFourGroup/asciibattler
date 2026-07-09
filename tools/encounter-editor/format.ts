/**
 * Pure formatter for `config/encounters.json` — the encounter editor's Save /
 * Copy / Download all emit through here so a written file is byte-for-byte the
 * shape a hand-edit would produce (no noisy whitespace diffs). Extracted from the
 * editor UI and node-safe (types only) so it can be unit-tested against the
 * committed file (tests/tools/encounter-editor.test.ts).
 *
 * The wave grammar is RECURSIVE (a tree of wave / pick / loop / stages entries,
 * nesting to any depth — see [sequencer.ts](../../src/run/encounters/sequencer.ts)),
 * so this is a small recursive pretty-printer rather than the flat
 * field-by-field emit the archetype/sector formatters use. The style mirrors
 * `config/encounters.json` exactly:
 *
 *  - 2-space indent throughout; no trailing newline (the save endpoint appends
 *    one, matching every other editor's emit convention).
 *  - Encounter key order: `id / name / description? / healthPool / kind /
 *    layouts? / rewards? / waves` (optional keys appear only when present).
 *  - Composite grammar nodes (`wave`/`pick`/`loop`/`stages`, the spec, the
 *    `units` array) expand one field per line; the LEAF objects stay inline on
 *    one line: `levelBudget` / `count` kind-objects, each `units` entry, a
 *    stage's `until` condition (e.g. `{ "kind": "weight", "weight": 0.7 }`),
 *    and each `rewards` ref (48e — the real block emitter replacing the 48a
 *    opaque `JSON.stringify` blob): the list expands, each
 *    `{ "table": …, "trigger": { "chance": … } }` stays on one line.
 *
 * The leaf-inline / composite-expand split is what makes a hand-authored
 * encounter readable; the byte-for-byte test pins it so the formatter and the
 * checked-in file can never drift.
 */

import type { Encounter } from '../../src/config/encounters';
import type { EncounterRewardRef } from '../../src/config/rewards';
import type { WaveEntry, PickOption, Stage } from '../../src/run/encounters/sequencer';
import type { WaveSpec, WaveUnitSpec } from '../../src/run/encounters/wave';

const IND = '  ';

/** A `{ ... }` block: each inner line is already indented to `pad + IND`; the
 *  opening brace sits where the caller places it (after a `"key": ` or an array
 *  element indent), and the closing brace aligns back to `pad`. */
function objBlock(pad: string, innerLines: string[]): string {
  return `{\n${innerLines.join(',\n')}\n${pad}}`;
}

/** A `[ ... ]` block: each element string is already indented to `pad + IND`;
 *  the closing bracket aligns back to `pad`. */
function arrBlock(pad: string, elems: string[]): string {
  return `[\n${elems.join(',\n')}\n${pad}]`;
}

/** A leaf object on one line: `{ "k": v, ... }` in the object's own key order.
 *  Used for the kind-objects (levelBudget/count/unit-count/unit-level) and a
 *  stage condition — every value is a string or number, so `JSON.stringify`
 *  emits each verbatim. */
function inlineObj(obj: Readonly<Record<string, unknown>>): string {
  const parts = Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{ ${parts.join(', ')} }`;
}

/** One `units` entry, inline: `{ "archetype": …, "count": {…}, "level": {…} }`. */
function inlineUnit(u: WaveUnitSpec): string {
  return `{ "archetype": ${JSON.stringify(u.archetype)}, "count": ${inlineObj(u.count)}, "level": ${inlineObj(u.level)} }`;
}

/** A `WaveSpec` block (`levelBudget` / `count` / optional `levelCap` inline,
 *  `units` expanded). `levelCap` is emitted only when present (absent = uncapped). */
function specBlock(pad: string, spec: WaveSpec): string {
  const childPad = pad + IND;
  const unitElems = spec.units.map((u) => childPad + IND + inlineUnit(u));
  const lines = [
    `${childPad}"levelBudget": ${inlineObj(spec.levelBudget)}`,
    `${childPad}"count": ${inlineObj(spec.count)}`,
  ];
  if (spec.levelCap !== undefined) lines.push(`${childPad}"levelCap": ${inlineObj(spec.levelCap)}`);
  lines.push(`${childPad}"units": ${arrBlock(childPad, unitElems)}`);
  return objBlock(pad, lines);
}

/** A wave-list (the top-level `waves`, and every loop/stage body): an array of
 *  entry blocks, each indented to `pad + IND`. */
function waveListBlock(pad: string, list: readonly WaveEntry[]): string {
  const elems = list.map((entry) => pad + IND + entryBlock(pad + IND, entry));
  return arrBlock(pad, elems);
}

/** One grammar entry block — recurses for loop/pick/stages bodies. `pad` is the
 *  indent of the entry's opening brace. */
function entryBlock(pad: string, entry: WaveEntry): string {
  const childPad = pad + IND;
  switch (entry.kind) {
    case 'wave':
      return objBlock(pad, [
        `${childPad}"kind": "wave"`,
        `${childPad}"spec": ${specBlock(childPad, entry.spec)}`,
      ]);
    case 'pick': {
      const optElems = entry.options.map((o) => childPad + IND + optionBlock(childPad + IND, o));
      return objBlock(pad, [
        `${childPad}"kind": "pick"`,
        `${childPad}"options": ${arrBlock(childPad, optElems)}`,
      ]);
    }
    case 'loop':
      return objBlock(pad, [
        `${childPad}"kind": "loop"`,
        `${childPad}"repeat": ${JSON.stringify(entry.repeat)}`,
        `${childPad}"body": ${waveListBlock(childPad, entry.body)}`,
      ]);
    case 'stages': {
      const stageElems = entry.stages.map((s) => childPad + IND + stageBlock(childPad + IND, s));
      return objBlock(pad, [
        `${childPad}"kind": "stages"`,
        `${childPad}"stages": ${arrBlock(childPad, stageElems)}`,
      ]);
    }
  }
}

/** A `pick` option block: `{ "entry": {…}, "weight": N }`, the nested entry expanded. */
function optionBlock(pad: string, option: PickOption): string {
  const childPad = pad + IND;
  return objBlock(pad, [
    `${childPad}"entry": ${entryBlock(childPad, option.entry)}`,
    `${childPad}"weight": ${JSON.stringify(option.weight)}`,
  ]);
}

/** A `stages` entry block: optional `until` (inline) then the expanded `body`. */
function stageBlock(pad: string, stage: Stage): string {
  const childPad = pad + IND;
  const lines: string[] = [];
  if (stage.until !== undefined) lines.push(`${childPad}"until": ${inlineObj(stage.until)}`);
  lines.push(`${childPad}"body": ${waveListBlock(childPad, stage.body)}`);
  return objBlock(pad, lines);
}

/** One reward ref, inline (the leaf convention): the nested `trigger` object
 *  stays on the same line — `{ "table": …, "trigger": { "chance": … } }`.
 *  `chance` is emitted explicitly (not via `inlineObj`) because the launch
 *  trigger vocabulary is chance-only; a §-later predicate join extends this. */
function inlineRewardRef(ref: EncounterRewardRef): string {
  return `{ "table": ${JSON.stringify(ref.table)}, "trigger": { "chance": ${JSON.stringify(ref.trigger.chance)} } }`;
}

/** One encounter object block. Optional keys (`description` / `layouts` /
 *  `rewards`) are emitted only when present, in the canonical order. */
function encounterBlock(pad: string, e: Encounter): string {
  const childPad = pad + IND;
  const lines: string[] = [
    `${childPad}"id": ${JSON.stringify(e.id)}`,
    `${childPad}"name": ${JSON.stringify(e.name)}`,
  ];
  if (e.description !== undefined) lines.push(`${childPad}"description": ${JSON.stringify(e.description)}`);
  lines.push(`${childPad}"healthPool": ${JSON.stringify(e.healthPool)}`);
  lines.push(`${childPad}"kind": ${JSON.stringify(e.kind)}`);
  if (e.layouts !== undefined) {
    const inner = e.layouts.map((l) => JSON.stringify(l)).join(', ');
    lines.push(`${childPad}"layouts": [${inner}]`);
  }
  if (e.rewards !== undefined) {
    // 48e — the real block emitter (the 48a placeholder blob-stringified). An
    // empty list emits `[]` inline (the schema allows it; the editor omits the
    // key instead, so this is the hand-edit path only).
    const refs =
      e.rewards.length === 0
        ? '[]'
        : arrBlock(
            childPad,
            e.rewards.map((r) => childPad + IND + inlineRewardRef(r)),
          );
    lines.push(`${childPad}"rewards": ${refs}`);
  }
  lines.push(`${childPad}"waves": ${waveListBlock(childPad, e.waves)}`);
  return objBlock(pad, lines);
}

/**
 * Format a full encounters catalog (the whole file) to a JSON string matching
 * `config/encounters.json`'s layout. No trailing newline.
 */
export function formatEncountersJson(encounters: readonly Encounter[]): string {
  if (encounters.length === 0) return '[]';
  const elems = encounters.map((e) => IND + encounterBlock(IND, e));
  return arrBlock('', elems);
}
