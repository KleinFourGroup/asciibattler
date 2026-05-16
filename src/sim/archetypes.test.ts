import { describe, it, expect } from 'vitest';
import { rollUnit, glyphForArchetype, ARCHETYPE_BOUNDS } from './archetypes';
import { RNG } from '../core/RNG';
import { secondsToTicks } from '../config';

describe('archetypes / rollUnit', () => {
  it('produces a melee template with stats inside the documented bounds', () => {
    const rng = new RNG(1);
    const b = ARCHETYPE_BOUNDS.melee;

    for (let i = 0; i < 100; i++) {
      const t = rollUnit('melee', rng);
      expect(t.archetype).toBe('melee');
      expect(t.stats.maxHp).toBeGreaterThanOrEqual(b.hp[0]);
      expect(t.stats.maxHp).toBeLessThanOrEqual(b.hp[1]);
      expect(t.stats.attackDamage).toBeGreaterThanOrEqual(b.attackDamage[0]);
      expect(t.stats.attackDamage).toBeLessThanOrEqual(b.attackDamage[1]);
      expect(t.stats.attackRange).toBe(b.attackRange);
      expect(t.stats.attackCooldownTicks).toBeGreaterThanOrEqual(
        secondsToTicks(b.attackCooldownSeconds[0]),
      );
      expect(t.stats.attackCooldownTicks).toBeLessThanOrEqual(
        secondsToTicks(b.attackCooldownSeconds[1]),
      );
      expect(t.stats.moveCooldownTicks).toBeGreaterThanOrEqual(
        secondsToTicks(b.moveCooldownSeconds[0]),
      );
      expect(t.stats.moveCooldownTicks).toBeLessThanOrEqual(
        secondsToTicks(b.moveCooldownSeconds[1]),
      );
    }
  });

  it('produces a ranged template with attackRange > 1', () => {
    const t = rollUnit('ranged', new RNG(1));
    expect(t.archetype).toBe('ranged');
    expect(t.stats.attackRange).toBeGreaterThan(1);
  });

  it('is deterministic for the same seed', () => {
    const a = rollUnit('melee', new RNG(42));
    const b = rollUnit('melee', new RNG(42));
    expect(a).toEqual(b);
  });

  it('produces different rolls for different seeds (very high probability)', () => {
    const a = rollUnit('melee', new RNG(1));
    const b = rollUnit('melee', new RNG(2));
    expect(a).not.toEqual(b);
  });
});

describe('archetypes / glyphForArchetype', () => {
  it('maps melee to M and ranged to a', () => {
    expect(glyphForArchetype('melee')).toBe('M');
    expect(glyphForArchetype('ranged')).toBe('a');
  });
});
