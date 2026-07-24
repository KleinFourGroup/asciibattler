/**
 * 63f — character editor formatter fidelity (the archetype/encounter-editor
 * pattern). The editor's Save (and Copy / Download) write the file through
 * `formatCharactersJson`; these pin two guarantees:
 *
 *  1. Re-emitting the committed catalog reproduces `config/characters.json`
 *     byte-for-byte (modulo line-ending / trailing whitespace) — so a Save
 *     with no edits is a no-op diff, and an edited Save touches only the
 *     lines the author changed.
 *  2. The formatted output round-trips back through the REAL game schema
 *     (`CharactersSchema` → `normalizeCharacter`) to a value deep-equal to
 *     the source — the formatter drops/reorders nothing the loader cares
 *     about.
 *
 * Both derive from the live catalog + schema (never hardcoded character
 * values). A third case exercises the one shape the shipped catalog doesn't
 * yet author (a multi-entry blacklist alongside multi-entry overrides), so
 * the inline-blacklist / expanded-overrides split is covered before a future
 * character needs it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  CharactersSchema,
  normalizeCharacter,
} from '../../src/config/characters';
import { formatCharactersJson } from '../../tools/character-editor/format';

/** Normalize line endings + trailing blank space so the assertion isn't
 *  hostage to how git checked the file out. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

describe('formatCharactersJson', () => {
  it('reproduces the committed config/characters.json verbatim', () => {
    const onDisk = readFileSync(
      fileURLToPath(new URL('../../config/characters.json', import.meta.url)),
      'utf8',
    );
    expect(norm(formatCharactersJson(CHARACTERS))).toBe(norm(onDisk));
  });

  it('round-trips through the game schema to a deep-equal catalog', () => {
    const reparsed = CharactersSchema.parse(JSON.parse(formatCharactersJson(CHARACTERS)));
    expect(reparsed.characters.map(normalizeCharacter)).toEqual(CHARACTERS);
  });

  it('formats a multi-entry blacklist + overrides character, round-tripping deep-equal', () => {
    // Parse the fixture through the schema first so it can't drift from the
    // real shape (the encounter-editor fixture discipline). `soldier` keeps
    // the id so `assertDefaultCharacter`-style constraints stay representable;
    // the blacklist/overrides pair is disjoint per the parse-time guard.
    const fixture = CharactersSchema.parse({
      characters: [
        {
          id: 'soldier',
          name: 'Fixture',
          description: 'Exercises the multi-entry blacklist + overrides paths.',
          roster: ['mercenary', 'archer'],
          daemon: 'mars',
          blacklist: ['shaman', 'rogue'],
          weightOverrides: { mage: 0.25, healer: 2 },
        },
      ],
    }).characters.map(normalizeCharacter);
    const reparsed = CharactersSchema.parse(JSON.parse(formatCharactersJson(fixture)));
    expect(reparsed.characters.map(normalizeCharacter)).toEqual(fixture);
    expect(formatCharactersJson(fixture)).toContain('"blacklist": ["shaman", "rogue"]');
  });
});
