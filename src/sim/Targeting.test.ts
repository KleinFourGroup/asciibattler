import { describe, it, expect } from 'vitest';
import { findTarget } from './Targeting';
import { World } from './World';
import { Unit, type Team, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import type { GameEvents } from '../core/events';
import type { GridCoord } from '../core/types';

describe('Targeting / findTarget', () => {
  it('returns null when there are no enemies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'player', x: 5, y: 5 },
    ]);
    expect(findTarget(units[0]!, world)).toBeNull();
  });

  it('picks the nearest enemy by Chebyshev distance (not Euclidean)', () => {
    // From (0,0): candidate A at (3,3) is Chebyshev 3, Euclidean ~4.24;
    // candidate B at (0,4) is Chebyshev 4, Euclidean 4. Chebyshev winner is A.
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 3, y: 3 },
      { id: 3, team: 'enemy', x: 0, y: 4 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(2);
  });

  it('breaks distance ties by lowest currentHp', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 5, y: 5 },
      { id: 2, team: 'enemy', x: 6, y: 6, currentHp: 30 },
      { id: 3, team: 'enemy', x: 6, y: 4, currentHp: 10 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('breaks distance+HP ties by lowest id', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 5, y: 5 },
      { id: 7, team: 'enemy', x: 6, y: 6, currentHp: 20 },
      { id: 3, team: 'enemy', x: 4, y: 4, currentHp: 20 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('skips dead enemies (currentHp <= 0)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 5, y: 5 },
      { id: 2, team: 'enemy', x: 6, y: 5, currentHp: 0 },
      { id: 3, team: 'enemy', x: 8, y: 5, currentHp: 25 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('skips same-team units', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'player', x: 1, y: 1 },
      { id: 3, team: 'enemy', x: 5, y: 5 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('skips neutral units (walls, env entities) even when closer than enemies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'neutral', x: 1, y: 1 }, // closer, but inert
      { id: 3, team: 'enemy', x: 5, y: 5 },
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('returns null when only neutrals are present', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'neutral', x: 1, y: 1 },
      { id: 3, team: 'neutral', x: 2, y: 2 },
    ]);
    expect(findTarget(units[0]!, world)).toBeNull();
  });
});

/**
 * Build a World seeded with hand-placed units. We bypass spawnUnit because
 * Targeting tests want precise ids and HPs without rolling templates.
 */
interface UnitSpec {
  id: number;
  team: Team;
  x: number;
  y: number;
  currentHp?: number;
}

function scene(specs: UnitSpec[]): { world: World; units: Unit[] } {
  const world = new World(new EventBus<GameEvents>(), new RNG(1));
  const stats: UnitStats = {
    maxHp: 50,
    attackDamage: 10,
    attackRange: 1,
    attackCooldownTicks: 8,
    moveCooldownTicks: 5,
  };
  const units = specs.map((s) => {
    const u = new Unit({
      id: s.id,
      team: s.team,
      glyph: 'M',
      stats,
      position: { x: s.x, y: s.y } satisfies GridCoord,
    });
    if (s.currentHp !== undefined) u.currentHp = s.currentHp;
    world.units.push(u);
    return u;
  });
  return { world, units };
}
