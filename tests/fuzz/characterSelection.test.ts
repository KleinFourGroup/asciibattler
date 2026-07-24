import { describe, it, expect } from 'vitest';
import {
  parseCharacterFlag,
  characterConfigFor,
  characterLabel,
  DEFAULT_CHARACTER_SELECTION,
} from './characterSelection';
import { CHARACTERS, characterById, DEFAULT_CHARACTER_ID } from '../../src/config/characters';

describe('parseCharacterFlag (63d)', () => {
  it('parses every catalog id (case/space tolerant)', () => {
    for (const c of CHARACTERS) {
      expect(parseCharacterFlag(c.id)).toEqual({ id: c.id });
      expect(parseCharacterFlag(` ${c.id.toUpperCase()} `)).toEqual({ id: c.id });
    }
  });

  it('throws on an unknown id (a typo must not silently measure the Soldier)', () => {
    expect(() => parseCharacterFlag('warlord')).toThrow(/unknown value/);
  });
});

describe('characterConfigFor', () => {
  it('resolves each selection to the catalog entry, by reference', () => {
    for (const c of CHARACTERS) {
      expect(characterConfigFor({ id: c.id })).toBe(characterById(c.id));
    }
  });

  it('throws on an unknown id', () => {
    expect(() => characterConfigFor({ id: 'warlord' })).toThrow(/unknown character id/);
  });

  it('the default selection is the explicit Soldier', () => {
    expect(DEFAULT_CHARACTER_SELECTION).toEqual({ id: DEFAULT_CHARACTER_ID });
    expect(characterConfigFor(DEFAULT_CHARACTER_SELECTION).id).toBe('soldier');
  });
});

describe('characterLabel', () => {
  it('labels by id', () => {
    expect(characterLabel({ id: 'gambler' })).toBe('gambler');
  });
});
