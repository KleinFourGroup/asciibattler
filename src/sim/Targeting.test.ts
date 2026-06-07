import { describe, it, expect } from 'vitest';
import { findTarget, updateTarget, currentTarget } from './Targeting';
import { World } from './World';
import { Unit, type Team, type UnitArchetype, type UnitStats } from './Unit';
import { EventBus } from '../core/EventBus';
import { RNG } from '../core/RNG';
import { deriveStats } from './stats';
import { ARCHETYPE_CONFIG } from './archetypes';
import { SIM } from '../config/sim';
import { spawnWall } from './environment';
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

describe('Targeting / target stickiness (E5)', () => {
  it('currentTarget falls back to the nearest enemy when uncommitted (targetId null)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 },
      { id: 3, team: 'enemy', x: 6, y: 0 },
    ]);
    expect(units[0]!.targetId).toBeNull();
    expect(currentTarget(units[0]!, world)?.id).toBe(2);
  });

  it('currentTarget honors a committed target even when it is not the nearest', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 }, // nearest
      { id: 3, team: 'enemy', x: 6, y: 0 }, // committed
    ]);
    units[0]!.targetId = 3;
    expect(currentTarget(units[0]!, world)?.id).toBe(3);
  });

  it('currentTarget falls back to nearest when the committed target is dead', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 },
      { id: 3, team: 'enemy', x: 6, y: 0, currentHp: 0 }, // committed but dead
    ]);
    units[0]!.targetId = 3;
    expect(currentTarget(units[0]!, world)?.id).toBe(2);
  });

  it('(a) updateTarget commits to the nearest enemy, then re-picks when it dies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 2, y: 0 },
      { id: 3, team: 'enemy', x: 5, y: 0 },
    ]);
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);

    units[1]!.currentHp = 0; // kill the committed target
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
  });

  it('(b) stays locked when a rival is only slightly closer (< ratio)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 6, y: 0 }, // committed (chebyshev 6)
      { id: 3, team: 'enemy', x: 5, y: 0 }, // nearer, but only 6/5 = 1.2x < 1.5x
    ]);
    units[0]!.targetId = 2;
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);
  });

  it('(b) switches when a rival is at least ratio-times closer', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 },
      { id: 2, team: 'enemy', x: 9, y: 0 }, // committed (chebyshev 9)
      { id: 3, team: 'enemy', x: 5, y: 0 }, // 9/5 = 1.8x >= 1.5x → switch
    ]);
    units[0]!.targetId = 2;
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
  });

  it('(c) ranged unit drops a target hidden behind a wall after the LOS timeout', () => {
    const { world, units } = scene([
      // chebyshev 4, behind a wall — the slightly-nearer rival (3) is NOT
      // 1.5x closer (3*1.5=4.5 > 4) so rule (b) never fires; only the LOS
      // timeout breaks the lock.
      { id: 1, team: 'player', x: 0, y: 0, archetype: 'ranged' },
      { id: 2, team: 'enemy', x: 4, y: 0 }, // committed, will be occluded
      { id: 3, team: 'enemy', x: 3, y: 3 }, // visible alternative, chebyshev 3
    ]);
    spawnWall(world, { x: 2, y: 0 }); // occludes the line to (4,0)
    units[0]!.targetId = 2;

    // Below the timeout: stays locked on the hidden target.
    for (let i = 0; i < SIM.rangedRetargetLosTicks - 1; i++) updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);

    // The tick that hits the timeout re-picks the nearest (visible) enemy.
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
  });

  it('(c) is melee-exempt: a melee unit keeps a hidden, non-much-closer target', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0 }, // melee (default)
      { id: 2, team: 'enemy', x: 4, y: 0 },
      { id: 3, team: 'enemy', x: 3, y: 3 },
    ]);
    spawnWall(world, { x: 2, y: 0 });
    units[0]!.targetId = 2;
    for (let i = 0; i < SIM.rangedRetargetLosTicks + 2; i++) updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);
  });
});

describe('Targeting / weakest strategy (rogue)', () => {
  it('picks the lowest max-HP enemy over a nearer, tankier one', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 2, team: 'enemy', x: 1, y: 0, maxHp: 30 }, // nearest, but tanky
      { id: 3, team: 'enemy', x: 5, y: 0, maxHp: 10 }, // far, but squishy
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(3);
  });

  it('breaks max-HP ties by Chebyshev distance', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 5, team: 'enemy', x: 4, y: 0, maxHp: 12 }, // farther
      { id: 6, team: 'enemy', x: 2, y: 0, maxHp: 12 }, // nearer → wins
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(6);
  });

  it('breaks max-HP + distance ties by lowest id', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 9, team: 'enemy', x: 2, y: 0, maxHp: 12 }, // chebyshev 2
      { id: 4, team: 'enemy', x: 0, y: 2, maxHp: 12 }, // chebyshev 2, lower id
    ]);
    expect(findTarget(units[0]!, world)?.id).toBe(4);
  });

  it('holds its committed mark even when a weaker enemy appears (no thrash)', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 2, team: 'enemy', x: 3, y: 0, maxHp: 15 }, // committed mark, alive
      { id: 3, team: 'enemy', x: 6, y: 0, maxHp: 5 }, // weaker, but appears later
    ]);
    units[0]!.targetId = 2;
    // The fresh weakest pick is now id 3, but the live mark is committed and
    // `weakest.shouldRetarget` is false → it never switches off a live target.
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);
  });

  it('re-picks the next weakest enemy when its mark dies', () => {
    const { world, units } = scene([
      { id: 1, team: 'player', x: 0, y: 0, targeting: 'weakest' },
      { id: 2, team: 'enemy', x: 3, y: 0, maxHp: 8 }, // weakest
      { id: 3, team: 'enemy', x: 6, y: 0, maxHp: 20 },
    ]);
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(2);

    units[1]!.currentHp = 0; // mark dies → rule (a) re-picks
    updateTarget(units[0]!, world);
    expect(units[0]!.targetId).toBe(3);
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
  /** Defaults to melee for combatants, environment for neutrals. */
  archetype?: UnitArchetype;
  /** Target-selection strategy; defaults to the Unit ctor default (nearest). */
  targeting?: string;
  /** Override `derived.maxHp` for this unit — lets the `weakest` tests vary
   *  structural HP per candidate (also sets `currentHp` via the ctor). */
  maxHp?: number;
}

function scene(specs: UnitSpec[]): { world: World; units: Unit[] } {
  const world = new World(new EventBus<GameEvents>(), new RNG(1));
  // E1: melee baseline. luck=0 keeps the crit roll deterministically
  // off, though Targeting never ticks the world so it can't matter here.
  const stats: UnitStats = { ...ARCHETYPE_CONFIG.melee.baseStats, luck: 0 };
  const derived = deriveStats(stats, 1);
  const units = specs.map((s) => {
    const d = s.maxHp !== undefined ? { ...derived, maxHp: s.maxHp } : derived;
    const u = new Unit({
      id: s.id,
      team: s.team,
      archetype: s.archetype ?? (s.team === 'neutral' ? 'environment' : 'melee'),
      glyph: 'M',
      stats,
      derived: d,
      position: { x: s.x, y: s.y } satisfies GridCoord,
      ...(s.targeting !== undefined ? { targeting: s.targeting } : {}),
    });
    if (s.currentHp !== undefined) u.currentHp = s.currentHp;
    world.units.push(u);
    return u;
  });
  return { world, units };
}
