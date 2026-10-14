import { describe, it, expect } from 'vitest';
import { focusTileDirective } from './focusTile';
import { Unit, type Team } from './Unit';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { OBJECTIVE } from '../config/objective';

/**
 * O3 — a unit's directive under a TILE focus (mechanic tests, explicit
 * literals): beeline while farther than the leash, engage around the tile
 * within it.
 */

const TILE = { x: 10, y: 10 };

function mkUnit(id: number, team: Team, x: number, y: number): Unit {
  const stats = { ...ARCHETYPE_CONFIG.mercenary.baseStats, luck: 0 };
  return new Unit({
    id,
    team,
    archetype: 'mercenary',
    glyph: 'M',
    stats,
    derived: deriveStats(stats, 1),
    position: { x, y },
  });
}

describe('focusTile directive', () => {
  const leash = OBJECTIVE.rangedLeashCells;

  it('is pursue while farther than the leash from the tile', () => {
    const far = mkUnit(1, 'player', TILE.x - (leash + 1), TILE.y); // chebyshev leash+1
    expect(focusTileDirective(far, TILE)).toBe('pursue');
  });

  it('flips to engageLocal once within the leash of the tile', () => {
    const atLeash = mkUnit(1, 'player', TILE.x - leash, TILE.y); // chebyshev == leash
    const onTile = mkUnit(2, 'player', TILE.x, TILE.y); // chebyshev 0
    expect(focusTileDirective(atLeash, TILE)).toBe('engageLocal');
    expect(focusTileDirective(onTile, TILE)).toBe('engageLocal');
  });
});
