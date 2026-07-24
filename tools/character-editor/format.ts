/**
 * Pure formatter for `config/characters.json` — the character editor's Save /
 * Copy / Download all emit through here so a saved file is byte-for-byte the
 * shape a hand-edit would produce (no noisy whitespace diffs). Extracted from
 * the editor UI and node-safe (a type import only) so it can be unit-tested
 * against the committed file (tests/tools/character-editor.test.ts).
 *
 * Mirrors the committed file exactly — 2-space indent, the
 * `id / name / description / roster / daemon / blacklist / weightOverrides`
 * key order (every key always present: the input is the NORMALIZED
 * `CharacterConfig`, whose collections are always-present — empty = no
 * additions/overrides, matching how the file is authored), and the
 * leaf-inline / composite-expand split the encounter formatter established:
 *
 *  - `roster` expands one archetype id per line (it's the roster in
 *    deployment order and its length IS the roster size — a vertical list
 *    reads as the ten slots it is).
 *  - `blacklist` stays inline on one line (`[]` / `["shaman"]`) — a short
 *    curation list, not a roster.
 *  - `weightOverrides` emits `{}` inline when empty, else one
 *    `"archetype": weight` per line.
 *
 * No trailing newline — the save endpoint appends one (every editor's emit
 * convention).
 */

import type { CharacterConfig } from '../../src/config/characters';

const IND = '  ';

/** One character block; `pad` is the indent of the opening brace. */
function characterBlock(pad: string, c: CharacterConfig): string {
  const childPad = pad + IND;
  const rosterElems = c.roster.map((a) => childPad + IND + JSON.stringify(a));
  const lines: string[] = [
    `${childPad}"id": ${JSON.stringify(c.id)}`,
    `${childPad}"name": ${JSON.stringify(c.name)}`,
    `${childPad}"description": ${JSON.stringify(c.description)}`,
    `${childPad}"roster": [\n${rosterElems.join(',\n')}\n${childPad}]`,
    `${childPad}"daemon": ${JSON.stringify(c.daemon)}`,
    `${childPad}"blacklist": [${c.blacklist.map((a) => JSON.stringify(a)).join(', ')}]`,
  ];
  const overrides = Object.entries(c.weightOverrides);
  if (overrides.length === 0) {
    lines.push(`${childPad}"weightOverrides": {}`);
  } else {
    const overrideLines = overrides.map(
      ([a, w]) => `${childPad}${IND}${JSON.stringify(a)}: ${JSON.stringify(w)}`,
    );
    lines.push(
      `${childPad}"weightOverrides": {\n${overrideLines.join(',\n')}\n${childPad}}`,
    );
  }
  return `{\n${lines.join(',\n')}\n${pad}}`;
}

/**
 * Format a full character catalog (the whole file) to a JSON string matching
 * `config/characters.json`'s layout. No trailing newline.
 */
export function formatCharactersJson(characters: readonly CharacterConfig[]): string {
  const elems = characters.map((c) => IND + IND + characterBlock(IND + IND, c));
  return `{\n${IND}"characters": [\n${elems.join(',\n')}\n${IND}]\n}`;
}
