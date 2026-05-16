import { describe, it, expect } from 'vitest';
import { Unit } from './Unit';

describe('Unit', () => {
  it('initializes currentHp to stats.maxHp', () => {
    const u = new Unit({
      id: 7,
      team: 'player',
      glyph: 'M',
      stats: {
        maxHp: 50,
        attackDamage: 10,
        attackRange: 1,
        attackCooldownTicks: 8,
        moveCooldownTicks: 5,
      },
      position: { x: 3, y: 4 },
    });
    expect(u.id).toBe(7);
    expect(u.team).toBe('player');
    expect(u.glyph).toBe('M');
    expect(u.currentHp).toBe(50);
    expect(u.position).toEqual({ x: 3, y: 4 });
    expect(u.behaviors).toEqual([]);
  });
});
