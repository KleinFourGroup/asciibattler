/**
 * §75i — pure formatter for `config/camps.json`. The camp editor's Save /
 * Copy / Download all emit through here so a written file is byte-for-byte the
 * shape a hand-edit would produce (no noisy whitespace diffs). Node-safe
 * (types only) so it can be unit-tested against the committed file
 * (tests/tools/camp-editor.test.ts) — the encounter-editor formatter's flat
 * sibling (a camp has no recursive grammar).
 *
 * Style mirrors the encounters.json conventions:
 *  - 2-space indent throughout; no trailing newline (the save endpoint
 *    appends one, matching every other editor's emit).
 *  - Camp key order: `id / name / description? / leashRadius / units /
 *    rewards?` (optional keys appear only when present).
 *  - Arrays expand one element per line; the LEAF objects stay inline: each
 *    `units` entry (`{ "archetype": …, "count": …?, "level": …? }` — the
 *    optional fields emitted only when present, so a bare default entry
 *    round-trips bare) and each `rewards` ref
 *    (`{ "table": …, "trigger": { "chance": … } }`).
 */

import type { CampDef, CampUnit } from '../../src/config/camps';
import type { EncounterRewardRef } from '../../src/config/rewards';

const IND = '  ';

/** A `{ ... }` block: each inner line is already indented to `pad + IND`; the
 *  closing brace aligns back to `pad`. */
function objBlock(pad: string, innerLines: string[]): string {
  return `{\n${innerLines.join(',\n')}\n${pad}}`;
}

/** A `[ ... ]` block: each element string is already indented to `pad + IND`;
 *  the closing bracket aligns back to `pad`. */
function arrBlock(pad: string, elems: string[]): string {
  return `[\n${elems.join(',\n')}\n${pad}]`;
}

/** One `units` entry, inline. `count` / `level` are emitted only when present
 *  (absent = the schema's default 1), in the `archetype / count / level` key
 *  order the committed file uses. */
function inlineUnit(u: CampUnit): string {
  let body = `"archetype": ${JSON.stringify(u.archetype)}`;
  if (u.count !== undefined) body += `, "count": ${JSON.stringify(u.count)}`;
  if (u.level !== undefined) body += `, "level": ${JSON.stringify(u.level)}`;
  return `{ ${body} }`;
}

/** One reward ref, inline (the encounter-formatter leaf convention): the
 *  nested `trigger` stays on the same line. `chance` is emitted explicitly
 *  because the launch trigger vocabulary is chance-only. */
function inlineRewardRef(ref: EncounterRewardRef): string {
  return `{ "table": ${JSON.stringify(ref.table)}, "trigger": { "chance": ${JSON.stringify(ref.trigger.chance)} } }`;
}

/** One camp object block. Optional keys (`description` / `rewards`) are
 *  emitted only when present, in the canonical order. */
function campBlock(pad: string, c: CampDef): string {
  const childPad = pad + IND;
  const lines: string[] = [
    `${childPad}"id": ${JSON.stringify(c.id)}`,
    `${childPad}"name": ${JSON.stringify(c.name)}`,
  ];
  if (c.description !== undefined) lines.push(`${childPad}"description": ${JSON.stringify(c.description)}`);
  lines.push(`${childPad}"leashRadius": ${JSON.stringify(c.leashRadius)}`);
  lines.push(
    `${childPad}"units": ${arrBlock(
      childPad,
      c.units.map((u) => childPad + IND + inlineUnit(u)),
    )}`,
  );
  if (c.rewards !== undefined) {
    // An empty list emits `[]` inline (the schema allows it; the editor omits
    // the key instead, so this is the hand-edit path only).
    const refs =
      c.rewards.length === 0
        ? '[]'
        : arrBlock(
            childPad,
            c.rewards.map((r) => childPad + IND + inlineRewardRef(r)),
          );
    lines.push(`${childPad}"rewards": ${refs}`);
  }
  return objBlock(pad, lines);
}

/**
 * Format a full camp catalog (the whole file) to a JSON string matching
 * `config/camps.json`'s layout. No trailing newline. An empty catalog is
 * legal (`CampsSchema` allows it) and emits `[]`.
 */
export function formatCampsJson(camps: readonly CampDef[]): string {
  if (camps.length === 0) return '[]';
  const elems = camps.map((c) => IND + campBlock(IND, c));
  return arrBlock('', elems);
}
