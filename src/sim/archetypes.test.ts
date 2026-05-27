import { describe, it, expect } from 'vitest';
import {
  rollUnit,
  glyphForArchetype,
  attackRangeForArchetype,
  ARCHETYPE_CONFIG,
} from './archetypes';
import { RNG } from '../core/RNG';

describe('archetypes / rollUnit (E1: returns baseStats verbatim, no rolls)', () => {
  it('produces a melee template equal to the configured baseStats', () => {
    const rng = new RNG(1);
    const expected = ARCHETYPE_CONFIG.melee.baseStats;

    for (let i = 0; i < 5; i++) {
      const t = rollUnit('melee', rng);
      expect(t.archetype).toBe('melee');
      expect(t.stats).toEqual(expected);
    }
  });

  it('produces a ranged template equal to the configured baseStats', () => {
    const rng = new RNG(1);
    const expected = ARCHETYPE_CONFIG.ranged.baseStats;
    const t = rollUnit('ranged', rng);
    expect(t.archetype).toBe('ranged');
    expect(t.stats).toEqual(expected);
  });

  it('same seed → same template (trivially: no RNG draws today)', () => {
    const a = rollUnit('melee', new RNG(42));
    const b = rollUnit('melee', new RNG(42));
    expect(a).toEqual(b);
  });

  it('different seeds produce IDENTICAL templates today (rolls land in E3)', () => {
    // Documents the E1 contract: stats come straight from the archetype
    // config, no per-stat randomization yet. E3's `simulateLevelUps`
    // will restore the "different seed → different stats" property.
    const a = rollUnit('melee', new RNG(1));
    const b = rollUnit('melee', new RNG(2));
    expect(a).toEqual(b);
  });

  it('melee and ranged templates have non-overlapping stat profiles', () => {
    // Smoke check that the JSON wasn't accidentally symmetric.
    const m = rollUnit('melee', new RNG(0));
    const r = rollUnit('ranged', new RNG(0));
    expect(m.stats.strength).toBeGreaterThan(r.stats.strength);
    expect(r.stats.ranged).toBeGreaterThan(m.stats.ranged);
  });
});

describe('archetypes / lookups', () => {
  it('glyphForArchetype maps to M / a', () => {
    expect(glyphForArchetype('melee')).toBe('M');
    expect(glyphForArchetype('ranged')).toBe('a');
  });

  it('attackRangeForArchetype matches config (melee=1, ranged>1)', () => {
    expect(attackRangeForArchetype('melee')).toBe(1);
    expect(attackRangeForArchetype('ranged')).toBeGreaterThan(1);
  });
});
