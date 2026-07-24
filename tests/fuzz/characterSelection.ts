/**
 * §63d — the fuzz character arm: which starting character the harness's runs
 * carry.
 *
 * Simpler than the daemon arm (no `random`/`none` kinds): a run ALWAYS has a
 * character, and the harness default is the EXPLICIT Soldier — the arm names
 * itself rather than leaning on Run's internal fallback (the §63 exit-
 * criterion lock), so a batch's identity is visible at the harness layer.
 * `--character=<id>` forces another catalog character; per-character
 * measurement doctrine lands at §68.
 *
 * A plain JSON object so it round-trips the `--jobs` ShardJob temp file, like
 * the daemon selection + the policies.
 */

import {
  CHARACTERS,
  characterById,
  DEFAULT_CHARACTER_ID,
  type CharacterConfig,
} from '../../src/config/characters';

export interface CharacterSelection {
  readonly id: string;
}

/** The explicit harness default: the Soldier (the continuity anchor). */
export const DEFAULT_CHARACTER_SELECTION: CharacterSelection = { id: DEFAULT_CHARACTER_ID };

/** Parse the `--character=<id>` flag. Throws on an unknown value so a typo'd
 *  character fails loudly instead of silently measuring the Soldier. */
export function parseCharacterFlag(raw: string): CharacterSelection {
  const token = raw.trim().toLowerCase();
  if (characterById(token) !== undefined) return { id: token };
  throw new Error(
    `--character: unknown value '${raw}' (choices: ${CHARACTERS.map((c) => c.id).join(', ')})`,
  );
}

export function characterLabel(selection: CharacterSelection): string {
  return selection.id;
}

/** Resolve a selection into the `RunConfig.character` def (loud on a miss —
 *  the daemonConfigFor contract). */
export function characterConfigFor(selection: CharacterSelection): CharacterConfig {
  const character = characterById(selection.id);
  if (character === undefined) {
    throw new Error(`characterConfigFor: unknown character id '${selection.id}'`);
  }
  return character;
}
