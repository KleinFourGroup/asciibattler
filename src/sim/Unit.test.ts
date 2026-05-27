import { describe, it, expect } from 'vitest';
import { Unit } from './Unit';
import { deriveStats } from './stats';

describe('Unit', () => {
  it('initializes currentHp to derived.maxHp', () => {
    const stats = {
      constitution: 20,
      strength: 8,
      ranged: 0,
      magic: 0,
      luck: 3,
      speed: 5,
      endurance: 6,
    };
    const derived = deriveStats(stats, 1);
    const u = new Unit({
      id: 7,
      team: 'player',
      archetype: 'melee',
      glyph: 'M',
      stats,
      derived,
      position: { x: 3, y: 4 },
    });
    expect(u.id).toBe(7);
    expect(u.team).toBe('player');
    expect(u.archetype).toBe('melee');
    expect(u.glyph).toBe('M');
    expect(u.currentHp).toBe(derived.maxHp);
    expect(u.position).toEqual({ x: 3, y: 4 });
    expect(u.behaviors).toEqual([]);
  });
});
