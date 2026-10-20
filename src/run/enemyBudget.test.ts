import { describe, it, expect } from 'vitest';
import { avgTeamLevel } from './enemyBudget';
import { ARCHETYPE_CONFIG } from '../sim/archetypes';
import type { UnitTemplate } from '../sim/Unit';

/** Build a fake roster at the given per-unit levels (stats = baseStats; only
 *  `level` matters to the mean). */
function roster(levels: number[], archetype: 'mercenary' | 'archer' = 'mercenary'): UnitTemplate[] {
  return levels.map((level) => ({
    archetype,
    level,
    stats: { ...ARCHETYPE_CONFIG[archetype].baseStats },
    xp: 0,
  }));
}

describe('avgTeamLevel (recruit basis)', () => {
  it('is the MEAN of roster unit levels', () => {
    expect(avgTeamLevel(roster([2, 4]))).toBe(3);
    expect(avgTeamLevel(roster([1, 1, 1, 1, 6]))).toBe(2);
  });

  it('is 1 for an empty roster (a recruit onto nothing comes in at 1 + bonus)', () => {
    expect(avgTeamLevel([])).toBe(1);
  });
});

