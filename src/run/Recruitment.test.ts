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

  it('eventually rolls both archetypes across many offers', () => {
    const offer = rollOffer(new RNG(1), 50);
    const archetypes = new Set(offer.map((u) => u.archetype));
    expect(archetypes).toEqual(new Set(['melee', 'ranged']));
  });

  it('same seed → same offer', () => {
    const a = rollOffer(new RNG(42));
    const b = rollOffer(new RNG(42));
    expect(a).toEqual(b);
  });
});
