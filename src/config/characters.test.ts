import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  CHARACTER_IDS,
  CharactersSchema,
  DEFAULT_CHARACTER_ID,
  assertDefaultCharacter,
  characterById,
  normalizeCharacter,
} from './characters';
import { UNIT_DEFS } from './units';
import { daemonById } from './daemons';
import { DRAFTABLE_ARCHETYPES } from '../sim/archetypes';

describe('the shipped character catalog', () => {
  it('parses to exactly the three kickoff characters, in file order', () => {
    expect(CHARACTER_IDS).toEqual(['soldier', 'priest', 'gambler']);
  });

  it('carries the default character, resolvable by id', () => {
    expect(characterById(DEFAULT_CHARACTER_ID)).toBeDefined();
    expect(characterById(DEFAULT_CHARACTER_ID)?.id).toBe('soldier');
  });

  it('returns undefined on an unknown id (callers decide throw vs skip)', () => {
    expect(characterById('no-such-character')).toBeUndefined();
  });

  it('references only real combatant archetypes and real daemons', () => {
    for (const c of CHARACTERS) {
      for (const a of [...c.roster, ...c.blacklist, ...Object.keys(c.weightOverrides)]) {
        expect(a in UNIT_DEFS, `character '${c.id}' references '${a}'`).toBe(true);
      }
      expect(daemonById(c.daemon), `character '${c.id}' daemon '${c.daemon}'`).toBeDefined();
    }
  });

  it('keeps blacklists disjoint from weight overrides', () => {
    for (const c of CHARACTERS) {
      for (const a of Object.keys(c.weightOverrides)) {
        expect(c.blacklist).not.toContain(a);
      }
    }
  });

  it('only blacklists archetypes the global pool would otherwise offer', () => {
    // An entry already excluded by `draftable:false` would be dead config —
    // the character layer ADDS exclusions on top of the global set.
    for (const c of CHARACTERS) {
      for (const a of c.blacklist) {
        expect(DRAFTABLE_ARCHETYPES, `character '${c.id}' blacklists '${a}'`).toContain(a);
      }
    }
  });
});

describe('the spec-authored content contract', () => {
  const counts = (roster: readonly string[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const a of roster) out[a] = (out[a] ?? 0) + 1;
    return out;
  };

  it('the Soldier is the current default company under Mars, unmodified pools', () => {
    const soldier = characterById('soldier')!;
    expect(counts(soldier.roster)).toEqual({ mercenary: 6, archer: 4 });
    expect(soldier.daemon).toBe('mars');
    expect(soldier.blacklist).toEqual([]);
    expect(soldier.weightOverrides).toEqual({});
  });

  it('the Priest swaps an archer for a healer under Minerva, shunning shaman + rare mages', () => {
    const priest = characterById('priest')!;
    expect(counts(priest.roster)).toEqual({ mercenary: 6, archer: 3, healer: 1 });
    expect(priest.daemon).toBe('minerva');
    expect(priest.blacklist).toEqual(['shaman']);
    expect(priest.weightOverrides).toEqual({ mage: 0.25 });
  });

  it('the Gambler swaps two mercenaries for a ronin + a rogue under Janus, rogue-heavy pools', () => {
    const gambler = characterById('gambler')!;
    expect(counts(gambler.roster)).toEqual({ mercenary: 4, ronin: 1, rogue: 1, archer: 4 });
    expect(gambler.daemon).toBe('janus');
    expect(gambler.blacklist).toEqual([]);
    expect(gambler.weightOverrides).toEqual({ rogue: 3 });
  });
});

describe('CharactersSchema legality (synthetic configs)', () => {
  const valid = {
    id: 'test',
    name: 'Test',
    description: 'A synthetic character.',
    roster: ['mercenary'],
    daemon: 'mars',
  };
  const parse = (characters: unknown[]) => CharactersSchema.safeParse({ characters });

  it('accepts a minimal character (blacklist / weightOverrides optional)', () => {
    expect(parse([valid]).success).toBe(true);
  });

  it('rejects an unknown roster archetype', () => {
    expect(parse([{ ...valid, roster: ['no-such-unit'] }]).success).toBe(false);
  });

  it('rejects an empty roster', () => {
    expect(parse([{ ...valid, roster: [] }]).success).toBe(false);
  });

  it('rejects an unknown daemon id', () => {
    expect(parse([{ ...valid, daemon: 'no-such-idol' }]).success).toBe(false);
  });

  it('rejects an unknown blacklist entry', () => {
    expect(parse([{ ...valid, blacklist: ['no-such-unit'] }]).success).toBe(false);
  });

  it('rejects an unknown weight-override key', () => {
    expect(parse([{ ...valid, weightOverrides: { 'no-such-unit': 2 } }]).success).toBe(false);
  });

  it('rejects a blacklisted archetype that also carries an override', () => {
    expect(
      parse([{ ...valid, blacklist: ['rogue'], weightOverrides: { rogue: 2 } }]).success,
    ).toBe(false);
  });

  it('rejects non-positive weights (weight 0 is spelled blacklist)', () => {
    expect(parse([{ ...valid, weightOverrides: { rogue: 0 } }]).success).toBe(false);
    expect(parse([{ ...valid, weightOverrides: { rogue: -1 } }]).success).toBe(false);
  });

  it('rejects duplicate character ids', () => {
    expect(parse([valid, { ...valid, name: 'Test Two' }]).success).toBe(false);
  });

  it('accepts fractional weights (the Priest mage 0.25 shape)', () => {
    expect(parse([{ ...valid, weightOverrides: { mage: 0.25 } }]).success).toBe(true);
  });
});

describe('normalization + the boot assert', () => {
  it('normalizes absent collections to empty (exact-optional discipline)', () => {
    const parsed = CharactersSchema.parse({
      characters: [
        {
          id: 'test',
          name: 'Test',
          description: 'A synthetic character.',
          roster: ['mercenary'],
          daemon: 'mars',
        },
      ],
    });
    const normalized = normalizeCharacter(parsed.characters[0]!);
    expect(normalized.blacklist).toEqual([]);
    expect(normalized.weightOverrides).toEqual({});
  });

  it('assertDefaultCharacter throws when soldier is missing', () => {
    const notSoldier = CHARACTERS.filter((c) => c.id !== DEFAULT_CHARACTER_ID);
    expect(() => assertDefaultCharacter(notSoldier)).toThrow(/soldier/);
    expect(() => assertDefaultCharacter(CHARACTERS)).not.toThrow();
  });
});
