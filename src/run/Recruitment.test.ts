import { describe, it, expect } from 'vitest';
import { RNG } from '../core/RNG';
import { rollOffer } from './Recruitment';

describe('rollOffer', () => {
  it('defaults to 3 units', () => {
    const offer = rollOffer(new RNG(1));
    expect(offer).toHaveLength(3);
  });

  it('respects an explicit size', () => {
    expect(rollOffer(new RNG(1), 2)).toHaveLength(2);
    expect(rollOffer(new RNG(1), 5)).toHaveLength(5);
  });

  it('produces only known archetypes', () => {
    const offer = rollOffer(new RNG(1), 20);
    for (const u of offer) {
      expect(['melee', 'ranged']).toContain(u.archetype);
    }
  });

  it('stat rolls land within archetype bounds', () => {
    const offer = rollOffer(new RNG(1), 50);
    for (const u of offer) {
      if (u.archetype === 'melee') {
        expect(u.stats.maxHp).toBeGreaterThanOrEqual(40);
        expect(u.stats.maxHp).toBeLessThanOrEqual(60);
        expect(u.stats.attackRange).toBe(1);
      } else {
        expect(u.stats.maxHp).toBeGreaterThanOrEqual(20);
        expect(u.stats.maxHp).toBeLessThanOrEqual(30);
        expect(u.stats.attackRange).toBe(3);
      }
    }
  });

  it('guarantees at least one melee and one ranged per offer (size >= 2)', () => {
    for (let s = 0; s < 50; s++) {
      const offer = rollOffer(new RNG(s));
      const archetypes = new Set(offer.map((u) => u.archetype));
      expect(archetypes.has('melee')).toBe(true);
      expect(archetypes.has('ranged')).toBe(true);
    }
  });

  it('size=1 falls back to a single random archetype', () => {
    const offer = rollOffer(new RNG(1), 1);
    expect(offer).toHaveLength(1);
    expect(['melee', 'ranged']).toContain(offer[0]!.archetype);
  });

  it('size=2 always produces exactly one of each archetype', () => {
    for (let s = 0; s < 20; s++) {
      const offer = rollOffer(new RNG(s), 2);
      const archetypes = offer.map((u) => u.archetype).sort();
      expect(archetypes).toEqual(['melee', 'ranged']);
    }
  });

  it('same seed → same offer', () => {
    const a = rollOffer(new RNG(42));
    const b = rollOffer(new RNG(42));
    expect(a).toEqual(b);
  });
});
